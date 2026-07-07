import React, { useState, useEffect, useRef } from 'react';
import { useCineTrack } from '../context/CineTrackContext';
import { tmdb } from '../services/tmdb';
import { TMDBMedia, ViewState } from '../types';
import { getPosterUrl } from '../lib/utils';
import { Star, Flame, Sparkles, Trophy, Calendar, Compass, Tv, Film } from 'lucide-react';

interface DiscoverViewProps {
  onNavigate: (view: ViewState) => void;
}

type DiscoverSection = 'trending' | 'popular' | 'top_rated' | 'now_playing' | 'upcoming';

export default function DiscoverView({ onNavigate }: DiscoverViewProps) {
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [section, setSection] = useState<DiscoverSection>('trending');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Pagination / Scroll to load states
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [autoLoad, setAutoLoad] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const prevFiltersRef = useRef({ mediaType, section, selectedGenre });

  useEffect(() => {
    async function loadGenres() {
      try {
        const data = await tmdb.getGenres(mediaType);
        setGenres(data.genres || []);
      } catch (err) {
        console.error('Error fetching genres:', err);
      }
    }
    loadGenres();
  }, [mediaType]);

  useEffect(() => {
    // Check if the actual filters changed
    const filtersChanged = 
      prevFiltersRef.current.mediaType !== mediaType ||
      prevFiltersRef.current.section !== section ||
      prevFiltersRef.current.selectedGenre !== selectedGenre;

    if (filtersChanged) {
      prevFiltersRef.current = { mediaType, section, selectedGenre };
      if (page !== 1) {
        setPage(1);
        setHasMore(true);
        return; // Prevent fetching yet; resetting page will trigger this effect again with page=1
      }
    }

    async function loadDiscoverData() {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      try {
        let response;
        if (selectedGenre) {
          // Use discover API with genre filter and page
          response = await tmdb.getDiscover(mediaType, { genre: selectedGenre }, page);
        } else {
          // Standard sections with page
          switch (section) {
            case 'trending':
              response = await tmdb.getTrending(mediaType, 'week', page);
              break;
            case 'popular':
              response = await tmdb.getPopular(mediaType, page);
              break;
            case 'top_rated':
              response = await tmdb.getTopRated(mediaType, page);
              break;
            case 'now_playing':
              response = mediaType === 'movie' 
                ? await tmdb.getNowPlayingMovies(page) 
                : await tmdb.getOnTheAirTV(page);
              break;
            case 'upcoming':
              response = mediaType === 'movie' 
                ? await tmdb.getUpcomingMovies(page) 
                : await tmdb.getAiringTodayTV(page);
              break;
          }
        }

        const newItems = response?.results || [];
        if (page === 1) {
          setItems(newItems);
        } else {
          // De-duplicate newly fetched items just in case TMDB results contain overlaps
          setItems(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const filteredNew = newItems.filter(item => !existingIds.has(item.id));
            return [...prev, ...filteredNew];
          });
        }

        const totalPages = response?.total_pages || 1;
        setHasMore(page < totalPages && newItems.length > 0);
      } catch (err) {
        console.error('Error loading discover results:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    }
    
    loadDiscoverData();
  }, [mediaType, section, selectedGenre, page]);

  // IntersectionObserver to auto-load when the bottom loaderRef is visible
  useEffect(() => {
    if (!autoLoad || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setPage(prev => prev + 1);
      }
    }, {
      rootMargin: '200px', // Trigger slightly early before hitting absolute bottom for smoother scroll transition
    });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [autoLoad, hasMore, loading, loadingMore]);

  const handleMediaClick = (item: TMDBMedia) => {
    if (mediaType === 'tv') {
      onNavigate({ type: 'show-details', showId: item.id });
    } else {
      onNavigate({ type: 'movie-details', movieId: item.id });
    }
  };

  const sectionsList: { id: DiscoverSection; label: string; icon: any }[] = [
    { id: 'trending', label: 'Trending', icon: Flame },
    { id: 'popular', label: 'Popular', icon: Compass },
    { id: 'top_rated', label: 'Top Rated', icon: Trophy },
    { id: 'now_playing', label: mediaType === 'movie' ? 'Now Playing' : 'On The Air', icon: Sparkles },
    { id: 'upcoming', label: mediaType === 'movie' ? 'Upcoming' : 'Airing Today', icon: Calendar },
  ];

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header Panel */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-foreground">
          Discover content
        </h1>
        <p className="text-sm text-muted-custom">
          Browse films and television shows powered directly by TMDB
        </p>
      </div>

      {/* Media Type & Section Selection Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border-custom p-4 rounded-2xl shadow-sm">
        
        {/* Movie vs TV Toggle */}
        <div className="flex bg-background p-1.5 rounded-xl border border-border-custom w-fit shrink-0">
          <button
            onClick={() => { setMediaType('movie'); setSelectedGenre(null); }}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              mediaType === 'movie' 
                ? 'bg-primary-custom text-white shadow' 
                : 'text-muted-custom hover:text-foreground'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Movies</span>
          </button>
          <button
            onClick={() => { setMediaType('tv'); setSelectedGenre(null); }}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              mediaType === 'tv' 
                ? 'bg-primary-custom text-white shadow' 
                : 'text-muted-custom hover:text-foreground'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>TV Shows</span>
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {sectionsList.map((sec) => {
            const Icon = sec.icon;
            const isActive = section === sec.id && !selectedGenre;
            return (
              <button
                key={sec.id}
                onClick={() => { setSection(sec.id); setSelectedGenre(null); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
                  isActive 
                    ? 'bg-primary-custom/10 text-primary-custom border border-primary-custom/20' 
                    : 'bg-background hover:bg-slate-800/10 border border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Genre Filter List */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-custom px-1">Filter by Genre</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setSelectedGenre(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              selectedGenre === null 
                ? 'bg-primary-custom text-white shadow' 
                : 'bg-card border border-border-custom text-muted-custom hover:text-foreground'
            }`}
          >
            All Genres
          </button>
          {genres.map((genre) => (
            <button
              key={genre.id}
              onClick={() => setSelectedGenre(genre.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedGenre === genre.id 
                  ? 'bg-primary-custom text-white shadow' 
                  : 'bg-card border border-border-custom text-muted-custom hover:text-foreground'
              }`}
            >
              {genre.name}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-primary-custom/20 border-t-primary-custom animate-spin" />
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {items.map((item) => (
              <div 
                key={item.id}
                onClick={() => handleMediaClick(item)}
                className="group cursor-pointer space-y-2.5"
              >
                <div className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow hover:shadow-lg transition-all duration-300">
                  <img 
                    src={getPosterUrl(item.poster_path, 'w342')} 
                    alt={item.title || item.name}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-103"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[10px] font-bold text-amber-500 flex items-center gap-0.5 shadow-sm">
                    <Star className="w-3 h-3 fill-current" />
                    <span>{item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                  </div>
                </div>
                <div className="px-1 space-y-0.5">
                  <h3 className="font-bold text-xs truncate text-foreground group-hover:text-primary-custom transition">
                    {item.title || item.name}
                  </h3>
                  <p className="text-[10px] text-muted-custom">
                    {item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4) || 'N/A'}
                  </p>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-custom space-y-2">
                <Compass className="w-10 h-10 mx-auto text-slate-700" />
                <p className="text-sm">No results match this selection.</p>
              </div>
            )}
          </div>

          {/* Pagination / Load More Section */}
          {items.length > 0 && hasMore && (
            <div 
              ref={loaderRef}
              className="py-10 border-t border-border-custom/50 flex flex-col items-center justify-center gap-4 text-center"
              id="discover-pagination-control"
            >
              {loadingMore ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-3 border-primary-custom/20 border-t-primary-custom animate-spin" />
                  </div>
                  <p className="text-[11px] text-muted-custom font-semibold tracking-wider uppercase animate-pulse">
                    Fetching page {page + 1}...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-900/10 border border-border-custom/30 p-5 rounded-3xl backdrop-blur-sm max-w-lg w-full justify-between">
                  <div className="text-left space-y-1">
                    <h4 className="text-xs font-bold text-foreground">
                      {selectedGenre ? 'More Genre Matches Available' : 'Keep Exploring'}
                    </h4>
                    <p className="text-[10px] text-muted-custom">
                      Currently viewing {items.length} items (Page {page})
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-wider text-muted-custom hover:text-foreground transition select-none">
                      <input
                        type="checkbox"
                        checked={autoLoad}
                        onChange={(e) => setAutoLoad(e.target.checked)}
                        className="rounded border-border-custom text-primary-custom focus:ring-primary-custom bg-card w-4 h-4 cursor-pointer"
                        id="auto-load-checkbox"
                      />
                      <span>Auto-Load</span>
                    </label>
                    <button
                      onClick={() => setPage((prev) => prev + 1)}
                      className="px-5 py-2.5 rounded-xl bg-primary-custom hover:bg-primary-custom/90 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all duration-200 active:scale-95 cursor-pointer"
                      id="load-next-page-btn"
                    >
                      <span>Load Page {page + 1}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
