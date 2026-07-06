import React, { useState } from 'react';
import { Film, Sparkles, Shield, ChevronRight, LogIn, AlertCircle } from 'lucide-react';
import { useCineTrack } from '../context/CineTrackContext';

interface AuthScreenProps {
  onSuccess: () => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const { loginAsGuest, loginWithGoogle } = useCineTrack();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    setError(null);
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setError('The sign-in popup was blocked by your browser. Please allow popups for this site, or click the "Open in new tab" icon at the top-right of the preview window.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('The Google Sign-In window was closed. If you are using the embedded preview, please click the "Open in new tab" icon at the top-right of the preview window to sign in securely.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('The sign-in request was cancelled. Please try again.');
      } else {
        setError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleEnterVault = () => {
    setLoadingGuest(true);
    setError(null);
    try {
      loginAsGuest();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to enter personal vault.');
    } finally {
      setLoadingGuest(false);
    }
  };

  const isLoading = loadingGoogle || loadingGuest;

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 md:p-6 text-neutral-100 font-sans relative overflow-hidden" id="auth-screen-root">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-custom/10 rounded-full blur-[120px] pointer-events-none" id="bg-glow-1" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[150px] pointer-events-none" id="bg-glow-2" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-[#0a0a0a] border border-neutral-800/40 rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 flex flex-col items-center text-center space-y-8 backdrop-blur-md" id="auth-card">
        
        {/* Animated Accent line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-primary-custom/60 to-transparent" id="accent-line" />
        
        {/* Brand Icon */}
        <div className="relative group" id="brand-logo-group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-custom to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500" />
          <div className="relative bg-[#121212] border border-neutral-800 text-primary-custom p-4 rounded-2xl shadow-xl">
            <Film className="w-8 h-8" />
          </div>
        </div>

        {/* Text Copy */}
        <div className="space-y-3" id="branding-texts">
          <div className="inline-flex items-center gap-1.5 bg-primary-custom/10 border border-primary-custom/20 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase text-primary-custom">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Secure Cloud Sync</span>
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight text-white">
            CineTrack
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">
            A beautiful, secure space to discover, track, and manage your favorite movies and shows.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs flex gap-3 text-left items-start animate-fade-in" id="auth-error-banner">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Portal */}
        <div className="w-full space-y-4" id="action-portal-container">
          {/* Real Firebase Backend Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full group bg-gradient-to-r from-primary-custom to-orange-600 hover:from-primary-custom/95 hover:to-orange-600/95 active:scale-[0.98] disabled:opacity-50 text-white font-medium text-sm py-3.5 px-6 rounded-2xl shadow-lg shadow-primary-custom/10 flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer"
            id="google-signin-btn"
          >
            {loadingGoogle ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign in with Google</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform ml-auto opacity-60" />
              </>
            )}
          </button>

          {/* Local Guest Fallback Option */}
          <button
            type="button"
            onClick={handleEnterVault}
            disabled={isLoading}
            className="w-full py-3 px-6 rounded-2xl bg-neutral-900/60 hover:bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800/60 font-medium text-sm transition-all duration-200 cursor-pointer"
            id="local-vault-btn"
          >
            {loadingGuest ? (
              <div className="w-5 h-5 border-2 border-neutral-500 border-t-neutral-200 rounded-full animate-spin mx-auto" />
            ) : (
              <span>Continue Offline (Local Storage)</span>
            )}
          </button>
        </div>

        {/* Private Instance Note */}
        <div className="pt-2 border-t border-neutral-900/60 w-full flex items-center justify-center gap-2 text-[11px] text-neutral-500" id="private-instance-badge">
          <Shield className="w-3.5 h-3.5 text-neutral-600" />
          <span>Private database • SSL Encrypted</span>
        </div>
      </div>
    </div>
  );
}
