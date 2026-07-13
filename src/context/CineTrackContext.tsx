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
        setSettings(defaultSettings);
        setRuntimeTmdbApiKey(null);
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

    try {
      await setDoc(doc(db, 'users', user.uid, 'watchlist', item.id), item);
      showNotification(`"${item.title}" has been successfully added to your Watchlist.`, 'success', 'Watchlist');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/watchlist/${item.id}`);
    }
  };

  const removeFromWatchlist = async (tmdbId: number, mediaType: 'movie' | 'tv') => {
    if (!user || isViewingShared) return;
    const itemId = `${mediaType}_${tmdbId}`;
    const existingItem = watchlist.find(w => w.id === itemId);
    const title = existingItem ? existingItem.title : (mediaType === 'movie' ? 'Movie' : 'TV show');
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'watchlist', itemId));
      showNotification(`"${title}" has been successfully removed from your Watchlist.`, 'success', 'Watchlist');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/watchlist/${itemId}`);
    }
  };

  const toggleFavorite = async (media: TMDBMedia, mediaType: 'movie' | 'tv') => {
    if (!user || isViewingShared) return;
    const docId = `${mediaType}_${media.id}`;
    const isFav = favorites.some(f => f.id === docId);
    const title = media.title || media.name || (mediaType === 'movie' ? 'Movie' : 'TV show');
    try {
      if (isFav) {
        await deleteDoc(doc(db, 'users', user.uid, 'favorites', docId));
        showNotification(`"${title}" has been successfully removed from your Favorites.`, 'success', 'Favorites');
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

        await setDoc(doc(db, 'users', user.uid, 'favorites', docId), item);
        showNotification(`"${title}" has been successfully added to your Favorites.`, 'success', 'Favorites');
      }
    } catch (err) {
      handleFirestoreError(err, isFav ? OperationType.DELETE : OperationType.WRITE, `users/${user.uid}/favorites/${docId}`);
    }
  };

  const toggleMovieWatched = async (movieId: number, title: string, posterPath: string | null, status: 'Watched' | 'Wishlist' | 'Rewatch' | 'Unwatched') => {
    if (!user || isViewingShared) return;
    const docId = `${movieId}`;
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

    try {
      const batch = writeBatch(db);
      if (isWatched) {
        // Remove watched episode
        batch.delete(doc(db, 'users', user.uid, 'watched_episodes', epId));
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
        batch.set(doc(db, 'users', user.uid, 'show_progress', `${showId}`), progress);
      } else {
        // Add watched episode
        const newEp: WatchedEpisode = {
          id: epId,
          showId,
          seasonNumber: seasonNum,
          episodeNumber: epNum,
          watchedAt: Date.now()
        };
        batch.set(doc(db, 'users', user.uid, 'watched_episodes', epId), newEp);
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
        batch.set(doc(db, 'users', user.uid, 'show_progress', `${showId}`), progress);
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/watched_episodes/${epId}`);
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
      
      let showEpsCount = watchedEpisodes.filter(we => we.showId === showId).length;
      episodes.forEach(ep => {
        const epId = `${showId}_${seasonNum}_${ep.episode_number}`;
        const isCurrentlyWatched = watchedEpisodes.some(we => we.id === epId);
        if (watched && !isCurrentlyWatched) {
          showEpsCount++;
        } else if (!watched && isCurrentlyWatched) {
          showEpsCount = Math.max(0, showEpsCount - 1);
        }
      });
      
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
      
      batch.set(doc(db, 'users', user.uid, 'show_progress', `${showId}`), progress);
      
      await batch.commit();
      
      showNotification(
        watched 
          ? `All episodes for Season ${seasonNum} marked as watched.` 
          : `All episodes for Season ${seasonNum} marked as unwatched.`,
        'success',
        showTitle
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/show_progress/${showId}`);
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
    try {
      await setDoc(doc(db, 'users', user.uid, 'ratings', id), item);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/ratings/${id}`);
    }
  };

  const saveNote = async (targetId: number | string, type: 'movie' | 'tv' | 'episode', content: string) => {
    if (!user || isViewingShared) return;
    const id = `${type}_${targetId}`;
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

    try {
      await setDoc(doc(db, 'users', user.uid, 'custom_lists', listId), fullList);
      if (notificationText && notificationTitle) {
        showNotification(notificationText, 'success', notificationTitle);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/custom_lists/${listId}`);
    }
  };

  const deleteCustomList = async (listId: string) => {
    if (!user || isViewingShared) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'custom_lists', listId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/custom_lists/${listId}`);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    if (newSettings.tmdbApiKey !== undefined) {
      setRuntimeTmdbApiKey(newSettings.tmdbApiKey || null);
    }

    if (user && !isViewingShared) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/settings/preferences`);
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
      setUser({ ...auth.currentUser } as any);
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
