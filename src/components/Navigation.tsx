import React from 'react';
import { Home, Compass, Search, Bookmark, Calendar, BarChart3, User, Menu, ChevronLeft, Film, LogOut, MoreHorizontal } from 'lucide-react';
import { ViewState } from '../types';

interface NavigationProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  userEmail: string | null;
  onLogout: () => void;
}

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

export function Sidebar({ 
  currentView, 
  onNavigate, 
  sidebarCollapsed, 
  setSidebarCollapsed,
  userEmail,
  onLogout 
}: NavigationProps) {
  return (
    <aside 
      className={`hidden md:flex flex-col bg-card border-r border-border-custom h-screen sticky top-0 transition-all duration-300 shrink-0 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-border-custom flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-primary-custom text-white p-2 rounded-xl shrink-0 flex items-center justify-center">
            <Film className="w-5 h-5" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-display font-bold text-lg tracking-tight text-foreground truncate">
              CineTrack
            </span>
          )}
        </div>
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1.5 rounded-lg hover:bg-background text-muted-custom hover:text-foreground transition"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentView.type === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate({ type: item.id as any })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                isActive 
                  ? 'bg-primary-custom text-white shadow-md' 
                  : 'text-muted-custom hover:bg-background hover:text-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'scale-110' : ''}`} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User / Logout Area */}
      <div className="p-4 border-t border-border-custom">
        {!sidebarCollapsed && (
          <div className="mb-3 px-2">
            <div className="text-xs text-muted-custom truncate">Logged in as</div>
            <div className="text-sm font-semibold truncate text-foreground">{userEmail || 'Anonymous'}</div>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs text-red-500 hover:bg-red-500/10 transition-all duration-200`}
          title="Log out"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
}

export function BottomNav({ 
  currentView, 
  onNavigate,
  userEmail,
  onLogout
}: {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  userEmail: string | null;
  onLogout: () => void;
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);

  const mainNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  ];

  const moreNavItems = [
    { id: 'calendar', label: 'Calendar', icon: Calendar, desc: 'Release schedule & airings' },
    { id: 'statistics', label: 'Statistics', icon: BarChart3, desc: 'Screen-time & genre insights' },
    { id: 'profile', label: 'Profile', icon: User, desc: 'Account & cloud sync options' },
  ];

  const isMoreActive = moreNavItems.some(item => currentView.type === item.id);

  const handleMoreNavigate = (id: string) => {
    onNavigate({ type: id as any });
    setMoreOpen(false);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border-custom px-2 py-1.5 flex justify-around items-center z-40 shadow-lg pb-safe">
        {mainNavItems.map((item) => {
          const isActive = currentView.type === item.id && !moreOpen;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate({ type: item.id as any });
                setMoreOpen(false);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
                isActive 
                  ? 'text-primary-custom' 
                  : 'text-muted-custom hover:text-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </button>
          );
        })}
        
        {/* More button */}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
            moreOpen || isMoreActive
              ? 'text-primary-custom' 
              : 'text-muted-custom hover:text-foreground'
          }`}
        >
          <MoreHorizontal className={`w-5 h-5 ${(moreOpen || isMoreActive) ? 'scale-110 stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
          <span className="text-[10px] mt-0.5 font-medium">More</span>
        </button>
      </nav>

      {/* Drawer Overlay Backdrop */}
      {moreOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Slide-Up Drawer Menu */}
      <div 
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border-custom rounded-t-3xl z-50 p-6 shadow-2xl transition-all duration-300 transform ${
          moreOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        } pb-safe`}
      >
        {/* Grab Handle indicator */}
        <div className="w-12 h-1 bg-border-custom rounded-full mx-auto mb-5" />

        {/* Head details */}
        <div className="flex justify-between items-center pb-4 border-b border-border-custom mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary-custom text-white p-2.5 rounded-2xl flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-sm text-foreground">CineTrack Hub</h3>
              <p className="text-[10px] text-muted-custom truncate max-w-[200px] mt-0.5">{userEmail || 'Guest account'}</p>
            </div>
          </div>
          <button 
            onClick={() => setMoreOpen(false)}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Inner grid list */}
        <div className="space-y-3.5">
          {moreNavItems.map((item) => {
            const isActive = currentView.type === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleMoreNavigate(item.id)}
                className={`w-full flex items-center gap-4 p-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? 'bg-primary-custom/10 text-primary-custom border border-primary-custom/25' 
                    : 'text-foreground bg-background/50 hover:bg-background border border-border-custom/50'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-primary-custom text-white' : 'bg-card text-muted-custom border border-border-custom'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <span className="block font-bold text-sm">{item.label}</span>
                  <span className="block text-[10px] font-medium text-muted-custom mt-0.5 truncate">{item.desc}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Account action section */}
        <div className="pt-6 border-t border-border-custom mt-6 flex flex-col gap-3">
          <button
            onClick={() => {
              setMoreOpen(false);
              onLogout();
            }}
            className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-500 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out from CineTrack</span>
          </button>
        </div>
      </div>
    </>
  );
}
