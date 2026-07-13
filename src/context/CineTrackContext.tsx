import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  db, 
  auth, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc, 
  onSnapshot,
  writeBatch,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  createUserWithEmailAndPassword,
  deleteUser,
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
  TMDBMedia,
  ToastNotification
} from '../types';
import { setRuntimeTmdbApiKey } from '../services/tmdb';

export interface LocalUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

interface CineTrackContextType {
  user: User | LocalUser | null;
  isAdmin: boolean;
  isGuest: boolean;
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
  notifications: ToastNotification[];
  showNotification: (message: string, type?: 'success' | 'info' | 'error', title?: string, duration?: number) => void;
  dismissNotification: (id: string) => void;
  
  // Share attributes
  sharedUser: { uid: string; email: string; displayName: string } | null;
  isViewingShared: boolean;
  loadSharedAccountByEmail: (email: string) => Promise<boolean>;
  loadSharedAccountByUid: (uid: string) => Promise<boolean>;
  stopViewingSharedAccount: () => void;
  mergeSharedAccountData: () => Promise<void>;
  
  addToWatchlist: (media: TMDBMedia, mediaType: 'movie' | 'tv') => Promise<void>;
  removeFromWatchlist: (tmdbId: number, mediaType: 'movie' | 'tv') => Promise<void>;
  toggleFavorite: (media: TMDBMedia, mediaType: 'movie' | 'tv') => Promise<void>;
  toggleMovieWatched: (movieId: number, title: string, posterPath: string | null, status: 'Watched' | 'Wishlist' | 'Rewatch' | 'Unwatched') => Promise<void>;
  toggleEpisodeWatched: (showId: number, seasonNum: number, epNum: number, showTitle: string, posterPath: string | null, totalEpisodes: number) => Promise<void>;
  toggleSeasonWatched: (showId: number, seasonNum: number, showTitle: string, posterPath: string | null, episodes: any[], watched: boolean) => Promise<void>;
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
  loginAsGuest: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  deleteUserAccount: () => Promise<void>;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success', title?: string, duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type, title, duration }]);
    setTimeout(() => {
      dismissNotification(id);
    }, duration);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const loadLocalCache = (userId: string) => {
    try {
      const cachedWatchlist = localStorage.getItem(`cinetrack_cache_${userId}_watchlist`);
      const cachedFavorites = localStorage.getItem(`cinetrack_cache_${userId}_favorites`);
      const cachedShowProgress = localStorage.getItem(`cinetrack_cache_${userId}_showProgress`);
      const cachedWatchedEpisodes = localStorage.getItem(`cinetrack_cache_${userId}_watchedEpisodes`);
      const cachedWatchedMovies = localStorage.getItem(`cinetrack_cache_${userId}_watchedMovies`);
      const cachedRatings = localStorage.getItem(`cinetrack_cache_${userId}_ratings`);
      const cachedNotes = localStorage.getItem(`cinetrack_cache_${userId}_notes`);
      const cachedCustomLists = localStorage.getItem(`cinetrack_cache_${userId}_customLists`);
      const cachedSettings = localStorage.getItem(`cinetrack_cache_${userId}_settings`);

      if (cachedWatchlist) setWatchlist(JSON.parse(cachedWatchlist));
      else setWatchlist([]);

      if (cachedFavorites) setFavorites(JSON.parse(cachedFavorites));
      else setFavorites([]);

      if (cachedShowProgress) setShowProgress(JSON.parse(cachedShowProgress));
      else setShowProgress([]);

      if (cachedWatchedEpisodes) setWatchedEpisodes(JSON.parse(cachedWatchedEpisodes));
      else setWatchedEpisodes([]);

      if (cachedWatchedMovies) setWatchedMovies(JSON.parse(cachedWatchedMovies));
      else setWatchedMovies([]);

      if (cachedRatings) setRatings(JSON.parse(cachedRatings));
      else setRatings([]);

      if (cachedNotes) setNotes(JSON.parse(cachedNotes));
      else setNotes([]);

      if (cachedCustomLists) setCustomLists(JSON.parse(cachedCustomLists).sort((a: any, b: any) => a.order - b.order));
      else setCustomLists([]);

      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings);
        setSettings({ ...defaultSettings, ...parsed });
        setRuntimeTmdbApiKey(parsed.tmdbApiKey || null);
      } else {
        setSettings(defaultSettings);
        setRuntimeTmdbApiKey(null);
      }
    } catch (e) {
      console.error('Error loading local cache:', e);
    }
  };

  const [sharedUser, setSharedUser] = useState<{ uid: string; email: string; displayName: string } | null>(null);

  // Sync dbUserId: use user.uid when logged in, or null when signed out
  useEffect(() => {
    if (user) {
      setDbUserId(user.uid);
      loadLocalCache(user.uid);
    } else {
      setDbUserId(null);
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
    setSharedUser(null);
  }, [user]);

  // Update user profile mapping in Firestore for sharing lookup and real-time security linkage
  useEffect(() => {
    if (user) {
      const updateProfile = async () => {
        try {
          const email = user.email || `anonymous_${user.uid}@cinetrack.com`;
          const displayName = user.email ? user.email.split('@')[0] : 'Anonymous User';
          await setDoc(doc(db, 'profiles', user.uid), {
            uid: user.uid,
            email: email.toLowerCase(),
            displayName: displayName,
            lastActive: Date.now()
          }, { merge: true });
        } catch (err) {
          console.error('Error updating share profile mapping:', err);
        }
      };
      updateProfile();
    }
  }, [user]);

  // Auth Listener: Simply listen for session changes (no auto guest sign-in)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!dbUserId) {
      return;
    }

    setLoading(true);
    const userId = dbUserId;
    const isViewingShared = dbUserId !== null && user !== null && dbUserId !== user.uid;

    const unsubWatchlist = onSnapshot(collection(db, 'users', userId, 'watchlist'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as WatchlistItem);
      setWatchlist(data);
      if (!isViewingShared) {
        localStorage.setItem(`cinetrack_cache_${userId}_watchlist`, JSON.stringify(data));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/watchlist`);
    });

    const unsubFavorites = onSnapshot(collection(db, 'users', userId, 'favorites'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as FavoriteItem);
      setFavorites(data);
      if (!isViewingShared) {
        localStorage.setItem(`cinetrack_cache_${userId}_favorites`, JSON.stringify(data));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/favorites`);
    });

    const unsubShowProgress = onSnapshot(collection(db, 'users', userId, 'show_progress'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as TVShowProgress);
      setShowProgress(data);
      if (!isViewingShared) {
        localStorage.setItem(`cinetrack_cache_${userId}_showProgress`, JSON.stringify(data));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/show_progress`);
    });

    const unsubWatchedEpisodes = onSnapshot(collection(db, 'users', userId, 'watched_episodes'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as WatchedEpisode);
      setWatchedEpisodes(data);
      if (!isViewingShared) {
        localStorage.setItem(`cinetrack_cache_${userId}_watchedEpisodes`, JSON.stringify(data));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/watched_episodes`);
    });

    const unsubWatchedMovies = onSnapshot(collection(db, 'users', userId, 'watched_movies'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as WatchedMovie);
      setWatchedMovies(data);
      if (!isViewingShared) {
        localStorage.setItem(`cinetrack_cache_${userId}_watchedMovies`, JSON.stringify(data));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/watched_movies`);
    });

    const unsubRatings = onSnapshot(collection(db, 'users', userId, 'ratings'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as UserRating);
      setRatings(data);
      if (!isViewingShared) {
        localStorage.setItem(`cinetrack_cache_${userId}_ratings`, JSON.stringify(data));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/ratings`);
    });

    const unsubNotes = onSnapshot(collection(db, 'users', userId, 'notes'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as UserNote);
      setNotes(data);
      if (!isViewingShared) {
        localStorage.setItem(`cinetrack_cache_${userId}_notes`, JSON.stringify(data));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/notes`);
    });

    const unsubCustomLists = onSnapshot(collection(db, 'users', userId, 'custom_lists'), (snap) => {
      const lists = snap.docs.map(doc => doc.data() as CustomList);
      const sorted = lists.sort((a, b) => a.order - b.order);
      setCustomLists(sorted);
      if (!isViewingShared) {
        localStorage.setItem(`cinetrack_cache_${userId}_customLists`, JSON.stringify(sorted));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/custom_lists`);
    });

    const unsubSettings = onSnapshot(doc(db, 'users', userId, 'settings', 'preferences'), (docSnap) => {
      if (docSnap.exists()) {
        const loadedSettings = docSnap.data() as AppSettings;
        const mergedSettings = { ...defaultSettings, ...loadedSettings };
        setSettings(mergedSettings);
        setRuntimeTmdbApiKey(loadedSettings.tmdbApiKey || null);
        if (!isViewingShared) {
          localStorage.setItem(`cinetrack_cache_${userId}_settings`, JSON.stringify(mergedSettings));
        }
      } else {
        setSettings(defaultSettings);
        setRuntimeTmdbApiKey(null);
        if (!isViewingShared) {
          localStorage.setItem(`cinetrack_cache_${userId}_settings`, JSON.stringify(defaultSettings));
        }
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
  }, [dbUserId]);

  // Operations
  const addToWatchlist = async (media: TMDBMedia, mediaType: 'movie' | 'tv') => {
    if (!user || isViewingShared) return;
    const item: WatchlistItem = {
      id: `${mediaType}_${media.id}`,
      tmdbId: media.id,
      mediaType,
      title: media.title || media.name || '',
      posterPath: media.poster_path || null,
      addedAt: Date.now()
    };

    const runtimeVal = media.runtime || (media.episode_run_time && media.episode_run_time.length > 0 ? media.episode_run_time[0] : null);
    if (runtimeVal !== null && runtimeVal !== undefined) {
      item.runtime = runtimeVal;
    }

    // Optimistic state and local storage write
    setWatchlist(prev => {
      const updated = [...prev.filter(w => w.id !== item.id), item];
      localStorage.setItem(`cinetrack_cache_${user.uid}_watchlist`, JSON.stringify(updated));
      return updated;
    });
    showNotification(`"${item.title}" has been successfully added to your Watchlist.`, 'success', 'Watchlist');

    try {
      await setDoc(doc(db, 'users', user.uid, 'watchlist', item.id), item);
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  };

  const removeFromWatchlist = async (tmdbId: number, mediaType: 'movie' | 'tv') => {
    if (!user || isViewingShared) return;
    const itemId = `${mediaType}_${tmdbId}`;
    const existingItem = watchlist.find(w => w.id === itemId);
    const title = existingItem ? existingItem.title : (mediaType === 'movie' ? 'Movie' : 'TV show');

    // Optimistic state and local storage write
    setWatchlist(prev => {
      const updated = prev.filter(w => w.id !== itemId);
      localStorage.setItem(`cinetrack_cache_${user.uid}_watchlist`, JSON.stringify(updated));
      return updated;
    });
    showNotification(`"${title}" has been successfully removed from your Watchlist.`, 'success', 'Watchlist');

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'watchlist', itemId));
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  };

  const toggleFavorite = async (media: TMDBMedia, mediaType: 'movie' | 'tv') => {
    if (!user || isViewingShared) return;
    const docId = `${mediaType}_${media.id}`;
    const isFav = favorites.some(f => f.id === docId);
    const title = media.title || media.name || (mediaType === 'movie' ? 'Movie' : 'TV show');

    if (isFav) {
      setFavorites(prev => {
        const updated = prev.filter(f => f.id !== docId);
        localStorage.setItem(`cinetrack_cache_${user.uid}_favorites`, JSON.stringify(updated));
        return updated;
      });
      showNotification(`"${title}" has been successfully removed from your Favorites.`, 'success', 'Favorites');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'favorites', docId));
      } catch (err) {
        console.error('Firestore sync error:', err);
      }
    } else {
      const item: FavoriteItem = {
        id: docId,
        tmdbId: media.id,
        mediaType,
        title: media.title || media.name || '',
        posterPath: media.poster_path || null,
        addedAt: Date.now()
      };

      const runtimeVal = media.runtime || (media.episode_run_time && media.episode_run_time.length > 0 ? media.episode_run_time[0] : null);
      if (runtimeVal !== null && runtimeVal !== undefined) {
        item.runtime = runtimeVal;
      }

      setFavorites(prev => {
        const updated = [...prev.filter(f => f.id !== docId), item];
        localStorage.setItem(`cinetrack_cache_${user.uid}_favorites`, JSON.stringify(updated));
        return updated;
      });
      showNotification(`"${title}" has been successfully added to your Favorites.`, 'success', 'Favorites');
      try {
        await setDoc(doc(db, 'users', user.uid, 'favorites', docId), item);
      } catch (err) {
        console.error('Firestore sync error:', err);
      }
    }
  };

  const toggleMovieWatched = async (movieId: number, title: string, posterPath: string | null, status: 'Watched' | 'Wishlist' | 'Rewatch' | 'Unwatched') => {
    if (!user || isViewingShared) return;
    const docId = `${movieId}`;

    setWatchedMovies(prev => {
      let updated;
      if (status === 'Unwatched') {
        updated = prev.filter(m => m.movieId !== movieId);
      } else {
        const item: WatchedMovie = {
          movieId,
          title,
          posterPath,
          status,
          watchedAt: Date.now(),
          watchCount: status === 'Rewatch' ? 2 : 1
        };
        updated = [...prev.filter(m => m.movieId !== movieId), item];
      }
      localStorage.setItem(`cinetrack_cache_${user.uid}_watchedMovies`, JSON.stringify(updated));
      return updated;
    });

    try {
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
    } catch (err) {
      console.error('Firestore sync error:', err);
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
    if (!user || isViewingShared) return;
    const epId = `${showId}_${seasonNum}_${epNum}`;
    const isWatched = watchedEpisodes.some(we => we.id === epId);

    // 1. Update watchedEpisodes state and cache
    let updatedEps: WatchedEpisode[] = [];
    setWatchedEpisodes(prev => {
      if (isWatched) {
        updatedEps = prev.filter(we => we.id !== epId);
      } else {
        const newEp: WatchedEpisode = {
          id: epId,
          showId,
          seasonNumber: seasonNum,
          episodeNumber: epNum,
          watchedAt: Date.now()
        };
        updatedEps = [...prev.filter(we => we.id !== epId), newEp];
      }
      localStorage.setItem(`cinetrack_cache_${user.uid}_watchedEpisodes`, JSON.stringify(updatedEps));
      return updatedEps;
    });

    // 2. Update showProgress state and cache
    const currentListForCount = isWatched
      ? watchedEpisodes.filter(we => we.showId === showId && we.id !== epId)
      : [...watchedEpisodes.filter(we => we.showId === showId), { id: epId, showId, seasonNumber: seasonNum, episodeNumber: epNum, watchedAt: Date.now() }];
    const updatedCount = Math.max(0, currentListForCount.length);

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

    setShowProgress(prev => {
      const updatedProgress = [...prev.filter(p => p.showId !== showId), progress];
      localStorage.setItem(`cinetrack_cache_${user.uid}_showProgress`, JSON.stringify(updatedProgress));
      return updatedProgress;
    });

    try {
      const batch = writeBatch(db);
      if (isWatched) {
        batch.delete(doc(db, 'users', user.uid, 'watched_episodes', epId));
      } else {
        const newEp: WatchedEpisode = {
          id: epId,
          showId,
          seasonNumber: seasonNum,
          episodeNumber: epNum,
          watchedAt: Date.now()
        };
        batch.set(doc(db, 'users', user.uid, 'watched_episodes', epId), newEp);
      }
      batch.set(doc(db, 'users', user.uid, 'show_progress', `${showId}`), progress);
      await batch.commit();
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  };

  const toggleSeasonWatched = async (
    showId: number,
    seasonNum: number,
    showTitle: string,
    posterPath: string | null,
    episodes: any[],
    watched: boolean
  ) => {
    if (!user || isViewingShared) return;
    try {
      // 1. Calculate and update state & localStorage optimistically
      let nextWatchedEpisodes = [...watchedEpisodes];
      episodes.forEach((ep) => {
        const epId = `${showId}_${seasonNum}_${ep.episode_number}`;
        const isCurrentlyWatched = nextWatchedEpisodes.some(we => we.id === epId);
        
        if (watched && !isCurrentlyWatched) {
          const newEp: WatchedEpisode = {
            id: epId,
            showId,
            seasonNumber: seasonNum,
            episodeNumber: ep.episode_number,
            watchedAt: Date.now()
          };
          nextWatchedEpisodes.push(newEp);
        } else if (!watched && isCurrentlyWatched) {
          nextWatchedEpisodes = nextWatchedEpisodes.filter(we => we.id !== epId);
        }
      });

      setWatchedEpisodes(nextWatchedEpisodes);
      localStorage.setItem(`cinetrack_cache_${user.uid}_watchedEpisodes`, JSON.stringify(nextWatchedEpisodes));

      const showEpsCount = nextWatchedEpisodes.filter(we => we.showId === showId).length;
      const existingProgress = showProgress.find(p => p.showId === showId);
      const totalEpisodes = existingProgress?.totalEpisodesCount || episodes.length;
      
      const lastEp = episodes[episodes.length - 1];
      const lastEpNum = lastEp ? lastEp.episode_number : 1;
      
      const progress: TVShowProgress = {
        showId,
        title: showTitle,
        posterPath,
        status: showEpsCount === totalEpisodes ? 'Completed' : 'Current',
        lastWatchedSeason: seasonNum,
        lastWatchedEpisode: lastEpNum,
        watchedEpisodesCount: showEpsCount,
        totalEpisodesCount: totalEpisodes,
        updatedAt: Date.now()
      };

      setShowProgress(prev => {
        const updatedProgress = [...prev.filter(p => p.showId !== showId), progress];
        localStorage.setItem(`cinetrack_cache_${user.uid}_showProgress`, JSON.stringify(updatedProgress));
        return updatedProgress;
      });

      showNotification(
        watched 
          ? `All episodes for Season ${seasonNum} marked as watched.` 
          : `All episodes for Season ${seasonNum} marked as unwatched.`,
        'success',
        showTitle
      );

      // 2. Perform Firestore write Batch in background
      const batch = writeBatch(db);
      episodes.forEach((ep) => {
        const epId = `${showId}_${seasonNum}_${ep.episode_number}`;
        const isCurrentlyWatched = watchedEpisodes.some(we => we.id === epId);
        
        if (watched && !isCurrentlyWatched) {
          const newEp: WatchedEpisode = {
            id: epId,
            showId,
            seasonNumber: seasonNum,
            episodeNumber: ep.episode_number,
            watchedAt: Date.now()
          };
          batch.set(doc(db, 'users', user.uid, 'watched_episodes', epId), newEp);
        } else if (!watched && isCurrentlyWatched) {
          batch.delete(doc(db, 'users', user.uid, 'watched_episodes', epId));
        }
      });
      batch.set(doc(db, 'users', user.uid, 'show_progress', `${showId}`), progress);
      await batch.commit();

    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  };

  const rateItem = async (targetId: number | string, type: 'movie' | 'tv' | 'episode', rating: number) => {
    if (!user || isViewingShared) return;
    const id = `${type}_${targetId}`;
    const item: UserRating = {
      id,
      targetId,
      type,
      rating,
      updatedAt: Date.now()
    };

    setRatings(prev => {
      const updated = [...prev.filter(r => r.id !== id), item];
      localStorage.setItem(`cinetrack_cache_${user.uid}_ratings`, JSON.stringify(updated));
      return updated;
    });

    try {
      await setDoc(doc(db, 'users', user.uid, 'ratings', id), item);
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  };

  const saveNote = async (targetId: number | string, type: 'movie' | 'tv' | 'episode', content: string) => {
    if (!user || isViewingShared) return;
    const id = `${type}_${targetId}`;

    setNotes(prev => {
      let updated;
      if (!content.trim()) {
        updated = prev.filter(n => n.id !== id);
      } else {
        const item: UserNote = {
          id,
          targetId,
          type,
          content,
          updatedAt: Date.now()
        };
        updated = [...prev.filter(n => n.id !== id), item];
      }
      localStorage.setItem(`cinetrack_cache_${user.uid}_notes`, JSON.stringify(updated));
      return updated;
    });

    try {
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
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  };

  const saveCustomList = async (list: Partial<CustomList>) => {
    if (!user || isViewingShared) return;
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

    const existingList = customLists.find(l => l.id === listId);
    let notificationText: string | null = null;
    let notificationTitle: string | null = null;

    if (existingList && list.items) {
      const existingItems = existingList.items || [];
      const incomingItems = list.items;
      if (incomingItems.length > existingItems.length) {
        const added = incomingItems.find(item => !existingItems.some(i => i.tmdbId === item.tmdbId && i.mediaType === item.mediaType));
        if (added) {
          notificationText = `"${added.title}" has been successfully added to "${fullList.name}".`;
          notificationTitle = fullList.name;
        }
      } else if (incomingItems.length < existingItems.length) {
        const removed = existingItems.find(item => !incomingItems.some(i => i.tmdbId === item.tmdbId && i.mediaType === item.mediaType));
        if (removed) {
          notificationText = `"${removed.title}" has been successfully removed from "${fullList.name}".`;
          notificationTitle = fullList.name;
        }
      }
    } else if (!existingList && list.items && list.items.length > 0) {
      const added = list.items[0];
      if (added) {
        notificationText = `"${added.title}" has been successfully added to "${fullList.name}".`;
        notificationTitle = fullList.name;
      }
    }

    setCustomLists(prev => {
      const updated = [...prev.filter(l => l.id !== listId), fullList].sort((a, b) => a.order - b.order);
      localStorage.setItem(`cinetrack_cache_${user.uid}_customLists`, JSON.stringify(updated));
      return updated;
    });

    if (notificationText && notificationTitle) {
      showNotification(notificationText, 'success', notificationTitle);
    }

    try {
      await setDoc(doc(db, 'users', user.uid, 'custom_lists', listId), fullList);
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  };

  const deleteCustomList = async (listId: string) => {
    if (!user || isViewingShared) return;

    setCustomLists(prev => {
      const updated = prev.filter(l => l.id !== listId);
      localStorage.setItem(`cinetrack_cache_${user.uid}_customLists`, JSON.stringify(updated));
      return updated;
    });

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'custom_lists', listId));
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    if (newSettings.tmdbApiKey !== undefined) {
      setRuntimeTmdbApiKey(newSettings.tmdbApiKey || null);
    }

    if (user && !isViewingShared) {
      localStorage.setItem(`cinetrack_cache_${user.uid}_settings`, JSON.stringify(updated));
      try {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), updated);
      } catch (err) {
        console.error('Firestore sync error:', err);
      }
    }
  };

  const loginAsGuest = async () => {
    throw new Error('Guest sign-in is disabled. Please register or sign in with your email and password.');
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const clonedUser = Object.assign(
        Object.create(Object.getPrototypeOf(auth.currentUser)),
        auth.currentUser
      );
      setUser(clonedUser);
    }
  };

  const logout = async () => {
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
    setRuntimeTmdbApiKey(null);
  };

  const deleteUserAccount = async () => {
    if (!auth.currentUser) {
      throw new Error("No user is signed in.");
    }
    const userId = auth.currentUser.uid;
    try {
      setLoading(true);
      const collectionsToDelete = [
        'watchlist',
        'favorites',
        'show_progress',
        'watched_episodes',
        'watched_movies',
        'ratings',
        'notes',
        'custom_lists'
      ];
      
      const batch = writeBatch(db);
      
      for (const colName of collectionsToDelete) {
        const querySnapshot = await getDocs(collection(db, 'users', userId, colName));
        querySnapshot.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
      }
      
      batch.delete(doc(db, 'users', userId));
      
      await batch.commit();
      
      await deleteUser(auth.currentUser);
      setUser(null);
      showNotification('Your account and all associated data have been deleted successfully.', 'success', 'Account Deleted');
    } catch (err: any) {
      console.error('Failed to delete account:', err);
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('For security reasons, this action requires a recent sign-in. Please sign out, sign back in, and try again.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Share functions
  const loadSharedAccountByEmail = async (email: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const q = query(collection(db, 'profiles'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const profileData = snap.docs[0].data();
        setDbUserId(profileData.uid);
        setSharedUser({
          uid: profileData.uid,
          email: profileData.email,
          displayName: profileData.displayName || profileData.email.split('@')[0]
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error loading shared account by email:', err);
      return false;
    }
  };

  const loadSharedAccountByUid = async (uid: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const docSnap = await getDoc(doc(db, 'profiles', uid));
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        setDbUserId(profileData.uid);
        setSharedUser({
          uid: profileData.uid,
          email: profileData.email,
          displayName: profileData.displayName || profileData.email.split('@')[0]
        });
        return true;
      } else {
        setDbUserId(uid);
        setSharedUser({
          uid: uid,
          email: 'Shared Account',
          displayName: 'Shared Member'
        });
        return true;
      }
    } catch (err) {
      console.error('Error loading shared account by uid:', err);
      // Robust Fallback: Still connect to the shared library even if profiles lookup fails (due to rule/permission issues)
      setDbUserId(uid);
      setSharedUser({
        uid: uid,
        email: 'Shared Account',
        displayName: 'Shared Member'
      });
      return true;
    }
  };

  const stopViewingSharedAccount = () => {
    if (user) {
      setDbUserId(user.uid);
      setSharedUser(null);
    }
  };

  const mergeSharedAccountData = async () => {
    if (!user || !sharedUser) return;
    const currentUid = user.uid;

    try {
      let batch = writeBatch(db);
      let opCount = 0;

      const commitIfNeeded = async () => {
        if (opCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      };

      // 1. Merge Watchlist
      for (const item of watchlist) {
        batch.set(doc(db, 'users', currentUid, 'watchlist', item.id), item);
        opCount++;
        await commitIfNeeded();
      }

      // 2. Merge Favorites
      for (const item of favorites) {
        batch.set(doc(db, 'users', currentUid, 'favorites', item.id), item);
        opCount++;
        await commitIfNeeded();
      }

      // 3. Merge Show Progress
      for (const item of showProgress) {
        batch.set(doc(db, 'users', currentUid, 'show_progress', `${item.showId}`), item);
        opCount++;
        await commitIfNeeded();
      }

      // 4. Merge Watched Episodes
      for (const item of watchedEpisodes) {
        batch.set(doc(db, 'users', currentUid, 'watched_episodes', item.id), item);
        opCount++;
        await commitIfNeeded();
      }

      // 5. Merge Watched Movies
      for (const item of watchedMovies) {
        batch.set(doc(db, 'users', currentUid, 'watched_movies', `${item.movieId}`), item);
        opCount++;
        await commitIfNeeded();
      }

      // 6. Merge Ratings
      for (const item of ratings) {
        batch.set(doc(db, 'users', currentUid, 'ratings', item.id), item);
        opCount++;
        await commitIfNeeded();
      }

      // 7. Merge Notes
      for (const item of notes) {
        batch.set(doc(db, 'users', currentUid, 'notes', item.id), item);
        opCount++;
        await commitIfNeeded();
      }

      // 8. Merge Custom Lists
      for (const item of customLists) {
        batch.set(doc(db, 'users', currentUid, 'custom_lists', item.id), item);
        opCount++;
        await commitIfNeeded();
      }

      if (opCount > 0) {
        await batch.commit();
      }

      stopViewingSharedAccount();
    } catch (err) {
      console.error('Error merging shared data:', err);
      throw err;
    }
  };

  const isViewingShared = dbUserId !== null && user !== null && dbUserId !== user.uid;

  // Check for shared UID in URL query parameters on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareUid = params.get('share') || params.get('shareUID');
    if (shareUid && user) {
      loadSharedAccountByUid(shareUid);
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [user]);

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

  const isGuest = false;
  const isAdmin = !!user;

  return (
    <CineTrackContext.Provider value={{
      user,
      isAdmin,
      isGuest,
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
      notifications,
      showNotification,
      dismissNotification,
      
      sharedUser,
      isViewingShared,
      loadSharedAccountByEmail,
      loadSharedAccountByUid,
      stopViewingSharedAccount,
      mergeSharedAccountData,
      
      addToWatchlist,
      removeFromWatchlist,
      toggleFavorite,
      toggleMovieWatched,
      toggleEpisodeWatched,
      toggleSeasonWatched,
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
      loginWithGoogle,
      logout,
      refreshUser,
      deleteUserAccount
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
