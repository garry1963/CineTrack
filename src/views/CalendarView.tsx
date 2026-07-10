import React, { useState, useEffect } from 'react';
import { tmdb } from '../services/tmdb';
import { TMDBMedia, TMDBEpisode, ViewState } from '../types';
import { getPosterUrl, formatDate } from '../lib/utils';
import { Calendar, ChevronRight, Tv, Film, Bell, CalendarDays, ChevronLeft } from 'lucide-react';
import { useCineTrack } from '../context/CineTrackContext';

export default function CalendarView({ onNavigate }: { onNavigate: (view: ViewState) => void }) {
  const { watchlist } = useCineTrack();
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'movies' | 'show-calendar'>('today');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [loading, setLoading] = useState(true);

  // TV Show Episode Calendar States
  const [selectedShowId, setSelectedShowId] = useState<number | null>(null);
  const [showEpisodes, setShowEpisodes] = useState<TMDBEpisode[]>([]);
  const [selectedShowName, setSelectedShowName] = useState<string>('');
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  useEffect(() => {
    async function loadCalendarData() {
      if (activeTab === 'show-calendar') {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        let data;
        if (activeTab === 'today') {
          data = await tmdb.getAiringTodayTV();
        } else if (activeTab === 'week') {
          data = await tmdb.getOnTheAirTV();
        } else {
          data = await tmdb.getUpcomingMovies();
        }
        
        const results = data.results || [];
        const watchlistedIds = new Set(watchlist.map(w => w.tmdbId));
        // Only display shows/movies from the watchlist in the Release Calendar
        const filtered = results.filter((item: TMDBMedia) => watchlistedIds.has(item.id));
        setItems(filtered);
      } catch (err) {
        console.error('Error fetching calendar data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCalendarData();
  }, [activeTab, watchlist]);

  // Fetch show episode details
  useEffect(() => {
    if (activeTab !== 'show-calendar' || !selectedShowId) {
      return;
    }

    async function loadEpisodes() {
      setLoadingEpisodes(true);
      try {
        const showDetails = await tmdb.getShowDetails(selectedShowId);
        setSelectedShowName(showDetails.name || '');
        
        const totalSeasons = showDetails.number_of_seasons || 1;
        // Limit to 20 seasons to keep API usage sane and avoid timeouts
        const startSeason = Math.max(1, totalSeasons - 19);
        const seasonPromises = [];
        
        for (let s = startSeason; s <= totalSeasons; s++) {
          seasonPromises.push(
            tmdb.getSeasonDetails(selectedShowId, s).catch(err => {
              console.error(`Error fetching season ${s} for show ${selectedShowId}:`, err);
              return null;
            })
          );
        }
        
        const seasonResults = await Promise.all(seasonPromises);
        const allEpisodes: TMDBEpisode[] = [];
        seasonResults.forEach(season => {
          if (season && season.episodes) {
            allEpisodes.push(...season.episodes);
          }
        });
        
        setShowEpisodes(allEpisodes);
        
        // Find the first upcoming episode or the latest episode to set the default current month
        const nowStr = new Date().toISOString().split('T')[0];
        const upcomingEp = allEpisodes.find(ep => ep.air_date && ep.air_date >= nowStr);
        if (upcomingEp && upcomingEp.air_date) {
          setCurrentMonth(new Date(upcomingEp.air_date));
        } else {
          setCurrentMonth(new Date());
        }
      } catch (err) {
        console.error('Error loading show episodes:', err);
      } finally {
        setLoadingEpisodes(false);
      }
    }

    loadEpisodes();
  }, [selectedShowId, activeTab]);

  // Helper for calendar month days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // Padding for previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }
    
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Padding for next month to complete the week rows
    const totalSlots = days.length;
    const remaining = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    setCurrentMonth(new Date());
  };

  const handleMediaClick = (media: TMDBMedia) => {
    if (activeTab === 'movies') {
      onNavigate({ type: 'movie-details', movieId: media.id });
    } else {
      onNavigate({ type: 'show-details', showId: media.id });
    }
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Title */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-foreground">
          Release Calendar
        </h1>
        <p className="text-sm text-muted-custom">
          Never miss a release. Track television episodes and upcoming movies airtimes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-card border border-border-custom p-1.5 rounded-2xl w-fit shadow-sm shrink-0 flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'today' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span>Airing Today</span>
        </button>
        <button
          onClick={() => setActiveTab('week')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'week' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>This Week</span>
        </button>
        <button
          onClick={() => setActiveTab('movies')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'movies' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Movie Releases</span>
        </button>
        <button
          onClick={() => setActiveTab('show-calendar')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'show-calendar' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>TV Show Calendar</span>
        </button>
      </div>

      {/* Calendar / Schedule Listing */}
      {activeTab === 'show-calendar' ? (
        <div className="space-y-6">
          {/* Dropdown Selection */}
          <div className="bg-card border border-border-custom p-5 rounded-3xl shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-primary-custom uppercase tracking-wider block">
                Select a Watchlist TV Show
              </label>
              <div className="relative max-w-md">
                <select
                  value={selectedShowId || ''}
                  onChange={(e) => setSelectedShowId(Number(e.target.value))}
                  className="w-full bg-background hover:bg-slate-800/10 border border-border-custom text-xs font-bold text-foreground py-3 pl-4 pr-10 rounded-xl outline-none focus:border-primary-custom cursor-pointer transition shadow-sm appearance-none"
                >
                  <option value="" disabled>Choose a show from watchlist...</option>
                  {watchlist.filter(w => w.mediaType === 'tv').map((show) => (
                    <option key={show.tmdbId} value={show.tmdbId}>
                      {show.title}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-custom">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>
            {watchlist.filter(w => w.mediaType === 'tv').length === 0 && (
              <p className="text-xs text-muted-custom italic">
                You have no TV shows in your Watchlist. Go to Discover or Search and add TV shows to your watchlist to track their episode schedules here.
              </p>
            )}
          </div>

          {/* Episode Calendar Grid */}
          {!selectedShowId ? (
            <div className="py-16 text-center text-muted-custom bg-card border border-border-custom rounded-3xl p-6">
              <Calendar className="w-10 h-10 mx-auto text-slate-700 mb-2" />
              <p className="text-xs font-semibold">Select a Watchlist TV Show to view its release schedule.</p>
            </div>
          ) : loadingEpisodes ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-primary-custom/20 border-t-primary-custom animate-spin" />
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border-custom rounded-3xl p-4 md:p-6 shadow-sm space-y-6">
              {/* Calendar Month Selector & Header */}
              <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-border-custom/50">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-primary-custom uppercase tracking-wider">
                    {selectedShowName}
                  </span>
                  <h2 className="font-display font-extrabold text-lg md:text-2xl text-foreground">
                    {currentMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                  </h2>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMonth}
                    className="p-2.5 bg-background hover:bg-slate-800/10 border border-border-custom hover:border-primary-custom text-muted-custom hover:text-foreground rounded-xl transition cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleGoToToday}
                    className="px-4 py-2.5 bg-background hover:bg-slate-800/10 border border-border-custom hover:border-primary-custom text-xs font-bold text-muted-custom hover:text-foreground rounded-xl transition cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-2.5 bg-background hover:bg-slate-800/10 border border-border-custom hover:border-primary-custom text-muted-custom hover:text-foreground rounded-xl transition cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Monthly Calendar Grid Layout */}
              <div className="grid grid-cols-7 gap-1 md:gap-2">
                {/* Weekdays */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wd) => (
                  <div key={wd} className="text-center text-[10px] md:text-xs font-bold text-muted-custom py-2 uppercase tracking-wider">
                    {wd}
                  </div>
                ))}

                {/* Day Blocks */}
                {getDaysInMonth(currentMonth).map((day, idx) => {
                  const dateKey = formatDateKey(day.date);
                  const isToday = formatDateKey(new Date()) === dateKey;
                  
                  // Filter episodes airing on this date
                  const dayEps = showEpisodes.filter((ep) => ep.air_date === dateKey);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[75px] md:min-h-[110px] p-2 border rounded-2xl flex flex-col justify-between transition ${
                        day.isCurrentMonth
                          ? 'bg-background/40 border-border-custom/50 text-foreground'
                          : 'bg-background/10 border-border-custom/20 text-muted-custom opacity-40'
                      } ${isToday ? 'ring-2 ring-primary-custom border-transparent bg-primary-custom/5' : ''}`}
                    >
                      <span className={`text-xs font-extrabold ${isToday ? 'text-primary-custom' : ''}`}>
                        {day.date.getDate()}
                      </span>

                      <div className="mt-2 space-y-1 flex-1 flex flex-col justify-end overflow-hidden">
                        {dayEps.map((ep) => (
                          <div
                            key={ep.id}
                            onClick={() => onNavigate({
                              type: 'episode-details',
                              showId: selectedShowId,
                              seasonNumber: ep.season_number,
                              episodeNumber: ep.episode_number,
                              showName: selectedShowName
                            })}
                            className="bg-primary-custom/10 hover:bg-primary-custom/25 border border-primary-custom/15 hover:border-primary-custom/35 text-primary-custom px-1.5 py-1 rounded-lg text-[9px] font-extrabold truncate cursor-pointer transition flex flex-col items-start leading-none gap-0.5"
                            title={`S${ep.season_number}E${ep.episode_number}: ${ep.name}`}
                          >
                            <span>S{ep.season_number}E{ep.episode_number}</span>
                            <span className="hidden md:inline truncate opacity-90 text-[8px] max-w-full font-medium">
                              {ep.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-primary-custom/20 border-t-primary-custom animate-spin" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="py-16 text-center text-muted-custom bg-card border border-border-custom rounded-2xl p-6">
              <Calendar className="w-10 h-10 mx-auto text-slate-700 mb-2" />
              <p className="text-xs">No airings scheduled from your Watchlist.</p>
              <p className="text-[10px] text-muted-custom/80 mt-1">
                (Only items added to your Watchlist will show up in this release calendar)
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border-custom rounded-3xl divide-y divide-border-custom shadow-sm overflow-hidden">
              {items.map((item) => {
                const dateVal = activeTab === 'movies' ? item.release_date : item.first_air_date;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleMediaClick(item)}
                    className="p-4 md:p-5 flex gap-4 md:gap-6 items-center cursor-pointer hover:bg-slate-800/10 transition group"
                  >
                    {/* Media Small Poster */}
                    <img
                      src={getPosterUrl(item.poster_path, 'w154')}
                      alt={item.title || item.name}
                      className="w-12 h-18 object-cover rounded-xl bg-slate-900 shadow-sm shrink-0"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />

                    {/* Schedule Text details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold bg-primary-custom/10 text-primary-custom border border-primary-custom/15 px-2 py-0.5 rounded-md uppercase">
                          {activeTab === 'movies' ? 'Movie' : 'TV Show'}
                        </span>
                        {item.vote_average > 0 && (
                          <span className="text-[10px] font-bold text-amber-500">
                            ★ {item.vote_average.toFixed(1)}
                          </span>
                        )}
                        <span className="sm:hidden text-[10px] font-bold text-primary-custom ml-auto shrink-0 bg-primary-custom/10 px-2 py-0.5 rounded-md">
                          {formatDate(dateVal)}
                        </span>
                      </div>
                      <h3 className="font-display font-extrabold text-sm md:text-base text-foreground truncate group-hover:text-primary-custom transition">
                        {item.title || item.name}
                      </h3>
                      <p className="text-xs text-muted-custom line-clamp-1">
                        {item.overview || 'No synopsis details available.'}
                      </p>
                    </div>

                    {/* Date Tag */}
                    <div className="text-right shrink-0 flex items-center gap-4">
                      <div className="hidden sm:block">
                        <p className="text-xs font-bold text-foreground">{formatDate(dateVal)}</p>
                        <p className="text-[10px] text-muted-custom mt-0.5">Estimated premiere</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-custom group-hover:text-primary-custom transition group-hover:translate-x-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reminder Notification Box */}
      <div className="bg-primary-custom/5 border border-primary-custom/10 p-5 rounded-3xl flex gap-4 items-center">
        <div className="w-10 h-10 bg-primary-custom/15 text-primary-custom rounded-2xl flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-foreground">Automated Schedule Alerts</h4>
          <p className="text-xs text-muted-custom leading-relaxed">
            Your personal dashboard continuously parses upcoming air dates from TMDB, ensuring you stay aligned on episode releases.
          </p>
        </div>
      </div>

    </div>
  );
}
