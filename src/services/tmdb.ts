import { TMDBMedia, TMDBSeason, TMDBEpisode } from '../types';

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

  const response = await fetch(`/api/tmdb?${queryParams.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `TMDB proxy returned status ${response.status}`);
  }

  return response.json() as Promise<T>;
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
