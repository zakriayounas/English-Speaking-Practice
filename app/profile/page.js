'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAppShell } from '../../components/AppShell';
import AppSelect from '../../components/AppSelect';
import { LEARNING_GOALS, levelLabel } from '../../lib/goals';
import { formatDate, formatDuration, formatPercent, formatTarget } from '../../lib/format';
import { ProfileProgressSkeleton, ProfileSkeleton } from '../../components/PageSkeletons';

export default function ProfilePage() {
  const router = useRouter();
  const shell = useAppShell();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [goals, setGoals] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!shell?.ready || shell.user) return undefined;
    let ignore = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!ignore && !data.session) router.replace('/login?next=/profile');
    });
    return () => { ignore = true; };
  }, [shell?.ready, shell?.user, router]);

  useEffect(() => {
    setName(shell?.profile?.full_name || '');
    setLevel(shell?.profile?.english_level || '');
    setGoals(shell?.goals || []);
  }, [shell?.profile, shell?.goals]);

  async function loadStats() {
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const response = await fetch('/api/stats', { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json();
    if (!response.ok) setError(result.error || 'Progress could not be loaded.');
    else setStats(result);
  }

  useEffect(() => {
    if (shell?.user) loadStats();
  }, [shell?.user]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ full_name: name, english_level: level || null, goals }),
    });
    const result = await response.json();
    if (!response.ok) setMessage({ type: 'error', text: result.error || 'Could not save your profile.' });
    else {
      setMessage({ type: 'success', text: 'Profile saved.' });
      await shell.refreshProfile();
    }
    setBusy(false);
  }

  if (!shell?.ready || !shell?.user) return <ProfileSkeleton />;
  const initials = (shell.profile?.full_name || shell.email || '?').split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
  const summary = stats?.summary;

  return (
    <main className="dashboard">
      <header className="profile-header">
        <div className="avatar" aria-hidden="true">{initials}</div>
        <div>
          <h1>{shell.profile?.full_name || 'Your profile'}</h1>
          <p className="secondary-email">{shell.email}</p>
          <p>{levelLabel(shell.profile?.english_level)} · Member since {formatDate(shell.profile?.created_at)}</p>
        </div>
      </header>
      <div className="profile-layout">
        <form className="edit-exercise-card profile-form" onSubmit={save}>
          <h2>Edit profile</h2>
          <div className="profile-fields">
            <label htmlFor="profile-name">Full name<input id="profile-name" value={name} onChange={event => setName(event.target.value)} required /></label>
            <AppSelect instanceId="profile-level" inputId="profile-level" label="English level" options={[{ value: '', label: 'Not sure yet' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={level} onChange={setLevel} />
            <AppSelect instanceId="profile-goals" inputId="profile-goals" label="Learning goals" options={LEARNING_GOALS} isMulti value={goals} onChange={setGoals} />
          </div>
          <button className="primary-button profile-save" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</button>
          {message && <p className={`notice notice-${message.type}`} role="status">{message.text}</p>}
        </form>
        {!stats && !error ? <ProfileProgressSkeleton /> : <div className="profile-progress">
          {error && <div className="section-empty-state"><strong>Progress is unavailable</strong><p>{error}</p><button type="button" className="primary-button inline-cta" onClick={loadStats}>Retry</button></div>}
          {stats && summary?.completed === 0 && <div className="section-empty-state"><strong>No attempts yet</strong><p>Finish an exercise and your scores will show up here.</p><Link className="primary-button inline-cta" href="/exercises">Start practicing</Link></div>}
          {stats && summary?.completed > 0 && (
            <>
              <div className="admin-stats">
                <div><strong>{summary.completed}</strong><span>Completed attempts</span></div>
                <div><strong>{formatPercent(summary.averageScore)}</strong><span>Average score</span></div>
                <div><strong>{formatDuration(summary.averageTimePerQuestionMs)}</strong><span>Avg time per question</span></div>
                <div><strong>{formatDuration(summary.averageTimePerAttemptMs)}</strong><span>Avg time per attempt</span></div>
              </div>
              <section className="edit-exercise-card">
                <h2>Score over time</h2>
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={stats.chart}>
                      <XAxis dataKey="date" tickFormatter={value => formatDate(value).split(',')[0]} stroke="#697572" />
                      <YAxis domain={[0, 100]} stroke="#697572" />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#1C6B59" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="edit-exercise-card">
                <h2>By category</h2>
                {stats.categories.map(category => (
                  <div className="category-stat" key={category.categoryId}>
                    <div><strong>{category.name}</strong><span>{category.completed} attempts · {formatPercent(category.averageScore)}</span></div>
                    <span className="level-progress" aria-hidden="true"><span style={{ width: `${Math.round((category.averageScore || 0) * 100)}%` }} /></span>
                  </div>
                ))}
              </section>
              <section className="edit-exercise-card">
                <h2>Recent attempts</h2>
                {stats.recent.map(attempt => (
                  <div className="recent-attempt" key={attempt.id}>
                    <strong>{attempt.exerciseTitle}</strong>
                    <span>{attempt.maxScore ? `${attempt.score}/${attempt.maxScore}` : 'Score unavailable'}</span>
                    <span>{formatDuration(attempt.durationMs)}{formatTarget(attempt.targetSeconds) ? ` / ${formatTarget(attempt.targetSeconds)}` : ''}</span>
                    <span>{formatDate(attempt.submittedAt)}</span>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>}
      </div>
    </main>
  );
}
