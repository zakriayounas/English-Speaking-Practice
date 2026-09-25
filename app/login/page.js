'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const result = signup
        ? await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        : await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (result.error) {
        setMessage({ type: 'error', text: result.error.message });
      } else if (signup && !result.data.session) {
        setMessage({ type: 'success', text: 'Account created. Check your email to confirm your account, then log in.' });
      } else {
        router.replace('/');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return (
    <main className="auth-shell auth-loading">
      <section className="auth-intro"><span className="eyebrow">FluentPal</span><span className="skeleton-line auth-loading-title" /><span className="skeleton-line auth-loading-copy" /></section>
      <section className="auth-card auth-loading-card"><span className="skeleton-line auth-loading-small" /><span className="skeleton-line auth-loading-heading" /><span className="skeleton-line auth-loading-input" /><span className="skeleton-line auth-loading-input" /><span className="skeleton-line auth-loading-button" /></section>
    </main>
  );

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <span className="eyebrow">FluentPal</span>
        <h1>Practice English with confidence.</h1>
        <p>Practice practical English with short exercises that fit into your day.</p>
      </section>
      <form className="auth-card" onSubmit={submit}>
        <div className="card-heading">
          <span className="kicker">{signup ? 'Start learning' : 'Welcome back'}</span>
          <h2>{signup ? 'Create your account' : 'Log in to practice'}</h2>
          <p>{signup ? 'Save your progress and keep your momentum.' : 'Your next useful phrase is waiting.'}</p>
        </div>
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" placeholder="At least 6 characters" value={password} onChange={event => setPassword(event.target.value)} minLength={6} autoComplete={signup ? 'new-password' : 'current-password'} required />
        <button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Please wait...</> : signup ? 'Create account' : 'Log in'}</button>
        {!signup && <Link className="auth-link" href="/reset-password">Forgot your password?</Link>}
        {message && <p className={`notice notice-${message.type}`}>{message.text}</p>}
        <p className="auth-switch">
          {signup ? 'Already have an account?' : 'New to FluentPal?'}{' '}
          <button type="button" className="text-button" onClick={() => { setSignup(!signup); setMessage(null); }}>{signup ? 'Log in' : 'Create an account'}</button>
        </p>
      </form>
    </main>
  );
}