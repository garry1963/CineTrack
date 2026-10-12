import React, { useState, useEffect, useRef } from 'react';
import { useCineTrack } from '../context/CineTrackContext';
import { ViewState, CustomList } from '../types';
import { getPosterUrl, formatRuntime } from '../lib/utils';
import { 
  Bookmark, Star, Trash2, Plus, X, List, Film, Tv, Heart, ClipboardList, Check, Sparkles,
  ArrowUpDown, GripVertical, ListOrdered, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, 
  ChevronsLeft, ChevronsRight, SlidersHorizontal, RotateCcw
} from 'lucide-react';
import { tmdb } from '../services/tmdb';

interface WatchlistViewProps {
  currentView?: ViewState;
  onNavigate: (view: ViewState) => void;
}

export default function WatchlistView({ currentView, onNavigate }: WatchlistViewProps) {
  const { 
    watchlist, 
    favorites, 
    customLists, 
    settings,
    reorderCustomLists,
    removeFromWatchlist, 
    toggleFavorite,
    saveCustomList,
    deleteCustomList,
    addToWatchlist
  } = useCineTrack();

  const [activeTab, setActiveTab] = useState<'watchlist' | 'favorites' | 'custom_lists'>('watchlist');
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortOption, setSortOption] = useState<'added' | 'alpha'>('added');
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const currentList = customLists.find(l => l.id === activeListId);

  // Dynamic runtime cache for items that don't have stored runtime
  const [runtimesCache, setRuntimesCache] = useState<Record<number, number>>({});
  const [releaseDatesCache, setReleaseDatesCache] = useState<Record<number, string>>({});
  const [customListFilterType, setCustomListFilterType] = useState<'all' | 'movie' | 'tv'>('all');
  const [customListSortOption, setCustomListSortOption] = useState<'custom' | 'added' | 'alpha' | 'runtime' | 'release'>('custom');
  const [isCustomReorderingMode, setIsCustomReorderingMode] = useState<boolean>(true);
  const [draggedTmdbId, setDraggedTmdbId] = useState<number | null>(null);
  const [dragOverTmdbId, setDragOverTmdbId] = useState<number | null>(null);

  // Custom Lists Overview Sorting & Reordering State
  const [listsSortOption, setListsSortOption] = useState<'order' | 'alpha' | 'created' | 'count'>('order');
  const [isReorderingListsMode, setIsReorderingListsMode] = useState<boolean>(false);
  const [draggedListId, setDraggedListId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);

  const [bulkAddFeedback, setBulkAddFeedback] = useState<string | null>(null);
  const fetchedOrFetchingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let listToCheck: any[] = [];
    if (activeTab === 'watchlist') {
      listToCheck = watchlist;
    } else if (activeTab === 'favorites') {
      listToCheck = favorites;
    } else if (activeTab === 'custom_lists' && currentList) {
      listToCheck = currentList.items.map(item => ({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        runtime: item.runtime
      }));
    }

    const moviesNeedingRuntime = listToCheck.filter(
      item => item.mediaType === 'movie' && item.runtime === undefined && !fetchedOrFetchingRef.current.has(item.tmdbId)
    );

    if (moviesNeedingRuntime.length === 0) return;

    // Mark as fetching
    moviesNeedingRuntime.forEach(item => fetchedOrFetchingRef.current.add(item.tmdbId));

    let isMounted = true;
    async function fetchRuntimes() {
      // Fetch in chunks of 5 concurrently to maximize throughput without rate-limiting
      const chunkSize = 5;
      for (let i = 0; i < moviesNeedingRuntime.length; i += chunkSize) {
        if (!isMounted) break;
        const chunk = moviesNeedingRuntime.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              const details = await tmdb.getMovieDetails(item.tmdbId);
              if (details && isMounted) {
                const rt = details.runtime || 0;
                setRuntimesCache(prev => ({
                  ...prev,
                  [item.tmdbId]: rt
                }));
              }
            } catch (e) {
              console.log(`Failed to fetch runtime for movie ${item.tmdbId}:`, e);
              // Remove on failure to allow retry if needed
              fetchedOrFetchingRef.current.delete(item.tmdbId);
            }
          })
        );
      }
    }

    fetchRuntimes();
    return () => {
      isMounted = false;
    };
  }, [watchlist, favorites, activeTab, currentList]);

  // Dynamic fetcher for custom list items missing metadata (releaseDate, runtime)
  useEffect(() => {
    if (activeTab !== 'custom_lists' || !currentList) return;

    // Items that are movies and miss either runtime or releaseDate, or TV shows that miss releaseDate
    const itemsNeedingMetadata = currentList.items.filter(item => {
      const alreadyFetched = fetchedOrFetchingRef.current.has(item.tmdbId);
      if (alreadyFetched) return false;

      if (item.mediaType === 'movie') {
        const hasStoredRuntime = item.runtime !== undefined;
        const hasStoredReleaseDate = item.releaseDate !== undefined;
        const hasCachedRuntime = runtimesCache[item.tmdbId] !== undefined;
        const hasCachedReleaseDate = releaseDatesCache[item.tmdbId] !== undefined;
        return !(hasStoredRuntime && hasStoredReleaseDate) && !(hasCachedRuntime && hasCachedReleaseDate);
      } else {
        const hasStoredReleaseDate = item.releaseDate !== undefined;
        const hasCachedReleaseDate = releaseDatesCache[item.tmdbId] !== undefined;
        return !hasStoredReleaseDate && !hasCachedReleaseDate;
      }
    });

    if (itemsNeedingMetadata.length === 0) return;

    itemsNeedingMetadata.forEach(item => fetchedOrFetchingRef.current.add(item.tmdbId));

    let isMounted = true;
    async function fetchMetadata() {
      const chunkSize = 5;
      for (let i = 0; i < itemsNeedingMetadata.length; i += chunkSize) {
        if (!isMounted) break;
        const chunk = itemsNeedingMetadata.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              if (item.mediaType === 'movie') {
                const details = await tmdb.getMovieDetails(item.tmdbId);
                if (details && isMounted) {
                  const rt = details.runtime || 0;
                  const rd = details.release_date || '';
                  setRuntimesCache(prev => ({ ...prev, [item.tmdbId]: rt }));
                  setReleaseDatesCache(prev => ({ ...prev, [item.tmdbId]: rd }));
                }
              } else {
                const details = await tmdb.getShowDetails(item.tmdbId);
                if (details && isMounted) {
                  const rd = details.first_air_date || '';
                  setReleaseDatesCache(prev => ({ ...prev, [item.tmdbId]: rd }));
                }
              }
            } catch (e) {
              console.log(`Failed to fetch metadata for ${item.mediaType} ${item.tmdbId}:`, e);
              fetchedOrFetchingRef.current.delete(item.tmdbId);
            }
          })
        );
      }
    }

    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, [activeTab, currentList, runtimesCache, releaseDatesCache]);

  const handleAddAllMoviesToWatchlist = async () => {
    if (!currentList) return;
    const moviesInList = currentList.items.filter(item => item.mediaType === 'movie');
    if (moviesInList.length === 0) {
      setBulkAddFeedback("No movies found in this list to add.");
      setTimeout(() => setBulkAddFeedback(null), 3500);
      return;
    }

    let addedCount = 0;
    for (const item of moviesInList) {
      const alreadyInWatchlist = watchlist.some(
        w => w.tmdbId === item.tmdbId && w.mediaType === 'movie'
      );
      if (!alreadyInWatchlist) {
        await addToWatchlist({
          id: item.tmdbId,
          title: item.title,
          poster_path: item.posterPath,
          overview: '',
          vote_average: 0,
          vote_count: 0
        } as any, 'movie');
        addedCount++;
      }
    }
    setBulkAddFeedback(`Successfully added ${addedCount} movie(s) to your Movie Watchlist!`);
    setTimeout(() => setBulkAddFeedback(null), 4500);
  };

  const handleAddAllTVToWatchlist = async () => {
    if (!currentList) return;
    const tvInList = currentList.items.filter(item => item.mediaType === 'tv');
    if (tvInList.length === 0) {
      setBulkAddFeedback("No TV shows found in this list to add.");
      setTimeout(() => setBulkAddFeedback(null), 3500);
      return;
    }

    let addedCount = 0;
    for (const item of tvInList) {
      const alreadyInWatchlist = watchlist.some(
        w => w.tmdbId === item.tmdbId && w.mediaType === 'tv'
      );
      if (!alreadyInWatchlist) {
        await addToWatchlist({
          id: item.tmdbId,
          name: item.title,
          poster_path: item.posterPath,
          overview: '',
          vote_average: 0,
          vote_count: 0
        } as any, 'tv');
        addedCount++;
      }
    }
    setBulkAddFeedback(`Successfully added ${addedCount} TV show(s) to your TV Show Watchlist!`);
    setTimeout(() => setBulkAddFeedback(null), 4500);
  };

  // Sync state from currentView prop
  useEffect(() => {
    if (currentView && currentView.type === 'watchlist') {
      if (currentView.tab) {
        setActiveTab(currentView.tab);
      }
      if (currentView.listId !== undefined) {
        setActiveListId(currentView.listId);
      }
    }
  }, [currentView]);

  // Custom List State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');

  // Custom list item lookup search
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listSearchResults, setListSearchResults] = useState<any[]>([]);

  // Watchlist Items Filtering & Sorting
  const getProcessedItems = (items: any[]) => {
    let processed = [...items];
    if (filterType !== 'all') {
      processed = processed.filter(item => item.mediaType === filterType);
    }
    if (sortOption === 'alpha') {
      processed.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      processed.sort((a, b) => b.addedAt - a.addedAt);
    }
    return processed;
  };

  // Sync sorting preference when a custom list is loaded
  useEffect(() => {
    if (currentList) {
      if (currentList.sortMode) {
        setCustomListSortOption(currentList.sortMode);
      } else if (settings?.defaultCustomListSort) {
        setCustomListSortOption(settings.defaultCustomListSort);
      } else {
        setCustomListSortOption('custom');
      }
      setIsCustomReorderingMode(currentList.customSortingEnabled ?? (settings?.enableCustomListSorting !== false));
    }
  }, [activeListId, currentList?.id]);

  const getProcessedCustomListItems = (items: any[]) => {
    let processed = [...items];
    if (customListFilterType !== 'all') {
      processed = processed.filter(item => item.mediaType === customListFilterType);
    }

    if (customListSortOption === 'custom') {
      // In custom sorting mode, maintain exact list item order!
      return processed;
    } else if (customListSortOption === 'alpha') {
      processed.sort((a, b) => a.title.localeCompare(b.title));
    } else if (customListSortOption === 'runtime') {
      processed.sort((a, b) => {
        const rtA = a.runtime || runtimesCache[a.tmdbId] || 0;
        const rtB = b.runtime || runtimesCache[b.tmdbId] || 0;
        return rtB - rtA; // longest runtime first
      });
    } else if (customListSortOption === 'release') {
      processed.sort((a, b) => {
        const dateA = a.releaseDate || releaseDatesCache[a.tmdbId] || '';
        const dateB = b.releaseDate || releaseDatesCache[b.tmdbId] || '';
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB).getTime() - new Date(dateA).getTime(); // newest first
      });
    } else {
      // customListSortOption === 'added' or default
      processed.sort((a, b) => {
        const indexA = items.indexOf(a);
        const indexB = items.indexOf(b);
        const timeA = a.addedAt || indexA;
        const timeB = b.addedAt || indexB;
        return timeB - timeA; // newest added first
      });
    }
    return processed;
  };

  // Move individual item in custom list (arrows or top/bottom)
  const handleMoveCustomListItem = async (tmdbId: number, mediaType: 'movie' | 'tv', direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (!currentList) return;
    const items = [...currentList.items];
    const currentIndex = items.findIndex(i => i.tmdbId === tmdbId && i.mediaType === mediaType);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (direction === 'up') targetIndex = currentIndex - 1;
    else if (direction === 'down') targetIndex = currentIndex + 1;
    else if (direction === 'top') targetIndex = 0;
    else if (direction === 'bottom') targetIndex = items.length - 1;

    if (targetIndex < 0 || targetIndex >= items.length || targetIndex === currentIndex) return;

    const [movedItem] = items.splice(currentIndex, 1);
    items.splice(targetIndex, 0, movedItem);

    await saveCustomList({
      ...currentList,
      items,
      sortMode: 'custom',
      customSortingEnabled: true
    });
    setCustomListSortOption('custom');
    setBulkAddFeedback(`Updated position for "${movedItem.title}" (#${targetIndex + 1})`);
    setTimeout(() => setBulkAddFeedback(null), 2500);
  };

  // Drag and drop reordering of item in custom list
  const handleDropCustomListItem = async (sourceTmdbId: number, targetTmdbId: number) => {
    if (!currentList || sourceTmdbId === targetTmdbId) return;
    const items = [...currentList.items];
    const sourceIndex = items.findIndex(i => i.tmdbId === sourceTmdbId);
    const targetIndex = items.findIndex(i => i.tmdbId === targetTmdbId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedItem] = items.splice(sourceIndex, 1);
    items.splice(targetIndex, 0, movedItem);

    await saveCustomList({
      ...currentList,
      items,
      sortMode: 'custom',
      customSortingEnabled: true
    });
    setCustomListSortOption('custom');
    setDraggedTmdbId(null);
    setDragOverTmdbId(null);
    setBulkAddFeedback(`Moved "${movedItem.title}" to position #${targetIndex + 1}`);
    setTimeout(() => setBulkAddFeedback(null), 2500);
  };

  // Preset order initialization for custom list
  const handleApplyPresetOrder = async (mode: 'release_asc' | 'release_desc' | 'alpha_asc' | 'reverse') => {
    if (!currentList) return;
    let items = [...currentList.items];
    if (mode === 'release_asc') {
      items.sort((a, b) => {
        const dateA = a.releaseDate || releaseDatesCache[a.tmdbId] || '';
        const dateB = b.releaseDate || releaseDatesCache[b.tmdbId] || '';
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    } else if (mode === 'release_desc') {
      items.sort((a, b) => {
        const dateA = a.releaseDate || releaseDatesCache[a.tmdbId] || '';
        const dateB = b.releaseDate || releaseDatesCache[b.tmdbId] || '';
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    } else if (mode === 'alpha_asc') {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (mode === 'reverse') {
      items.reverse();
    }

    await saveCustomList({
      ...currentList,
      items,
      sortMode: 'custom',
      customSortingEnabled: true
    });
    setCustomListSortOption('custom');
    setBulkAddFeedback("Custom order updated and saved!");
    setTimeout(() => setBulkAddFeedback(null), 3000);
  };

  // Toggle custom sorting mode on the list
  const handleToggleCustomSortingOnList = async () => {
    if (!currentList) return;
    const nextEnabled = !isCustomReorderingMode;
    setIsCustomReorderingMode(nextEnabled);
    if (nextEnabled) {
      setCustomListSortOption('custom');
    }
    await saveCustomList({
      ...currentList,
      customSortingEnabled: nextEnabled,
      sortMode: nextEnabled ? 'custom' : customListSortOption
    });
    setBulkAddFeedback(nextEnabled ? "Custom sorting enabled for this list" : "Custom sorting disabled");
    setTimeout(() => setBulkAddFeedback(null), 2500);
  };

  // Custom Lists Overview Sorting
  const getProcessedCustomLists = () => {
    let lists = [...customLists];
    if (listsSortOption === 'alpha') {
      lists.sort((a, b) => a.name.localeCompare(b.name));
    } else if (listsSortOption === 'created') {
      lists.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (listsSortOption === 'count') {
      lists.sort((a, b) => b.items.length - a.items.length);
    } else {
      lists.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return lists;
  };

  // Move custom list in overview
  const handleMoveList = async (listId: string, direction: 'left' | 'right') => {
    const lists = getProcessedCustomLists();
    const currentIndex = lists.findIndex(l => l.id === listId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= lists.length) return;

    const [movedList] = lists.splice(currentIndex, 1);
    lists.splice(targetIndex, 0, movedList);

    await reorderCustomLists(lists);
    setListsSortOption('order');
  };

  // Drop custom list in overview
  const handleDropList = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const lists = getProcessedCustomLists();
    const sourceIndex = lists.findIndex(l => l.id === sourceId);
    const targetIndex = lists.findIndex(l => l.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedList] = lists.splice(sourceIndex, 1);
    lists.splice(targetIndex, 0, movedList);

    await reorderCustomLists(lists);
    setListsSortOption('order');
    setDraggedListId(null);
    setDragOverListId(null);
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    await saveCustomList({
      name: newListName,
      description: newListDesc,
      items: [],
      order: customLists.length
    });

    setNewListName('');
    setNewListDesc('');
    setShowCreateModal(false);
  };

  const handleSearchInsideList = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setListSearchQuery(q);
    if (!q.trim()) {
      setListSearchResults([]);
      return;
    }
    try {
      const data = await tmdb.searchMulti(q);
      setListSearchResults((data.results || []).slice(0, 5));
    } catch (err) {
      console.error(err);
    }
  };

  const addItemToCustomList = async (list: CustomList, tmdbItem: any) => {
    const determinedType = tmdbItem.media_type || (tmdbItem.first_air_date || tmdbItem.name ? 'tv' : 'movie');
    const alreadyExists = list.items.some(i => i.tmdbId === tmdbItem.id && i.mediaType === determinedType);
    if (alreadyExists) return;

    let runtime: number | undefined = undefined;
    let releaseDate: string | undefined = tmdbItem.release_date || tmdbItem.first_air_date;

    if (determinedType === 'movie') {
      try {
        const details = await tmdb.getMovieDetails(tmdbItem.id);
        if (details) {
          if (details.runtime) {
            runtime = details.runtime;
          }
          if (details.release_date) {
            releaseDate = details.release_date;
          }
        }
      } catch (err) {
        console.error('Failed to fetch movie details when adding to custom list:', err);
      }
    } else {
      try {
        const details = await tmdb.getShowDetails(tmdbItem.id);
        if (details && details.first_air_date) {
          releaseDate = details.first_air_date;
        }
      } catch (err) {
        console.error('Failed to fetch TV details when adding to custom list:', err);
      }
    }

    const updatedItems = [
      ...list.items,
      {
        tmdbId: tmdbItem.id,
        mediaType: determinedType,
        title: tmdbItem.title || tmdbItem.name || '',
        posterPath: tmdbItem.poster_path,
        runtime,
        releaseDate,
        addedAt: Date.now()
      }
    ];

    await saveCustomList({
      ...list,
      items: updatedItems
    });

    setListSearchQuery('');
    setListSearchResults([]);
  };

  const removeItemFromCustomList = async (list: CustomList, tmdbId: number, mediaType: 'movie' | 'tv') => {
    const updatedItems = list.items.filter(i => !(i.tmdbId === tmdbId && i.mediaType === mediaType));
    await saveCustomList({
      ...list,
      items: updatedItems
    });
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header View Title */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-foreground">
          Your Media Spaces
        </h1>
        <p className="text-sm text-muted-custom">
          Organize your private watchlist, favorite curators, and custom themed lists
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-border-custom gap-6">
        <button
          onClick={() => { setActiveTab('watchlist'); setActiveListId(null); }}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'watchlist' 
              ? 'border-primary-custom text-primary-custom' 
              : 'border-transparent text-muted-custom hover:text-foreground'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Watchlist</span>
          <span className="bg-background border border-border-custom px-2 py-0.5 rounded-full text-[10px] text-muted-custom shrink-0 font-bold">
            {watchlist.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('favorites'); setActiveListId(null); }}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'favorites' 
              ? 'border-primary-custom text-primary-custom' 
              : 'border-transparent text-muted-custom hover:text-foreground'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Favorites</span>
          <span className="bg-background border border-border-custom px-2 py-0.5 rounded-full text-[10px] text-muted-custom shrink-0 font-bold">
            {favorites.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('custom_lists')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'custom_lists' 
              ? 'border-primary-custom text-primary-custom' 
              : 'border-transparent text-muted-custom hover:text-foreground'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Custom Lists</span>
          <span className="bg-background border border-border-custom px-2 py-0.5 rounded-full text-[10px] text-muted-custom shrink-0 font-bold">
            {customLists.length}
          </span>
        </button>
      </div>

      {/* Rendering Watchlist / Favorites */}
      {(activeTab === 'watchlist' || activeTab === 'favorites') && (
        <div className="space-y-6">
          {/* Sub-bar Filter and Sorters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border-custom p-4 rounded-2xl shadow-sm">
            {/* Movies vs TV */}
            <div className="flex gap-1 bg-background p-1 rounded-xl border border-border-custom w-fit">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterType === 'all' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('movie')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  filterType === 'movie' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
                }`}
              >
                <Film className="w-3 h-3" />
                <span>Movies</span>
              </button>
              <button
                onClick={() => setFilterType('tv')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  filterType === 'tv' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
                }`}
              >
                <Tv className="w-3 h-3" />
                <span>TV Shows</span>
              </button>
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-custom font-semibold">Sort by:</span>
              <button
                onClick={() => setSortOption('added')}
                className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                  sortOption === 'added' 
                    ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25' 
                    : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                Recently Added
              </button>
              <button
                onClick={() => setSortOption('alpha')}
                className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                  sortOption === 'alpha' 
                    ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25' 
                    : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                Alphabetical
              </button>
            </div>
          </div>

          {/* Catalog items Grid */}
          {getProcessedItems(activeTab === 'watchlist' ? watchlist : favorites).length === 0 ? (
            <div className="py-20 text-center text-muted-custom bg-card border border-border-custom rounded-2xl p-6 max-w-lg mx-auto space-y-3 shadow-sm">
              <ClipboardList className="w-12 h-12 mx-auto text-slate-700" />
              <div className="space-y-1">
                <p className="font-bold text-foreground text-sm">No items in this Space</p>
                <p className="text-xs">Explore trending movies or tv shows to start filling your collection.</p>
              </div>
              <button
                onClick={() => onNavigate({ type: 'discover' })}
                className="bg-primary-custom hover:bg-primary-custom/95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow"
              >
                Explore Discover Tab
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {getProcessedItems(activeTab === 'watchlist' ? watchlist : favorites).map((item) => (
                <div 
                  key={item.id}
                  className="group relative cursor-pointer space-y-2.5"
                >
                  <div 
                    onClick={() => onNavigate({ 
                      type: item.mediaType === 'tv' ? 'show-details' : 'movie-details', 
                      [item.mediaType === 'tv' ? 'showId' : 'movieId']: item.tmdbId 
                    } as any)}
                    className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow hover:shadow-md transition duration-300"
                  >
                    <img 
                      src={getPosterUrl(item.posterPath, 'w342')} 
                      alt={item.title}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-102"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Delete Button on Hover/Overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeTab === 'watchlist') {
                        removeFromWatchlist(item.tmdbId, item.mediaType);
                      } else {
                        // toggleFavorite takes standard TMDBMedia mock to delete
                        toggleFavorite({ id: item.tmdbId, title: item.title, poster_path: item.posterPath, name: item.title } as any, item.mediaType);
                      }
                    }}
                    className="absolute top-2.5 right-2.5 bg-red-600/90 text-white p-1.5 rounded-full hover:bg-red-500 transition shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="px-1 space-y-0.5">
                    <h3 className="font-bold text-xs truncate text-foreground hover:text-primary-custom transition">
                      {item.title}
                    </h3>
                    <div className="flex items-center justify-between gap-1.5 text-[10px]">
                      <span className="text-muted-custom">
                        {item.mediaType === 'tv' ? 'TV Show' : 'Movie'}
                      </span>
                      {item.mediaType === 'movie' && (item.runtime || runtimesCache[item.tmdbId]) ? (
                        <span className="text-primary-custom font-semibold">
                          {formatRuntime(item.runtime || runtimesCache[item.tmdbId])}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rendering Custom Lists */}
      {activeTab === 'custom_lists' && !activeListId && (
        <div className="space-y-6">
          {/* Header row with List Sorters, Reorder toggle & Add list */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border-custom p-4 rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-custom font-semibold">Sort lists:</span>
              <button
                onClick={() => setListsSortOption('order')}
                className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                  listsSortOption === 'order'
                    ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25'
                    : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                Custom Order
              </button>
              <button
                onClick={() => setListsSortOption('alpha')}
                className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                  listsSortOption === 'alpha'
                    ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25'
                    : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                Alphabetical
              </button>
              <button
                onClick={() => setListsSortOption('created')}
                className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                  listsSortOption === 'created'
                    ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25'
                    : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                Recently Created
              </button>
              <button
                onClick={() => setListsSortOption('count')}
                className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                  listsSortOption === 'count'
                    ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25'
                    : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                Most Titles
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsReorderingListsMode(!isReorderingListsMode);
                  if (!isReorderingListsMode) setListsSortOption('order');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border flex items-center gap-1.5 ${
                  isReorderingListsMode
                    ? 'bg-primary-custom/15 border-primary-custom/40 text-primary-custom'
                    : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                }`}
                title="Rearrange your lists in your chosen custom order"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{isReorderingListsMode ? 'Reordering: Active' : 'Custom Sort Lists'}</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary-custom hover:bg-primary-custom/90 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Themed List</span>
              </button>
            </div>
          </div>

          {/* List display Cards */}
          {customLists.length === 0 ? (
            <div className="py-20 text-center text-muted-custom bg-card border border-border-custom rounded-2xl p-6 max-w-lg mx-auto space-y-3">
              <List className="w-12 h-12 mx-auto text-slate-700" />
              <div className="space-y-1">
                <p className="font-bold text-foreground text-sm">No custom lists created</p>
                <p className="text-xs">Create custom thematic folders like "Harry Potter", "Marvel", or "Oscar Winners".</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {getProcessedCustomLists().map((list, index) => (
                <div
                  key={list.id}
                  draggable={isReorderingListsMode}
                  onDragStart={(e) => {
                    setDraggedListId(list.id);
                    e.dataTransfer.setData('text/plain', list.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedListId && draggedListId !== list.id) {
                      setDragOverListId(list.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverListId === list.id) {
                      setDragOverListId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedListId && draggedListId !== list.id) {
                      handleDropList(draggedListId, list.id);
                    }
                  }}
                  onClick={() => setActiveListId(list.id)}
                  className={`bg-card hover:bg-slate-800/10 border p-5 rounded-2xl cursor-pointer shadow-sm flex flex-col justify-between hover:scale-[1.01] transition relative group ${
                    dragOverListId === list.id
                      ? 'border-primary-custom ring-2 ring-primary-custom/40 scale-[1.02]'
                      : 'border-border-custom'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 max-w-[80%]">
                        <span className="bg-background border border-border-custom text-[10px] font-mono font-bold text-primary-custom px-2 py-0.5 rounded-md shrink-0">
                          #{index + 1}
                        </span>
                        <h3 className="font-display font-extrabold text-base text-foreground truncate group-hover:text-primary-custom transition">
                          {list.name}
                        </h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${list.name}"?`)) {
                            deleteCustomList(list.id);
                          }
                        }}
                        className="text-muted-custom hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                        title="Delete list"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-custom line-clamp-2 leading-relaxed min-h-[32px]">
                      {list.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Reordering Controls if in custom list reorder mode */}
                  {isReorderingListsMode && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="my-2 p-2 bg-background/80 border border-border-custom rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="text-[10px] font-semibold text-muted-custom flex items-center gap-1">
                        <GripVertical className="w-3.5 h-3.5 text-primary-custom" />
                        <span>Drag or move:</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveList(list.id, 'left')}
                          className="p-1 rounded-lg hover:bg-primary-custom/10 hover:text-primary-custom disabled:opacity-30 disabled:hover:bg-transparent text-muted-custom transition"
                          title="Move list earlier"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === customLists.length - 1}
                          onClick={() => handleMoveList(list.id, 'right')}
                          className="p-1 rounded-lg hover:bg-primary-custom/10 hover:text-primary-custom disabled:opacity-30 disabled:hover:bg-transparent text-muted-custom transition"
                          title="Move list later"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border-custom flex items-center justify-between text-xs text-muted-custom font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span>{list.items.length} titles</span>
                      {list.sortMode && (
                        <span className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border-custom font-normal">
                          {list.sortMode === 'custom' ? 'Custom' : list.sortMode}
                        </span>
                      )}
                    </span>
                    <span className="text-primary-custom group-hover:translate-x-1 transition flex items-center gap-1">
                      <span>Open list</span>
                      <Plus className="w-3.5 h-3.5 rotate-45" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expanded Custom List Detail View */}
      {activeTab === 'custom_lists' && activeListId && currentList && (
        <div className="space-y-6">
          {/* Back Header */}
          <div className="flex items-center justify-between border-b border-border-custom pb-4">
            <button
              onClick={() => { setActiveListId(null); setListSearchQuery(''); setListSearchResults([]); }}
              className="text-muted-custom hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <X className="w-4 h-4" />
              <span>Back to Lists</span>
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete entire list "${currentList.name}"?`)) {
                  deleteCustomList(currentList.id);
                  setActiveListId(null);
                }
              }}
              className="text-red-500 hover:bg-red-500/10 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete List</span>
            </button>
          </div>

          {/* List Meta Header & Add All Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border-custom p-5 rounded-3xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-extrabold text-2xl text-foreground">{currentList.name}</h2>
                {currentList.sortMode && (
                  <span className="text-[10px] bg-primary-custom/10 text-primary-custom border border-primary-custom/25 font-bold px-2 py-0.5 rounded-md">
                    Sort: {currentList.sortMode === 'custom' ? 'Custom Order' : currentList.sortMode}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-custom leading-relaxed">{currentList.description || 'No description provided.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
              {/* Option to Enable/Disable Custom Sorting for this List */}
              <button
                type="button"
                onClick={handleToggleCustomSortingOnList}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border flex items-center gap-2 cursor-pointer ${
                  isCustomReorderingMode
                    ? 'bg-primary-custom/15 border-primary-custom/40 text-primary-custom shadow-sm'
                    : 'bg-card hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                }`}
                title="Toggle custom manual sequence sorting for this list"
              >
                <ListOrdered className="w-4 h-4 text-primary-custom" />
                <span>{isCustomReorderingMode ? 'Custom Sorting: Enabled' : 'Enable Custom Sorting'}</span>
              </button>
              {currentList.items.some(item => item.mediaType === 'movie') && (
                <button
                  onClick={handleAddAllMoviesToWatchlist}
                  className="bg-primary-custom hover:bg-primary-custom/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition duration-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add all movies to Movie Watchlist</span>
                </button>
              )}
              {currentList.items.some(item => item.mediaType === 'tv') && (
                <button
                  onClick={handleAddAllTVToWatchlist}
                  className="bg-blue-600 hover:bg-blue-600/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition duration-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add all TV shows to TV Watchlist</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback banner */}
          {bulkAddFeedback && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 shrink-0" />
              <span>{bulkAddFeedback}</span>
            </div>
          )}

          {/* Inline TMDB Adding Bar */}
          <div className="bg-card border border-border-custom p-4 rounded-2xl shadow-sm space-y-3 max-w-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-custom flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-primary-custom" />
              <span>Add movies or shows to this List</span>
            </h3>
            <div className="relative">
              <input
                type="text"
                placeholder="Search to add titles directly..."
                value={listSearchQuery}
                onChange={handleSearchInsideList}
                className="w-full bg-background border border-border-custom px-3.5 py-2 rounded-xl text-xs text-foreground outline-none focus:border-primary-custom"
              />
              {listSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-card border border-border-custom rounded-xl mt-1.5 shadow-lg overflow-hidden z-20 divide-y divide-border-custom">
                  {listSearchResults.map((sr) => {
                    const determinedType = sr.media_type || (sr.first_air_date || sr.name ? 'tv' : 'movie');
                    const isAlreadyIn = currentList.items.some(i => i.tmdbId === sr.id && i.mediaType === determinedType);
                    return (
                      <div
                        key={sr.id}
                        onClick={() => !isAlreadyIn && addItemToCustomList(currentList, sr)}
                        className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-background transition text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={getPosterUrl(sr.poster_path, 'w92')} 
                            alt={sr.title || sr.name} 
                            className="w-7 h-10 object-cover rounded shadow bg-slate-900 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <span className="truncate text-foreground font-semibold">{sr.title || sr.name}</span>
                        </div>
                        {isAlreadyIn ? (
                          <span className="text-emerald-500 font-bold flex items-center gap-0.5 text-[10px]">
                            <Check className="w-3 h-3" /> In List
                          </span>
                        ) : (
                          <span className="text-primary-custom hover:underline font-bold text-[10px]">
                            + Add
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* List items displayed */}
          {currentList.items.length === 0 ? (
            <div className="py-16 text-center text-muted-custom bg-card border border-border-custom rounded-2xl p-6 max-w-md">
              <List className="w-10 h-10 mx-auto text-slate-700 mb-2" />
              <p className="text-xs">This themed list is empty. Use the search input above to add catalog items!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Filter and Sorting Row for Custom List */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border-custom p-4 rounded-2xl shadow-sm">
                {/* Media Type Filter */}
                <div className="flex gap-1 bg-background p-1 rounded-xl border border-border-custom w-fit">
                  <button
                    onClick={() => {
                      setCustomListFilterType('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      customListFilterType === 'all' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setCustomListFilterType('movie');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      customListFilterType === 'movie' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
                    }`}
                  >
                    <Film className="w-3 h-3" />
                    <span>Movies</span>
                  </button>
                  <button
                    onClick={() => {
                      setCustomListFilterType('tv');
                      if (customListSortOption === 'runtime' || customListSortOption === 'release') {
                        setCustomListSortOption('added');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      customListFilterType === 'tv' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
                    }`}
                  >
                    <Tv className="w-3 h-3" />
                    <span>TV Shows</span>
                  </button>
                </div>

                {/* Sorters with Custom Order option */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-custom font-semibold">Sort by:</span>

                  {/* Custom Order button */}
                  {(settings?.enableCustomListSorting !== false || isCustomReorderingMode) && (
                    <button
                      onClick={() => setCustomListSortOption('custom')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition border flex items-center gap-1.5 ${
                        customListSortOption === 'custom'
                          ? 'bg-primary-custom text-white border-primary-custom shadow-sm'
                          : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                      }`}
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Custom Order</span>
                    </button>
                  )}

                  <button
                    onClick={() => setCustomListSortOption('alpha')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                      customListSortOption === 'alpha'
                        ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25'
                        : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                    }`}
                  >
                    Alphabetical
                  </button>

                  {(customListFilterType === 'all' || customListFilterType === 'tv') && (
                    <button
                      onClick={() => setCustomListSortOption('added')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                        customListSortOption === 'added'
                          ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25'
                          : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                      }`}
                    >
                      Date Added
                    </button>
                  )}

                  {(customListFilterType === 'all' || customListFilterType === 'movie') && (
                    <>
                      <button
                        onClick={() => setCustomListSortOption('runtime')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                          customListSortOption === 'runtime'
                            ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25'
                            : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                        }`}
                      >
                        Runtime
                      </button>
                      <button
                        onClick={() => setCustomListSortOption('release')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition border ${
                          customListSortOption === 'release'
                            ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/25'
                            : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                        }`}
                      >
                        Release Date
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Custom Sorting Helper Bar */}
              {(customListSortOption === 'custom' || isCustomReorderingMode) && (
                <div className="bg-card/70 border border-primary-custom/30 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs animate-fadeIn">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <GripVertical className="w-4 h-4 text-primary-custom shrink-0" />
                    <span>Custom Sorting Active: Drag cards or use the directional controls below each poster to curate your bespoke sequence.</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-muted-custom font-semibold">Auto-fill sequence:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetOrder('release_asc')}
                      className="px-2.5 py-1 rounded-lg bg-background border border-border-custom hover:bg-slate-800/20 text-muted-custom hover:text-foreground transition text-[11px] font-semibold"
                      title="Order chronologically by release date and save as custom sequence"
                    >
                      Chronological
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetOrder('alpha_asc')}
                      className="px-2.5 py-1 rounded-lg bg-background border border-border-custom hover:bg-slate-800/20 text-muted-custom hover:text-foreground transition text-[11px] font-semibold"
                      title="Order alphabetically (A-Z) and save as custom sequence"
                    >
                      A-Z
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetOrder('reverse')}
                      className="px-2.5 py-1 rounded-lg bg-background border border-border-custom hover:bg-slate-800/20 text-muted-custom hover:text-foreground transition text-[11px] font-semibold"
                      title="Reverse the current sequence"
                    >
                      Reverse
                    </button>
                  </div>
                </div>
              )}

              {/* Grid or Empty results */}
              {getProcessedCustomListItems(currentList.items).length === 0 ? (
                <div className="py-12 text-center text-muted-custom bg-card border border-border-custom rounded-2xl p-6">
                  <p className="text-xs">No matching titles found in this list.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {getProcessedCustomListItems(currentList.items).map((item, index) => {
                    const isCustomMode = customListSortOption === 'custom' || isCustomReorderingMode;
                    const isBeingDragged = draggedTmdbId === item.tmdbId;
                    const isDragOver = dragOverTmdbId === item.tmdbId;

                    return (
                      <div 
                        key={`${item.mediaType}_${item.tmdbId}`}
                        draggable={isCustomMode}
                        onDragStart={(e) => {
                          setDraggedTmdbId(item.tmdbId);
                          e.dataTransfer.setData('text/plain', item.tmdbId.toString());
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedTmdbId && draggedTmdbId !== item.tmdbId) {
                            setDragOverTmdbId(item.tmdbId);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverTmdbId === item.tmdbId) {
                            setDragOverTmdbId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedTmdbId && draggedTmdbId !== item.tmdbId) {
                            handleDropCustomListItem(draggedTmdbId, item.tmdbId);
                          }
                        }}
                        className={`group relative space-y-2 rounded-2xl transition ${
                          isBeingDragged ? 'opacity-40 scale-95' : ''
                        } ${
                          isDragOver 
                            ? 'ring-2 ring-primary-custom scale-102 bg-primary-custom/5 p-1' 
                            : ''
                        }`}
                      >
                        {/* Poster Container */}
                        <div 
                          onClick={() => onNavigate({ 
                            type: item.mediaType === 'tv' ? 'show-details' : 'movie-details', 
                            [item.mediaType === 'tv' ? 'showId' : 'movieId']: item.tmdbId 
                          } as any)}
                          className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow hover:shadow-md transition cursor-pointer"
                        >
                          <img 
                            src={getPosterUrl(item.posterPath, 'w342')} 
                            alt={item.title}
                            className="w-full h-full object-cover transition group-hover:scale-102"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />

                          {/* Position Badge */}
                          <div className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md border border-white/10 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-lg shadow-md flex items-center gap-1 z-10">
                            {isCustomMode && <GripVertical className="w-2.5 h-2.5 text-primary-custom" />}
                            <span>#{index + 1}</span>
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItemFromCustomList(currentList, item.tmdbId, item.mediaType);
                            }}
                            className="absolute top-2.5 right-2.5 bg-red-600/95 text-white p-1.5 rounded-full hover:bg-red-500 shadow transition opacity-0 group-hover:opacity-100 z-10"
                            title="Remove from list"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Reordering Controls Bar (Under Poster in Custom Mode) */}
                        {isCustomMode && (
                          <div className="bg-background/90 border border-border-custom p-1.5 rounded-xl flex items-center justify-between gap-1 shadow-xs">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveCustomListItem(item.tmdbId, item.mediaType, 'top')}
                              className="p-1 rounded hover:bg-primary-custom/10 hover:text-primary-custom text-muted-custom disabled:opacity-20 transition"
                              title="Move to Top"
                            >
                              <ChevronsLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveCustomListItem(item.tmdbId, item.mediaType, 'up')}
                              className="p-1 rounded hover:bg-primary-custom/10 hover:text-primary-custom text-muted-custom disabled:opacity-20 transition"
                              title="Move Earlier"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] font-mono font-bold text-muted-custom">
                              #{index + 1}
                            </span>
                            <button
                              type="button"
                              disabled={index === currentList.items.length - 1}
                              onClick={() => handleMoveCustomListItem(item.tmdbId, item.mediaType, 'down')}
                              className="p-1 rounded hover:bg-primary-custom/10 hover:text-primary-custom text-muted-custom disabled:opacity-20 transition"
                              title="Move Later"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === currentList.items.length - 1}
                              onClick={() => handleMoveCustomListItem(item.tmdbId, item.mediaType, 'bottom')}
                              className="p-1 rounded hover:bg-primary-custom/10 hover:text-primary-custom text-muted-custom disabled:opacity-20 transition"
                              title="Move to Bottom"
                            >
                              <ChevronsRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Meta information */}
                        <div className="px-1 space-y-0.5">
                          <h3 
                            onClick={() => onNavigate({ 
                              type: item.mediaType === 'tv' ? 'show-details' : 'movie-details', 
                              [item.mediaType === 'tv' ? 'showId' : 'movieId']: item.tmdbId 
                            } as any)}
                            className="font-bold text-xs truncate text-foreground hover:text-primary-custom transition cursor-pointer"
                          >
                            {item.title}
                          </h3>
                          <div className="flex items-center justify-between gap-1.5 text-[10px]">
                            <span className="text-muted-custom uppercase font-mono">{item.mediaType === 'tv' ? 'TV' : 'Movie'}</span>
                            {item.mediaType === 'movie' && (item.runtime || runtimesCache[item.tmdbId]) ? (
                              <span className="text-primary-custom font-semibold">
                                {formatRuntime(item.runtime || runtimesCache[item.tmdbId])}
                              </span>
                            ) : null}
                          </div>
                          {(item.releaseDate || releaseDatesCache[item.tmdbId]) && (
                            <div className="text-[9px] text-muted-custom">
                              Rel: {item.releaseDate || releaseDatesCache[item.tmdbId]}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleCreateList}
            className="bg-card w-full max-w-md rounded-2xl border border-border-custom p-6 space-y-4 shadow-2xl animate-scaleUp"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-lg text-foreground">Create Themed List</h3>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-background text-muted-custom hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">List Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Oscar Winners 2026, Marvel Binge"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full bg-background border border-border-custom px-3.5 py-2.5 rounded-xl text-sm outline-none text-foreground focus:border-primary-custom"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Description (Optional)</label>
              <textarea
                placeholder="Write a brief custom description..."
                value={newListDesc}
                onChange={(e) => setNewListDesc(e.target.value)}
                rows={3}
                className="w-full bg-background border border-border-custom px-3.5 py-2.5 rounded-xl text-sm outline-none text-foreground focus:border-primary-custom"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-border-custom hover:bg-background rounded-xl text-xs font-semibold text-muted-custom transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-primary-custom hover:bg-primary-custom/95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition"
              >
                Save List
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
