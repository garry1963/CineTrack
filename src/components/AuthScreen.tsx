import React, { useState } from 'react';
import { 
  auth, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from '../firebase';
import { Film, LogIn, UserPlus, HelpCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useCineTrack } from '../context/CineTrackContext';

interface AuthScreenProps {
  onSuccess: () => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const { loginAsGuest } = useCineTrack();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill out all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      // Directly enter guest mode to bypass administrative Firebase restrictions on anonymous auth
      loginAsGuest();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Guest entry failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row text-neutral-100 font-sans">
      {/* Decorative Branding Panel */}
      <div className="md:w-1/2 bg-gradient-to-br from-neutral-900 to-[#050505] p-8 md:p-16 flex flex-col justify-between relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.15),transparent_50%)]" />
        
        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-primary-custom text-white p-2.5 rounded-2xl shadow-lg shadow-primary-custom/20">
            <Film className="w-6 h-6" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">
            CineTrack
          </span>
        </div>

        {/* Hero Copy */}
        <div className="space-y-4 max-w-md my-12 md:my-0 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-primary-custom/10 border border-primary-custom/20 px-3 py-1 rounded-full text-xs font-medium text-primary-custom">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personal Media Vault</span>
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl leading-tight tracking-tight text-white">
            Track, Discover & Manage Your Favorite Shows
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            A beautiful, lightning-fast private tracker inspired by TV Time. Built with modern UI cards, live TMDB metadata integration, and direct Reddit discussion lookups.
          </p>
        </div>

        {/* Footer */}
        <div className="text-xs text-neutral-500 relative z-10 flex items-center gap-2">
          <span>Secure Cloud Persistence via Firebase</span>
        </div>
      </div>

      {/* Access Form Panel */}
      <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8 bg-[#121212] p-8 rounded-2xl border border-[#1f1f1f] shadow-xl">
          
          <div className="space-y-2">
            <h2 className="font-display font-bold text-2xl text-white">
              {isSignUp ? 'Create your Vault' : 'Welcome back'}
            </h2>
            <p className="text-sm text-neutral-400">
              {isSignUp ? 'Setup a new private account for tracking' : 'Enter details to access your dashboard'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] focus:border-primary-custom px-4 py-2.5 rounded-xl text-sm outline-none transition"
                required
              />
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] focus:border-primary-custom px-4 py-2.5 pr-10 rounded-xl text-sm outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-custom hover:bg-primary-custom/90 active:bg-primary-custom/85 disabled:opacity-50 text-white font-medium text-sm py-3 rounded-xl shadow-lg shadow-primary-custom/10 flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Signup/Signin */}
          <div className="text-center text-xs">
            <span className="text-neutral-400">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </span>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-primary-custom hover:text-primary-custom/80 font-semibold transition"
            >
              {isSignUp ? 'Sign In' : 'Register now'}
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1f1f1f]"></div>
            </div>
            <span className="relative bg-[#121212] px-3 text-xs uppercase tracking-wider text-neutral-500">Or</span>
          </div>

          {/* Anonymous Login Card */}
          <div className="bg-[#0a0a0a] p-4 rounded-xl border border-[#1f1f1f] flex flex-col gap-3">
            <div className="flex gap-2.5">
              <HelpCircle className="w-5 h-5 text-primary-custom shrink-0" />
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-white">Just Browsing / Testing?</h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Sign in instantly. Your tracking data will be saved temporarily in your local browser cache.
                </p>
              </div>
            </div>
            <div className="mt-1">
              <button
                type="button"
                onClick={handleAnonymousAuth}
                disabled={loading}
                className="w-full bg-[#121212] hover:bg-primary-custom/10 hover:text-primary-custom hover:border-primary-custom/30 border border-[#1f1f1f] text-neutral-200 text-xs py-2.5 rounded-lg font-medium transition"
              >
                Enter as Guest (No Account Required)
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
