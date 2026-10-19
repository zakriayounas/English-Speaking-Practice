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

export default function Register() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [nameError, setNameError] = useState('');
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
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setNameError('Enter a full name between 2 and 60 characters.');
      return;
    }
    setNameError('');
    setBusy(true);
    try {
      const result = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { full_name: trimmedName },
        },
      });
      if (result.error) {
        setMessage({ type: 'error', text: result.error.message });
        setBusy(false);
      } else if (!result.data.session) {
        setMessage({ type: 'success', text: 'Account created. Check your email to confirm your account, then log in.' });
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
          <span className="kicker">Start learning</span>
          <h2>Create your account</h2>
          <p>Save your progress and keep your momentum.</p>
        </div>
        <label htmlFor="full-name">Full name</label>
        <input id="full-name" value={fullName} onChange={event => { setFullName(event.target.value); setNameError(''); }} autoComplete="name" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'full-name-error' : undefined} required />
        {nameError && <p id="full-name-error" className="field-error" role="alert">{nameError}</p>}
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required />
        <label htmlFor="password">Password</label>
        <PasswordField id="password" placeholder="At least 6 characters" value={password} onChange={event => setPassword(event.target.value)} minLength={6} autoComplete="new-password" required />
        <button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Please wait...</> : 'Create account'}</button>
        {message && <p className={`notice notice-${message.type}`}>{message.text}</p>}
        <p className="auth-switch">
          Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
        </p>
      </form>
    </main>
  );
}
