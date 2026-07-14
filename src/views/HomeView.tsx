import React, { useState, useEffect, useRef } from 'react';
import { useCineTrack } from '../context/CineTrackContext';
import { tmdb } from '../services/tmdb';
import { TMDBMedia, ViewState } from '../types';
import { getPosterUrl, getBackdropUrl, formatDate, formatRuntime } from '../lib/utils';
import { 
  Play, Star, Bookmark, Heart, Shuffle, ArrowRight, Tv, Film, 
  Eye, Sparkles, Sliders, ChevronUp, ChevronDown, Check, Plus, RotateCcw, X, List 
} from 'lucide-react';

interface HomeViewProps {
  onNavigate: (view: ViewState) => void;
}

// Global in-memory cache to make HomeView navigation instant
let cachedHomeData: {
  trendingMovies: TMDBMedia[];
  trendingTV: TMDBMedia[];
  upcomingMovies: TMDBMedia[];
  recentlyPremiered: TMDBMedia[];
  randomRecommendation: TMDBMedia | null;
  timestamp: number;
} | null = null;

export default function HomeView({ onNavigate }: HomeViewProps) {
  const { 
    watchlist, 
    favorites, 
    showProgress, 
    watchedEpisodes,
    watchedMovies, 
    customLists,
    settings,
    updateSettings
  } = useCineTrack();

  const [trendingMovies, setTrendingMovies] = useState<TMDBMedia[]>(() => cachedHomeData?.trendingMovies || []);
  const [trendingTV, setTrendingTV] = useState<TMDBMedia[]>(() => cachedHomeData?.trendingTV || []);
  const [upcomingMovies, setUpcomingMovies] = useState<TMDBMedia[]>(() => cachedHomeData?.upcomingMovies || []);
  const [recentlyPremiered, setRecentlyPremiered] = useState<TMDBMedia[]>(() => cachedHomeData?.recentlyPremiered || []);
  const [randomRecommendation, setRandomRecommendation] = useState<TMDBMedia | null>(() => cachedHomeData?.randomRecommendation || null);
  const [loading, setLoading] = useState(() => !cachedHomeData);
  const [showCustomize, setShowCustomize] = useState(false);
  const [runtimesCache, setRuntimesCache] = useState<Record<number, number>>({});
  const [resolvedProgress, setResolvedProgress] = useState<Record<number, {
    totalEpisodes: number;
    nextSeason: number;
    nextEpisode: number;
    watchedEpisodesCount: number;
  }>>({});
  const fetchedOrFetchingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!showProgress || showProgress.length === 0) return;

    let isMounted = true;
    async function resolveProgressDetails() {
      const results: typeof resolvedProgress = {};
      await Promise.all(
        showProgress.map(async (prog) => {
          try {
            const details = await tmdb.getShowDetails(prog.showId);
            if (!details) return;

            const totalCount = details.number_of_episodes || 0;
            const seasons = (details.seasons || [])
              .filter((s: any) => s.season_number > 0)
              .sort((a: any, b: any) => a.season_number - b.season_number);

            const watchedForShow = watchedEpisodes.filter(we => we.showId === prog.showId);
            const watchedCount = watchedForShow.length;

            // Find first unmarked episode
            let nextS = 1;
            let nextE = 1;
            let found = false;

            for (const s of seasons) {
              const epCount = s.episode_count || 0;
              for (let e = 1; e <= epCount; e++) {
                const epId = `${prog.showId}_${s.season_number}_${e}`;
                const isWatched = watchedEpisodes.some(we => we.id === epId);
                if (!isWatched) {
                  nextS = s.season_number;
                  nextE = e;
                  found = true;
                  break;
                }
              }
              if (found) break;
            }

            if (!found && seasons.length > 0) {
              const lastS = seasons[seasons.length - 1];
              nextS = lastS.season_number;
              nextE = lastS.episode_count || 1;
            }

            results[prog.showId] = {
              totalEpisodes: totalCount,
              nextSeason: nextS,
              nextEpisode: nextE,
              watchedEpisodesCount: watchedCount
            };
          } catch (e) {
            console.error(`Failed to resolve details for show ${prog.showId}:`, e);
          }
        })
      );

      if (isMounted) {
        setResolvedProgress(prev => ({ ...prev, ...results }));
      }
    }

    resolveProgressDetails();
    return () => {
      isMounted = false;
    };
  }, [showProgress, watchedEpisodes]);

  useEffect(() => {
    const moviesNeedingRuntime: { id: number }[] = [];

    // 1. Check custom list items
    if (customLists && customLists.length > 0) {
      customLists.forEach(list => {
        list.items.forEach(item => {
          if (item.mediaType === 'movie' && item.runtime === undefined && !fetchedOrFetchingRef.current.has(item.tmdbId)) {
            if (!moviesNeedingRuntime.some(m => m.id === item.tmdbId)) {
              moviesNeedingRuntime.push({ id: item.tmdbId });
            }
          }
        });
      });
    }

    // 2. Check trending movies shown on screen
    if (trendingMovies && trendingMovies.length > 0) {
      trendingMovies.forEach(movie => {
        if (!movie.runtime && !fetchedOrFetchingRef.current.has(movie.id)) {
          if (!moviesNeedingRuntime.some(m => m.id === movie.id)) {
            moviesNeedingRuntime.push({ id: movie.id });
          }
        }
      });
    }

    // 3. Check upcoming movies shown on screen
    if (upcomingMovies && upcomingMovies.length > 0) {
      upcomingMovies.forEach(movie => {
        if (!movie.runtime && !fetchedOrFetchingRef.current.has(movie.id)) {
          if (!moviesNeedingRuntime.some(m => m.id === movie.id)) {
            moviesNeedingRuntime.push({ id: movie.id });
          }
        }
      });
    }

    if (moviesNeedingRuntime.length === 0) return;

    // Mark all as fetching
    moviesNeedingRuntime.forEach(m => fetchedOrFetchingRef.current.add(m.id));

    let isMounted = true;
    async function fetchRuntimes() {
      // Chunk concurrent requests to fetch runtimes extremely quickly without hitting rate limits
      const chunkSize = 5;
      for (let i = 0; i < moviesNeedingRuntime.length; i += chunkSize) {
        if (!isMounted) break;
        const chunk = moviesNeedingRuntime.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              const details = await tmdb.getMovieDetails(item.id);
              if (details && isMounted) {
                const rt = details.runtime || 0;
                setRuntimesCache(prev => ({
                  ...prev,
                  [item.id]: rt
                }));
              }
            } catch (e) {
              console.log(`Failed to fetch runtime for movie ${item.id}:`, e);
              // Remove on failure to allow retry if needed
              fetchedOrFetchingRef.current.delete(item.id);
            }
          })
        );
      }
    }

    fetchRuntimes();
    return () => {
      isMounted = false;
    };
  }, [customLists, trendingMovies, upcomingMovies]);

  // Available rows list mapping
  const allAvailableSections = [
    { id: 'continue-watching', name: 'Continue Watching (TV)', category: 'System tracking' },
    { id: 'trending-movies', name: 'Trending Movies (Weekly)', category: 'TMDB Lists' },
    { id: 'trending-tv', name: 'Trending TV Shows (Weekly)', category: 'TMDB Lists' },
    { id: 'upcoming-movies', name: 'Upcoming Movie Releases', category: 'TMDB Lists' },
    { id: 'recently-premiered', name: 'Recently Premiered TV', category: 'TMDB Lists' },
    { id: 'watchlist', name: 'My Watchlist', category: 'My Curations' },
    { id: 'favorites', name: 'My Favorites', category: 'My Curations' }
  ];

  const customListSections = (customLists || []).map(list => ({
    id: `custom-list-${list.id}`,
    name: list.name,
    category: 'My Themed Lists'
  }));

  const allSections = [
    ...allAvailableSections,
    ...customListSections
  ];

  const homeSections = settings.homeSections || [
    'continue-watching',
    'trending-movies',
    'trending-tv',
    'upcoming-movies',
    'recently-premiered'
  ];

  const toggleSection = async (sectionId: string) => {
    let updated: string[];
    if (homeSections.includes(sectionId)) {
      updated = homeSections.filter(id => id !== sectionId);
    } else {
      updated = [...homeSections, sectionId];
    }
    await updateSettings({ homeSections: updated });
  };

  const moveSection = async (sectionId: string, direction: 'up' | 'down') => {
    const index = homeSections.indexOf(sectionId);
    if (index === -1) return;
    
    const updated = [...homeSections];
    if (direction === 'up' && index > 0) {
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
    } else if (direction === 'down' && index < updated.length - 1) {
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
    }
    await updateSettings({ homeSections: updated });
  };

  const resetSections = async () => {
    await updateSettings({ homeSections: undefined });
  };

  useEffect(() => {
    async function loadHomeData() {
      if (cachedHomeData && Date.now() - cachedHomeData.timestamp < 10 * 60 * 1000) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [trendingM, trendingT, upcomingM, premieredT] = await Promise.all([
          tmdb.getTrending('movie', 'week'),
          tmdb.getTrending('tv', 'week'),
          tmdb.getUpcomingMovies(),
          tmdb.getOnTheAirTV()
        ]);

        const mResults = trendingM.results || [];
        const tResults = trendingT.results || [];
        const upcomingResults = upcomingM.results || [];
        const premieredTResults = premieredT.results || [];
        
        const trendingMoviesSlice = mResults.slice(0, 10);
        const upcomingMoviesSlice = upcomingResults.slice(0, 10);
        const trendingTVSlice = tResults.slice(0, 10);
        const recentlyPremieredSlice = premieredTResults.slice(0, 10);

        setTrendingMovies(trendingMoviesSlice);
        setTrendingTV(trendingTVSlice);
        setUpcomingMovies(upcomingMoviesSlice);
        setRecentlyPremiered(recentlyPremieredSlice);

        // Random recommendation from either movies or tv
        const combined = [...trendingMoviesSlice, ...trendingTVSlice];
        let randomRec = null;
        if (combined.length > 0) {
          const randomIndex = Math.floor(Math.random() * combined.length);
          randomRec = combined[randomIndex];
          setRandomRecommendation(randomRec);
        }

        cachedHomeData = {
          trendingMovies: trendingMoviesSlice,
          trendingTV: trendingTVSlice,
          upcomingMovies: upcomingMoviesSlice,
          recentlyPremiered: recentlyPremieredSlice,
          randomRecommendation: randomRec,
          timestamp: Date.now()
        };
      } catch (err) {
        console.error('Error loading home view data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, []);

  const handleMediaClick = (media: TMDBMedia, defaultType?: 'movie' | 'tv') => {
    const isTV = media.media_type === 'tv' || defaultType === 'tv' || !!media.first_air_date;
    if (isTV) {
      onNavigate({ type: 'show-details', showId: media.id });
    } else {
      onNavigate({ type: 'movie-details', movieId: media.id });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary-custom/20 border-t-primary-custom animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-indigo-500/10 border-b-indigo-500 animate-spin" style={{ animationDirection: 'reverse' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-16">
      
      {/* Home Screen Header with List Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-custom pb-6 animate-fade-in" id="home-view-header-row">
        <div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-foreground" id="welcome-home-title">
            Your CineTrack
          </h1>
          <p className="text-xs text-muted-custom" id="welcome-home-subtitle">
            Personal tracking suite for movies, TV series, and seasonal releases.
          </p>
        </div>
        
        {/* Header Actions Container */}
        <div className="flex flex-wrap items-center gap-3" id="home-header-actions">
          {/* Customize Layout button */}
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            className={`flex items-center justify-center gap-2 border px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              showCustomize 
                ? 'bg-primary-custom border-primary-custom text-white shadow-md' 
                : 'bg-card hover:bg-slate-800/40 border-border-custom text-foreground'
            }`}
            id="home-customize-feed-btn"
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>Customize Feed</span>
          </button>

          {/* Dropdown list selector */}
          <div className="relative min-w-[200px]" id="home-list-dropdown-container">
            <div className="relative">
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (val === 'watchlist') {
                    onNavigate({ type: 'watchlist', tab: 'watchlist', listId: null });
                  } else if (val === 'favorites') {
                    onNavigate({ type: 'watchlist', tab: 'favorites', listId: null });
                  } else {
                    onNavigate({ type: 'watchlist', tab: 'custom_lists', listId: val });
                  }
                  // Reset select value to allow selecting same list again later if needed
                  e.target.value = '';
                }}
                defaultValue=""
                className="w-full bg-card hover:bg-slate-800/20 border border-border-custom text-xs font-bold text-foreground py-2.5 pl-3.5 pr-10 rounded-xl outline-none focus:border-primary-custom cursor-pointer transition shadow-sm appearance-none"
                id="home-quick-list-dropdown"
              >
                <option value="" disabled>Choose a list to view...</option>
                <optgroup label="Default Spaces" className="bg-card text-foreground">
                  <option value="watchlist">Watchlist ({watchlist.length})</option>
                  <option value="favorites">Favorites ({favorites.length})</option>
                </optgroup>
                {customLists && customLists.length > 0 ? (
                  <optgroup label="Your Themed Lists" className="bg-card text-foreground">
                    {customLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.items.length})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-custom">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customize Feed Configuration Drawer */}
      {showCustomize && (
        <div className="bg-card border border-border-custom rounded-3xl p-6 space-y-5 animate-fade-in" id="customize-feed-panel">
          <div className="flex items-center justify-between border-b border-border-custom pb-4">
            <div>
              <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary-custom" />
                <span>Configure Home Feed Rows</span>
              </h3>
              <p className="text-[11px] text-muted-custom mt-1">
                Toggle, arrange, and order your TMDB charts and personal lists on the home screen.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetSections}
                className="flex items-center gap-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                title="Reset to original default layout"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
              <button
                onClick={() => setShowCustomize(false)}
                className="text-muted-custom hover:text-foreground p-1.5 bg-slate-800/40 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Displayed rows list */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-primary-custom uppercase tracking-wider animate-pulse">Active Rows (Displayed in Order)</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {homeSections.map((sectionId, idx) => {
                  const section = allSections.find(s => s.id === sectionId);
                  if (!section) return null;
                  return (
                    <div 
                      key={sectionId} 
                      className="flex items-center justify-between p-3 bg-slate-900/50 border border-border-custom/80 rounded-xl gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-mono text-muted-custom">#{idx + 1}</span>
                        <div className="min-w-0">
                          <span className="block font-bold text-xs text-foreground truncate">{section.name}</span>
                          <span className="block text-[9px] font-medium text-muted-custom mt-0.5">{section.category}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Order buttons */}
                        <button
                          disabled={idx === 0}
                          onClick={() => moveSection(sectionId, 'up')}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent rounded-md transition cursor-pointer"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          disabled={idx === homeSections.length - 1}
                          onClick={() => moveSection(sectionId, 'down')}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent rounded-md transition cursor-pointer"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        {/* Remove button */}
                        <button
                          onClick={() => toggleSection(sectionId)}
                          className="ml-1 p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-md transition cursor-pointer text-[10px] font-bold px-2 py-1"
                          title="Remove from home"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                {homeSections.length === 0 && (
                  <p className="text-xs text-muted-custom py-4 text-center border border-dashed border-border-custom rounded-xl">
                    No rows displayed. Toggle rows from the library below to customize your feed!
                  </p>
                )}
              </div>
            </div>

            {/* Hidden / Addable rows list */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-custom uppercase tracking-wider">Addable Rows</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 divide-y divide-slate-800/50">
                {allSections.filter(section => !homeSections.includes(section.id)).map(section => {
                  return (
                    <div 
                      key={section.id} 
                      className="flex items-center justify-between py-2.5 px-1 first:pt-0 gap-2"
                    >
                      <div className="min-w-0">
                        <span className="block font-bold text-xs text-foreground truncate">{section.name}</span>
                        <span className="block text-[9px] font-medium text-muted-custom mt-0.5">{section.category}</span>
                      </div>
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="p-1.5 bg-primary-custom/10 hover:bg-primary-custom text-primary-custom hover:text-white border border-primary-custom/20 rounded-xl transition cursor-pointer text-[10px] font-bold px-3 py-1 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>Add to Feed</span>
                      </button>
                    </div>
                  );
                })}
                {allSections.filter(section => !homeSections.includes(section.id)).length === 0 && (
                  <p className="text-xs text-muted-custom py-4 text-center">
                    All available rows are currently active on your home feed!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Configured Feed Rows */}
      {homeSections.map((sectionId) => {
        switch (sectionId) {
          case 'continue-watching': {
            const activeProgress = showProgress.filter((prog) => {
              const resolved = resolvedProgress[prog.showId];
              const totalEps = resolved ? resolved.totalEpisodes : prog.totalEpisodesCount;
              const watchedEps = resolved ? resolved.watchedEpisodesCount : prog.watchedEpisodesCount;
              return totalEps === 0 || watchedEps < totalEps;
            });
            if (activeProgress.length === 0) return null;
            return (
              <div key="continue-watching" className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2 text-foreground">
                    <Tv className="w-5 h-5 text-primary-custom" />
                    <span>Continue Watching</span>
                  </h2>
                  <button 
                    onClick={() => onNavigate({ type: 'watchlist' })}
                    className="text-primary-custom hover:text-primary-custom/80 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>View All Progress</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeProgress.map((prog) => {
                    const resolved = resolvedProgress[prog.showId];
                    const totalEps = resolved ? resolved.totalEpisodes : prog.totalEpisodesCount;
                    const watchedEps = resolved ? resolved.watchedEpisodesCount : prog.watchedEpisodesCount;
                    const percent = totalEps > 0 
                      ? Math.round((watchedEps / totalEps) * 100) 
                      : 0;
                    
                    const displaySeason = resolved ? resolved.nextSeason : prog.lastWatchedSeason;
                    const displayEpisode = resolved ? resolved.nextEpisode : prog.lastWatchedEpisode;

                    return (
                      <div 
                        key={prog.showId}
                        onClick={() => onNavigate({ type: 'show-details', showId: prog.showId })}
                        className="bg-card hover:bg-slate-800/20 border border-border-custom rounded-2xl p-3 flex gap-3.5 cursor-pointer hover:scale-[1.01] transition shadow-sm group"
                      >
                        <img 
                          src={getPosterUrl(prog.posterPath, 'w185')} 
                          alt={prog.title}
                          className="w-16 h-24 object-cover rounded-xl shrink-0 shadow-md bg-slate-900"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <h3 className="font-bold text-sm text-foreground truncate group-hover:text-primary-custom transition">
                              {prog.title}
                            </h3>
                            <p className="text-[11px] text-muted-custom font-mono mt-1">
                              Up Next: S{displaySeason < 10 ? '0' + displaySeason : displaySeason}E{displayEpisode < 10 ? '0' + displayEpisode : displayEpisode}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-medium text-muted-custom">
                              <span>{watchedEps} / {totalEps} episodes</span>
                              <span className="font-bold text-primary-custom">{percent}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-primary-custom h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          case 'trending-movies':
            if (trendingMovies.length === 0) return null;
            return (
              <div key="trending-movies" className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2 text-foreground">
                    <Film className="w-5 h-5 text-primary-custom" />
                    <span>Trending Movies</span>
                  </h2>
                  <button 
                    onClick={() => onNavigate({ type: 'discover' })}
                    className="text-primary-custom hover:text-primary-custom/80 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>Explore Library</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x">
                  {trendingMovies.map((movie) => (
                    <div 
                      key={movie.id}
                      onClick={() => handleMediaClick(movie, 'movie')}
                      className="w-36 md:w-44 shrink-0 snap-start cursor-pointer group space-y-2"
                    >
                      <div className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                        <img 
                          src={getPosterUrl(movie.poster_path, 'w342')} 
                          alt={movie.title}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-current" />
                          <span>{movie.vote_average.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="px-1 space-y-0.5">
                        <h3 className="font-bold text-xs truncate text-foreground group-hover:text-primary-custom transition" title={movie.title}>
                          {movie.title}
                          {(movie.runtime || runtimesCache[movie.id]) ? ` • ${formatRuntime(movie.runtime || runtimesCache[movie.id])}` : ''}
                        </h3>
                        <p className="text-[10px] text-muted-custom">
                          {formatDate(movie.release_date).split(',')[1]?.trim() || movie.release_date?.substring(0, 4) || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );

          case 'trending-tv':
            if (trendingTV.length === 0) return null;
            return (
              <div key="trending-tv" className="space-y-4 animate-fade-in">
                <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2 text-foreground">
                  <Tv className="w-5 h-5 text-primary-custom" />
                  <span>Trending TV Shows</span>
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x">
                  {trendingTV.map((show) => (
                    <div 
                      key={show.id}
                      onClick={() => handleMediaClick(show, 'tv')}
                      className="w-36 md:w-44 shrink-0 snap-start cursor-pointer group space-y-2"
                    >
                      <div className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                        <img 
                          src={getPosterUrl(show.poster_path, 'w342')} 
                          alt={show.name}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-current" />
                          <span>{show.vote_average.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="px-1 space-y-0.5">
                        <h3 className="font-bold text-xs truncate text-foreground group-hover:text-primary-custom transition">
                          {show.name}
                        </h3>
                        <p className="text-[10px] text-muted-custom">
                          {formatDate(show.first_air_date).split(',')[1]?.trim() || show.first_air_date?.substring(0, 4) || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );

          case 'upcoming-movies':
            return (
              <div key="upcoming-movies" className="space-y-4 animate-fade-in">
                <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground">
                  <Film className="w-4.5 h-4.5 text-primary-custom" />
                  <span>Upcoming Movie Releases</span>
                </h2>
                <div className="bg-card border border-border-custom rounded-2xl p-4 divide-y divide-border-custom max-h-[380px] overflow-y-auto animate-fade-in">
                  {upcomingMovies.length === 0 && <p className="text-sm text-muted-custom p-4 text-center">No upcoming movie releases found.</p>}
                  {upcomingMovies.map((movie) => (
                    <div 
                      key={movie.id}
                      onClick={() => handleMediaClick(movie, 'movie')}
                      className="py-3 flex gap-3.5 items-center cursor-pointer hover:bg-slate-800/10 rounded-xl px-2 transition"
                    >
                      <img 
                        src={getPosterUrl(movie.poster_path, 'w92')} 
                        alt={movie.title}
                        className="w-10 h-14 object-cover rounded-lg bg-slate-900 shadow"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-foreground truncate" title={movie.title}>
                          {movie.title}
                          {(movie.runtime || runtimesCache[movie.id]) ? ` • ${formatRuntime(movie.runtime || runtimesCache[movie.id])}` : ''}
                        </h4>
                        <p className="text-[10px] text-primary-custom font-medium mt-0.5">{formatDate(movie.release_date)}</p>
                      </div>
                      <div className="text-[10px] text-muted-custom bg-background px-2 py-1 rounded-lg">
                        Movie
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );

          case 'recently-premiered':
            return (
              <div key="recently-premiered" className="space-y-4 animate-fade-in">
                <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground">
                  <Tv className="w-4.5 h-4.5 text-primary-custom" />
                  <span>Recently Premiered TV</span>
                </h2>
                <div className="bg-card border border-border-custom rounded-2xl p-4 divide-y divide-border-custom max-h-[380px] overflow-y-auto animate-fade-in">
                  {recentlyPremiered.length === 0 && <p className="text-sm text-muted-custom p-4 text-center">No premiered shows found.</p>}
                  {recentlyPremiered.map((show) => (
                    <div 
                      key={show.id}
                      onClick={() => handleMediaClick(show, 'tv')}
                      className="py-3 flex gap-3.5 items-center cursor-pointer hover:bg-slate-800/10 rounded-xl px-2 transition"
                    >
                      <img 
                        src={getPosterUrl(show.poster_path, 'w92')} 
                        alt={show.name}
                        className="w-10 h-14 object-cover rounded-lg bg-slate-900 shadow"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-foreground truncate">{show.name}</h4>
                        <p className="text-[10px] text-primary-custom font-medium mt-0.5">Air Date: {formatDate(show.first_air_date)}</p>
                      </div>
                      <div className="text-[10px] text-muted-custom bg-background px-2 py-1 rounded-lg">
                        TV Show
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );

          case 'watchlist':
            return (
              <div key="watchlist" className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2 text-foreground">
                    <Bookmark className="w-5 h-5 text-primary-custom" />
                    <span>My Watchlist</span>
                  </h2>
                  <button 
                    onClick={() => onNavigate({ type: 'watchlist', tab: 'watchlist', listId: null })}
                    className="text-primary-custom hover:text-primary-custom/80 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>View Full List</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {watchlist.length === 0 ? (
                  <div className="text-center py-8 bg-card border border-dashed border-border-custom rounded-2xl w-full">
                    <p className="text-xs text-muted-custom">Your watchlist is empty.</p>
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x">
                    {watchlist.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => onNavigate({ type: item.mediaType === 'tv' ? 'show-details' : 'movie-details', [item.mediaType === 'tv' ? 'showId' : 'movieId']: item.tmdbId } as any)}
                        className="w-36 md:w-44 shrink-0 snap-start cursor-pointer group space-y-2"
                      >
                        <div className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                          <img 
                            src={getPosterUrl(item.posterPath, 'w342')} 
                            alt={item.title}
                            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[9px] font-bold text-primary-custom uppercase tracking-wider">
                            {item.mediaType}
                          </div>
                        </div>
                        <div className="px-1 space-y-0.5">
                          <h3 className="font-bold text-xs truncate text-foreground group-hover:text-primary-custom transition">
                            {item.title}
                          </h3>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );

          case 'favorites':
            return (
              <div key="favorites" className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2 text-foreground">
                    <Heart className="w-5 h-5 text-rose-400 fill-rose-400/10" />
                    <span>My Favorites</span>
                  </h2>
                  <button 
                    onClick={() => onNavigate({ type: 'watchlist', tab: 'favorites', listId: null })}
                    className="text-primary-custom hover:text-primary-custom/80 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>View Full List</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {favorites.length === 0 ? (
                  <div className="text-center py-8 bg-card border border-dashed border-border-custom rounded-2xl w-full">
                    <p className="text-xs text-muted-custom">Your favorites list is empty.</p>
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x">
                    {favorites.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => onNavigate({ type: item.mediaType === 'tv' ? 'show-details' : 'movie-details', [item.mediaType === 'tv' ? 'showId' : 'movieId']: item.tmdbId } as any)}
                        className="w-36 md:w-44 shrink-0 snap-start cursor-pointer group space-y-2"
                      >
                        <div className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                          <img 
                            src={getPosterUrl(item.posterPath, 'w342')} 
                            alt={item.title}
                            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[9px] font-bold text-rose-400 uppercase tracking-wider">
                            {item.mediaType}
                          </div>
                        </div>
                        <div className="px-1 space-y-0.5">
                          <h3 className="font-bold text-xs truncate text-foreground group-hover:text-primary-custom transition">
                            {item.title}
                          </h3>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );

          default:
            if (sectionId.startsWith('custom-list-')) {
              const listId = sectionId.substring('custom-list-'.length);
              const list = customLists.find(cl => cl.id === listId);
              if (!list) return null;
              return (
                <div key={sectionId} className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2 text-foreground">
                      <List className="w-5 h-5 text-indigo-400" />
                      <span>{list.name}</span>
                    </h2>
                    <button 
                      onClick={() => onNavigate({ type: 'watchlist', tab: 'custom_lists', listId: list.id })}
                      className="text-primary-custom hover:text-primary-custom/80 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>View Full List</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {list.items.length === 0 ? (
                    <div className="text-center py-8 bg-card border border-dashed border-border-custom rounded-2xl w-full">
                      <p className="text-xs text-muted-custom">This list is empty.</p>
                    </div>
                  ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x">
                      {list.items.map((item) => (
                        <div 
                          key={item.tmdbId}
                          onClick={() => onNavigate({ type: item.mediaType === 'tv' ? 'show-details' : 'movie-details', [item.mediaType === 'tv' ? 'showId' : 'movieId']: item.tmdbId } as any)}
                          className="w-36 md:w-44 shrink-0 snap-start cursor-pointer group space-y-2"
                        >
                          <div className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                            <img 
                              src={getPosterUrl(item.posterPath, 'w342')} 
                              alt={item.title}
                              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
                              {item.mediaType}
                            </div>
                          </div>
                          <div className="px-1 space-y-0.5">
                            <h3 className="font-bold text-xs truncate text-indigo-400 group-hover:text-indigo-400 transition" title={item.title}>
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-custom">
                              <span className="uppercase font-mono">{item.mediaType}</span>
                              {item.mediaType === 'movie' && (item.runtime || runtimesCache[item.tmdbId]) ? (
                                <>
                                  <span>•</span>
                                  <span className="text-primary-custom font-semibold">
                                    {formatRuntime(item.runtime || runtimesCache[item.tmdbId])}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return null;
        }
      })}

      {/* Saved / Favorites Summary Bar */}
      {(favorites.length > 0 || watchlist.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-primary-custom/5 border border-primary-custom/15 rounded-3xl p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary-custom">
              <Bookmark className="w-5 h-5 fill-current" />
              <h3 className="font-display font-bold text-base text-white">Your Watchlist Space</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              You currently have <strong className="text-primary-custom font-bold">{watchlist.length} titles</strong> pending in your private watchlist vault.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-rose-400">
              <Heart className="w-5 h-5 fill-current" />
              <h3 className="font-display font-bold text-base text-white">Favorite Curations</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Curate and customize unlimited lists. You have starred <strong className="text-rose-400 font-bold">{favorites.length} media titles</strong>.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
