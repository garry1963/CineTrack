import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, ExternalLink, X, ShieldAlert, MessageSquare } from 'lucide-react';

interface RedditBrowserProps {
  url: string;
  title: string;
  fallbackSearch?: string;
  onClose: () => void;
}

export default function RedditBrowser({ url, title, fallbackSearch, onClose }: RedditBrowserProps) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [history, setHistory] = useState<string[]>([url]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [key, setKey] = useState(0); // for refresh simulation
  const [showWarning, setShowWarning] = useState(true);

  const handleGoBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setCurrentUrl(history[historyIndex - 1]);
    }
  };

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setCurrentUrl(history[historyIndex + 1]);
    }
  };

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  const handleOpenExternally = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8">
      <div className="bg-card w-full h-full max-w-6xl rounded-2xl border border-border-custom overflow-hidden flex flex-col shadow-2xl">
        
        {/* Browser Top Bar Controls */}
        <div className="bg-background px-4 py-3 border-b border-border-custom flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={handleGoBack}
              disabled={historyIndex === 0}
              className="p-1.5 rounded-lg hover:bg-card text-foreground disabled:opacity-30 transition"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={handleGoForward}
              disabled={historyIndex === history.length - 1}
              className="p-1.5 rounded-lg hover:bg-card text-foreground disabled:opacity-30 transition"
              title="Forward"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={handleRefresh}
              className="p-1.5 rounded-lg hover:bg-card text-foreground transition"
              title="Refresh"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="bg-card border border-border-custom px-3 py-1.5 rounded-full text-xs font-mono text-muted-custom flex items-center justify-between gap-2 overflow-hidden truncate">
              <span className="truncate">{currentUrl}</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded uppercase font-semibold shrink-0">Secure WebView</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenExternally}
              className="bg-primary-custom hover:bg-primary-custom/90 text-white text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Externally</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-foreground transition"
              title="Close Browser"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Browser Title / Sub-header */}
        <div className="bg-card px-6 py-2.5 border-b border-border-custom flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-custom">
            <MessageSquare className="w-4 h-4" />
            <h3 className="font-semibold text-sm truncate max-w-md">{title} - Discussion</h3>
          </div>
          {fallbackSearch && (
            <span className="text-xs text-muted-custom">Searching Reddit: "{fallbackSearch}"</span>
          )}
        </div>

        {/* Helper Banner for Embedded Frame */}
        {showWarning && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-500 shrink-0" />
              <span>
                <strong>In-App Browser Note:</strong> Modern websites like Reddit may occasionally restrict loading in frame layouts due to their security policies. If the panel below appears blank, click 
                <button onClick={handleOpenExternally} className="underline ml-1 text-amber-400 hover:text-amber-300 font-bold">Open Externally</button> to read and participate.
              </span>
            </div>
            <button onClick={() => setShowWarning(false)} className="p-1 hover:bg-amber-500/20 rounded-lg text-amber-400 transition ml-4">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Embedded Frame Area */}
        <div className="flex-1 bg-white relative">
          <iframe
            key={key}
            src={currentUrl}
            className="absolute inset-0 w-full h-full border-none bg-white opacity-100 pointer-events-auto"
            title="Reddit Standard WebView"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>

      </div>
    </div>
  );
}
