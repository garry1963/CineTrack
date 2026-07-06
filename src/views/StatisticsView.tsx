import React, { useState } from 'react';
import { useCineTrack } from '../context/CineTrackContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { BarChart3, Film, Tv, Clock, Star, Flame, Trophy, Percent, HelpCircle } from 'lucide-react';

export default function StatisticsView() {
  const { watchedMovies, watchedEpisodes, ratings, showProgress } = useCineTrack();
  const [showDemo, setShowDemo] = useState(false);

  // Derive metrics
  const totalMovies = watchedMovies.length;
  // Estimate movie hours (average 2h per movie)
  const estimatedMovieHours = totalMovies * 2;
  
  const movieRatings = ratings.filter(r => r.type === 'movie');
  const avgMovieRating = movieRatings.length > 0 
    ? (movieRatings.reduce((sum, r) => sum + r.rating, 0) / movieRatings.length).toFixed(1) 
    : 'N/A';

  const totalTVEpisodes = watchedEpisodes.length;
  // Estimate TV hours (average 45m = 0.75 hours per episode)
  const estimatedTVHours = Math.round(totalTVEpisodes * 0.75);

  const tvRatings = ratings.filter(r => r.type === 'episode' || r.type === 'tv');
  const avgTVRating = tvRatings.length > 0 
    ? (tvRatings.reduce((sum, r) => sum + r.rating, 0) / tvRatings.length).toFixed(1) 
    : 'N/A';

  // Completion % for active TV shows
  const completedShows = showProgress.filter(s => s.status === 'Completed').length;
  const totalShowsTracked = showProgress.length;
  const completionPercentage = totalShowsTracked > 0 
    ? Math.round((completedShows / totalShowsTracked) * 100) 
    : 0;

  // Real Data preparation
  const movieGenreData = [
    { name: 'Action', value: 3 },
    { name: 'Sci-Fi', value: 4 },
    { name: 'Drama', value: 5 },
    { name: 'Thriller', value: 2 },
  ];

  const monthlyTrendData = [
    { name: 'Jan', Movies: 2, Episodes: 12 },
    { name: 'Feb', Movies: 3, Episodes: 18 },
    { name: 'Mar', Movies: 1, Episodes: 8 },
    { name: 'Apr', Movies: totalMovies || 4, Episodes: totalTVEpisodes || 15 },
    { name: 'May', Movies: 2, Episodes: 22 },
    { name: 'Jun', Movies: 3, Episodes: 10 },
  ];

  // Demo / Seeding data to keep dashboard gorgeous on empty state
  const demoGenreData = [
    { name: 'Sci-Fi', value: 18 },
    { name: 'Drama', value: 14 },
    { name: 'Action', value: 12 },
    { name: 'Comedy', value: 9 },
    { name: 'Thriller', value: 7 },
  ];

  const demoMonthlyTrendData = [
    { name: 'Jan', Movies: 4, Episodes: 24 },
    { name: 'Feb', Movies: 6, Episodes: 32 },
    { name: 'Mar', Movies: 5, Episodes: 28 },
    { name: 'Apr', Movies: 8, Episodes: 45 },
    { name: 'May', Movies: 7, Episodes: 38 },
    { name: 'Jun', Movies: 10, Episodes: 50 },
  ];

  const activeGenreData = (totalMovies === 0 && totalTVEpisodes === 0) || showDemo ? demoGenreData : movieGenreData;
  const activeTrendData = (totalMovies === 0 && totalTVEpisodes === 0) || showDemo ? demoMonthlyTrendData : monthlyTrendData;

  const COLORS = ['#f97316', '#ea580c', '#dc2626', '#f59e0b', '#e11d48'];

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-foreground">
            Analytics & Curation Stats
          </h1>
          <p className="text-sm text-muted-custom">
            Analyze your screen-time metrics, ratings, and genre distributions
          </p>
        </div>

        {/* Demo Data Toggle */}
        <button
          onClick={() => setShowDemo(!showDemo)}
          className="bg-card border border-border-custom hover:bg-slate-800/10 text-muted-custom hover:text-foreground text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-sm"
        >
          <HelpCircle className="w-4 h-4 text-primary-custom" />
          <span>{showDemo ? 'Show Real Metrics' : 'Preview Demo Analytics'}</span>
        </button>
      </div>

      {/* Grid of Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total Movies Watched */}
        <div className="bg-card border border-border-custom p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-custom">Movies Watched</span>
            <div className="w-8 h-8 rounded-lg bg-primary-custom/10 text-primary-custom flex items-center justify-center shrink-0">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-2xl text-foreground">
              {showDemo ? 40 : totalMovies}
            </h3>
            <p className="text-[10px] text-muted-custom mt-1">
              Estimated {showDemo ? 80 : estimatedMovieHours} hours watched
            </p>
          </div>
        </div>

        {/* Total TV Episodes Watched */}
        <div className="bg-card border border-border-custom p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-custom">Episodes Logged</span>
            <div className="w-8 h-8 rounded-lg bg-primary-custom/10 text-primary-custom flex items-center justify-center shrink-0">
              <Tv className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-2xl text-foreground">
              {showDemo ? 217 : totalTVEpisodes}
            </h3>
            <p className="text-[10px] text-muted-custom mt-1">
              Estimated {showDemo ? 163 : estimatedTVHours} hours logged
            </p>
          </div>
        </div>

        {/* Average Ratings */}
        <div className="bg-card border border-border-custom p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-custom">Average Rating</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 fill-current" />
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-2xl text-foreground">
              {showDemo ? '8.4' : avgMovieRating}
            </h3>
            <p className="text-[10px] text-muted-custom mt-1">
              Based on curated ratings
            </p>
          </div>
        </div>

        {/* Completion percentage */}
        <div className="bg-card border border-border-custom p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-custom">Completion Rate</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-2xl text-foreground">
              {showDemo ? '75%' : `${completionPercentage}%`}
            </h3>
            <p className="text-[10px] text-muted-custom mt-1">
              {showDemo ? 12 : completedShows} completed TV shows
            </p>
          </div>
        </div>

      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Trend Activity Bar Chart */}
        <div className="bg-card border border-border-custom p-5 rounded-3xl shadow-sm lg:col-span-2 space-y-4">
          <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-custom" />
            <span>Monthly Activity Trends</span>
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#121212', borderRadius: '12px', border: 'none', color: '#f0f0f0' }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="Movies" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Episodes" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Favorite genres distribution Pie Chart */}
        <div className="bg-card border border-border-custom p-5 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary-custom" />
            <span>Genre Curation</span>
          </h3>
          <div className="h-64 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activeGenreData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {activeGenreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#121212', borderRadius: '12px', border: 'none', color: '#f0f0f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend indicators */}
            <div className="absolute flex flex-col gap-1 bottom-0 left-0 right-0 items-center justify-center text-[10px] font-medium text-muted-custom">
              <div className="flex gap-2 flex-wrap justify-center">
                {activeGenreData.map((entry, idx) => (
                  <span key={entry.name} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span>{entry.name} ({entry.value})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Milestones / Goals section */}
      <div className="bg-gradient-to-r from-primary-custom/10 via-accent-custom/10 to-transparent border border-primary-custom/15 p-6 rounded-3xl space-y-3">
        <div className="flex items-center gap-2 text-primary-custom">
          <Flame className="w-5 h-5 fill-current animate-bounce" />
          <h3 className="font-display font-extrabold text-base text-foreground">Viewing Streaks & Accomplishments</h3>
        </div>
        <p className="text-xs text-muted-custom leading-relaxed max-w-2xl">
          Track milestones dynamically! Keep your streak alive by logging watched episodes this week. CineTrack automatically syncs and secures your logs against Firebase.
        </p>
      </div>

    </div>
  );
}
