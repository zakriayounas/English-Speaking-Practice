'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setRecovery(Boolean(data.session));
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setRecovery(true);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function requestReset(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMessage(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Check your email for a password reset link.' });
    setBusy(false);
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Your password must be at least 6 characters.' });
      return;
    }
    if (password !== passwordAgain) {
      setMessage({ type: 'error', text: 'The passwords do not match.' });
      return;
    }

    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Your password has been updated. You can now log in.' });
    if (!error) setComplete(true);
    setBusy(false);
  }

  if (loading) return (
    <main className="auth-shell auth-loading">
      <section className="auth-intro"><span className="eyebrow">FluentPal</span><span className="skeleton-line auth-loading-title" /><span className="skeleton-line auth-loading-copy" /></section>
      <section className="auth-card auth-loading-card"><span className="skeleton-line auth-loading-small" /><span className="skeleton-line auth-loading-heading" /><span className="skeleton-line auth-loading-input" /><span className="skeleton-line auth-loading-button" /></section>
    </main>
  );

  if (complete) return (
    <main className="auth-shell">
      <section className="auth-intro"><span className="eyebrow">FluentPal</span><h1>Your password is updated.</h1><p>Your account is ready. Return to the login page to continue practicing.</p></section>
      <section className="auth-card"><div className="card-heading"><span className="kicker">All set</span><h2>Password changed</h2><p>{message?.text}</p></div><Link className="primary-button status-button" href="/login">Go to login</Link></section>
    </main>
  );

  return (
    <main className="auth-shell">
      <section className="auth-intro"><span className="eyebrow">FluentPal</span><h1>{recovery ? 'Choose a new password.' : 'Reset your password.'}</h1><p>{recovery ? 'Set a new password for your FluentPal account.' : 'Enter your email and we will send you a secure reset link.'}</p></section>
      <form className="auth-card" onSubmit={recovery ? updatePassword : requestReset}>
        <div className="card-heading"><span className="kicker">Account access</span><h2>{recovery ? 'Create a new password' : 'Forgot your password?'}</h2><p>{recovery ? 'Use at least 6 characters.' : 'The link will return you here to finish the reset.'}</p></div>
        {!recovery ? <>
          <label htmlFor="reset-email">Email address</label>
          <input id="reset-email" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required />
        </> : <>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" placeholder="At least 6 characters" value={password} onChange={event => setPassword(event.target.value)} minLength={6} autoComplete="new-password" required />
          <label htmlFor="new-password-again">Confirm new password</label>
          <input id="new-password-again" type="password" placeholder="Enter it again" value={passwordAgain} onChange={event => setPasswordAgain(event.target.value)} minLength={6} autoComplete="new-password" required />
        </>}
        <button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Please wait...</> : recovery ? 'Update password' : 'Send reset link'}</button>
        {message && <p className={`notice notice-${message.type}`}>{message.text}</p>}
        <p className="auth-switch"><Link className="auth-link" href="/login">Back to login</Link></p>
      </form>
    </main>
  );
}
