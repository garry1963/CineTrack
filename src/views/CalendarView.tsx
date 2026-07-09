import React, { useState, useEffect } from 'react';
import { tmdb } from '../services/tmdb';
import { TMDBMedia, ViewState } from '../types';
import { getPosterUrl, formatDate } from '../lib/utils';
import { Calendar, ChevronRight, Tv, Film, Bell, CalendarDays } from 'lucide-react';

export default function CalendarView({ onNavigate }: { onNavigate: (view: ViewState) => void }) {
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'movies'>('today');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCalendarData() {
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
        setItems(data.results || []);
      } catch (err) {
        console.error('Error fetching calendar data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCalendarData();
  }, [activeTab]);

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
          Never miss an release. Track television episodes and upcoming movies airtimes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-card border border-border-custom p-1.5 rounded-2xl w-fit shadow-sm shrink-0">
        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
            activeTab === 'today' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span>Airing Today</span>
        </button>
        <button
          onClick={() => setActiveTab('week')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
            activeTab === 'week' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>This Week</span>
        </button>
        <button
          onClick={() => setActiveTab('movies')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
            activeTab === 'movies' ? 'bg-primary-custom text-white' : 'text-muted-custom hover:text-foreground'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Movie Releases</span>
        </button>
      </div>

      {/* Calendar / Schedule Listing */}
      {loading ? (
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
              <p className="text-xs">No airings scheduled in this catalog view.</p>
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
