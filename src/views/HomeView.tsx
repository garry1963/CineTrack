import React, { useState, useEffect } from 'react';
import { useCineTrack } from '../context/CineTrackContext';
import { tmdb } from '../services/tmdb';
import { TMDBMedia, ViewState } from '../types';
import { getPosterUrl, getBackdropUrl, formatDate } from '../lib/utils';
import { Play, Star, Bookmark, Heart, Shuffle, ArrowRight, Tv, Film, Eye, Sparkles } from 'lucide-react';

interface HomeViewProps {
  onNavigate: (view: ViewState) => void;
}

export default function HomeView({ onNavigate }: HomeViewProps) {
  const { watchlist, favorites, showProgress, watchedMovies } = useCineTrack();
  const [trendingMovies, setTrendingMovies] = useState<TMDBMedia[]>([]);
  const [trendingTV, setTrendingTV] = useState<TMDBMedia[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<TMDBMedia[]>([]);
  const [recentlyPremiered, setRecentlyPremiered] = useState<TMDBMedia[]>([]);
  const [randomRecommendation, setRandomRecommendation] = useState<TMDBMedia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHomeData() {
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
        
        setTrendingMovies(mResults.slice(0, 10));
        setTrendingTV(tResults.slice(0, 10));
        setUpcomingMovies((upcomingM.results || []).slice(0, 10));
        setRecentlyPremiered((premieredT.results || []).slice(0, 10));

        // Random recommendation from either movies or tv
        const combined = [...mResults, ...tResults];
        if (combined.length > 0) {
          const randomIndex = Math.floor(Math.random() * combined.length);
          setRandomRecommendation(combined[randomIndex]);
        }
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
      
      {/* Hero Random Recommendation Backdrop Banner */}
      {randomRecommendation && (
        <div className="relative rounded-3xl overflow-hidden aspect-backdrop w-full max-h-[380px] bg-slate-900 group shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10" />
          <img 
            src={getBackdropUrl(randomRecommendation.backdrop_path)} 
            alt={randomRecommendation.title || randomRecommendation.name}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-60 transition duration-700 group-hover:scale-102"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-20 space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-primary-custom/90 text-white text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-bold shadow-md">
              <Shuffle className="w-3 h-3 animate-pulse" />
              <span>Spotlight Suggestion</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl md:text-4xl text-white tracking-tight drop-shadow">
              {randomRecommendation.title || randomRecommendation.name}
            </h1>
            <p className="text-slate-300 text-xs md:text-sm line-clamp-2 leading-relaxed drop-shadow-sm">
              {randomRecommendation.overview}
            </p>
            <div className="pt-2 flex items-center gap-3">
              <button 
                onClick={() => handleMediaClick(randomRecommendation)}
                className="bg-white hover:bg-slate-100 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition transform active:scale-95 shadow-md"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Explore Details</span>
              </button>
              <button 
                onClick={() => {
                  const combined = [...trendingMovies, ...trendingTV];
                  const randomIdx = Math.floor(Math.random() * combined.length);
                  setRandomRecommendation(combined[randomIdx]);
                }}
                className="bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm flex items-center gap-2 transition"
                title="Shuffle Spotlight"
              >
                <Shuffle className="w-4 h-4 text-muted-custom" />
                <span className="hidden sm:inline">Shuffle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Continue Watching (TV Shows progress) */}
      {showProgress.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2 text-foreground">
              <Tv className="w-5 h-5 text-primary-custom" />
              <span>Continue Watching</span>
            </h2>
            <button 
              onClick={() => onNavigate({ type: 'watchlist' })}
              className="text-primary-custom hover:text-primary-custom/80 font-semibold text-xs flex items-center gap-1 transition"
            >
              <span>View All Progress</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {showProgress.map((prog) => {
              const percent = prog.totalEpisodesCount > 0 
                ? Math.round((prog.watchedEpisodesCount / prog.totalEpisodesCount) * 100) 
                : 0;
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
                        Up Next: S{prog.lastWatchedSeason < 10 ? '0' + prog.lastWatchedSeason : prog.lastWatchedSeason}E{prog.lastWatchedEpisode < 10 ? '0' + prog.lastWatchedEpisode : prog.lastWatchedEpisode}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-medium text-muted-custom">
                        <span>{prog.watchedEpisodesCount} / {prog.totalEpisodesCount} episodes</span>
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
      )}

      {/* Trending Movies Carousel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2 text-foreground">
            <Film className="w-5 h-5 text-primary-custom" />
            <span>Trending Movies</span>
          </h2>
          <button 
            onClick={() => onNavigate({ type: 'discover' })}
            className="text-primary-custom hover:text-primary-custom/80 font-semibold text-xs flex items-center gap-1 transition"
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
                <h3 className="font-bold text-xs truncate text-foreground group-hover:text-primary-custom transition">
                  {movie.title}
                </h3>
                <p className="text-[10px] text-muted-custom">
                  {formatDate(movie.release_date).split(',')[1]?.trim() || movie.release_date?.substring(0, 4) || 'N/A'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trending TV Shows Carousel */}
      <div className="space-y-4">
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

      {/* Bento Bottom Grid: Upcoming Movies & Recently Premiered */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Upcoming Movie Releases */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground">
            <Film className="w-4.5 h-4.5 text-primary-custom" />
            <span>Upcoming Movie Releases</span>
          </h2>
          <div className="bg-card border border-border-custom rounded-2xl p-4 divide-y divide-border-custom max-h-[380px] overflow-y-auto">
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
                  <h4 className="font-bold text-xs text-foreground truncate">{movie.title}</h4>
                  <p className="text-[10px] text-primary-custom font-medium mt-0.5">{formatDate(movie.release_date)}</p>
                </div>
                <div className="text-[10px] text-muted-custom bg-background px-2 py-1 rounded-lg">
                  Movie
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recently Premiered Shows */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground">
            <Tv className="w-4.5 h-4.5 text-primary-custom" />
            <span>Recently Premiered TV</span>
          </h2>
          <div className="bg-card border border-border-custom rounded-2xl p-4 divide-y divide-border-custom max-h-[380px] overflow-y-auto">
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

      </div>

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
