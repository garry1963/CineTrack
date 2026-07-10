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
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
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
import { setRuntimeTmdbApiKey } from '../services/tmdb';

export interface LocalUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

interface CineTrackContextType {
  user: User | LocalUser | null;
  isAdmin: boolean;
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

  // Load local settings on boot as fallback
  useEffect(() => {
    const local = localStorage.getItem('cinetrack_local_settings');
    if (local) {
      try {
        setSettings(JSON.parse(local));
      } catch (e) {}
    }
  }, []);
  const [sharedUser, setSharedUser] = useState<{ uid: string; email: string; displayName: string } | null>(null);

  // Sync dbUserId: use user.uid when logged in, or null when signed out
  useEffect(() => {
    if (user) {
      setDbUserId(user.uid);
    } else {
      setDbUserId(null);
    }
    setSharedUser(null);
  }, [user]);

  // Update user profile mapping in Firestore for sharing lookup
  useEffect(() => {
    if (user && !user.isAnonymous && user.email) {
      const updateProfile = async () => {
        try {
          await setDoc(doc(db, 'profiles', user.uid), {
            uid: user.uid,
            email: user.email.toLowerCase(),
            displayName: user.email.split('@')[0],
            lastActive: Date.now()
          }, { merge: true });
        } catch (err) {
          console.error('Error updating share profile mapping:', err);
        }
      };
      updateProfile();
    }
  }, [user]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!dbUserId) {
      // Load local offline data when not synced to any database user
      const localWatchlist = localStorage.getItem('cinetrack_local_watchlist');
      const localFavorites = localStorage.getItem('cinetrack_local_favorites');
      const localProgress = localStorage.getItem('cinetrack_local_show_progress');
      const localEpisodes = localStorage.getItem('cinetrack_local_watched_episodes');
      const localMovies = localStorage.getItem('cinetrack_local_watched_movies');
      const localRatings = localStorage.getItem('cinetrack_local_ratings');
      const localNotes = localStorage.getItem('cinetrack_local_notes');
      const localLists = localStorage.getItem('cinetrack_local_custom_lists');
      const localSettings = localStorage.getItem('cinetrack_local_settings');

      setWatchlist(localWatchlist ? JSON.parse(localWatchlist) : []);
      setFavorites(localFavorites ? JSON.parse(localFavorites) : []);
      setShowProgress(localProgress ? JSON.parse(localProgress) : []);
      setWatchedEpisodes(localEpisodes ? JSON.parse(localEpisodes) : []);
      setWatchedMovies(localMovies ? JSON.parse(localMovies) : []);
      setRatings(localRatings ? JSON.parse(localRatings) : []);
      setNotes(localNotes ? JSON.parse(localNotes) : []);
      setCustomLists(localLists ? JSON.parse(localLists) : []);
      setSettings(localSettings ? JSON.parse(localSettings) : defaultSettings);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userId = dbUserId;

    const unsubWatchlist = onSnapshot(collection(db, 'users', userId, 'watchlist'), (snap) => {
      setWatchlist(snap.docs.map(doc => doc.data() as WatchlistItem));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/watchlist`);
    });

    const unsubFavorites = onSnapshot(collection(db, 'users', userId, 'favorites'), (snap) => {
      setFavorites(snap.docs.map(doc => doc.data() as FavoriteItem));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/favorites`);
    });

