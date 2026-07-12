import React, { useState, useEffect } from 'react';
import { tmdb } from '../services/tmdb';
import { ViewState } from '../types';
import { getPosterUrl, formatDate, getEpisodeCode } from '../lib/utils';
import { Calendar, Tv, Bell, Clock, X, Check, Loader2 } from 'lucide-react';
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
  const { watchlist, isEpisodeWatched, toggleEpisodeWatched, isViewingShared } = useCineTrack();
  const [scheduleList, setScheduleList] = useState<TVShowScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // States for Episode Release Dates Modal
  const [selectedShowForEpisodes, setSelectedShowForEpisodes] = useState<TVShowScheduleItem | null>(null);
  const [activeSeasonNumber, setActiveSeasonNumber] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const getEpisodeStatus = (airDateStr: string | null) => {
    if (!airDateStr) return 'TBA';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const airDate = new Date(airDateStr);
    airDate.setHours(0, 0, 0, 0);
    
    if (airDate.getTime() > today.getTime()) {
      return 'Upcoming';
    }
    return 'Aired';
  };

  // Fetch season episodes when a show or season is selected
  useEffect(() => {
    if (!selectedShowForEpisodes) {
      setSeasonEpisodes([]);
      return;
    }

    async function loadSeasonEpisodes() {
      setSeasonLoading(true);
      setSeasonError(null);
      try {
        const details = await tmdb.getSeasonDetails(selectedShowForEpisodes.tmdbId, activeSeasonNumber);
        setSeasonEpisodes(details.episodes || []);
      } catch (err) {
        console.error('Error fetching season episodes:', err);
        setSeasonError('Failed to load episodes for this season.');
      } finally {
        setSeasonLoading(false);
      }
    }

    loadSeasonEpisodes();
  }, [selectedShowForEpisodes, activeSeasonNumber]);

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
        
        // Filter out shows without confirmed upcoming episode release dates (air_date is today or in the future)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filteredResults = results.filter((show) => {
          if (!show.nextEpisode || !show.nextEpisode.air_date) {
            return false;
          }
          const airDate = new Date(show.nextEpisode.air_date);
          airDate.setHours(0, 0, 0, 0);
          return airDate.getTime() >= today.getTime();
        });
        
        // Sort the list: shows with earliest nextEpisode first
        filteredResults.sort((a, b) => {
          const dateA = a.nextEpisode!.air_date || '';
          const dateB = b.nextEpisode!.air_date || '';
          return dateA.localeCompare(dateB);
        });

        setScheduleList(filteredResults);
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
      ) : scheduleList.length === 0 ? (
        <div className="py-16 text-center text-muted-custom bg-card border border-dashed border-border-custom rounded-3xl p-6 max-w-2xl mx-auto space-y-4 animate-fade-in">
          <Calendar className="w-12 h-12 mx-auto text-slate-700" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-foreground">No Upcoming Confirmed Release Dates</h3>
            <p className="text-xs text-muted-custom">
              There are no upcoming episode release dates currently scheduled for the TV shows in your watchlist. We'll automatically update this view when new episode dates are confirmed!
            </p>
          </div>
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

                  {/* Show All Episode Release Dates button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedShowForEpisodes(show);
                      setActiveSeasonNumber(show.numberOfSeasons || 1);
                    }}
                    className="w-full mt-2.5 py-1.5 px-3 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 hover:border-slate-600/80 text-slate-300 hover:text-white font-semibold text-[10px] rounded-xl transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-primary-custom" />
                    <span>View Episode Release Dates</span>
                  </button>
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

      {/* Episode Release Dates Modal */}
      {selectedShowForEpisodes && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => setSelectedShowForEpisodes(null)}
        >
          <div 
            className="bg-card border border-border-custom w-full max-w-xl rounded-3xl shadow-xl overflow-hidden relative flex flex-col my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border-custom flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-14 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-900 shadow">
                  <img
                    src={getPosterUrl(selectedShowForEpisodes.posterPath, 'w92')}
                    alt={selectedShowForEpisodes.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-extrabold text-base text-foreground leading-tight">
                    {selectedShowForEpisodes.title}
                  </h3>
                  <p className="text-xs text-muted-custom">
                    Episode Release Schedule
                  </p>
                  
                  {/* Season Selector */}
                  <div className="pt-1.5 flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Select Season:</span>
                    <select
                      value={activeSeasonNumber}
                      onChange={(e) => setActiveSeasonNumber(Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 text-foreground text-xs font-bold rounded-xl px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-primary-custom"
                    >
                      {Array.from({ length: selectedShowForEpisodes.numberOfSeasons || 1 }, (_, i) => i + 1).map((s) => (
                        <option key={s} value={s}>
                          Season {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedShowForEpisodes(null)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Episodes List */}
            <div className="p-5 max-h-[50vh] overflow-y-auto custom-scrollbar flex-1 min-h-[250px]">
              {seasonLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <Loader2 className="w-8 h-8 text-primary-custom animate-spin" />
                  <p className="text-xs text-muted-custom animate-pulse">Retrieving episode release dates...</p>
                </div>
              ) : seasonError ? (
                <div className="text-center py-12 text-red-500 space-y-2">
                  <p className="text-sm font-bold">{seasonError}</p>
                  <button
                    onClick={() => {
                      // Trigger state change to reload
                      const current = activeSeasonNumber;
                      setActiveSeasonNumber(0);
                      setTimeout(() => setActiveSeasonNumber(current), 50);
                    }}
                    className="text-xs text-primary-custom hover:underline font-bold"
                  >
                    Try Again
                  </button>
                </div>
              ) : seasonEpisodes.filter((ep) => {
                if (!ep.air_date) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const airDate = new Date(ep.air_date);
                airDate.setHours(0, 0, 0, 0);
                return airDate.getTime() >= today.getTime();
              }).length === 0 ? (
                <div className="text-center py-12 text-muted-custom text-xs">
                  No upcoming episodes scheduled for Season {activeSeasonNumber}.
                </div>
              ) : (
                <div className="space-y-3">
                  {seasonEpisodes
                    .filter((ep) => {
                      if (!ep.air_date) return false;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const airDate = new Date(ep.air_date);
                      airDate.setHours(0, 0, 0, 0);
                      return airDate.getTime() >= today.getTime();
                    })
                    .map((ep) => {
                      const status = getEpisodeStatus(ep.air_date);
                      const watched = isEpisodeWatched(selectedShowForEpisodes.tmdbId, activeSeasonNumber, ep.episode_number);
                      
                      return (
                        <div 
                          key={ep.id}
                          className="bg-slate-900/40 border border-slate-800/60 hover:border-slate-800 rounded-2xl p-3 flex items-start justify-between gap-4 transition group"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-extrabold text-primary-custom bg-primary-custom/10 px-1.5 py-0.5 rounded">
                                {getEpisodeCode(activeSeasonNumber, ep.episode_number)}
                              </span>
                              <span className="text-xs font-bold text-foreground truncate" title={ep.name}>
                                {ep.name || `Episode ${ep.episode_number}`}
                              </span>
                            </div>
                            
                            {ep.overview && (
                              <p className="text-[10px] text-muted-custom line-clamp-2 leading-relaxed pt-0.5 pr-2 group-hover:line-clamp-none transition duration-200">
                                {ep.overview}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-3 pt-1 text-[10px]">
                              <span className="text-slate-400 font-medium">
                                Air Date: <strong className="text-slate-200">{formatDate(ep.air_date)}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Status badging and toggle */}
                          <div className="flex flex-col items-end justify-between self-stretch shrink-0 min-h-[44px]">
                            {/* Badges */}
                            <div className="flex items-center gap-1.5">
                              {watched && (
                                <span className="text-[9px] font-extrabold bg-green-500/10 text-green-500 border border-green-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <Check className="w-3 h-3" />
                                  <span>Watched</span>
                                </span>
                              )}
                              
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                status === 'Upcoming' 
                                  ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                                  : status === 'Aired'
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-yellow-600/10 text-yellow-500 border border-yellow-600/20'
                              }`}>
                                {status}
                              </span>
                            </div>

                            {/* Quick watched toggle */}
                            {!isViewingShared && (
                              <button
                                onClick={async () => {
                                  await toggleEpisodeWatched(
                                    selectedShowForEpisodes.tmdbId,
                                    activeSeasonNumber,
                                    ep.episode_number,
                                    selectedShowForEpisodes.title,
                                    selectedShowForEpisodes.posterPath,
                                    selectedShowForEpisodes.numberOfEpisodes || 0
                                  );
                                }}
                                className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition duration-200 cursor-pointer ${
                                  watched
                                    ? 'bg-slate-800 hover:bg-red-950/40 border-slate-700 hover:border-red-900/60 text-slate-300 hover:text-red-400'
                                    : 'bg-primary-custom/10 hover:bg-primary-custom text-primary-custom hover:text-white border-primary-custom/20 hover:border-transparent'
                                }`}
                              >
                                {watched ? 'Mark Unwatched' : 'Mark Watched'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-900/20 border-t border-border-custom text-center">
              <p className="text-[10px] text-muted-custom">
                Note: Episode details and release dates are sourced from TMDB and updated dynamically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
