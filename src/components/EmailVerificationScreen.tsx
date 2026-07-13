import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, RefreshCw, LogOut, ShieldAlert, AlertCircle, Send } from 'lucide-react';
import { useCineTrack } from '../context/CineTrackContext';
import { auth, sendEmailVerification } from '../firebase';

export default function EmailVerificationScreen() {
  const { user, refreshUser, logout, showNotification } = useCineTrack();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer for resend button rate limiting
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => {
      setCooldown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleCheckVerification = async () => {
    setChecking(true);
    setError(null);
    try {
      await refreshUser();
      // Wait a tiny bit and check
      if (auth.currentUser && auth.currentUser.emailVerified) {
        showNotification('Email verified! Welcome to CineTrack.', 'success', 'Access Granted');
      } else {
        setError('Email address is still unverified. Please check your inbox and click the verification link.');
        showNotification('We couldn\'t verify your email yet. Please try again.', 'error', 'Still Unverified');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to refresh verification status.');
    } finally {
      setChecking(false);
    }
  };

  const handleResendEmail = async () => {
    if (cooldown > 0 || !auth.currentUser) return;
    setResending(true);
    setError(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setCooldown(60); // 60s rate limit
      showNotification('Verification email resent successfully!', 'success', 'Email Sent');
    } catch (err: any) {
      console.error(err);
      setError('Too many requests. Please wait a moment and try again.');
      showNotification('Failed to resend. Please try again later.', 'error', 'Rate Limited');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 md:p-6 text-neutral-100 font-sans relative overflow-hidden" id="verification-screen-root">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-custom/10 rounded-full blur-[120px] pointer-events-none" id="bg-glow-1" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[150px] pointer-events-none" id="bg-glow-2" />

      {/* Card */}
      <div className="w-full max-w-md bg-[#0a0a0a] border border-neutral-800/40 rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 flex flex-col items-center text-center space-y-6 backdrop-blur-md" id="verification-card">
        
        {/* Accent line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-primary-custom/60 to-transparent" id="accent-line" />
        
        {/* Mail Icon */}
        <div className="relative group" id="mail-logo-group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-custom to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500" />
          <div className="relative bg-[#121212] border border-neutral-800 text-primary-custom p-4 rounded-2xl shadow-xl">
            <Mail className="w-8 h-8 animate-pulse" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3" id="verification-texts">
          <div className="inline-flex items-center gap-1.5 bg-primary-custom/10 border border-primary-custom/20 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase text-primary-custom">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Verification Required</span>
          </div>
          <h1 className="font-display font-bold text-2xl tracking-tight text-white">
            Confirm Your Email
          </h1>
          <p className="text-neutral-400 text-xs leading-relaxed max-w-xs mx-auto">
            We have sent a verification link to <span className="font-semibold text-white break-all">{user?.email}</span>.
          </p>
          <p className="text-neutral-500 text-[11px] leading-relaxed max-w-xs mx-auto">
            Please check your inbox (and your spam folder) and click the link to confirm your email address. Once confirmed, full access will be granted.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl text-xs flex gap-3 text-left items-start animate-fade-in" id="verification-error-banner">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="w-full space-y-3 pt-2" id="verification-actions">
          {/* Check Verification Button */}
          <button
            type="button"
            onClick={handleCheckVerification}
            disabled={checking}
            className="w-full group bg-gradient-to-r from-primary-custom to-orange-600 hover:from-primary-custom/95 hover:to-orange-600/95 active:scale-[0.98] disabled:opacity-50 text-white font-medium text-sm py-3.5 px-6 rounded-2xl shadow-lg shadow-primary-custom/10 flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer"
            id="check-verification-btn"
          >
            {checking ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>I've Confirmed My Email</span>
          </button>

          {/* Resend Code Button */}
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resending || cooldown > 0}
            className="w-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-medium text-xs py-3 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:hover:bg-neutral-900"
            id="resend-verification-btn"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {cooldown > 0 ? `Resend Email in ${cooldown}s` : 'Resend Verification Email'}
            </span>
          </button>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={() => logout()}
            className="w-full bg-transparent hover:bg-neutral-900/40 text-neutral-500 hover:text-neutral-300 font-medium text-xs py-2.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            id="sign-out-btn"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out / Use Another Account</span>
          </button>
        </div>

        {/* Private Instance Note */}
        <div className="pt-2 border-t border-neutral-900/60 w-full flex items-center justify-center gap-2 text-[11px] text-neutral-500" id="private-instance-badge">
          <span>Secure email check • OAuth enabled</span>
        </div>
      </div>
    </div>
  );
}
