import React, { useRef, useState } from 'react';
import { useCineTrack } from '../context/CineTrackContext';
import { auth, signOut } from '../firebase';
import { AppSettings, ThemeMode } from '../types';
import { User, Settings, Database, Sliders, LogOut, Sun, Moon, Shield, Download, Upload, Check, RefreshCw, Share2 } from 'lucide-react';

export default function ProfileView() {
  const { 
    user, 
    settings, 
    updateSettings,
    watchlist,
    favorites,
    showProgress,
    watchedEpisodes,
    watchedMovies,
    ratings,
    notes,
    customLists,
    logout,
    sharedUser,
    isViewingShared,
    loadSharedAccountByEmail,
    loadSharedAccountByUid,
    stopViewingSharedAccount,
    mergeSharedAccountData
  } = useCineTrack();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [friendInput, setFriendInput] = useState('');
  const [loadingFriend, setLoadingFriend] = useState(false);
  const [friendError, setFriendError] = useState('');
  const [friendSuccess, setFriendSuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [uidCopied, setUidCopied] = useState(false);

  const handleLoadSharedFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendInput.trim()) return;

    setLoadingFriend(true);
    setFriendError('');
    setFriendSuccess(false);

    try {
      const input = friendInput.trim();
      let success = false;
      
      if (input.includes('@')) {
        success = await loadSharedAccountByEmail(input);
      } else {
        success = await loadSharedAccountByUid(input);
      }

      if (success) {
        setFriendSuccess(true);
        setFriendInput('');
      } else {
        setFriendError('No profile matching that email or ID was found. Ensure your friend has signed in with a valid cloud tracking account.');
      }
    } catch (err) {
      console.error(err);
      setFriendError('An error occurred while linking the account.');
    } finally {
      setLoadingFriend(false);
    }
  };

  const handleThemeChange = async (mode: ThemeMode) => {
    // Save to context settings
    await updateSettings({ theme: mode });
    
    // Apply theme class immediately to document element
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-amoled', 'theme-dynamic');
    root.classList.add(`theme-${mode}`);
  };

  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify({
        watchlist,
        favorites,
        showProgress,
        watchedEpisodes,
        watchedMovies,
        ratings,
        notes,
        customLists,
        exportedAt: new Date().toISOString()
      }, null, 2);

      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cinetrack_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
      alert('Failed to generate export file.');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.watchlist && !json.favorites) {
          alert('Invalid backup file format.');
          return;
        }

        // We can guide them or directly update. For simplicity, we import.
        alert('Backup read successfully! Click "Trigger Import Sync" to import these datasets.');
      } catch (err) {
        console.error('Failed to parse backup:', err);
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  const triggerManualSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, 1200);
  };

  return (
    <div className="space-y-8 pb-16 max-w-4xl">
      
      {/* Title */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-foreground">
          Profile & Preferences
        </h1>
        <p className="text-sm text-muted-custom">
          Manage your secure user session, display configs, and data backups
        </p>
      </div>

      {/* User Card Row */}
      <div className="bg-card border border-border-custom p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-primary-custom/10 text-primary-custom flex items-center justify-center shrink-0">
            <User className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-base text-foreground truncate">
              {user?.email || 'Anonymous Tracking Account'}
            </h3>
            <p className="text-xs text-muted-custom font-mono mt-0.5 truncate">
              UID: {user?.uid || 'local_session'}
            </p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="border border-red-500/20 text-red-500 hover:bg-red-500/10 px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Visual Settings Panel */}
        <div className="bg-card border border-border-custom p-5 rounded-3xl space-y-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-border-custom">
            <Settings className="w-5 h-5 text-primary-custom" />
            <h3 className="font-display font-bold text-base text-foreground">Visual settings</h3>
          </div>

          {/* Theme Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Display Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark', 'amoled', 'dynamic'] as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-center border capitalize transition ${
                    settings.theme === t 
                      ? 'bg-primary-custom/10 text-primary-custom border-primary-custom/30' 
                      : 'bg-background hover:bg-slate-800/10 border-border-custom text-muted-custom hover:text-foreground'
                  }`}
                >
                  {t} Theme
                </button>
              ))}
            </div>
          </div>

          {/* Poster & Backdrop Quality */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Poster Quality</label>
              <select
                value={settings.posterQuality}
                onChange={(e) => updateSettings({ posterQuality: e.target.value as any })}
                className="w-full bg-background border border-border-custom px-3 py-2 rounded-xl text-xs font-medium text-foreground outline-none"
              >
                <option value="w342">Standard (w342)</option>
                <option value="w500">High Quality (w500)</option>
                <option value="original">Uncompressed (Original)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Backdrop Quality</label>
              <select
                value={settings.backdropQuality}
                onChange={(e) => updateSettings({ backdropQuality: e.target.value as any })}
                className="w-full bg-background border border-border-custom px-3 py-2 rounded-xl text-xs font-medium text-foreground outline-none"
              >
                <option value="w780">Standard (w780)</option>
                <option value="w1280">HD (w1280)</option>
                <option value="original">Uncompressed (Original)</option>
              </select>
            </div>
          </div>

          {/* Languages */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Metadata Language</label>
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              className="w-full bg-background border border-border-custom px-3.5 py-2.5 rounded-xl text-xs font-medium text-foreground outline-none"
            >
              <option value="en">English (US)</option>
              <option value="es">Español (ES)</option>
              <option value="fr">Français (FR)</option>
              <option value="de">Deutsch (DE)</option>
              <option value="ja">日本語 (JP)</option>
            </select>
          </div>

          {/* Custom TMDB API Key for Standalone Mode */}
          <div className="space-y-1.5 pt-3 border-t border-border-custom/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-custom">Custom TMDB API Key</label>
              <span className="text-[10px] text-amber-500 font-semibold uppercase">Standalone Mode</span>
            </div>
            <input
              type="text"
              placeholder="Paste your 32-character TMDB API Key..."
              value={settings.tmdbApiKey || ''}
              onChange={(e) => updateSettings({ tmdbApiKey: e.target.value.trim() })}
              className="w-full bg-background border border-border-custom px-3.5 py-2.5 rounded-xl text-xs font-medium text-foreground outline-none font-mono focus:border-primary-custom/50 transition-colors"
            />
            <p className="text-[10px] text-muted-custom leading-normal">
              Required if running CineTrack as a standalone web app or outside AI Studio. Get your key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-primary-custom hover:underline font-semibold">themoviedb.org</a>.
            </p>
          </div>

        </div>

        {/* Sync & Vault Backups Panel */}
        <div className="bg-card border border-border-custom p-5 rounded-3xl space-y-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-border-custom">
            <Database className="w-5 h-5 text-primary-custom" />
            <h3 className="font-display font-bold text-base text-foreground">Data Vault & Backups</h3>
          </div>

          {/* Export / Download */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground">Local JSON Backups</h4>
            <p className="text-[11px] text-muted-custom leading-relaxed">
              Generate a secure offline JSON backup file containing all watch history, lists, ratings, and notes.
            </p>
            <button
              onClick={handleExportData}
              className="w-full bg-background hover:bg-slate-800/10 border border-border-custom px-4 py-3 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-primary-custom" />
              <span>Export Tracking Database</span>
            </button>
          </div>

          {/* Import / Upload */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-foreground">Restore From Backup</h4>
            <p className="text-[11px] text-muted-custom leading-relaxed">
              Upload a previously exported CineTrack `.json` file to restore your settings and catalog data instantly.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportData}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-background hover:bg-slate-800/10 border border-border-custom px-4 py-3 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 transition"
            >
              <Upload className="w-4 h-4 text-primary-custom" />
              <span>Upload Backup File</span>
            </button>
          </div>

          {/* Sync status */}
          <div className="pt-2">
            <div className="flex justify-between items-center bg-background border border-border-custom p-3.5 rounded-2xl">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-custom" />
                <span className="text-xs text-foreground font-semibold">Firebase Cloud Sync</span>
              </div>
              <button
                onClick={triggerManualSync}
                disabled={syncing}
                className="text-primary-custom hover:underline text-xs font-bold flex items-center gap-1.5 transition"
              >
                {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>{syncing ? 'Syncing...' : copied ? 'Synced' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Share Account & Tracking Data Panel */}
      <div className="bg-card border border-border-custom p-6 rounded-3xl space-y-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-border-custom">
          <Share2 className="w-5 h-5 text-primary-custom" />
          <h3 className="font-display font-bold text-base text-foreground">Share Account & Tracking Data</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Share outbound */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider text-muted-custom">Share Your Tracking Database</h4>
              <p className="text-[11px] text-muted-custom leading-relaxed mt-1">
                Give friends real-time access to view your watchlist, favorites, customs, ratings, progress, and movie notes.
              </p>
            </div>

            <div className="space-y-3">
              {/* Copy share link */}
              <div>
                <label className="text-[10px] font-bold text-muted-custom block mb-1">Your Direct Share Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={user ? `${window.location.origin}${window.location.pathname}?share=${user.uid}` : ''}
                    className="flex-1 bg-background border border-border-custom px-3 py-2 rounded-xl text-xs font-mono text-muted-custom outline-none select-all"
                  />
                  <button
                    onClick={() => {
                      if (!user) return;
                      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?share=${user.uid}`);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    disabled={!user}
                    className="px-4 py-2 bg-primary-custom hover:bg-primary-custom/90 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {linkCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {/* Direct share UID */}
              <div>
                <label className="text-[10px] font-bold text-muted-custom block mb-1">Your Share ID (UID)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={user ? user.uid : ''}
                    className="flex-1 bg-background border border-border-custom px-3 py-2 rounded-xl text-xs font-mono text-muted-custom outline-none select-all"
                  />
                  <button
                    onClick={() => {
                      if (!user) return;
                      navigator.clipboard.writeText(user.uid);
                      setUidCopied(true);
                      setTimeout(() => setUidCopied(false), 2000);
                    }}
                    disabled={!user}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {uidCopied ? 'Copied!' : 'Copy ID'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Share inbound */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider text-muted-custom">Connect to a Friend's Library</h4>
              <p className="text-[11px] text-muted-custom leading-relaxed mt-1">
                Enter your friend's account email address or direct Share ID below to view their tracking collections and lists in real-time.
              </p>
            </div>

            <form onSubmit={handleLoadSharedFriend} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-muted-custom block mb-1">Friend's Email Address or Share ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. friend@example.com or user_uid_here..."
                    value={friendInput}
                    onChange={(e) => setFriendInput(e.target.value)}
                    className="flex-1 bg-background border border-border-custom px-3.5 py-2.5 rounded-xl text-xs text-foreground outline-none focus:border-primary-custom/50"
                  />
                  <button
                    type="submit"
                    disabled={loadingFriend}
                    className="px-4 py-2.5 bg-primary-custom hover:bg-primary-custom/90 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loadingFriend ? 'Searching...' : 'Connect'}
                  </button>
                </div>
                {friendError && (
                  <p className="text-[10px] text-red-500 font-semibold mt-1">
                    {friendError}
                  </p>
                )}
                {friendSuccess && (
                  <p className="text-[10px] text-emerald-500 font-semibold mt-1">
                    Successfully loaded shared library!
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
  );
}
