'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAppShell } from '../../components/AppShell';
import { formatDate, formatDuration, formatPercent, formatTarget } from '../../lib/format';
import { ProfileProgressSkeleton, ProgressPageSkeleton } from '../../components/PageSkeletons';

export default function ProgressPage() {
  const router = useRouter();
  const shell = useAppShell();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shell?.ready || shell.user) return undefined;
    let ignore = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!ignore && !data.session) router.replace('/login?next=/progress');
    });
    return () => { ignore = true; };
  }, [shell?.ready, shell?.user, router]);

  async function loadStats() {
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your session has expired. Please sign in again to view your progress.');
        return;
      }
      const response = await fetch('/api/stats', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Progress could not be loaded.');
        return;
      }
      if (!result?.summary || !Array.isArray(result.categories) || !Array.isArray(result.chart) || !Array.isArray(result.recent)) {
        throw new Error('Progress data could not be read. Please try again.');
      }
      setStats(result);
    } catch (loadError) {
      setError(loadError.message || 'Progress could not be loaded. Please try again.');
    }
  }

  useEffect(() => {
    if (shell?.user) loadStats();
  }, [shell?.user]);

  if (!shell?.ready || !shell?.user) return <ProgressPageSkeleton />;

  const summary = stats?.summary;

  return (
    <main className="admin-page profile-page">
      <header className="author-header">
        <div>
          <h1>Progress</h1>
          <p>Review your practice, track your scores, and continue an exercise.</p>
        </div>
        <div className="admin-links">
          <Link className="back-button" href="/settings">Settings</Link>
          <Link className="primary-button" href="/exercises">Practice</Link>
        </div>
      </header>
      {error ? (
        <section className="admin-section">
          <div className="section-empty-state">
            <strong>Progress is unavailable</strong>
            <p>{error}</p>
            <button type="button" className="primary-button inline-cta" onClick={loadStats}>Retry</button>
          </div>
        </section>
      ) : !stats ? (
        <ProfileProgressSkeleton />
      ) : summary?.completed === 0 ? (
        <section className="admin-section">
          <div className="section-empty-state">
            <strong>No attempts yet</strong>
            <p>Finish an exercise and your scores will show up here.</p>
            <Link className="primary-button inline-cta" href="/exercises">Start practicing</Link>
          </div>
        </section>
      ) : (
        <>
          <div className="admin-stats">
            <div><strong>{summary.completed}</strong><span>Completed attempts</span></div>
            <div><strong>{formatPercent(summary.averageScore)}</strong><span>Average score</span></div>
            <div><strong>{formatDuration(summary.averageTimePerQuestionMs)}</strong><span>Avg time per question</span></div>
            <div><strong>{formatDuration(summary.averageTimePerAttemptMs)}</strong><span>Avg time per attempt</span></div>
          </div>
          <div className="profile-progress-sections">
            <section className="admin-section profile-chart-section">
              <div className="section-heading"><h2>Score over time</h2></div>
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
            <section className="admin-section">
              <div className="section-heading"><h2>By category</h2></div>
              {stats.categories.length ? stats.categories.map(category => {
                const categoryWidth = String(Math.round((category.averageScore || 0) * 100)) + '%';
                return (
                  <div className="category-stat" key={category.categoryId}>
                    <div><strong>{category.name}</strong><span className="category-stat-details">{category.completed} attempts <span className="category-stat-separator" aria-hidden="true">·</span> {formatPercent(category.averageScore)}</span></div>
                    <span className="level-progress" aria-hidden="true"><span style={{ width: categoryWidth }} /></span>
                  </div>
                );
              }) : <p className="progress-copy">No category data yet.</p>}
            </section>
            <section className="admin-section">
              <div className="section-heading"><h2>Recent attempts</h2></div>
              {stats.recent.map(attempt => (
                <div className="recent-attempt" key={attempt.id}>
                  <strong>{attempt.exerciseTitle}</strong>
                  <Link className="recent-attempt-retry" href={'/exercise/' + attempt.exerciseId}>Retry</Link>
                  <div className="recent-attempt-details">
                    <span>{attempt.maxScore ? attempt.score + '/' + attempt.maxScore : 'Score unavailable'}</span>
                    <span>{formatDuration(attempt.durationMs)}{formatTarget(attempt.targetSeconds) ? ' / ' + formatTarget(attempt.targetSeconds) : ''}</span>
                    <span>{formatDate(attempt.submittedAt)}</span>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
