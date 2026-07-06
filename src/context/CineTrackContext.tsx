import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  db, 
  auth, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  User 
} from '../firebase';
import { 
  WatchlistItem, 
  FavoriteItem, 
  TVShowProgress, 
  WatchedEpisode, 
  WatchedMovie, 
  UserRating, 
  UserNote, 
  CustomList, 
  AppSettings,
  TMDBMedia
} from '../types';

export interface LocalUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

interface CineTrackContextType {
  user: User | LocalUser | null;
  loading: boolean;
  watchlist: WatchlistItem[];
  favorites: FavoriteItem[];
  showProgress: TVShowProgress[];
  watchedEpisodes: WatchedEpisode[];
  watchedMovies: WatchedMovie[];
  ratings: UserRating[];
  notes: UserNote[];
  customLists: CustomList[];
  settings: AppSettings;
  
  addToWatchlist: (media: TMDBMedia, mediaType: 'movie' | 'tv') => Promise<void>;
  removeFromWatchlist: (tmdbId: number, mediaType: 'movie' | 'tv') => Promise<void>;
  toggleFavorite: (media: TMDBMedia, mediaType: 'movie' | 'tv') => Promise<void>;
  toggleMovieWatched: (movieId: number, title: string, posterPath: string | null, status: 'Watched' | 'Wishlist' | 'Rewatch' | 'Unwatched') => Promise<void>;
  toggleEpisodeWatched: (showId: number, seasonNum: number, epNum: number, showTitle: string, posterPath: string | null, totalEpisodes: number) => Promise<void>;
  rateItem: (targetId: number | string, type: 'movie' | 'tv' | 'episode', rating: number) => Promise<void>;
  saveNote: (targetId: number | string, type: 'movie' | 'tv' | 'episode', content: string) => Promise<void>;
  saveCustomList: (list: Partial<CustomList>) => Promise<void>;
  deleteCustomList: (listId: string) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  
  isMovieWatched: (movieId: number) => boolean;
  getMovieStatus: (movieId: number) => 'Watched' | 'Unwatched' | 'Rewatch' | 'Wishlist';
  isEpisodeWatched: (showId: number, seasonNum: number, epNum: number) => boolean;
  getItemRating: (targetId: number | string, type: 'movie' | 'tv' | 'episode') => number;
  getItemNote: (targetId: number | string, type: 'movie' | 'tv' | 'episode') => string;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
}

const CineTrackContext = createContext<CineTrackContextType | undefined>(undefined);

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en',
  posterQuality: 'w500',
  backdropQuality: 'w1280',
  autoSync: true,
  cacheSize: '50MB'
};

