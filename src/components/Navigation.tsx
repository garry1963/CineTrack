import React from 'react';
import { Home, Compass, Search, Bookmark, Calendar, BarChart3, User, Menu, ChevronLeft, Film, LogOut } from 'lucide-react';
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
  onNavigate 
}: Pick<NavigationProps, 'currentView' | 'onNavigate'>) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border-custom px-2 py-1.5 flex justify-around items-center z-40 shadow-lg">
      {navItems.map((item) => {
        const isActive = currentView.type === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate({ type: item.id as any })}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
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
    </nav>
  );
}
