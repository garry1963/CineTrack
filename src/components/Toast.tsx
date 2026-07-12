import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCineTrack } from '../context/CineTrackContext';
import { X, CheckCircle, Bookmark, Heart, List, Info, AlertTriangle } from 'lucide-react';

export default function ToastContainer() {
  const { notifications, dismissNotification } = useCineTrack();

  const getIcon = (type: string, title?: string) => {
    if (title === 'Watchlist') {
      return <Bookmark className="w-5 h-5 text-indigo-400 fill-indigo-400/20 shrink-0" />;
    }
    if (title === 'Favorites') {
      return <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20 shrink-0" />;
    }
    if (type === 'success') {
      return <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
    if (type === 'error') {
      return <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />;
    }
    return <Info className="w-5 h-5 text-sky-400 shrink-0" />;
  };

  return (
    <div 
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[9999] flex flex-col gap-3 max-w-sm w-[calc(100vw-32px)] md:w-96 pointer-events-none"
      id="toast-notifications-container"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            layout
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto w-full bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 flex gap-3 items-start justify-between select-none group"
            id={`toast-notification-${notification.id}`}
          >
            <div className="flex gap-3 items-start min-w-0">
              <div className="mt-0.5 shrink-0">
                {getIcon(notification.type, notification.title)}
              </div>
              <div className="space-y-0.5 min-w-0">
                {notification.title && (
                  <h4 className="text-xs font-bold text-slate-200 tracking-wide uppercase font-mono">
                    {notification.title}
                  </h4>
                )}
                <p className="text-xs font-medium text-slate-300 leading-relaxed">
                  {notification.message}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => dismissNotification(notification.id)}
              className="p-1 -mr-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800/50 transition cursor-pointer shrink-0"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