    const unsubShowProgress = onSnapshot(collection(db, 'users', userId, 'show_progress'), (snap) => {
      setShowProgress(snap.docs.map(doc => doc.data() as TVShowProgress));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/show_progress`);
    });

    const unsubWatchedEpisodes = onSnapshot(collection(db, 'users', userId, 'watched_episodes'), (snap) => {
      setWatchedEpisodes(snap.docs.map(doc => doc.data() as WatchedEpisode));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/watched_episodes`);
    });

    const unsubWatchedMovies = onSnapshot(collection(db, 'users', userId, 'watched_movies'), (snap) => {
      setWatchedMovies(snap.docs.map(doc => doc.data() as WatchedMovie));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/watched_movies`);
    });

    const unsubRatings = onSnapshot(collection(db, 'users', userId, 'ratings'), (snap) => {
      setRatings(snap.docs.map(doc => doc.data() as UserRating));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/ratings`);
    });

    const unsubNotes = onSnapshot(collection(db, 'users', userId, 'notes'), (snap) => {
      setNotes(snap.docs.map(doc => doc.data() as UserNote));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/notes`);
    });

    const unsubCustomLists = onSnapshot(collection(db, 'users', userId, 'custom_lists'), (snap) => {
      const lists = snap.docs.map(doc => doc.data() as CustomList);
      setCustomLists(lists.sort((a, b) => a.order - b.order));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/custom_lists`);
    });

    const unsubSettings = onSnapshot(doc(db, 'users', userId, 'settings', 'preferences'), (docSnap) => {
      if (docSnap.exists()) {
        const loadedSettings = docSnap.data() as AppSettings;
        setSettings({ ...defaultSettings, ...loadedSettings });
        setRuntimeTmdbApiKey(loadedSettings.tmdbApiKey || null);
      } else {
        const local = localStorage.getItem('cinetrack_local_settings');
        if (local) {
          try {
            setSettings(JSON.parse(local));
          } catch (e) {}
        } else {
          setSettings(defaultSettings);
          setRuntimeTmdbApiKey(null);
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
    const item: WatchlistItem = {
      id: `${mediaType}_${media.id}`,
      tmdbId: media.id,
      mediaType,
      title: media.title || media.name || '',
      posterPath: media.poster_path,
      addedAt: Date.now()
    };

    if (user) {
      if (isViewingShared) return;
      try {
        await setDoc(doc(db, 'users', user.uid, 'watchlist', item.id), item);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/watchlist/${item.id}`);
      }
    } else {
      const updated = [...watchlist.filter(w => w.id !== item.id), item];
      setWatchlist(updated);
      localStorage.setItem('cinetrack_local_watchlist', JSON.stringify(updated));
    }
  };

  const removeFromWatchlist = async (tmdbId: number, mediaType: 'movie' | 'tv') => {
    const itemId = `${mediaType}_${tmdbId}`;
    if (user) {
      if (isViewingShared) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'watchlist', itemId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/watchlist/${itemId}`);
      }
    } else {
      const updated = watchlist.filter(w => w.id !== itemId);
      setWatchlist(updated);
      localStorage.setItem('cinetrack_local_watchlist', JSON.stringify(updated));
    }
  };

  const toggleFavorite = async (media: TMDBMedia, mediaType: 'movie' | 'tv') => {
    const docId = `${mediaType}_${media.id}`;
    const isFav = favorites.some(f => f.id === docId);
    if (user) {
      if (isViewingShared) return;
      try {
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
      } catch (err) {
        handleFirestoreError(err, isFav ? OperationType.DELETE : OperationType.WRITE, `users/${user.uid}/favorites/${docId}`);
      }
    } else {
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
      localStorage.setItem('cinetrack_local_favorites', JSON.stringify(updated));
    }
  };

  const toggleMovieWatched = async (movieId: number, title: string, posterPath: string | null, status: 'Watched' | 'Wishlist' | 'Rewatch' | 'Unwatched') => {
    const docId = `${movieId}`;
    if (user) {
      if (isViewingShared) return;
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
        handleFirestoreError(err, status === 'Unwatched' ? OperationType.DELETE : OperationType.WRITE, `users/${user.uid}/watched_movies/${docId}`);
      }
    } else {
      let updated;
      if (status === 'Unwatched') {
        updated = watchedMovies.filter(m => `${m.movieId}` !== docId);
      } else {
        const item: WatchedMovie = {
          movieId,
          title,
          posterPath,
          status,
          watchedAt: Date.now(),
          watchCount: status === 'Rewatch' ? 2 : 1
        };
        updated = [...watchedMovies.filter(m => `${m.movieId}` !== docId), item];
      }
      setWatchedMovies(updated);
      localStorage.setItem('cinetrack_local_watched_movies', JSON.stringify(updated));
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
    const epId = `${showId}_${seasonNum}_${epNum}`;
    const isWatched = watchedEpisodes.some(we => we.id === epId);

    if (user) {
      if (isViewingShared) return;
      try {
        if (isWatched) {
          // Remove watched episode
          await deleteDoc(doc(db, 'users', user.uid, 'watched_episodes', epId));
          const updatedCount = Math.max(0, watchedEpisodes.filter(we => we.showId === showId).length - 1);
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
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/watched_episodes/${epId}`);
      }
    } else {
      let updatedEps;
      let updatedCount;
      if (isWatched) {
        updatedEps = watchedEpisodes.filter(we => we.id !== epId);
        updatedCount = Math.max(0, updatedEps.filter(we => we.showId === showId).length);
      } else {
        const newEp: WatchedEpisode = {
          id: epId,
          showId,
          seasonNumber: seasonNum,
          episodeNumber: epNum,
          watchedAt: Date.now()
        };
        updatedEps = [...watchedEpisodes, newEp];
        updatedCount = updatedEps.filter(we => we.showId === showId).length;
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

      setWatchedEpisodes(updatedEps);
      setShowProgress(updatedProgress);
      localStorage.setItem('cinetrack_local_watched_episodes', JSON.stringify(updatedEps));
      localStorage.setItem('cinetrack_local_show_progress', JSON.stringify(updatedProgress));
    }
  };

  const rateItem = async (targetId: number | string, type: 'movie' | 'tv' | 'episode', rating: number) => {
    const id = `${type}_${targetId}`;
    const item: UserRating = {
      id,
      targetId,
      type,
      rating,
      updatedAt: Date.now()
    };
    if (user) {
      if (isViewingShared) return;
      try {
        await setDoc(doc(db, 'users', user.uid, 'ratings', id), item);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/ratings/${id}`);
      }
    } else {
      const updated = [...ratings.filter(r => r.id !== id), item];
      setRatings(updated);
      localStorage.setItem('cinetrack_local_ratings', JSON.stringify(updated));
    }
  };

  const saveNote = async (targetId: number | string, type: 'movie' | 'tv' | 'episode', content: string) => {
    const id = `${type}_${targetId}`;
    if (user) {
      if (isViewingShared) return;
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
        handleFirestoreError(err, !content.trim() ? OperationType.DELETE : OperationType.WRITE, `users/${user.uid}/notes/${id}`);
      }
    } else {
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
      localStorage.setItem('cinetrack_local_notes', JSON.stringify(updated));
    }
  };

  const saveCustomList = async (list: Partial<CustomList>) => {
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
    if (user) {
      if (isViewingShared) return;
      try {
        await setDoc(doc(db, 'users', user.uid, 'custom_lists', listId), fullList);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/custom_lists/${listId}`);
      }
    } else {
      const updated = [...customLists.filter(l => l.id !== listId), fullList];
      setCustomLists(updated.sort((a, b) => a.order - b.order));
      localStorage.setItem('cinetrack_local_custom_lists', JSON.stringify(updated));
    }
  };

  const deleteCustomList = async (listId: string) => {
    if (user) {
      if (isViewingShared) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'custom_lists', listId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/custom_lists/${listId}`);
      }
    } else {
      const updated = customLists.filter(l => l.id !== listId);
      setCustomLists(updated);
      localStorage.setItem('cinetrack_local_custom_lists', JSON.stringify(updated));
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    if (newSettings.tmdbApiKey !== undefined) {
      setRuntimeTmdbApiKey(newSettings.tmdbApiKey || null);
    }

    if (user) {
      if (!isViewingShared) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), updated);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/settings/preferences`);
        }
      }
    } else {
      localStorage.setItem('cinetrack_local_settings', JSON.stringify(updated));
    }
  };

  const loginAsGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error('Error signing in anonymously:', err);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
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
      // 1. Merge Watchlist
      for (const item of watchlist) {
        await setDoc(doc(db, 'users', currentUid, 'watchlist', item.id), item);
      }

      // 2. Merge Favorites
      for (const item of favorites) {
        await setDoc(doc(db, 'users', currentUid, 'favorites', item.id), item);
      }

      // 3. Merge Show Progress
      for (const item of showProgress) {
        await setDoc(doc(db, 'users', currentUid, 'show_progress', `${item.showId}`), item);
      }

      // 4. Merge Watched Episodes
      for (const item of watchedEpisodes) {
        await setDoc(doc(db, 'users', currentUid, 'watched_episodes', item.id), item);
      }

      // 5. Merge Watched Movies
      for (const item of watchedMovies) {
        await setDoc(doc(db, 'users', currentUid, 'watched_movies', `${item.movieId}`), item);
      }

      // 6. Merge Ratings
      for (const item of ratings) {
        await setDoc(doc(db, 'users', currentUid, 'ratings', item.id), item);
      }

      // 7. Merge Notes
      for (const item of notes) {
        await setDoc(doc(db, 'users', currentUid, 'notes', item.id), item);
      }

      // 8. Merge Custom Lists
      for (const item of customLists) {
        await setDoc(doc(db, 'users', currentUid, 'custom_lists', item.id), item);
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

  const isAdmin = !!user;

  return (
    <CineTrackContext.Provider value={{
      user,
      isAdmin,
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