export function CineTrackProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [showProgress, setShowProgress] = useState<TVShowProgress[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<WatchedEpisode[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovie[]>([]);
  const [ratings, setRatings] = useState<UserRating[]>([]);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        localStorage.removeItem('cine_track_guest_active');
      } else {
        const isGuest = localStorage.getItem('cine_track_guest_active') === 'true';
        if (isGuest) {
          setUser({
            uid: 'guest_user',
            email: 'guest@cinetrack.local',
            isAnonymous: true
          });
        } else {
          setUser(null);
          setLoading(false);
          // Clear states
          setWatchlist([]);
          setFavorites([]);
          setShowProgress([]);
          setWatchedEpisodes([]);
          setWatchedMovies([]);
          setRatings([]);
          setNotes([]);
          setCustomLists([]);
          setSettings(defaultSettings);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Sync with Firestore or LocalStorage Guest Cache
  useEffect(() => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      setLoading(true);
      try {
        setWatchlist(JSON.parse(localStorage.getItem('cine_watchlist') || '[]'));
        setFavorites(JSON.parse(localStorage.getItem('cine_favorites') || '[]'));
        setShowProgress(JSON.parse(localStorage.getItem('cine_show_progress') || '[]'));
        setWatchedEpisodes(JSON.parse(localStorage.getItem('cine_watched_episodes') || '[]'));
        setWatchedMovies(JSON.parse(localStorage.getItem('cine_watched_movies') || '[]'));
        setRatings(JSON.parse(localStorage.getItem('cine_ratings') || '[]'));
        setNotes(JSON.parse(localStorage.getItem('cine_notes') || '[]'));
        setCustomLists(JSON.parse(localStorage.getItem('cine_custom_lists') || '[]'));
        const restoredSettings = JSON.parse(localStorage.getItem('cine_settings') || JSON.stringify(defaultSettings));
        setSettings(restoredSettings);
        if (restoredSettings.tmdbApiKey) {
          localStorage.setItem('cine_tmdb_api_key', restoredSettings.tmdbApiKey);
        } else {
          localStorage.removeItem('cine_tmdb_api_key');
        }
      } catch (e) {
        console.error('Error restoring guest local storage:', e);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const userId = user.uid;

    const unsubWatchlist = onSnapshot(collection(db, 'users', userId, 'watchlist'), (snap) => {
      setWatchlist(snap.docs.map(doc => doc.data() as WatchlistItem));
    });

    const unsubFavorites = onSnapshot(collection(db, 'users', userId, 'favorites'), (snap) => {
      setFavorites(snap.docs.map(doc => doc.data() as FavoriteItem));
    });

    const unsubShowProgress = onSnapshot(collection(db, 'users', userId, 'show_progress'), (snap) => {
      setShowProgress(snap.docs.map(doc => doc.data() as TVShowProgress));
    });

    const unsubWatchedEpisodes = onSnapshot(collection(db, 'users', userId, 'watched_episodes'), (snap) => {
      setWatchedEpisodes(snap.docs.map(doc => doc.data() as WatchedEpisode));
    });

    const unsubWatchedMovies = onSnapshot(collection(db, 'users', userId, 'watched_movies'), (snap) => {
      setWatchedMovies(snap.docs.map(doc => doc.data() as WatchedMovie));
    });

    const unsubRatings = onSnapshot(collection(db, 'users', userId, 'ratings'), (snap) => {
      setRatings(snap.docs.map(doc => doc.data() as UserRating));
    });

    const unsubNotes = onSnapshot(collection(db, 'users', userId, 'notes'), (snap) => {
      setNotes(snap.docs.map(doc => doc.data() as UserNote));
    });

    const unsubCustomLists = onSnapshot(collection(db, 'users', userId, 'custom_lists'), (snap) => {
      const lists = snap.docs.map(doc => doc.data() as CustomList);
      setCustomLists(lists.sort((a, b) => a.order - b.order));
    });

    const unsubSettings = onSnapshot(doc(db, 'users', userId, 'settings', 'preferences'), (docSnap) => {
      if (docSnap.exists()) {
        const loadedSettings = docSnap.data() as AppSettings;
        setSettings({ ...defaultSettings, ...loadedSettings });
        if (loadedSettings.tmdbApiKey) {
          localStorage.setItem('cine_tmdb_api_key', loadedSettings.tmdbApiKey);
        } else {
          localStorage.removeItem('cine_tmdb_api_key');
        }
      } else {
        setSettings(defaultSettings);
        localStorage.removeItem('cine_tmdb_api_key');
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => {
      unsubWatchlist();
      unsubFavorites();
      unsubShowProgress();
      unsubWatchedEpisodes();
      unsubWatchedMovies();
      unsubRatings();
      unsubNotes();
      unsubCustomLists();
      unsubSettings();
    };
  }, [user]);

  // Operations
  const addToWatchlist = async (media: TMDBMedia, mediaType: 'movie' | 'tv') => {
    if (!user) return;
    const item: WatchlistItem = {
      id: `${mediaType}_${media.id}`,
      tmdbId: media.id,
      mediaType,
      title: media.title || media.name || '',
      posterPath: media.poster_path,
      addedAt: Date.now()
    };
    if (user.uid === 'guest_user') {
      const updated = [...watchlist.filter(i => i.id !== item.id), item];
      setWatchlist(updated);
      localStorage.setItem('cine_watchlist', JSON.stringify(updated));
      return;
    }
    await setDoc(doc(db, 'users', user.uid, 'watchlist', item.id), item);
  };

  const removeFromWatchlist = async (tmdbId: number, mediaType: 'movie' | 'tv') => {
    if (!user) return;
    const itemId = `${mediaType}_${tmdbId}`;
    if (user.uid === 'guest_user') {
      const updated = watchlist.filter(i => i.id !== itemId);
      setWatchlist(updated);
      localStorage.setItem('cine_watchlist', JSON.stringify(updated));
      return;
    }
    await deleteDoc(doc(db, 'users', user.uid, 'watchlist', itemId));
  };

  const toggleFavorite = async (media: TMDBMedia, mediaType: 'movie' | 'tv') => {
    if (!user) return;
    const docId = `${mediaType}_${media.id}`;
    const isFav = favorites.some(f => f.id === docId);
    if (user.uid === 'guest_user') {
      let updated;
      if (isFav) {
        updated = favorites.filter(f => f.id !== docId);
      } else {
        const item: FavoriteItem = {
          id: docId,
          tmdbId: media.id,
          mediaType,
          title: media.title || media.name || '',
          posterPath: media.poster_path,
          addedAt: Date.now()
        };
        updated = [...favorites, item];
      }
      setFavorites(updated);
      localStorage.setItem('cine_favorites', JSON.stringify(updated));
      return;
    }
    if (isFav) {
      await deleteDoc(doc(db, 'users', user.uid, 'favorites', docId));
    } else {
      const item: FavoriteItem = {
        id: docId,
        tmdbId: media.id,
        mediaType,
        title: media.title || media.name || '',
        posterPath: media.poster_path,
        addedAt: Date.now()
      };
      await setDoc(doc(db, 'users', user.uid, 'favorites', docId), item);
    }
  };

  const toggleMovieWatched = async (movieId: number, title: string, posterPath: string | null, status: 'Watched' | 'Wishlist' | 'Rewatch' | 'Unwatched') => {
    if (!user) return;
    const docId = `${movieId}`;
    if (user.uid === 'guest_user') {
      let updated;
      if (status === 'Unwatched') {
        updated = watchedMovies.filter(m => m.movieId !== movieId);
      } else {
        const item: WatchedMovie = {
          movieId,
          title,
          posterPath,
          status,
          watchedAt: Date.now(),
          watchCount: status === 'Rewatch' ? 2 : 1
        };
        updated = [...watchedMovies.filter(m => m.movieId !== movieId), item];
      }
      setWatchedMovies(updated);
      localStorage.setItem('cine_watched_movies', JSON.stringify(updated));
      return;
    }
    if (status === 'Unwatched') {
      await deleteDoc(doc(db, 'users', user.uid, 'watched_movies', docId));
    } else {
      const item: WatchedMovie = {
        movieId,
        title,
        posterPath,
        status,
        watchedAt: Date.now(),
        watchCount: status === 'Rewatch' ? 2 : 1
      };
      await setDoc(doc(db, 'users', user.uid, 'watched_movies', docId), item);
    }
  };

  const toggleEpisodeWatched = async (
    showId: number, 
    seasonNum: number, 
    epNum: number, 
    showTitle: string, 
    posterPath: string | null,
    totalEpisodes: number
  ) => {
    if (!user) return;
    const epId = `${showId}_${seasonNum}_${epNum}`;
    const isWatched = watchedEpisodes.some(we => we.id === epId);

    if (user.uid === 'guest_user') {
      let updatedEpisodes: WatchedEpisode[];
      let updatedCount: number;
      if (isWatched) {
        updatedEpisodes = watchedEpisodes.filter(we => we.id !== epId);
        updatedCount = Math.max(0, updatedEpisodes.filter(we => we.showId === showId).length);
      } else {
        const newEp: WatchedEpisode = {
          id: epId,
          showId,
          seasonNumber: seasonNum,
          episodeNumber: epNum,
          watchedAt: Date.now()
        };
        updatedEpisodes = [...watchedEpisodes, newEp];
        updatedCount = updatedEpisodes.filter(we => we.showId === showId).length;
      }
      
      const progress: TVShowProgress = {
        showId,
        title: showTitle,
        posterPath,
        status: updatedCount === totalEpisodes ? 'Completed' : 'Current',
        lastWatchedSeason: seasonNum,
        lastWatchedEpisode: epNum,
        watchedEpisodesCount: updatedCount,
        totalEpisodesCount: totalEpisodes,
        updatedAt: Date.now()
      };
      
      const updatedProgress = [...showProgress.filter(p => p.showId !== showId), progress];
      
      setWatchedEpisodes(updatedEpisodes);
      setShowProgress(updatedProgress);
      localStorage.setItem('cine_watched_episodes', JSON.stringify(updatedEpisodes));
      localStorage.setItem('cine_show_progress', JSON.stringify(updatedProgress));
      return;
    }

    if (isWatched) {
      // Remove watched episode
      await deleteDoc(doc(db, 'users', user.uid, 'watched_episodes', epId));
      
      // Re-calculate show progress count
      const updatedCount = Math.max(0, watchedEpisodes.filter(we => we.showId === showId).length - 1);
      
      // Update Progress
      const progress: TVShowProgress = {
        showId,
        title: showTitle,
        posterPath,
        status: updatedCount === totalEpisodes ? 'Completed' : 'Current',
        lastWatchedSeason: seasonNum,
        lastWatchedEpisode: epNum,
        watchedEpisodesCount: updatedCount,
        totalEpisodesCount: totalEpisodes,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'users', user.uid, 'show_progress', `${showId}`), progress);
    } else {
      // Add watched episode
      const newEp: WatchedEpisode = {
        id: epId,
        showId,
        seasonNumber: seasonNum,
        episodeNumber: epNum,
        watchedAt: Date.now()
      };
      await setDoc(doc(db, 'users', user.uid, 'watched_episodes', epId), newEp);

      // Re-calculate progress
      const updatedCount = watchedEpisodes.filter(we => we.showId === showId).length + 1;
      
      const progress: TVShowProgress = {
        showId,
        title: showTitle,
        posterPath,
        status: updatedCount === totalEpisodes ? 'Completed' : 'Current',
        lastWatchedSeason: seasonNum,
        lastWatchedEpisode: epNum,
        watchedEpisodesCount: updatedCount,
        totalEpisodesCount: totalEpisodes,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'users', user.uid, 'show_progress', `${showId}`), progress);
    }
  };

  const rateItem = async (targetId: number | string, type: 'movie' | 'tv' | 'episode', rating: number) => {
    if (!user) return;
    const id = `${type}_${targetId}`;
    const item: UserRating = {
      id,
      targetId,
      type,
      rating,
      updatedAt: Date.now()
    };
    if (user.uid === 'guest_user') {
      const updated = [...ratings.filter(r => r.id !== id), item];
      setRatings(updated);
      localStorage.setItem('cine_ratings', JSON.stringify(updated));
      return;
    }
    await setDoc(doc(db, 'users', user.uid, 'ratings', id), item);
  };

  const saveNote = async (targetId: number | string, type: 'movie' | 'tv' | 'episode', content: string) => {
    if (!user) return;
    const id = `${type}_${targetId}`;
    if (user.uid === 'guest_user') {
      let updated;
      if (!content.trim()) {
        updated = notes.filter(n => n.id !== id);
      } else {
        const item: UserNote = {
          id,
          targetId,
          type,
          content,
          updatedAt: Date.now()
        };
        updated = [...notes.filter(n => n.id !== id), item];
      }
      setNotes(updated);
      localStorage.setItem('cine_notes', JSON.stringify(updated));
      return;
    }
    if (!content.trim()) {
      await deleteDoc(doc(db, 'users', user.uid, 'notes', id));
    } else {
      const item: UserNote = {
        id,
        targetId,
        type,
        content,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'users', user.uid, 'notes', id), item);
    }
  };

  const saveCustomList = async (list: Partial<CustomList>) => {
    if (!user) return;
    const listId = list.id || `list_${Math.random().toString(36).substr(2, 9)}`;
    const fullList: CustomList = {
      id: listId,
      name: list.name || 'Untitled List',
      description: list.description || '',
      artworkUrl: list.artworkUrl || null,
      items: list.items || [],
      createdAt: list.createdAt || Date.now(),
      order: list.order !== undefined ? list.order : customLists.length
    };
    if (user.uid === 'guest_user') {
      const updated = [...customLists.filter(l => l.id !== listId), fullList];
      setCustomLists(updated);
      localStorage.setItem('cine_custom_lists', JSON.stringify(updated));
      return;
    }
    await setDoc(doc(db, 'users', user.uid, 'custom_lists', listId), fullList);
  };

  const deleteCustomList = async (listId: string) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      const updated = customLists.filter(l => l.id !== listId);
      setCustomLists(updated);
      localStorage.setItem('cine_custom_lists', JSON.stringify(updated));
      return;
    }
    await deleteDoc(doc(db, 'users', user.uid, 'custom_lists', listId));
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    if (!user) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    if (newSettings.tmdbApiKey !== undefined) {
      if (newSettings.tmdbApiKey) {
        localStorage.setItem('cine_tmdb_api_key', newSettings.tmdbApiKey);
      } else {
        localStorage.removeItem('cine_tmdb_api_key');
      }
    }

    if (user.uid === 'guest_user') {
      localStorage.setItem('cine_settings', JSON.stringify(updated));
      return;
    }
    await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), updated);
  };

  const loginAsGuest = () => {
    localStorage.setItem('cine_track_guest_active', 'true');
    setUser({
      uid: 'guest_user',
      email: 'guest@cinetrack.local',
      isAnonymous: true
    });
  };

  const logout = async () => {
    localStorage.removeItem('cine_track_guest_active');
    await auth.signOut().catch(() => {});
    setUser(null);
    setWatchlist([]);
    setFavorites([]);
    setShowProgress([]);
    setWatchedEpisodes([]);
    setWatchedMovies([]);
    setRatings([]);
    setNotes([]);
    setCustomLists([]);
    setSettings(defaultSettings);
  };

  // Quick Getters
  const isMovieWatched = (movieId: number) => {
    const found = watchedMovies.find(m => m.movieId === movieId);
    return found ? (found.status === 'Watched' || found.status === 'Rewatch') : false;
  };

  const getMovieStatus = (movieId: number) => {
    const found = watchedMovies.find(m => m.movieId === movieId);
    return found ? found.status : 'Unwatched';
  };

  const isEpisodeWatched = (showId: number, seasonNum: number, epNum: number) => {
    return watchedEpisodes.some(we => we.showId === showId && we.seasonNumber === seasonNum && we.episodeNumber === epNum);
  };

  const getItemRating = (targetId: number | string, type: 'movie' | 'tv' | 'episode') => {
    const found = ratings.find(r => r.id === `${type}_${targetId}`);
    return found ? found.rating : 0;
  };

  const getItemNote = (targetId: number | string, type: 'movie' | 'tv' | 'episode') => {
    const found = notes.find(n => n.id === `${type}_${targetId}`);
    return found ? found.content : '';
  };

  return (
    <CineTrackContext.Provider value={{
      user,
      loading,
      watchlist,
      favorites,
      showProgress,
      watchedEpisodes,
      watchedMovies,
      ratings,
      notes,
      customLists,
      settings,
      
      addToWatchlist,
      removeFromWatchlist,
      toggleFavorite,
      toggleMovieWatched,
      toggleEpisodeWatched,
      rateItem,
      saveNote,
      saveCustomList,
      deleteCustomList,
      updateSettings,
      
      isMovieWatched,
      getMovieStatus,
      isEpisodeWatched,
      getItemRating,
      getItemNote,
      loginAsGuest,
      logout
    }}>
      {children}
    </CineTrackContext.Provider>
  );
}

export function useCineTrack() {
  const context = useContext(CineTrackContext);
  if (context === undefined) {
    throw new Error('useCineTrack must be used within a CineTrackProvider');
  }
  return context;
}
