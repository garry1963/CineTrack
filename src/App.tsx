import React, { useState, useEffect } from 'react';
import { CineTrackProvider, useCineTrack } from './context/CineTrackContext';
import { ViewState } from './types';
import { Sidebar, BottomNav } from './components/Navigation';
import AuthScreen from './components/AuthScreen';
import HomeView from './views/HomeView';
import DiscoverView from './views/DiscoverView';
import SearchView from './views/SearchView';
import WatchlistView from './views/WatchlistView';
import CalendarView from './views/CalendarView';
import StatisticsView from './views/StatisticsView';
import ProfileView from './views/ProfileView';
import DetailsView from './views/DetailsView';
import { auth } from './firebase';
import { Film, User, AlertCircle } from 'lucide-react';

function Dashboard() {
  const { user, loading, settings, logout } = useCineTrack();
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'home' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Apply visual theme class on boot or settings load
  useEffect(() => {
    if (settings?.theme) {
      const root = document.documentElement;
      root.classList.remove('theme-light', 'theme-dark', 'theme-amoled', 'theme-dynamic');
      root.classList.add(`theme-${settings.theme}`);
    }
  }, [settings?.theme]);

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    // Smoothly scroll container back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-xs font-mono tracking-widest text-indigo-400 uppercase animate-pulse">Initializing Tracking Vault...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSuccess={() => setCurrentView({ type: 'home' })} />;
  }

  // Render proper View component matching the state
  const renderActiveView = () => {
    switch (currentView.type) {
      case 'home':
        return <HomeView onNavigate={handleNavigate} />;
      case 'discover':
        return <DiscoverView onNavigate={handleNavigate} />;
      case 'search':
        return <SearchView onNavigate={handleNavigate} />;
      case 'watchlist':
        return <WatchlistView onNavigate={handleNavigate} />;
      case 'calendar':
        return <CalendarView onNavigate={handleNavigate} />;
      case 'statistics':
        return <StatisticsView />;
      case 'profile':
        return <ProfileView />;
      case 'show-details':
      case 'movie-details':
      case 'season-details':
      case 'episode-details':
        return <DetailsView currentView={currentView} onNavigate={handleNavigate} />;
      default:
        return <HomeView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground transition-colors duration-300">
      
      {/* Desktop collapsible sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        userEmail={user.email}
        onLogout={handleLogout}
      />

      {/* Main content scroll container */}
      <main className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
        
        {/* Missing API Key warning banner (Only visible if TMDB_API_KEY is standard placeholder) */}
        {process.env.TMDB_API_KEY === 'YOUR_TMDB_API_KEY' && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3 items-center">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-xs leading-relaxed text-slate-300">
              <strong className="text-amber-500 font-bold">TMDB API Key missing!</strong> Please define the <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-400">TMDB_API_KEY</code> environment secret inside your AI Studio Settings parameters to fully load movies, TV episodes, cast and backdrops.
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          {renderActiveView()}
        </div>
      </main>

      {/* Mobile / Tablet Bottom Navigation */}
      <BottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
      />

    </div>
  );
}

export default function App() {
  return (
    <CineTrackProvider>
      <Dashboard />
    </CineTrackProvider>
  );
}
