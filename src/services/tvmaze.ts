import { TMDBMedia, TMDBSeason, TMDBEpisode } from '../types';
import { stripHtml } from '../lib/utils';

let activeTvmazeApiKey: string | null = null;

export function setRuntimeTvmazeApiKey(key: string | null) {
  activeTvmazeApiKey = key;
}

// Fallback direct TVmaze call if local proxy is offline
async function fetchDirectTVmaze<T = any>(
  path: string,
  params: Record<string, any> = {},
  apiKey?: string | null
): Promise<T> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          searchParams.append(key, String(item));
        }
      } else {
        searchParams.append(key, String(value));
      }
    }
  }

  const queryString = searchParams.toString();
  const url = `https://api.tvmaze.com${path}${queryString ? `?${queryString}` : ''}`;
  
  const headers: Record<string, string> = {
    'User-Agent': 'CineTrack-Media-App/1.0 (+https://cintrack.app)',
    'Accept': 'application/json'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Direct TVmaze API returned status ${response.status}: ${errText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetch from TVmaze via the secure server proxy /api/tvmaze
 */
export async function fetchFromTVmaze<T = any>(
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
      if (Array.isArray(value)) {
        for (const item of value) {
          queryParams.append(key, String(item));
        }
      } else {
        queryParams.append(key, String(value));
      }
    }
  }

  const envKey = (import.meta as any).env?.VITE_TVMAZE_API_KEY || (import.meta as any).env?.TVMAZE_API_KEY;
  const rawKey = activeTvmazeApiKey || (envKey && envKey !== 'YOUR_TVMAZE_API_KEY' ? envKey : null);
  const customKey = rawKey && rawKey !== 'undefined' && rawKey !== 'null' && rawKey !== 'YOUR_TVMAZE_API_KEY' && rawKey.trim() !== '' ? rawKey : null;

  const headers: Record<string, string> = {};
  if (customKey) {
    headers['x-tvmaze-key'] = customKey;
  }

  try {
    const response = await fetch(`/api/tvmaze?${queryParams.toString()}`, { headers });

    // Fall back to direct TVmaze if proxy is not found or in static dev mode
    if (response.status === 404 || response.status === 502) {
      return fetchDirectTVmaze<T>(path, params, customKey);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `TVmaze proxy returned status ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (error: any) {
    // If local network error prevented calling proxy, try direct
    return fetchDirectTVmaze<T>(path, params, customKey);
  }
}

/**
 * Converts a TVmaze Show object into the application's unified TMDBMedia representation
 */
export function mapTVmazeShowToTMDB(show: any): TMDBMedia {
  if (!show) {
    throw new Error('Show object is empty');
  }

  const rawSeasons = show._embedded?.seasons || [];
  const rawEpisodes = show._embedded?.episodes || [];
  const rawCast = show._embedded?.cast || [];

  // Determine season counts and construct season summaries
  const seasons = rawSeasons.map((s: any) => {
    const seasonEps = rawEpisodes.filter((ep: any) => ep.season === s.number);
    return {
      id: s.id,
      season_number: s.number,
      episode_count: s.episodeOrder || seasonEps.length || 0,
      name: s.name || `Season ${s.number}`,
      poster_path: s.image?.original || s.image?.medium || show.image?.original || show.image?.medium || null
    };
  });

  const cast = rawCast.map((c: any, index: number) => ({
    id: c.person?.id || index,
    name: c.person?.name || '',
    character: c.character?.name || '',
    profile_path: c.person?.image?.medium || c.person?.image?.original || null,
    order: index
  }));

  const genres = (show.genres || []).map((name: string, index: number) => ({
    id: index + 100,
    name
  }));

  const posterPath = show.image?.original || show.image?.medium || null;
  // TVmaze original images are high resolution and suitable for posters & hero backdrops
  const backdropPath = show.image?.original || show.image?.medium || null;

  return {
    id: show.id,
    name: show.name,
    title: show.name,
    original_name: show.name,
    overview: stripHtml(show.summary) || 'No overview available from TVmaze.',
    poster_path: posterPath,
    backdrop_path: backdropPath,
    media_type: 'tv',
    metadata_source: 'tvmaze',
    tvmaze_id: show.id,
    official_site: show.officialSite || undefined,
    schedule: show.schedule ? {
      time: show.schedule.time || undefined,
      days: show.schedule.days || []
    } : undefined,
    first_air_date: show.premiered || undefined,
    vote_average: show.rating?.average || 0,
    vote_count: show.weight ? Math.round(show.weight * 10) : 0,
    genres,
    genre_ids: genres.map((g: any) => g.id),
    status: show.status,
    runtime: show.runtime || show.averageRuntime,
    episode_run_time: show.averageRuntime ? [show.averageRuntime] : (show.runtime ? [show.runtime] : []),
    number_of_seasons: seasons.length > 0 ? seasons.length : (rawEpisodes.length > 0 ? Math.max(...rawEpisodes.map((e: any) => e.season)) : 1),
    number_of_episodes: rawEpisodes.length > 0 ? rawEpisodes.length : undefined,
    seasons: seasons.length > 0 ? seasons : undefined,
    credits: {
      cast,
      crew: []
    },
    networks: show.network ? [{
      id: show.network.id,
      name: show.network.name,
      logo_path: null
    }] : (show.webChannel ? [{
      id: show.webChannel.id,
      name: show.webChannel.name,
      logo_path: null
    }] : [])
  };
}

/**
 * TVmaze Service API
 */
export const tvmaze = {
  /**
   * Search shows by title or keyword
   */
  searchShows: async (queryText: string): Promise<TMDBMedia[]> => {
    if (!queryText || !queryText.trim()) return [];
    try {
      const data = await fetchFromTVmaze<any[]>('/search/shows', { q: queryText.trim() });
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => item && item.show)
        .map((item: any) => mapTVmazeShowToTMDB(item.show));
    } catch (err) {
      console.error('TVmaze searchShows failed:', err);
      return [];
    }
  },

  /**
   * Fetch full show details with embedded seasons, episodes, and cast
   */
  getShowDetails: async (showId: number): Promise<TMDBMedia> => {
    const data = await fetchFromTVmaze<any>(`/shows/${showId}`, {
      'embed[]': ['seasons', 'episodes', 'cast']
    });
    return mapTVmazeShowToTMDB(data);
  },

  /**
   * Fetch season details with all episodes for that season
   */
  getSeasonDetails: async (showId: number, seasonNumber: number): Promise<TMDBSeason> => {
    // Fetch show with episodes and seasons
    const show = await fetchFromTVmaze<any>(`/shows/${showId}`, {
      'embed[]': ['seasons', 'episodes']
    });

    const seasons = show._embedded?.seasons || [];
    const episodes = show._embedded?.episodes || [];

    const currentSeason = seasons.find((s: any) => s.number === seasonNumber) || {
      id: seasonNumber,
      number: seasonNumber,
      name: `Season ${seasonNumber}`,
      summary: '',
      image: null,
      premiereDate: null
    };

    const seasonEpisodes: TMDBEpisode[] = episodes
      .filter((ep: any) => ep.season === seasonNumber)
      .map((ep: any) => ({
        id: ep.id,
        episode_number: ep.number,
        season_number: ep.season,
        name: ep.name || `Episode ${ep.number}`,
        overview: stripHtml(ep.summary) || 'No episode description available.',
        air_date: ep.airdate || null,
        still_path: ep.image?.original || ep.image?.medium || null,
        vote_average: ep.rating?.average || 0,
        vote_count: ep.rating?.average ? 10 : 0,
        runtime: ep.runtime || 0
      }));

    return {
      id: currentSeason.id,
      season_number: currentSeason.number,
      name: currentSeason.name || `Season ${seasonNumber}`,
      overview: stripHtml(currentSeason.summary),
      poster_path: currentSeason.image?.original || currentSeason.image?.medium || show.image?.original || null,
      air_date: currentSeason.premiereDate || null,
      episodes: seasonEpisodes
    };
  },

  /**
   * Fetch specific episode by season and episode number
   */
  getEpisodeDetails: async (showId: number, seasonNumber: number, episodeNumber: number): Promise<TMDBEpisode> => {
    const ep = await fetchFromTVmaze<any>(`/shows/${showId}/episodebynumber`, {
      season: seasonNumber,
      number: episodeNumber
    });

    return {
      id: ep.id,
      episode_number: ep.number,
      season_number: ep.season,
      name: ep.name,
      overview: stripHtml(ep.summary) || 'No episode description available.',
      air_date: ep.airdate || null,
      still_path: ep.image?.original || ep.image?.medium || null,
      vote_average: ep.rating?.average || 0,
      vote_count: ep.rating?.average ? 10 : 0,
      runtime: ep.runtime || 0
    };
  },

  /**
   * Fetch TV shows airing today from TVmaze schedule
   */
  getAiringToday: async (country = 'US'): Promise<TMDBMedia[]> => {
    try {
      const schedule = await fetchFromTVmaze<any[]>('/schedule', { country });
      if (!Array.isArray(schedule)) return [];

      const showMap = new Map<number, any>();
      for (const item of schedule) {
        if (item.show && !showMap.has(item.show.id)) {
          showMap.set(item.show.id, item.show);
        }
      }

      return Array.from(showMap.values()).map(show => mapTVmazeShowToTMDB(show));
    } catch (err) {
      console.error('TVmaze getAiringToday failed:', err);
      return [];
    }
  },

  /**
   * Fetch list of popular TV shows from TVmaze directory
   */
  getPopularShows: async (page = 0): Promise<TMDBMedia[]> => {
    try {
      const shows = await fetchFromTVmaze<any[]>('/shows', { page });
      if (!Array.isArray(shows)) return [];
      return shows
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .map(show => mapTVmazeShowToTMDB(show));
    } catch (err) {
      console.error('TVmaze getPopularShows failed:', err);
      return [];
    }
  },

  /**
   * Lookup TVmaze show by external IMDb ID
   */
  lookupShowByImdb: async (imdbId: string): Promise<TMDBMedia | null> => {
    try {
      const show = await fetchFromTVmaze<any>('/lookup/shows', { imdb: imdbId });
      return show ? mapTVmazeShowToTMDB(show) : null;
    } catch {
      return null;
    }
  },

  /**
   * Lookup TVmaze show by external TheTVDB ID
   */
  lookupShowByTheTvdb: async (thetvdbId: number): Promise<TMDBMedia | null> => {
    try {
      const show = await fetchFromTVmaze<any>('/lookup/shows', { thetvdb: thetvdbId });
      return show ? mapTVmazeShowToTMDB(show) : null;
    } catch {
      return null;
    }
  },

  /**
   * Test connection to the TVmaze API via the secure server proxy
   */
  testConnection: async (): Promise<{ ok: boolean; status: number; latencyMs: number; message: string }> => {
    const start = Date.now();
    try {
      // Ping TVmaze Breaking Bad show (ID: 169)
      const res = await fetchFromTVmaze<any>('/shows/169', {}, true);
      const latencyMs = Date.now() - start;
      if (res && res.name === 'Breaking Bad') {
        return {
          ok: true,
          status: 200,
          latencyMs,
          message: `Successfully connected to TVmaze API via secure proxy (${latencyMs}ms latency).`
        };
      }
      return {
        ok: true,
        status: 200,
        latencyMs,
        message: `Connected to TVmaze API (${latencyMs}ms latency).`
      };
    } catch (error: any) {
      const latencyMs = Date.now() - start;
      return {
        ok: false,
        status: 500,
        latencyMs,
        message: error.message || 'Failed to connect to TVmaze API'
      };
    }
  }
};
