import React, { useState, useEffect } from 'react';
import { useCineTrack } from '../context/CineTrackContext';
import { tmdb } from '../services/tmdb';
import { TMDBMedia, TMDBSeason, TMDBEpisode, ViewState, MovieStatus, CustomList } from '../types';
import { getPosterUrl, getBackdropUrl, formatDate, formatCurrency, formatRuntime } from '../lib/utils';
import { 
  Star, Bookmark, Heart, ChevronLeft, Calendar, 
  Clock, Landmark, Play, Sparkles, Check, ChevronRight, PenTool, Edit3, X, Tv,
  Plus, List, Shield
} from 'lucide-react';

interface DetailsViewProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

interface ListSelectorProps {
  media: TMDBMedia;
  mediaType: 'movie' | 'tv';
  watchlist: any[];
  favorites: any[];
  customLists: CustomList[];
  addToWatchlist: (media: TMDBMedia, mediaType: 'movie' | 'tv') => Promise<void>;
  removeFromWatchlist: (tmdbId: number, mediaType: 'movie' | 'tv') => Promise<void>;
  toggleFavorite: (media: TMDBMedia, mediaType: 'movie' | 'tv') => Promise<void>;
  saveCustomList: (list: Partial<CustomList>) => Promise<void>;
}

function ListSelector({
  media,
  mediaType,
  watchlist,
  favorites,
  customLists,
  addToWatchlist,
  removeFromWatchlist,
  toggleFavorite,
  saveCustomList
}: ListSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isWatchlisted = watchlist.some(w => w.id === `${mediaType}_${media.id}`);
  const isFav = favorites.some(f => f.id === `${mediaType}_${media.id}`);

  const handleToggleWatchlist = async () => {
    if (isWatchlisted) {
      await removeFromWatchlist(media.id, mediaType);
    } else {
      await addToWatchlist(media, mediaType);
    }
  };

  const handleToggleFavorite = async () => {
    await toggleFavorite(media, mediaType);
  };

  const isItemInCustomList = (list: CustomList) => {
    return list.items.some(item => item.tmdbId === media.id);
  };

  const handleToggleCustomList = async (list: CustomList) => {
    const isInList = isItemInCustomList(list);
    let updatedItems;
    if (isInList) {
      updatedItems = list.items.filter(item => item.tmdbId !== media.id);
    } else {
      updatedItems = [
        ...list.items,
        {
          tmdbId: media.id,
          mediaType,
          title: media.title || media.name || '',
          posterPath: media.poster_path
        }
      ];
    }
    await saveCustomList({
      ...list,
      items: updatedItems
    });
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const listId = `list_${Math.random().toString(36).substr(2, 9)}`;
    const newList: CustomList = {
      id: listId,
      name: newListName.trim(),
      description: '',
      artworkUrl: null,
      items: [
        {
          tmdbId: media.id,
          mediaType,
          title: media.title || media.name || '',
          posterPath: media.poster_path
        }
      ],
      createdAt: Date.now(),
      order: customLists.length
    };

    await saveCustomList(newList);
    setNewListName('');
    setIsCreating(false);
  };

  return (
    <div className="relative inline-block text-left" id={`list-selector-${mediaType}-${media.id}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2.5 bg-primary-custom hover:bg-primary-custom/90 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md cursor-pointer"
        id={`add-to-list-trigger-${media.id}`}
      >
        <Plus className="w-4 h-4" />
        <span>Add to List...</span>
      </button>

      {isOpen && (
        <>
          {/* Transparent click-outside overlay */}
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => { setIsOpen(false); setIsCreating(false); }} 
          />
          
          <div 
            className="origin-top-right absolute left-0 mt-2 w-72 rounded-2xl shadow-xl bg-card border border-border-custom ring-1 ring-black ring-opacity-5 z-40 focus:outline-none divide-y divide-border-custom overflow-hidden"
            id={`list-selector-dropdown-${media.id}`}
          >
            {/* Standard Lists */}
            <div className="py-2.5 px-3 space-y-1">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-custom px-2 mb-1">
                Standard Lists
              </span>
              
              <button
                type="button"
                onClick={handleToggleWatchlist}
                className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-slate-800/10 rounded-xl transition text-left"
              >
                <span className="flex items-center gap-2">
                  <Bookmark className={`w-3.5 h-3.5 ${isWatchlisted ? 'text-primary-custom fill-current' : 'text-muted-custom'}`} />
                  <span>Watchlist</span>
                </span>
                {isWatchlisted && <Check className="w-3.5 h-3.5 text-primary-custom" />}
              </button>

              <button
                type="button"
                onClick={handleToggleFavorite}
                className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-slate-800/10 rounded-xl transition text-left"
              >
                <span className="flex items-center gap-2">
                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'text-rose-500 fill-current' : 'text-muted-custom'}`} />
                  <span>Favorites</span>
                </span>
                {isFav && <Check className="w-3.5 h-3.5 text-rose-500" />}
              </button>
            </div>

            {/* Custom Lists */}
            <div className="py-2.5 px-3 space-y-1 max-h-48 overflow-y-auto">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-custom px-2 mb-1">
                Your Custom Lists
              </span>

              {customLists.length === 0 ? (
                <p className="text-[10px] text-muted-custom px-2.5 py-1">
                  No custom lists created yet.
                </p>
              ) : (
                customLists.map(list => {
                  const isInList = isItemInCustomList(list);
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => handleToggleCustomList(list)}
                      className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-slate-800/10 rounded-xl transition text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-custom shrink-0" />
                        <span className="truncate">{list.name}</span>
                      </span>
                      {isInList && <Check className="w-3.5 h-3.5 text-primary-custom" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Create list quick field */}
            <div className="p-3 bg-slate-900/10">
              {!isCreating ? (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="w-full py-2 bg-background hover:bg-slate-800/20 border border-border-custom text-[11px] font-bold text-muted-custom hover:text-foreground rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-primary-custom" />
                  <span>Create New List...</span>
                </button>
              ) : (
                <form onSubmit={handleCreateAndAdd} className="space-y-2">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="List name..."
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full bg-background border border-border-custom px-2.5 py-1.5 rounded-lg text-xs text-foreground outline-none focus:border-primary-custom"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button
                      type="button"
                      onClick={() => { setIsCreating(false); setNewListName(''); }}
                      className="px-2 py-1 border border-border-custom hover:bg-background rounded-lg text-[10px] font-semibold text-muted-custom cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2 py-1 bg-primary-custom hover:bg-primary-custom/90 text-white rounded-lg text-[10px] font-semibold cursor-pointer"
                    >
                      Create & Add
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DetailsView({ currentView, onNavigate }: DetailsViewProps) {
  const { 
    user,
    watchlist, 
    favorites, 
    addToWatchlist, 
    removeFromWatchlist, 
    toggleFavorite,
    isMovieWatched,
    getMovieStatus,
    toggleMovieWatched,
    isEpisodeWatched,
    toggleEpisodeWatched,
    ratings,
    rateItem,
    getItemRating,
    saveNote,
    getItemNote,
    customLists,
    saveCustomList
  } = useCineTrack();

  const [media, setMedia] = useState<TMDBMedia | null>(null);
  const [season, setSeason] = useState<TMDBSeason | null>(null);
  const [episode, setEpisode] = useState<TMDBEpisode | null>(null);
  const [loading, setLoading] = useState(true);

  // Rating and Notes editor state
  const [showEditor, setShowEditor] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userNote, setUserNote] = useState('');

  // Pad numbers for S01E02 format
  const pad = (n: number) => n < 10 ? `0${n}` : n;

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      try {
        if (currentView.type === 'movie-details') {
          const data = await tmdb.getMovieDetails(currentView.movieId);
          setMedia(data);
          setUserRating(getItemRating(currentView.movieId, 'movie'));
          setUserNote(getItemNote(currentView.movieId, 'movie'));
        } else if (currentView.type === 'show-details') {
          const data = await tmdb.getShowDetails(currentView.showId);
          setMedia(data);
          setUserRating(getItemRating(currentView.showId, 'tv'));
          setUserNote(getItemNote(currentView.showId, 'tv'));
        } else if (currentView.type === 'season-details') {
          const data = await tmdb.getSeasonDetails(currentView.showId, currentView.seasonNumber);
          setSeason(data);
        } else if (currentView.type === 'episode-details') {
          const data = await tmdb.getEpisodeDetails(currentView.showId, currentView.seasonNumber, currentView.episodeNumber);
          setEpisode(data);
          setUserRating(getItemRating(`${currentView.showId}_${currentView.seasonNumber}_${currentView.episodeNumber}`, 'episode'));
          setUserNote(getItemNote(`${currentView.showId}_${currentView.seasonNumber}_${currentView.episodeNumber}`, 'episode'));
        }
      } catch (err) {
        console.error('Failed to load metadata:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [currentView]);

  const handleBack = () => {
    if (currentView.type === 'season-details') {
      onNavigate({ type: 'show-details', showId: currentView.showId });
    } else if (currentView.type === 'episode-details') {
      onNavigate({ type: 'season-details', showId: currentView.showId, seasonNumber: currentView.seasonNumber, showName: currentView.showName });
    } else {
      onNavigate({ type: 'home' });
    }
  };

  const handleSaveEditor = async () => {
    if (currentView.type === 'movie-details') {
      await rateItem(currentView.movieId, 'movie', userRating);
      await saveNote(currentView.movieId, 'movie', userNote);
    } else if (currentView.type === 'show-details') {
      await rateItem(currentView.showId, 'tv', userRating);
      await saveNote(currentView.showId, 'tv', userNote);
    } else if (currentView.type === 'episode-details') {
      const epKey = `${currentView.showId}_${currentView.seasonNumber}_${currentView.episodeNumber}`;
      await rateItem(epKey, 'episode', userRating);
      await saveNote(epKey, 'episode', userNote);
    }
    setShowEditor(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary-custom/20 border-t-primary-custom animate-spin" />
        </div>
      </div>
    );
  }

  // Render Movie Details Sub-Screen
  if (currentView.type === 'movie-details' && media) {
    const isWatchlisted = watchlist.some(w => w.id === `movie_${media.id}`);
    const isFav = favorites.some(f => f.id === `movie_${media.id}`);
    const movieStatus = getMovieStatus(media.id);

    return (
      <div className="space-y-8 pb-16">
        
        {/* Backdrop Banner Header */}
        <div className="relative rounded-3xl overflow-hidden aspect-backdrop w-full max-h-[420px] bg-slate-900 group shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent z-10" />
          <img 
            src={getBackdropUrl(media.backdrop_path)} 
            alt={media.title}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-60 transition duration-700"
            referrerPolicy="no-referrer"
          />
          
          <button 
            onClick={handleBack}
            className="absolute top-4 left-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-xl backdrop-blur-md z-20 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-20 space-y-3 max-w-3xl">
            <h1 className="font-display font-extrabold text-2xl md:text-5xl text-white tracking-tight leading-tight">
              {media.title}
            </h1>
            {media.tagline && (
              <p className="text-slate-300 text-xs md:text-sm font-medium italic">
                "{media.tagline}"
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-primary-custom" /> {formatDate(media.release_date)}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-primary-custom" /> {formatRuntime(media.runtime)}</span>
              {media.vote_average > 0 && (
                <span className="flex items-center gap-1 text-amber-500 font-bold"><Star className="w-4 h-4 fill-current" /> {media.vote_average.toFixed(1)} / 10</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls Panel */}
        {user ? (
          <div className="bg-card border border-border-custom p-4 rounded-3xl shadow-sm flex flex-wrap gap-3.5 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Watchlist toggle */}
              <button
                onClick={() => isWatchlisted ? removeFromWatchlist(media.id, 'movie') : addToWatchlist(media, 'movie')}
                className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition bg-background border border-border-custom text-muted-custom hover:text-foreground cursor-pointer"
              >
                <Bookmark className="w-4 h-4" />
                <span>{isWatchlisted ? 'Watchlisted' : 'Add to Watchlist'}</span>
              </button>

              {/* Favorite Toggle */}
              <button
                onClick={() => toggleFavorite(media, 'movie')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                  isFav 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25' 
                    : 'bg-background border border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                <span>Favorite</span>
              </button>

              {/* List Selector dropdown */}
              <ListSelector
                media={media}
                mediaType="movie"
                watchlist={watchlist}
                favorites={favorites}
                customLists={customLists}
                addToWatchlist={addToWatchlist}
                removeFromWatchlist={removeFromWatchlist}
                toggleFavorite={toggleFavorite}
                saveCustomList={saveCustomList}
              />

              {/* Notes & Rating edit button */}
              <button
                onClick={() => {
                  setUserRating(getItemRating(media.id, 'movie'));
                  setUserNote(getItemNote(media.id, 'movie'));
                  setShowEditor(true);
                }}
                className="px-4 py-2.5 bg-background border border-border-custom hover:border-primary-custom text-muted-custom hover:text-foreground rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <PenTool className="w-4 h-4 text-primary-custom" />
                <span>Personal Rating & Notes</span>
              </button>
            </div>

            {/* Watch status dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-custom font-semibold">Your Status:</span>
              <select
                value={movieStatus}
                onChange={(e) => toggleMovieWatched(media.id, media.title || '', media.poster_path, e.target.value as MovieStatus)}
                className="bg-background border border-border-custom px-3 py-2 rounded-xl font-bold text-foreground outline-none"
              >
                <option value="Unwatched">Unwatched</option>
                <option value="Watched">Watched</option>
                <option value="Wishlist">Wishlist</option>
                <option value="Rewatch">Rewatch</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border-custom p-5 rounded-3xl shadow-sm flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="bg-primary-custom/10 text-primary-custom font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Read-Only Guest Mode</span>
              </span>
              {isWatchlisted && (
                <span className="bg-slate-800/20 text-foreground border border-border-custom font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-primary-custom fill-current" />
                  <span>On Administrator's Watchlist</span>
                </span>
              )}
              {isFav && (
                <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span>Administrator's Favorite</span>
                </span>
              )}
              {movieStatus && movieStatus !== 'Unwatched' && (
                <span className="bg-emerald-500/10 text-emerald-500 font-bold px-3 py-1.5 rounded-xl capitalize">
                  Admin Status: {movieStatus}
                </span>
              )}
            </div>

            {(userRating > 0 || userNote) && (
              <div className="bg-background border border-border-custom p-4 rounded-2xl w-full md:max-w-md space-y-2 shrink-0">
                <div className="flex justify-between items-center pb-2 border-b border-border-custom/50">
                  <span className="text-[10px] font-extrabold text-muted-custom uppercase tracking-wider">Administrator Review</span>
                  {userRating > 0 && <span className="text-amber-500 text-xs font-bold">★ {userRating} / 10</span>}
                </div>
                {userNote && <p className="text-xs text-foreground italic whitespace-pre-wrap">"{userNote}"</p>}
              </div>
            )}
          </div>
        )}

        {/* Details Grid: Synopsis & Meta */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main content column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Overview */}
            <div className="space-y-2.5">
              <h3 className="font-display font-extrabold text-lg text-foreground">Synopsis</h3>
              <p className="text-muted-custom text-sm leading-relaxed">{media.overview || 'No synopsis available.'}</p>
            </div>

            {/* Cast Listing */}
            {media.credits?.cast && media.credits.cast.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="font-display font-extrabold text-lg text-foreground">Principal Cast</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                  {media.credits.cast.slice(0, 10).map((actor) => (
                    <div key={actor.id} className="w-24 shrink-0 text-center space-y-2">
                      <img 
                        src={getPosterUrl(actor.profile_path, 'w185')} 
                        alt={actor.name}
                        className="w-18 h-18 rounded-full object-cover mx-auto bg-slate-900 shadow-sm"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div>
                        <p className="font-bold text-[10px] text-foreground line-clamp-1">{actor.name}</p>
                        <p className="text-[9px] text-muted-custom line-clamp-1 mt-0.5">{actor.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Sidebar Metadata */}
          <div className="bg-card border border-border-custom p-5 rounded-3xl space-y-4 shadow-sm h-fit">
            <h3 className="font-display font-bold text-base text-foreground pb-2 border-b border-border-custom">Production Facts</h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-custom">Status</span>
                <span className="font-semibold text-foreground">{media.status || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-custom">Budget</span>
                <span className="font-semibold text-foreground">{formatCurrency(media.budget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-custom">Revenue</span>
                <span className="font-semibold text-foreground">{formatCurrency(media.revenue)}</span>
              </div>
              {media.genres && media.genres.length > 0 && (
                <div className="pt-2 border-t border-border-custom space-y-1.5">
                  <span className="text-muted-custom">Genres</span>
                  <div className="flex flex-wrap gap-1.5">
                    {media.genres.map(g => (
                      <span key={g.id} className="bg-background border border-border-custom px-2.5 py-1 rounded-full text-[10px] text-muted-custom">
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Custom editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-lg rounded-2xl border border-border-custom p-6 space-y-4 shadow-2xl animate-scaleUp">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-lg text-foreground">Personal Curation</h3>
                <button onClick={() => setShowEditor(false)} className="p-1 rounded hover:bg-background text-muted-custom"><X className="w-5 h-5" /></button>
              </div>

              {/* Slider for Rating */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Your Rating</label>
                  <span className="text-xs font-bold text-amber-500">★ {userRating || 'Unrated'} / 10</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={userRating}
                  onChange={(e) => setUserRating(Number(e.target.value))}
                  className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary-custom"
                />
              </div>

              {/* Textarea for Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Private Notes (Markdown Supported)</label>
                <textarea
                  placeholder="Record thoughts, viewing date, or quotes..."
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  rows={4}
                  className="w-full bg-background border border-border-custom px-3.5 py-2.5 rounded-xl text-sm outline-none text-foreground focus:border-primary-custom"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 border border-border-custom hover:bg-background rounded-xl text-xs font-semibold text-muted-custom"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditor}
                  className="bg-primary-custom hover:bg-primary-custom/95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md"
                >
                  Save Curation
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Render TV Show Details Sub-Screen
  if (currentView.type === 'show-details' && media) {
    const isWatchlisted = watchlist.some(w => w.id === `tv_${media.id}`);
    const isFav = favorites.some(f => f.id === `tv_${media.id}`);

    return (
      <div className="space-y-8 pb-16">
        
        {/* Backdrop Header Banner */}
        <div className="relative rounded-3xl overflow-hidden aspect-backdrop w-full max-h-[420px] bg-slate-900 group shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent z-10" />
          <img 
            src={getBackdropUrl(media.backdrop_path)} 
            alt={media.name}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-60 transition duration-700"
            referrerPolicy="no-referrer"
          />
          
          <button 
            onClick={handleBack}
            className="absolute top-4 left-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-xl backdrop-blur-md z-20 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-20 space-y-3 max-w-3xl">
            <h1 className="font-display font-extrabold text-2xl md:text-5xl text-white tracking-tight leading-tight">
              {media.name}
            </h1>
            {media.tagline && (
              <p className="text-slate-300 text-xs md:text-sm font-medium italic">
                "{media.tagline}"
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-primary-custom" /> {formatDate(media.first_air_date)}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-primary-custom" /> S{media.number_of_seasons || 1} • {media.number_of_episodes || 0} eps</span>
              {media.vote_average > 0 && (
                <span className="flex items-center gap-1 text-amber-500 font-bold"><Star className="w-4 h-4 fill-current" /> {media.vote_average.toFixed(1)} / 10</span>
              )}
            </div>
          </div>
        </div>

        {/* Action controls */}
        {user ? (
          <div className="bg-card border border-border-custom p-4 rounded-3xl shadow-sm flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => isWatchlisted ? removeFromWatchlist(media.id, 'tv') : addToWatchlist(media, 'tv')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                  isWatchlisted 
                    ? 'bg-primary-custom text-white' 
                    : 'bg-background border border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                <span>{isWatchlisted ? 'Watchlisted' : 'Add to Watchlist'}</span>
              </button>

              <button
                onClick={() => toggleFavorite(media, 'tv')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                  isFav 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25' 
                    : 'bg-background border border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                <span>Favorite Show</span>
              </button>

              {/* List Selector dropdown */}
              <ListSelector
                media={media}
                mediaType="tv"
                watchlist={watchlist}
                favorites={favorites}
                customLists={customLists}
                addToWatchlist={addToWatchlist}
                removeFromWatchlist={removeFromWatchlist}
                toggleFavorite={toggleFavorite}
                saveCustomList={saveCustomList}
              />

              <button
                onClick={() => {
                  setUserRating(getItemRating(media.id, 'tv'));
                  setUserNote(getItemNote(media.id, 'tv'));
                  setShowEditor(true);
                }}
                className="px-4 py-2.5 bg-background border border-border-custom hover:border-primary-custom text-muted-custom hover:text-foreground rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <PenTool className="w-4 h-4 text-primary-custom" />
                <span>Personal Rating & Notes</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border-custom p-5 rounded-3xl shadow-sm flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="bg-primary-custom/10 text-primary-custom font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Read-Only Guest Mode</span>
              </span>
              {isWatchlisted && (
                <span className="bg-slate-800/20 text-foreground border border-border-custom font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-primary-custom fill-current" />
                  <span>On Administrator's Watchlist</span>
                </span>
              )}
              {isFav && (
                <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span>Administrator's Favorite</span>
                </span>
              )}
            </div>

            {(userRating > 0 || userNote) && (
              <div className="bg-background border border-border-custom p-4 rounded-2xl w-full md:max-w-md space-y-2 shrink-0">
                <div className="flex justify-between items-center pb-2 border-b border-border-custom/50">
                  <span className="text-[10px] font-extrabold text-muted-custom uppercase tracking-wider">Administrator Review</span>
                  {userRating > 0 && <span className="text-amber-500 text-xs font-bold">★ {userRating} / 10</span>}
                </div>
                {userNote && <p className="text-xs text-foreground italic whitespace-pre-wrap">"{userNote}"</p>}
              </div>
            )}
          </div>
        )}

        {/* Content Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* Overview */}
            <div className="space-y-2.5">
              <h3 className="font-display font-extrabold text-lg text-foreground">Synopsis</h3>
              <p className="text-muted-custom text-sm leading-relaxed">{media.overview || 'No synopsis available.'}</p>
            </div>

            {/* Seasons List page lookup */}
            <div className="space-y-3 pt-2">
              <h3 className="font-display font-extrabold text-lg text-foreground">Browse Seasons</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {Array.from({ length: media.number_of_seasons || 1 }).map((_, i) => {
                  const seasonNum = i + 1;
                  return (
                    <div
                      key={seasonNum}
                      onClick={() => onNavigate({ 
                        type: 'season-details', 
                        showId: media.id, 
                        seasonNumber: seasonNum, 
                        showName: media.name || '' 
                      })}
                      className="bg-card hover:bg-slate-800/15 border border-border-custom p-4 rounded-2xl cursor-pointer flex justify-between items-center group transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-custom/10 text-primary-custom rounded-xl flex items-center justify-center shrink-0">
                          <Tv className="w-4.5 h-4.5" />
                        </div>
                        <span className="font-bold text-sm text-foreground group-hover:text-primary-custom transition">Season {seasonNum}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-custom group-hover:text-primary-custom transition group-hover:translate-x-1" />
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Sidebar Meta facts */}
          <div className="bg-card border border-border-custom p-5 rounded-3xl space-y-4 shadow-sm h-fit">
            <h3 className="font-display font-bold text-base text-foreground pb-2 border-b border-border-custom">Show Details</h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-custom">Status</span>
                <span className="font-semibold text-foreground">{media.status || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-custom">Seasons count</span>
                <span className="font-semibold text-foreground">{media.number_of_seasons || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-custom">Episodes count</span>
                <span className="font-semibold text-foreground">{media.number_of_episodes || 'N/A'}</span>
              </div>
              {media.networks && media.networks.length > 0 && (
                <div className="pt-2 border-t border-border-custom space-y-2">
                  <span className="text-muted-custom">Networks</span>
                  <div className="flex flex-wrap gap-2">
                    {media.networks.map(n => (
                      <span key={n.id} className="bg-background border border-border-custom px-2.5 py-1 rounded-md text-[10px] font-semibold text-foreground">
                        {n.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Show Editor Rating Modal */}
        {showEditor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-lg rounded-2xl border border-border-custom p-6 space-y-4 shadow-2xl animate-scaleUp">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-lg text-foreground">Personal Curation</h3>
                <button onClick={() => setShowEditor(false)} className="p-1 rounded hover:bg-background text-muted-custom"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Your Rating</label>
                  <span className="text-xs font-bold text-amber-500">★ {userRating || 'Unrated'} / 10</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={userRating}
                  onChange={(e) => setUserRating(Number(e.target.value))}
                  className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary-custom"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Private Notes</label>
                <textarea
                  placeholder="Record thoughts or viewing date..."
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  rows={4}
                  className="w-full bg-background border border-border-custom px-3.5 py-2.5 rounded-xl text-sm outline-none text-foreground focus:border-primary-custom"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setShowEditor(false)} className="px-4 py-2 border border-border-custom hover:bg-background rounded-xl text-xs font-semibold text-muted-custom">Cancel</button>
                <button onClick={handleSaveEditor} className="bg-primary-custom hover:bg-primary-custom/95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md">Save Curation</button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Render TV Season Page (listing episodes)
  if (currentView.type === 'season-details' && season) {
    const totalEps = season.episodes?.length || 0;

    return (
      <div className="space-y-6 pb-16">
        
        {/* Simple Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBack}
            className="bg-card border border-border-custom text-foreground p-2 rounded-xl hover:bg-slate-800/10 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-display font-extrabold text-xl text-foreground">{currentView.showName}</h2>
            <p className="text-xs text-muted-custom font-semibold">Season {season.season_number} • {totalEps} Episodes</p>
          </div>
        </div>

        {/* Season synopsis if exists */}
        {season.overview && (
          <div className="bg-card border border-border-custom p-5 rounded-3xl space-y-2.5">
            <h3 className="font-display font-bold text-sm text-foreground">Season overview</h3>
            <p className="text-xs text-muted-custom leading-relaxed">{season.overview}</p>
          </div>
        )}

        {/* Episodes Cards Stack */}
        <div className="space-y-4">
          <h3 className="font-display font-extrabold text-base text-foreground">Episode list</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {season.episodes?.map((ep) => {
              const watched = isEpisodeWatched(currentView.showId, season.season_number, ep.episode_number);
              return (
                <div
                  key={ep.id}
                  onClick={() => onNavigate({ 
                    type: 'episode-details', 
                    showId: currentView.showId, 
                    seasonNumber: season.season_number, 
                    episodeNumber: ep.episode_number, 
                    showName: currentView.showName 
                  })}
                  className="bg-card hover:bg-slate-800/10 border border-border-custom p-4 rounded-2xl flex gap-4 cursor-pointer hover:scale-[1.01] transition shadow-sm group"
                >
                  <img 
                    src={getPosterUrl(ep.still_path, 'w185')} 
                    alt={ep.name}
                    className="w-24 h-16 object-cover rounded-xl shrink-0 shadow bg-slate-900"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-foreground truncate group-hover:text-primary-custom transition">
                        {ep.episode_number}. {ep.name}
                      </h4>
                      <p className="text-[10px] text-muted-custom font-medium mt-1">Air Date: {formatDate(ep.air_date)}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {user ? (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Toggle watched episode progress in Firestore
                            await toggleEpisodeWatched(
                              currentView.showId, 
                              season.season_number, 
                              ep.episode_number, 
                              currentView.showName, 
                              null, 
                              totalEps
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            watched 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : 'bg-background hover:bg-slate-800/15 text-muted-custom border border-border-custom'
                          }`}
                        >
                          {watched ? <Check className="w-3.5 h-3.5" /> : null}
                          <span>{watched ? 'Watched' : 'Mark Watched'}</span>
                        </button>
                      ) : watched ? (
                        <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Watched by Admin</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  }

  // Render TV Episode Page Detail
  if (currentView.type === 'episode-details' && episode) {
    const epKey = `${currentView.showId}_${currentView.seasonNumber}_${currentView.episodeNumber}`;
    const watched = isEpisodeWatched(currentView.showId, currentView.seasonNumber, currentView.episodeNumber);

    return (
      <div className="space-y-6 pb-16 max-w-4xl">
        
        {/* Header simple back navigation row */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBack}
            className="bg-card border border-border-custom text-foreground p-2 rounded-xl hover:bg-slate-800/10 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-display font-extrabold text-xl text-foreground">Episode details</h2>
            <p className="text-xs text-muted-custom font-semibold">
              {currentView.showName} • S{pad(currentView.seasonNumber)}E{pad(currentView.episodeNumber)}
            </p>
          </div>
        </div>

        {/* Thumbnail backdrop banner block */}
        <div className="relative aspect-backdrop rounded-3xl overflow-hidden bg-slate-900 shadow">
          <img 
            src={getPosterUrl(episode.still_path, 'original')} 
            alt={episode.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          {watched && (
            <span className="absolute top-4 right-4 bg-emerald-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-full uppercase shadow">
              ✔ Watched
            </span>
          )}
        </div>

        {/* Episode actions panel */}
        {user ? (
          <div className="bg-card border border-border-custom p-4 rounded-3xl shadow-sm flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={async () => {
                  await toggleEpisodeWatched(
                    currentView.showId, 
                    currentView.seasonNumber, 
                    currentView.episodeNumber, 
                    currentView.showName, 
                    null, 
                    10 // standard guess fallback
                  );
                }}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                  watched 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : 'bg-background border border-border-custom text-muted-custom hover:text-foreground'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{watched ? 'Watched' : 'Mark Watched'}</span>
              </button>

              <button
                onClick={() => {
                  setUserRating(getItemRating(epKey, 'episode'));
                  setUserNote(getItemNote(epKey, 'episode'));
                  setShowEditor(true);
                }}
                className="px-4 py-2.5 bg-background border border-border-custom hover:border-primary-custom text-muted-custom hover:text-foreground rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <PenTool className="w-4 h-4 text-primary-custom" />
                <span>Personal Rating & Notes</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border-custom p-5 rounded-3xl shadow-sm flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="bg-primary-custom/10 text-primary-custom font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Read-Only Guest Mode</span>
              </span>
              {watched && (
                <span className="bg-emerald-500/10 text-emerald-500 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Watched by Admin</span>
                </span>
              )}
            </div>

            {(userRating > 0 || userNote) && (
              <div className="bg-background border border-border-custom p-4 rounded-2xl w-full md:max-w-md space-y-2 shrink-0">
                <div className="flex justify-between items-center pb-2 border-b border-border-custom/50">
                  <span className="text-[10px] font-extrabold text-muted-custom uppercase tracking-wider">Administrator Review</span>
                  {userRating > 0 && <span className="text-amber-500 text-xs font-bold">★ {userRating} / 10</span>}
                </div>
                {userNote && <p className="text-xs text-foreground italic whitespace-pre-wrap">"{userNote}"</p>}
              </div>
            )}
          </div>
        )}

        {/* Grid description detail columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            <div className="space-y-2">
              <h3 className="font-display font-extrabold text-lg text-foreground">{episode.episode_number}. {episode.name}</h3>
              <p className="text-muted-custom text-sm leading-relaxed">{episode.overview || 'No synopsis details available for this episode.'}</p>
            </div>

          </div>

          <div className="bg-card border border-border-custom p-4 rounded-3xl h-fit space-y-3.5 text-xs">
            <h4 className="font-display font-bold text-sm text-foreground">Metadata facts</h4>
            <div className="flex justify-between">
              <span className="text-muted-custom">Air Date</span>
              <span className="font-semibold text-foreground">{formatDate(episode.air_date)}</span>
            </div>
            {episode.runtime && (
              <div className="flex justify-between">
                <span className="text-muted-custom">Runtime</span>
                <span className="font-semibold text-foreground">{episode.runtime} mins</span>
              </div>
            )}
          </div>
        </div>

        {/* Rating modal editor popup */}
        {showEditor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-lg rounded-2xl border border-border-custom p-6 space-y-4 shadow-2xl animate-scaleUp">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-lg text-foreground">Episode Rating</h3>
                <button onClick={() => setShowEditor(false)} className="p-1 rounded hover:bg-background text-muted-custom"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Your Rating</label>
                  <span className="text-xs font-bold text-amber-500">★ {userRating || 'Unrated'} / 10</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={userRating}
                  onChange={(e) => setUserRating(Number(e.target.value))}
                  className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary-custom"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Notes</label>
                <textarea
                  placeholder="Record episodic reviews..."
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  rows={4}
                  className="w-full bg-background border border-border-custom px-3.5 py-2.5 rounded-xl text-sm outline-none text-foreground focus:border-primary-custom"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setShowEditor(false)} className="px-4 py-2 border border-border-custom hover:bg-background rounded-xl text-xs font-semibold text-muted-custom">Cancel</button>
                <button onClick={handleSaveEditor} className="bg-primary-custom hover:bg-primary-custom/95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md">Save Curation</button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  return null;
}
