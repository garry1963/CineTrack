import React, { useState, useEffect } from 'react';
import { tmdb } from '../services/tmdb';
import { ViewState } from '../types';
import { getPosterUrl, formatDate, getEpisodeCode } from '../lib/utils';
import { Calendar, Tv, Bell, Clock } from 'lucide-react';
import { useCineTrack } from '../context/CineTrackContext';

interface TVShowScheduleItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  status?: string;
  nextEpisode?: {
    air_date: string | null;
    episode_number: number;
    season_number: number;
    name: string;
    overview: string;
  } | null;
  lastEpisode?: {
    air_date: string | null;
    episode_number: number;
    season_number: number;
    name: string;
    overview: string;
  } | null;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  networks?: { name: string }[];
}

export default function CalendarView({ onNavigate }: { onNavigate: (view: ViewState) => void }) {
  const { watchlist } = useCineTrack();
  const [scheduleList, setScheduleList] = useState<TVShowScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const tvWatchlist = watchlist.filter(w => w.mediaType === 'tv');

  useEffect(() => {
    if (tvWatchlist.length === 0) {
      setScheduleList([]);
      setLoading(false);
      return;
    }

    async function loadTVReleaseSchedules() {
      setLoading(true);
      try {
        const promises = tvWatchlist.map(async (item) => {
          try {
            const details = await tmdb.getShowDetails(item.tmdbId);
            return {
              tmdbId: item.tmdbId,
              title: item.title,
              posterPath: item.posterPath,
              status: details.status,
              nextEpisode: (details as any).next_episode_to_air || null,
              lastEpisode: (details as any).last_episode_to_air || null,
              numberOfSeasons: details.number_of_seasons,
              numberOfEpisodes: details.number_of_episodes,
              networks: details.networks || []
            };
          } catch (err) {
            console.log(`Failed to fetch details for TV Show ${item.tmdbId}:`, err);
            return {
              tmdbId: item.tmdbId,
              title: item.title,
              posterPath: item.posterPath,
              status: 'Unknown',
              nextEpisode: null,
              lastEpisode: null,
            };
          }
        });

        const results = await Promise.all(promises);
        
        // Sort the list: shows with upcoming nextEpisode first (earliest nextEpisode first), then shows with lastEpisode (most recent lastEpisode first), then others.
        results.sort((a, b) => {
          if (a.nextEpisode && b.nextEpisode) {
            const dateA = a.nextEpisode.air_date || '';
            const dateB = b.nextEpisode.air_date || '';
            return dateA.localeCompare(dateB);
          }
          if (a.nextEpisode) return -1;
          if (b.nextEpisode) return 1;
          
          if (a.lastEpisode && b.lastEpisode) {
            const dateA = a.lastEpisode.air_date || '';
            const dateB = b.lastEpisode.air_date || '';
            return dateB.localeCompare(dateA); // most recent last
          }
          if (a.lastEpisode) return -1;
          if (b.lastEpisode) return 1;
          
          return a.title.localeCompare(b.title);
        });

        setScheduleList(results);
      } catch (e) {
        console.log('Error loading TV release schedules:', e);
      } finally {
        setLoading(false);
      }
    }

    loadTVReleaseSchedules();
  }, [watchlist]);

  return (
    <div className="space-y-6 pb-16">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-foreground">
          TV Release Schedule
        </h1>
        <p className="text-sm text-muted-custom">
          Stay updated with upcoming episode release dates and recent airings for shows in your watchlist
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[40vh]">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-primary-custom/20 border-t-primary-custom animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-indigo-500/10 border-b-indigo-500 animate-spin" style={{ animationDirection: 'reverse' }} />
          </div>
        </div>
      ) : tvWatchlist.length === 0 ? (
        <div className="py-16 text-center text-muted-custom bg-card border border-dashed border-border-custom rounded-3xl p-6 max-w-2xl mx-auto space-y-4">
          <Calendar className="w-12 h-12 mx-auto text-slate-700" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-foreground">Your Watchlist TV Space is Empty</h3>
            <p className="text-xs text-muted-custom">
              Add TV series to your watchlist from the Discover or Search views to populate your automated episode release calendar schedule list!
            </p>
          </div>
          <button
            onClick={() => onNavigate({ type: 'discover' })}
            className="bg-primary-custom hover:bg-primary-custom/90 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
          >
            Go Discover TV Shows
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {scheduleList.map((show) => {
            const networkName = show.networks && show.networks.length > 0 ? show.networks[0].name : '';
            return (
              <div
                key={show.tmdbId}
                className="bg-card border border-border-custom rounded-3xl p-4 flex gap-4 hover:scale-[1.01] hover:border-primary-custom/40 transition duration-300 shadow-sm group"
              >
                {/* Image Tile (Poster) */}
                <div 
                  onClick={() => onNavigate({ type: 'show-details', showId: show.tmdbId })}
                  className="w-24 h-36 md:w-28 md:h-40 rounded-2xl overflow-hidden shrink-0 bg-slate-900 shadow-md cursor-pointer relative group-hover:shadow-primary-custom/10 transition"
                >
                  <img
                    src={getPosterUrl(show.posterPath, 'w185')}
                    alt={show.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end justify-center pb-2">
                    <span className="text-[9px] font-bold text-white bg-black/60 px-2 py-1 rounded-md">View Details</span>
                  </div>
                </div>

                {/* Info and Release Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="space-y-1.5">
                    {/* Header tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] font-extrabold bg-primary-custom/10 text-primary-custom border border-primary-custom/15 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {show.status || 'Unknown'}
                      </span>
                      {networkName && (
                        <span className="text-[9px] font-bold text-muted-custom bg-slate-800/40 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                          {networkName}
                        </span>
                      )}
                    </div>

                    <h3 
                      onClick={() => onNavigate({ type: 'show-details', showId: show.tmdbId })}
                      className="font-display font-extrabold text-sm md:text-base text-foreground truncate hover:text-primary-custom transition cursor-pointer"
                      title={show.title}
                    >
                      {show.title}
                    </h3>

                    {/* Relevant Episode release date information */}
                    <div className="space-y-2 mt-1">
                      {show.nextEpisode ? (
                        <div className="bg-primary-custom/5 border border-primary-custom/15 rounded-xl p-2.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-extrabold text-primary-custom flex items-center gap-1 uppercase tracking-wider">
                              <Clock className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                              <span>Next Episode</span>
                            </span>
                            <span className="text-[10px] font-bold font-mono text-primary-custom">
                              {getEpisodeCode(show.nextEpisode.season_number, show.nextEpisode.episode_number)}
                            </span>
                          </div>
                          <p className="font-bold text-xs text-white truncate">
                            {show.nextEpisode.name || `Episode ${show.nextEpisode.episode_number}`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Air Date: <span className="text-white font-bold">{formatDate(show.nextEpisode.air_date)}</span>
                          </p>
                        </div>
                      ) : show.lastEpisode ? (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-muted-custom flex items-center gap-1 uppercase tracking-wider">
                              <Tv className="w-3.5 h-3.5 shrink-0" />
                              <span>Last Aired</span>
                            </span>
                            <span className="text-[10px] font-bold font-mono text-muted-custom">
                              {getEpisodeCode(show.lastEpisode.season_number, show.lastEpisode.episode_number)}
                            </span>
                          </div>
                          <p className="font-semibold text-xs text-slate-300 truncate">
                            {show.lastEpisode.name || `Episode ${show.lastEpisode.episode_number}`}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Aired: <span className="text-slate-300 font-semibold">{formatDate(show.lastEpisode.air_date)}</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-custom italic">
                          No airdate details found for this show.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Summary Footer */}
                  <div className="flex items-center justify-between text-[10px] text-muted-custom border-t border-border-custom/50 pt-2 mt-2">
                    <span>{show.numberOfSeasons || 0} Seasons</span>
                    <span>{show.numberOfEpisodes || 0} Episodes</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reminder Notification Box */}
      <div className="bg-primary-custom/5 border border-primary-custom/10 p-5 rounded-3xl flex gap-4 items-center">
        <div className="w-10 h-10 bg-primary-custom/15 text-primary-custom rounded-2xl flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-foreground">Automated Release Tracking</h4>
          <p className="text-xs text-muted-custom leading-relaxed">
            Your schedule continuously scans TMDB to update airtimes and episode information automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
