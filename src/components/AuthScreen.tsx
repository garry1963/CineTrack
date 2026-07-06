import React, { useState, useEffect } from 'react';
import { Film, Sparkles, Shield, ChevronRight, LogIn, AlertCircle, ExternalLink, Mail, Lock, UserPlus } from 'lucide-react';
import { useCineTrack } from '../context/CineTrackContext';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase';

interface AuthScreenProps {
  onSuccess: () => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const { loginAsGuest } = useCineTrack();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      let message = err.message || 'Authentication failed.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'Invalid email or password. Please try again.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already in use. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        message = 'The password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/operation-not-allowed') {
        message = 'Email/Password authentication is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.';
      }
      setError(message);
    } finally {
      setLoading(false);
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

  const isLoading = loading || loadingGuest;

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
        <div className="w-full space-y-5 text-left" id="action-portal-container">
          <form onSubmit={handleSubmit} className="space-y-4 w-full" id="auth-credentials-form">
            {/* Email Field */}
            <div className="space-y-1.5" id="email-field-group">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  disabled={isLoading}
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 focus:border-primary-custom/60 text-sm placeholder:text-neutral-600 text-neutral-100 outline-none transition duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5" id="password-field-group">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 focus:border-primary-custom/60 text-sm placeholder:text-neutral-600 text-neutral-100 outline-none transition duration-200"
                />
              </div>
            </div>

            {/* Confirm Password Field (Only during registration) */}
            {mode === 'signup' && (
              <div className="space-y-1.5 animate-fade-in" id="confirm-password-field-group">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Confirm Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    disabled={isLoading}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 focus:border-primary-custom/60 text-sm placeholder:text-neutral-600 text-neutral-100 outline-none transition duration-200"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full group mt-2 bg-gradient-to-r from-primary-custom to-orange-600 hover:from-primary-custom/95 hover:to-orange-600/95 active:scale-[0.98] disabled:opacity-50 text-white font-medium text-sm py-3.5 px-6 rounded-2xl shadow-lg shadow-primary-custom/10 flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer"
              id="submit-auth-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform ml-auto opacity-60" />
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform ml-auto opacity-60" />
                </>
              )}
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="text-center" id="mode-switcher-container">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="text-xs text-neutral-400 hover:text-primary-custom hover:underline transition cursor-pointer"
              id="toggle-mode-btn"
            >
              {mode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>

          <div className="relative flex py-2 items-center text-xs" id="auth-divider">
            <div className="flex-grow border-t border-neutral-800/40"></div>
            <span className="flex-shrink mx-4 text-neutral-600 font-medium">or</span>
            <div className="flex-grow border-t border-neutral-800/40"></div>
          </div>

          {/* Local Guest Fallback Option */}
          <button
            type="button"
            onClick={handleEnterVault}
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-2xl bg-neutral-900/40 hover:bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800/40 font-medium text-sm transition-all duration-200 cursor-pointer text-center"
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
