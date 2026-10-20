import { TMDBMedia, TMDBSeason, TMDBEpisode } from '../types';
import { tvmaze, setRuntimeTvmazeApiKey } from './tvmaze';

export { tvmaze, setRuntimeTvmazeApiKey };

let runtimeTvProvider: 'tmdb' | 'tvmaze' = 'tmdb';

export function setRuntimeTvProvider(provider: 'tmdb' | 'tvmaze') {
  runtimeTvProvider = provider;
}

export function getRuntimeTvProvider(): 'tmdb' | 'tvmaze' {
  return runtimeTvProvider;
}

let activeTmdbApiKey: string | null = null;

export function setRuntimeTmdbApiKey(key: string | null) {
  activeTmdbApiKey = key;
}

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

  const envKey = (import.meta as any).env?.VITE_TMDB_API_KEY || (import.meta as any).env?.TMDB_API_KEY || (import.meta as any).env?.REACT_APP_TMDB_API_KEY;
  const rawKey = activeTmdbApiKey || (envKey && envKey !== 'YOUR_TMDB_API_KEY' ? envKey : null);
  const customKey = rawKey && rawKey !== 'undefined' && rawKey !== 'null' && rawKey !== 'YOUR_TMDB_API_KEY' && rawKey.trim() !== '' ? rawKey : null;
  
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

  getAiringTodayTV: async (page = 1) => {
    if (runtimeTvProvider === 'tvmaze') {
      try {
        const shows = await tvmaze.getAiringToday();
        if (shows.length > 0) {
          return { results: shows, page: 1, total_pages: 1, total_results: shows.length };
        }
      } catch (err) {
        console.warn('TVmaze getAiringToday failed, falling back to TMDB:', err);
      }
    }
    return fetchFromTMDB('/tv/airing_today', { page });
  },

  getOnTheAirTV: async (page = 1) => {
    if (runtimeTvProvider === 'tvmaze') {
      try {
        const shows = await tvmaze.getPopularShows(page - 1);
        if (shows.length > 0) {
          return { results: shows, page, total_pages: 10, total_results: 100 };
        }
      } catch (err) {
        console.warn('TVmaze getOnTheAirTV failed, falling back to TMDB:', err);
      }
    }
    return fetchFromTMDB('/tv/on_the_air', { page });
  },

  getShowDetails: async (id: number, forceProvider?: 'tmdb' | 'tvmaze', expectedTitle?: string): Promise<TMDBMedia> => {
    const useTvmaze = forceProvider === 'tvmaze' || (forceProvider !== 'tmdb' && runtimeTvProvider === 'tvmaze');
    if (useTvmaze) {
      try {
        const show = await tvmaze.getShowDetails(id, expectedTitle);
        if (show) return show;
      } catch (err) {
        console.warn(`TVmaze getShowDetails for show ${id} failed, falling back to TMDB:`, err);
      }
    }
    try {
      const show = await fetchFromTMDB<TMDBMedia>(`/tv/${id}`, { append_to_response: 'credits,videos,recommendations,similar' });
      show.metadata_source = 'tmdb';
      return show;
    } catch (err) {
      if (!useTvmaze) {
        try {
          return await tvmaze.getShowDetails(id, expectedTitle);
        } catch {}
      }
      throw err;
    }
  },

  getMovieDetails: (id: number): Promise<TMDBMedia> => {
    return fetchFromTMDB(`/movie/${id}`, { append_to_response: 'credits,videos,recommendations,similar' });
  },

  getSeasonDetails: async (showId: number, seasonNumber: number, forceProvider?: 'tmdb' | 'tvmaze', expectedTitle?: string): Promise<TMDBSeason> => {
    const useTvmaze = forceProvider === 'tvmaze' || (forceProvider !== 'tmdb' && runtimeTvProvider === 'tvmaze');
    if (useTvmaze) {
      try {
        return await tvmaze.getSeasonDetails(showId, seasonNumber, expectedTitle);
      } catch (err) {
        console.warn(`TVmaze getSeasonDetails failed for ${showId} S${seasonNumber}, falling back to TMDB:`, err);
      }
    }
    try {
      return await fetchFromTMDB(`/tv/${showId}/season/${seasonNumber}`);
    } catch (err) {
      if (!useTvmaze) {
        try {
          return await tvmaze.getSeasonDetails(showId, seasonNumber, expectedTitle);
        } catch {}
      }
      throw err;
    }
  },

  getEpisodeDetails: async (showId: number, seasonNumber: number, episodeNumber: number, forceProvider?: 'tmdb' | 'tvmaze', expectedTitle?: string): Promise<TMDBEpisode> => {
    const useTvmaze = forceProvider === 'tvmaze' || (forceProvider !== 'tmdb' && runtimeTvProvider === 'tvmaze');
    if (useTvmaze) {
      try {
        return await tvmaze.getEpisodeDetails(showId, seasonNumber, episodeNumber, expectedTitle);
      } catch (err) {
        console.warn(`TVmaze getEpisodeDetails failed for ${showId} S${seasonNumber}E${episodeNumber}, falling back to TMDB:`, err);
      }
    }
    try {
      return await fetchFromTMDB(`/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`);
    } catch (err) {
      if (!useTvmaze) {
        try {
          return await tvmaze.getEpisodeDetails(showId, seasonNumber, episodeNumber, expectedTitle);
        } catch {}
      }
      throw err;
    }
  },

  searchMulti: async (queryText: string, page = 1) => {
    if (runtimeTvProvider === 'tvmaze') {
      try {
        const [tmdbResult, tvmazeShows] = await Promise.allSettled([
          fetchFromTMDB('/search/multi', { query: queryText, page }),
          tvmaze.searchShows(queryText)
        ]);

        const tmdbData = tmdbResult.status === 'fulfilled' ? tmdbResult.value : { results: [] };
        const tvmazeList = tvmazeShows.status === 'fulfilled' ? tvmazeShows.value : [];

        // Movies & Persons from TMDB
        const nonTvItems = (tmdbData.results || []).filter((item: any) => item.media_type !== 'tv');

        return {
          page,
          results: [...tvmazeList, ...nonTvItems],
          total_pages: tmdbData.total_pages || 1,
          total_results: (tmdbData.total_results || 0) + tvmazeList.length
        };
      } catch (err) {
        console.warn('TVmaze multi-search failed, falling back to TMDB:', err);
      }
    }
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
