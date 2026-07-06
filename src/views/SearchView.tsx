import React, { useState, useEffect } from 'react';
import { tmdb } from '../services/tmdb';
import { TMDBMedia, ViewState } from '../types';
import { getPosterUrl } from '../lib/utils';
import { Search, SlidersHorizontal, Star, X, Film, Tv, User, Compass } from 'lucide-react';

interface SearchViewProps {
  onNavigate: (view: ViewState) => void;
}

export default function SearchView({ onNavigate }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters & Sorters
  const [showFilters, setShowFilters] = useState(false);
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv' | 'person'>('all');
  const [filterYear, setFilterYear] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [sortBy, setSortBy] = useState<'popularity' | 'release_date' | 'vote_average'>('popularity');

  // Trigger search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        let data;
        if (mediaType === 'person') {
          data = await tmdb.searchPerson(query);
        } else {
          data = await tmdb.searchMulti(query);
        }
        
        let searchResults = data.results || [];
        
        // Filter by media type if not 'all'
        if (mediaType !== 'all') {
          searchResults = searchResults.filter((item: any) => item.media_type === mediaType);
        }

        // Apply visual year filtering client-side
        if (filterYear) {
          searchResults = searchResults.filter((item: any) => {
            const dateStr = item.release_date || item.first_air_date || '';
            return dateStr.includes(filterYear);
          });
        }

        // Apply rating threshold client-side
        if (filterRating) {
          const threshold = Number(filterRating);
          searchResults = searchResults.filter((item: any) => (item.vote_average || 0) >= threshold);
        }

        // Sort results client-side
        searchResults.sort((a: any, b: any) => {
          if (sortBy === 'release_date') {
            const dateA = new Date(a.release_date || a.first_air_date || '1970-01-01').getTime();
            const dateB = new Date(b.release_date || b.first_air_date || '1970-01-01').getTime();
            return dateB - dateA;
          } else if (sortBy === 'vote_average') {
            return (b.vote_average || 0) - (a.vote_average || 0);
          } else {
            return (b.popularity || 0) - (a.popularity || 0);
          }
        });

        setResults(searchResults);
      } catch (err) {
        console.error('Error during TMDB search:', err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query, mediaType, filterYear, filterRating, sortBy]);

  const handleItemClick = (item: any) => {
    const type = item.media_type || (mediaType !== 'all' ? mediaType : 'movie');
    if (type === 'tv') {
      onNavigate({ type: 'show-details', showId: item.id });
    } else if (type === 'movie') {
      onNavigate({ type: 'movie-details', movieId: item.id });
    }
  };

  const clearFilters = () => {
    setFilterYear('');
    setFilterRating('');
    setSortBy('popularity');
    setMediaType('all');
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header Title */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-foreground">
          Universal Search
        </h1>
        <p className="text-sm text-muted-custom">
          Find movies, television shows, actors, and creators in one search query
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="flex gap-3">
        <div className="flex-1 bg-card border border-border-custom px-4 py-3.5 rounded-2xl flex items-center gap-3 shadow-sm focus-within:border-primary-custom transition">
          <Search className="w-5 h-5 text-muted-custom shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, cast, directors..."
            className="bg-transparent w-full outline-none text-sm text-foreground placeholder:text-muted-custom"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 rounded-full hover:bg-background text-muted-custom hover:text-foreground transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-2xl border flex items-center justify-center gap-2 font-semibold text-xs shadow-sm transition shrink-0 ${
            showFilters 
              ? 'bg-primary-custom text-white border-primary-custom' 
              : 'bg-card border-border-custom hover:bg-slate-800/10 text-foreground'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Advanced Filters</span>
        </button>
      </div>

      {/* Collapsible Filters Panel */}
      {showFilters && (
        <div className="bg-card border border-border-custom p-5 rounded-2xl shadow-md grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
          
          {/* Media Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Category</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as any)}
              className="w-full bg-background border border-border-custom px-3 py-2 rounded-xl text-xs font-medium text-foreground outline-none"
            >
              <option value="all">All Catalog</option>
              <option value="movie">Movies Only</option>
              <option value="tv">TV Shows Only</option>
              <option value="person">People Only</option>
            </select>
          </div>

          {/* Release Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Release Year</label>
            <input
              type="number"
              placeholder="e.g. 2026"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full bg-background border border-border-custom px-3 py-2 rounded-xl text-xs font-medium text-foreground outline-none"
            />
          </div>

          {/* Rating filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Minimum Rating</label>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="w-full bg-background border border-border-custom px-3 py-2 rounded-xl text-xs font-medium text-foreground outline-none"
            >
              <option value="">Any TMDB Rating</option>
              <option value="8">★ 8.0+ Excellent</option>
              <option value="7">★ 7.0+ Good</option>
              <option value="6">★ 6.0+ Average</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Sort Results</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-background border border-border-custom px-3 py-2 rounded-xl text-xs font-medium text-foreground outline-none"
            >
              <option value="popularity">Most Popular</option>
              <option value="release_date">Release Date</option>
              <option value="vote_average">Highest Rated</option>
            </select>
          </div>

          <div className="col-span-full pt-2 flex justify-end gap-2.5">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-border-custom hover:bg-background rounded-xl text-xs font-semibold text-muted-custom transition"
            >
              Reset filters
            </button>
          </div>

        </div>
      )}

      {/* Results Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-primary-custom/20 border-t-primary-custom animate-spin" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {results.map((item) => {
            const isPerson = item.media_type === 'person' || (!item.title && !item.name && item.profile_path);
            const imagePath = isPerson ? item.profile_path : item.poster_path;
            const subtitle = isPerson 
              ? `Actor • ${item.known_for_department || 'Cast'}` 
              : (item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4) || 'N/A');

            return (
              <div 
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="group cursor-pointer space-y-2.5"
              >
                <div className="relative aspect-poster rounded-2xl overflow-hidden bg-slate-900 shadow hover:shadow-lg transition">
                  <img 
                    src={getPosterUrl(imagePath, 'w342')} 
                    alt={item.title || item.name}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-103"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  {!isPerson && item.vote_average && (
                    <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[10px] font-bold text-amber-500 flex items-center gap-0.5 shadow-sm">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{item.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="px-1 space-y-0.5">
                  <h3 className="font-bold text-xs truncate text-foreground group-hover:text-primary-custom transition flex items-center gap-1">
                    {isPerson ? <User className="w-3.5 h-3.5 text-muted-custom" /> : item.media_type === 'tv' ? <Tv className="w-3.5 h-3.5 text-muted-custom" /> : <Film className="w-3.5 h-3.5 text-muted-custom" />}
                    <span>{item.title || item.name}</span>
                  </h3>
                  <p className="text-[10px] text-muted-custom">
                    {subtitle}
                  </p>
                </div>
              </div>
            );
          })}

          {!query.trim() && (
            <div className="col-span-full py-20 text-center text-muted-custom space-y-3">
              <Search className="w-12 h-12 mx-auto text-slate-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Type a query to search</p>
                <p className="text-xs">Find films, series, actors, and other content across TMDB library.</p>
              </div>
            </div>
          )}

          {query.trim() && results.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-custom space-y-3">
              <Compass className="w-12 h-12 mx-auto text-slate-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No matches found</p>
                <p className="text-xs">Try adjusting your query or filters above.</p>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
