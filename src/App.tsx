import React, { useState, useEffect } from 'react';
import { CineTrackProvider, useCineTrack } from './context/CineTrackContext';
import { ViewState } from './types';
import { Sidebar, BottomNav } from './components/Navigation';
import AuthScreen from './components/AuthScreen';
import EmailVerificationScreen from './components/EmailVerificationScreen';
import HomeView from './views/HomeView';
import DiscoverView from './views/DiscoverView';
import SearchView from './views/SearchView';
import WatchlistView from './views/WatchlistView';
import CalendarView from './views/CalendarView';
import StatisticsView from './views/StatisticsView';
import ProfileView from './views/ProfileView';
import DetailsView from './views/DetailsView';
import { auth } from './firebase';
import { Film, User, AlertCircle, RefreshCw, Share2 } from 'lucide-react';
import ToastContainer from './components/Toast';

function Dashboard() {
  const { 
    user, 
    loading, 
    settings, 
    logout,
    sharedUser,
    isViewingShared,
    stopViewingSharedAccount,
    mergeSharedAccountData
  } = useCineTrack();
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'home' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [serverHasTmdbKey, setServerHasTmdbKey] = useState<boolean | null>(null);
  const [merging, setMerging] = useState(false);

  const handleMergeSharedData = async () => {
    if (!sharedUser) return;
    if (window.confirm(`Are you sure you want to merge all of ${sharedUser.email}'s watchlist items, custom lists, ratings, progress, and notes into your account? This cannot be undone.`)) {
      setMerging(true);
      try {
        await mergeSharedAccountData();
        alert("Success! All tracking database collections have been merged into your profile.");
      } catch (err) {
        alert("Failed to merge account database.");
      } finally {
        setMerging(false);
      }
    }
  };

  // Fetch server status to see if TMDB key is configured on the backend
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.hasTmdbKey === 'boolean') {
          setServerHasTmdbKey(data.hasTmdbKey);
        }
      })
      .catch((err) => console.error('Error checking server health:', err));
  }, []);

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

  // Auth gate: If user is not logged in, force them to Sign In / Sign Up
  if (!user) {
    return <AuthScreen onSuccess={() => setCurrentView({ type: 'home' })} />;
  }

  // Verification gate: Email must be confirmed before full account access is granted
  const isEmailVerified = user.emailVerified || user.email === 'admin@domain.com';
  if (!isEmailVerified) {
    return <EmailVerificationScreen />;
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
        return <WatchlistView currentView={currentView} onNavigate={handleNavigate} />;
      case 'calendar':
        return <CalendarView onNavigate={handleNavigate} />;
      case 'statistics':
        return <StatisticsView />;
      case 'profile':
        return <ProfileView onNavigate={handleNavigate} />;
      case 'admin-login':
        return <AuthScreen onSuccess={() => handleNavigate({ type: 'profile' })} />;
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
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      
      {/* Main content scroll container */}
      <main className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto pb-28 md:pb-32">
        
        {/* Viewing Shared Library warning banner */}
        {isViewingShared && sharedUser && (
          <div className="mb-6 bg-primary-custom/10 border border-primary-custom/30 p-4 rounded-2xl flex flex-col sm:flex-row gap-3.5 items-start sm:items-center justify-between shadow-md">
            <div className="flex gap-3 items-center min-w-0">
              <RefreshCw className="w-5 h-5 text-primary-custom shrink-0 animate-spin" />
              <div className="text-xs text-slate-300 min-w-0">
                <span className="font-bold text-primary-custom block sm:inline">Viewing Shared Library:</span>{' '}
                <span className="truncate text-foreground font-semibold">{sharedUser.email} (Read-Only)</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
              <button
                onClick={handleMergeSharedData}
                disabled={merging}
                className="flex-1 sm:flex-initial px-3 py-2 bg-primary-custom hover:bg-primary-custom/90 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {merging ? "Merging..." : "Merge Into My Account"}
              </button>
              <button
                onClick={stopViewingSharedAccount}
                className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Back to My Account
              </button>
            </div>
          </div>
        )}

        {/* Missing API Key warning banner */}
        {!settings.tmdbApiKey && 
         serverHasTmdbKey === false &&
         (!(import.meta as any).env?.VITE_TMDB_API_KEY || (import.meta as any).env?.VITE_TMDB_API_KEY === 'YOUR_TMDB_API_KEY') &&
         (!(import.meta as any).env?.REACT_APP_TMDB_API_KEY || (import.meta as any).env?.REACT_APP_TMDB_API_KEY === 'YOUR_TMDB_API_KEY') && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3.5 items-start md:items-center">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 md:mt-0" />
            <div className="text-xs leading-relaxed text-slate-300 flex-1 md:flex md:items-center md:justify-between gap-4">
              <div>
                <strong className="text-amber-500 font-bold block md:inline">TMDB API Key is missing!</strong>{' '}
                <span>Please define the <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-400 font-mono">TMDB_API_KEY</code> environment secret or enter a custom key in your profile settings to load movie & TV catalogs.</span>
              </div>
              <button
                onClick={() => setCurrentView({ type: 'profile' })}
                className="mt-2.5 md:mt-0 text-[11px] text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider shrink-0"
              >
                Go to Settings &rarr;
              </button>
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
        userEmail={user?.email || null}
        onLogout={handleLogout}
      />

      {/* Global Toast Notification Overlay */}
      <ToastContainer />

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
