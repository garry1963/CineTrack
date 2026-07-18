export type ViewState = 
  | { type: 'home' }
  | { type: 'discover' }
  | { type: 'search' }
  | { type: 'watchlist'; tab?: 'watchlist' | 'favorites' | 'custom_lists'; listId?: string | null }
  | { type: 'calendar' }
  | { type: 'statistics' }
  | { type: 'profile' }
  | { type: 'admin-login' }
  | { type: 'show-details'; showId: number }
  | { type: 'movie-details'; movieId: number }
  | { type: 'season-details'; showId: number; seasonNumber: number; showName: string }
  | { type: 'episode-details'; showId: number; seasonNumber: number; episodeNumber: number; showName: string }
  | { type: 'reddit-viewer'; url: string; title: string; fallbackSearch?: string };

export type ThemeMode = 'light' | 'dark' | 'amoled' | 'dynamic';

export interface AppSettings {
  theme: ThemeMode;
  language: string;
  posterQuality: 'w342' | 'w500' | 'original';
  backdropQuality: 'w780' | 'w1280' | 'original';
  autoSync: boolean;
  cacheSize: string; // e.g. "50MB"
  tmdbApiKey?: string;
  homeSections?: string[];
}

// TMDB Standard Structures
export interface Genre {
  id: number;
  name: string;
}

export interface Network {
  id: number;
  name: string;
  logo_path: string | null;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface TMDBMedia {
  id: number;
  title?: string;       // Movie
  name?: string;        // TV Show
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type?: 'movie' | 'tv';
  release_date?: string; // Movie
  first_air_date?: string; // TV Show
  vote_average: number;
  vote_count: number;
  genres?: Genre[];
  genre_ids?: number[];
  runtime?: number;      // Movie
  episode_run_time?: number[]; // TV Show
  status?: string;
  tagline?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: {
    id: number;
    season_number: number;
    episode_count: number;
    name?: string;
    poster_path?: string | null;
  }[];
  networks?: Network[];
  credits?: {
    cast: CastMember[];
    crew: CrewMember[];
  };
  videos?: {
    results: Video[];
  };
  recommendations?: {
    results: TMDBMedia[];
  };
  similar?: {
    results: TMDBMedia[];
  };
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
  budget?: number;
  revenue?: number;
  production_companies?: {
    id: number;
    name: string;
    logo_path: string | null;
  }[];
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TMDBEpisode[];
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  vote_average: number;
  runtime: number | null;
  guest_stars?: CastMember[];
  crew?: CrewMember[];
}

// Firestore / Sync Structures
export interface WatchlistItem {
  id: string; // "movie_123" or "tv_456"
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  addedAt: number;
  runtime?: number;
}

export interface FavoriteItem {
  id: string; // "movie_123" or "tv_456"
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  addedAt: number;
  runtime?: number;
}

export type TVShowStatus = 'Current' | 'Completed' | 'Dropped' | 'Paused' | 'Plan to Watch' | 'Rewatching';
export type MovieStatus = 'Watched' | 'Unwatched' | 'Rewatch' | 'Wishlist';

export interface TVShowProgress {
  showId: number;
  title: string;
  posterPath: string | null;
  status: TVShowStatus;
  lastWatchedSeason: number;
  lastWatchedEpisode: number;
  watchedEpisodesCount: number;
  totalEpisodesCount: number;
  updatedAt: number;
}

export interface WatchedEpisode {
  id: string; // "showId_seasonNumber_episodeNumber"
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: number;
}

export interface WatchedMovie {
  movieId: number;
  title: string;
  posterPath: string | null;
  status: MovieStatus;
  watchedAt: number; // timestamp
  watchCount: number; // for rewatching
}

export interface UserRating {
  id: string; // "movie_123" or "tv_456" or "episode_showId_season_episode"
  targetId: number | string;
  type: 'movie' | 'tv' | 'episode';
  rating: number; // 0.5 to 10 stars
  updatedAt: number;
}

export interface UserNote {
  id: string; // "movie_123" or "tv_456" or "episode_showId_season_episode"
  targetId: number | string;
  type: 'movie' | 'tv' | 'episode';
  content: string; // Markdown supported
  updatedAt: number;
}

export interface CustomList {
  id: string;
  name: string;
  description: string;
  artworkUrl: string | null;
  items: {
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    posterPath: string | null;
    runtime?: number;
    releaseDate?: string;
    addedAt?: number;
  }[];
  createdAt: number;
  order: number;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  title?: string;
  duration?: number;
}
