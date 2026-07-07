import React, { useState, useEffect } from 'react';
import { useCineTrack } from '../context/CineTrackContext';
import { ViewState, CustomList } from '../types';
import { getPosterUrl } from '../lib/utils';
import { Bookmark, Star, Trash2, Plus, X, List, Film, Tv, Heart, ClipboardList, Check } from 'lucide-react';
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
    removeFromWatchlist, 
    toggleFavorite,
    saveCustomList,
    deleteCustomList
  } = useCineTrack();

  const [activeTab, setActiveTab] = useState<'watchlist' | 'favorites' | 'custom_lists'>('watchlist');
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortOption, setSortOption] = useState<'added' | 'alpha'>('added');

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
  const [activeListId, setActiveListId] = useState<string | null>(null);

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
    const alreadyExists = list.items.some(i => i.tmdbId === tmdbItem.id);
    if (alreadyExists) return;

    const updatedItems = [
      ...list.items,
      {
        tmdbId: tmdbItem.id,
        mediaType: tmdbItem.media_type || 'movie',
        title: tmdbItem.title || tmdbItem.name || '',
        posterPath: tmdbItem.poster_path
      }
    ];

    await saveCustomList({
      ...list,
      items: updatedItems
    });

    setListSearchQuery('');
    setListSearchResults([]);
  };

  const removeItemFromCustomList = async (list: CustomList, tmdbId: number) => {
    const updatedItems = list.items.filter(i => i.tmdbId !== tmdbId);
    await saveCustomList({
      ...list,
      items: updatedItems
    });
  };

  const currentList = customLists.find(l => l.id === activeListId);

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
                    <p className="text-[10px] text-muted-custom">
                      {item.mediaType === 'tv' ? 'TV Show' : 'Movie'}
                    </p>
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
          {/* Header row to Add list */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-custom hover:bg-primary-custom/90 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Themed List</span>
            </button>
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
              {customLists.map((list) => (
                <div
                  key={list.id}
                  onClick={() => setActiveListId(list.id)}
                  className="bg-card hover:bg-slate-800/10 border border-border-custom p-5 rounded-2xl cursor-pointer shadow-sm flex flex-col justify-between hover:scale-[1.01] transition relative group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-display font-extrabold text-base text-foreground truncate max-w-[80%] group-hover:text-primary-custom transition">
                        {list.name}
                      </h3>
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

                  <div className="pt-4 border-t border-border-custom flex items-center justify-between text-xs text-muted-custom font-semibold">
                    <span>{list.items.length} titles</span>
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

          {/* List Meta Header */}
          <div className="space-y-2">
            <h2 className="font-display font-extrabold text-2xl text-foreground">{currentList.name}</h2>
            <p className="text-sm text-muted-custom leading-relaxed">{currentList.description || 'No description provided.'}</p>
          </div>

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
                    const isAlreadyIn = currentList.items.some(i => i.tmdbId === sr.id);
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {currentList.items.map((item) => (
                <div 
                  key={item.tmdbId}
                  className="group relative cursor-pointer space-y-2.5"
                >
                  <div 
                    onClick={() => onNavigate({ 
                      type: item.mediaType === 'tv' ? 'show-details' : 'movie-details', 
                      [item.mediaType === 'tv' ? 'showId' : 'movieId']: item.tmdbId 
                    } as any)}
                    className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow hover:shadow-md transition"
                  >
                    <img 
                      src={getPosterUrl(item.posterPath, 'w342')} 
                      alt={item.title}
                      className="w-full h-full object-cover transition group-hover:scale-102"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  </div>

                  <button
                    onClick={() => removeItemFromCustomList(currentList, item.tmdbId)}
                    className="absolute top-2.5 right-2.5 bg-red-600/95 text-white p-1.5 rounded-full hover:bg-red-500 shadow transition opacity-0 group-hover:opacity-100"
                    title="Remove from list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="px-1">
                    <h3 className="font-bold text-xs truncate text-foreground">{item.title}</h3>
                    <p className="text-[10px] text-muted-custom uppercase font-mono mt-0.5">{item.mediaType}</p>
                  </div>
                </div>
              ))}
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
