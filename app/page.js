'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [user, setUser] = useState(null), [list, setList] = useState([]), [questionCounts, setQuestionCounts] = useState({});
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [signup, setSignup] = useState(false), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const [view, setView] = useState('list'), [listLoading, setListLoading] = useState(false), [authLoading, setAuthLoading] = useState(true), [role, setRole] = useState('learner'), [selectedLevel, setSelectedLevel] = useState('all'), [page, setPage] = useState(1);

  const pageSize = 15;
  const visibleExercises = selectedLevel === 'all' ? list : list.filter(item => item.level === selectedLevel);
  const totalPages = Math.max(1, Math.ceil(visibleExercises.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedExercises = visibleExercises.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [selectedLevel]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
    const { data: s } = supabase.auth.onAuthStateChange((_e, ses) => setUser(ses?.user ?? null));
    return () => s.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => setRole(data?.role || 'learner'));
      setListLoading(true);
      Promise.all([
        supabase.from('exercises').select('id,title,category,level,owner_id').order('title'),
        supabase.from('questions').select('exercise_id'),
      ]).then(([{ data: exerciseData }, { data: questionData }]) => {
        const counts = {};
        (questionData || []).forEach(({ exercise_id }) => {
          counts[exercise_id] = (counts[exercise_id] || 0) + 1;
        });
        setList(exerciseData || []);
        setQuestionCounts(counts);
      }).finally(() => setListLoading(false));
    }
  }, [user]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const result = signup
        ? await supabase.auth.signUp({ email: normalizedEmail, password: pw })
        : await supabase.auth.signInWithPassword({ email: normalizedEmail, password: pw });
      if (result.error) {
        setMsg({ type: 'error', text: result.error.message });
      } else if (signup && !result.data.session) {
        setMsg({ type: 'success', text: 'Account created. Check your email to confirm your account, then log in.' });
      } else if (signup) {
        setMsg({ type: 'success', text: 'Account created. You are now signed in.' });
      }
    } catch (error) {
      setMsg({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return (
    <main className="auth-shell auth-loading">
      <section className="auth-intro"><span className="eyebrow">FluentPal</span><span className="skeleton-line auth-loading-title" /><span className="skeleton-line auth-loading-copy" /></section>
      <section className="auth-card auth-loading-card"><span className="skeleton-line auth-loading-small" /><span className="skeleton-line auth-loading-heading" /><span className="skeleton-line auth-loading-input" /><span className="skeleton-line auth-loading-input" /><span className="skeleton-line auth-loading-button" /></section>
    </main>
  );

  if (!user) return (
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
        <input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" placeholder="At least 6 characters" value={pw} onChange={e => setPw(e.target.value)} minLength={6} autoComplete={signup ? 'new-password' : 'current-password'} required />
        <button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Please wait...</> : signup ? 'Create account' : 'Log in'}</button>
        {msg && <p className={`notice notice-${msg.type}`}>{msg.text}</p>}
        <p className="auth-switch">
          {signup ? 'Already have an account?' : 'New to FluentPal?'}{' '}
          <button type="button" className="text-button" onClick={() => { setSignup(!signup); setMsg(null); }}>{signup ? 'Log in' : 'Create an account'}</button>
        </p>
      </form>
    </main>
  );
  return (
    <main className="dashboard">
      <header className="topbar"><div><span className="eyebrow">FluentPal</span><h1>Your practice library</h1></div><div className="topbar-actions"><Link className="ghost-button" href="/add">Add exercise</Link>{role === 'admin' && <Link className="ghost-button" href="/admin">Progress</Link>}<button className="ghost-button" onClick={() => supabase.auth.signOut()}>Sign out</button></div></header>
      <div className="section-heading"><div className="exercise-toolbar"><div className="view-toggle" aria-label="Exercise view"><button className={view === 'list' ? 'active' : ''} aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}>&#9776;</button><button className={view === 'grid' ? 'active' : ''} aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>&#9638;</button></div><select className="level-filter" value={selectedLevel} onChange={event => setSelectedLevel(event.target.value)}><option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div><div className="section-pagination">{totalPages > 1 && <><button type="button" className="pager-button" disabled={safePage === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button><div className="pager-numbers" aria-label="Page numbers">{Array.from({ length: totalPages }, (_, index) => index + 1).map(pageNumber => <button key={pageNumber} type="button" className={`pager-page ${pageNumber === safePage ? 'active' : ''}`} onClick={() => setPage(pageNumber)} aria-current={pageNumber === safePage ? 'page' : undefined}>{pageNumber}</button>)}</div><button type="button" className="pager-button" disabled={safePage === totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Next</button></>}</div></div>
      {listLoading && <div className={`exercise-grid ${view === 'grid' ? 'exercise-grid-view' : 'exercise-list-view'}`} aria-label="Loading exercises">{Array.from({ length: view === 'grid' ? 20 : 10 }, (_, index) => <div className="skeleton-card" key={index} />)}</div>}
      {!listLoading && visibleExercises.length > 0 && (
        <>
          <div className={`exercise-grid ${view === 'grid' ? 'exercise-grid-view' : 'exercise-list-view'}`}>{paginatedExercises.map((x, index) => <article className="exercise-card" key={x.id}><Link className="exercise-card-link" href={`/exercise/${x.id}`}><span className="card-number">{String(startIndex + index + 1).padStart(2, '0')}</span><span className="exercise-card-copy"><strong>{x.title}</strong><small>{x.category || 'English practice'} • {questionCounts[x.id] ?? 0} questions</small></span><span className="exercise-card-meta"><span className={`exercise-level-badge ${x.level || 'beginner'}`}>{(x.level || 'beginner').replace(/^./, c => c.toUpperCase())}</span></span><span className="arrow" aria-hidden="true">&#8599;</span></Link>{user.id === x.owner_id && <Link className="exercise-edit-link" href={`/edit/${x.id}`} aria-label={`Edit ${x.title}`} title="Edit exercise"><span className="edit-icon" aria-hidden="true">&#9998;</span><span className="edit-label">Edit</span></Link>}</article>)}</div>
        </>
      )}
      {!listLoading && !visibleExercises.length && <div className="section-empty-state"><div className="empty-state-illustration" aria-hidden="true">📚</div><strong>No exercises for this level yet</strong><p>Try another level or add a new exercise.</p><Link className="primary-button inline-cta" href="/add">Add exercise</Link></div>}
    </main>
  );
}