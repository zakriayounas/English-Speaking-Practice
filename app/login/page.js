'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import PasswordField from '../../components/PasswordField';

function safeNext() {
  const next = new URLSearchParams(window.location.search).get('next') || '/exercises';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/exercises';
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [next, setNext] = useState('/exercises');

  useEffect(() => {
    setNext(safeNext());
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeNext());
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (result.error) {
        setMessage({ type: 'error', text: result.error.message });
        setBusy(false);
      } else router.replace(safeNext());
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
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
          <span className="kicker">Welcome back</span>
          <h2>Log in to practice</h2>
          <p>Your next useful phrase is waiting.</p>
        </div>
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required />
        <label htmlFor="password">Password</label>
        <PasswordField id="password" placeholder="At least 6 characters" value={password} onChange={event => setPassword(event.target.value)} minLength={6} autoComplete="current-password" required />
        <button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Please wait...</> : 'Log in'}</button>
        <Link className="auth-link" href="/reset-password">Forgot your password?</Link>
        {message && <p className={`notice notice-${message.type}`}>{message.text}</p>}
        <p className="auth-switch">
          New to FluentPal? <Link href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </p>
      </form>
    </main>
  );
}
