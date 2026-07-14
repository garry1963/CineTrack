import React from 'react';
import { Home, Compass, Search, Bookmark, Calendar, BarChart3, User, Menu, ChevronLeft, Film, LogOut, MoreHorizontal, Shield } from 'lucide-react';
import { ViewState } from '../types';
import { useCineTrack } from '../context/CineTrackContext';

interface NavigationProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  userEmail: string | null;
  onLogout: () => void;
}

const navItems = [
  { id: 'home', label: 'Home', icon: Home, desc: 'Your personalized cinema feed' },
  { id: 'discover', label: 'Discover', icon: Compass, desc: 'Explore trending & top rated' },
  { id: 'search', label: 'Search', icon: Search, desc: 'Find movies, shows & reviews' },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark, desc: 'Your saved library & custom lists' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, desc: 'Release schedule & airings' },
  { id: 'statistics', label: 'Statistics', icon: BarChart3, desc: 'Watchtime & genre insights' },
  { id: 'profile', label: 'Profile', icon: User, desc: 'Preferences, custom keys & sync' },
];

export function Sidebar({ 
  currentView, 
  onNavigate, 
  sidebarCollapsed, 
  setSidebarCollapsed,
  userEmail,
  onLogout 
}: NavigationProps) {
  // Sidebar is relocated to the bottom bar location, so we return null to remove it from layout.
  return null;
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
  const { settings } = useCineTrack();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const visibleIds = settings?.bottomNavItems && settings.bottomNavItems.length > 0
    ? settings.bottomNavItems
    : ['home', 'discover', 'search', 'watchlist'];

  const mainNavItems = navItems.filter((item) => visibleIds.includes(item.id));
  const moreNavItems = navItems.filter((item) => !visibleIds.includes(item.id));

  const isMoreActive = moreNavItems.some(item => currentView.type === item.id);

  const handleMoreNavigate = (id: string) => {
    onNavigate({ type: id as any });
    setMoreOpen(false);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-card border-t border-border-custom px-4 py-2 flex justify-around items-center z-40 shadow-2xl backdrop-blur-xl bg-card/95 pb-safe">
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
        {moreNavItems.length > 0 && (
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
        )}
      </nav>

      {/* Drawer Overlay Backdrop */}
      {moreOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Slide-Up Drawer Menu (Floating Popover on desktop) */}
      <div 
        className={`fixed z-50 p-6 shadow-2xl transition-all duration-300 transform bg-card border-border-custom
          ${moreOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-12 opacity-0 pointer-events-none'}
          bottom-0 left-0 right-0 rounded-t-3xl border-t
          md:bottom-18 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-[450px] md:rounded-3xl md:border md:mb-2
        `}
      >
        {/* Grab Handle indicator */}
        <div className="w-12 h-1 bg-border-custom rounded-full mx-auto mb-5 md:hidden" />

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
        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
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
          {userEmail ? (
            <button
              onClick={() => {
                setMoreOpen(false);
                onLogout();
              }}
              className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-500 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out Admin</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setMoreOpen(false);
                onNavigate({ type: 'admin-login' });
              }}
              className="w-full py-3.5 bg-primary-custom/10 hover:bg-primary-custom/15 border border-primary-custom/20 text-primary-custom rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Admin Sign In</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
