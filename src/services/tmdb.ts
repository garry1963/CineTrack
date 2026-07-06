import { TMDBMedia, TMDBSeason, TMDBEpisode } from '../types';

async function fetchDirectTMDB<T = any>(
  path: string,
  params: Record<string, any>,
  apiKey: string
): Promise<T> {
  const searchParams = new URLSearchParams();
  searchParams.append('api_key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }

  const response = await fetch(`https://api.themoviedb.org/3${path}?${searchParams.toString()}`);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Direct TMDB API returned status ${response.status}: ${errText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchFromTMDB<T = any>(
  path: string, 
  params: Record<string, any> = {}, 
  bypassCache = false
): Promise<T> {
  const queryParams = new URLSearchParams();
  queryParams.append('path', path);
  if (bypassCache) {
    queryParams.append('bypassCache', 'true');
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  }

  const envKey = (import.meta as any).env?.VITE_TMDB_API_KEY;
  const customKey = typeof window !== 'undefined' ? (localStorage.getItem('cine_tmdb_api_key') || (envKey && envKey !== 'YOUR_TMDB_API_KEY' ? envKey : null)) : null;
  const headers: Record<string, string> = {};
  if (customKey) {
    headers['x-tmdb-key'] = customKey;
  }

  try {
    const response = await fetch(`/api/tmdb?${queryParams.toString()}`, { headers });
    
    // If the server proxy is not found (404/502) or is unavailable, try direct TMDB API call from client
    if (response.status === 404 || response.status === 502) {
      if (customKey) {
        return fetchDirectTMDB<T>(path, params, customKey);
      }
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // If server returns needsConfig, retry direct TMDB from client if they provided their own key
      if (errorData.needsConfig && customKey) {
        return fetchDirectTMDB<T>(path, params, customKey);
      }
      throw new Error(errorData.error || `TMDB proxy returned status ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (error: any) {
    // If local fetch failed entirely (network down/no proxy server), try direct TMDB
    if (customKey) {
      return fetchDirectTMDB<T>(path, params, customKey);
    }
    throw error;
  }
}

// Service Functions
export const tmdb = {
  getTrending: (mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'day', page = 1) => {
    return fetchFromTMDB(`/trending/${mediaType}/${timeWindow}`, { page });
  },

  getPopular: (mediaType: 'movie' | 'tv', page = 1) => {
    return fetchFromTMDB(`/${mediaType}/popular`, { page });
  },

  getTopRated: (mediaType: 'movie' | 'tv', page = 1) => {
    return fetchFromTMDB(`/${mediaType}/top_rated`, { page });
  },

  getNowPlayingMovies: (page = 1) => {
    return fetchFromTMDB('/movie/now_playing', { page });
  },

  getUpcomingMovies: (page = 1) => {
    return fetchFromTMDB('/movie/upcoming', { page });
  },

  getAiringTodayTV: (page = 1) => {
    return fetchFromTMDB('/tv/airing_today', { page });
  },

  getOnTheAirTV: (page = 1) => {
    return fetchFromTMDB('/tv/on_the_air', { page });
  },

  getShowDetails: (id: number): Promise<TMDBMedia> => {
    return fetchFromTMDB(`/tv/${id}`, { append_to_response: 'credits,videos,recommendations,similar' });
  },

  getMovieDetails: (id: number): Promise<TMDBMedia> => {
    return fetchFromTMDB(`/movie/${id}`, { append_to_response: 'credits,videos,recommendations,similar' });
  },

  getSeasonDetails: (showId: number, seasonNumber: number): Promise<TMDBSeason> => {
    return fetchFromTMDB(`/tv/${showId}/season/${seasonNumber}`);
  },

  getEpisodeDetails: (showId: number, seasonNumber: number, episodeNumber: number): Promise<TMDBEpisode> => {
    return fetchFromTMDB(`/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`);
  },

  searchMulti: (queryText: string, page = 1) => {
    return fetchFromTMDB('/search/multi', { query: queryText, page });
  },

  searchPerson: (queryText: string, page = 1) => {
    return fetchFromTMDB('/search/person', { query: queryText, page });
  },

  getDiscover: (mediaType: 'movie' | 'tv', filters: Record<string, any> = {}, page = 1) => {
    // Process known filters to match TMDB API query parameters
    const queryParams: Record<string, any> = { page };
    
    if (filters.genre) {
      queryParams.with_genres = filters.genre;
    }
    if (filters.year) {
      if (mediaType === 'movie') {
        queryParams.primary_release_year = filters.year;
      } else {
        queryParams.first_air_date_year = filters.year;
      }
    }
    if (filters.language) {
      queryParams.with_original_language = filters.language;
    }
    if (filters.status) {
      // status filter varies by show/movie, but we can search with standard query
    }
    if (filters.sortBy) {
      queryParams.sort_by = filters.sortBy;
    } else {
      queryParams.sort_by = 'popularity.desc';
    }

    return fetchFromTMDB(`/discover/${mediaType}`, queryParams);
  },

  getGenres: async (mediaType: 'movie' | 'tv'): Promise<{ genres: { id: number; name: string }[] }> => {
    return fetchFromTMDB(`/genre/${mediaType}/list`);
  },

  getWatchProviders: async (mediaType: 'movie' | 'tv', id: number) => {
    return fetchFromTMDB(`/${mediaType}/${id}/watch/providers`);
  }
};
