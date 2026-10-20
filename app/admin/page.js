'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import AppSelect from '../../components/AppSelect';
import { formatDuration } from '../../lib/format';

function formatAttemptDate(value) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';
}

function truncateExerciseTitle(title, maxLength = 25) {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length <= maxLength) return trimmedTitle;

  const words = trimmedTitle.split(/\s+/);
  let result = '';
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (candidate.length > maxLength) break;
    result = candidate;
  }

  return `${result || words[0]}...`;
}

export default function Admin() {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [attemptHistory, setAttemptHistory] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const historyRequestId = useRef(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (level) params.set('level', level);
      const response = await fetch(`/api/progress${params.toString() ? `?${params}` : ''}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const result = await response.json();
      if (ignore) return;
      if (!response.ok) setError(result.error);
      else { setError(''); setData(result); }
    })();
    return () => { ignore = true; };
  }, [category, level]);

  async function loadAttemptHistory(target, offset = 0) {
    const requestId = ++historyRequestId.current;
    const append = offset > 0;
    if (append) setHistoryLoadingMore(true);
    else setHistoryLoading(true);
    setHistoryError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ [target.kind]: target.id, offset: String(offset) });
      const response = await fetch(`/api/progress?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load attempt history');
      if (requestId !== historyRequestId.current) return;
      setHistoryRows(current => append ? [...current, ...result.attempts] : result.attempts);
      setHistoryHasMore(result.hasMore);
    } catch (historyLoadError) {
      if (requestId === historyRequestId.current) {
        setHistoryError(historyLoadError.message || 'Could not load attempt history');
      }
    } finally {
      if (requestId === historyRequestId.current) {
        setHistoryLoading(false);
        setHistoryLoadingMore(false);
      }
    }
  }

  function openAttemptHistory(kind, id, title) {
    const target = { kind, id, title };
    setAttemptHistory(target);
    setHistoryRows([]);
    setHistoryHasMore(false);
    loadAttemptHistory(target);
  }

  function closeAttemptHistory() {
    historyRequestId.current += 1;
    setAttemptHistory(null);
    setHistoryLoading(false);
    setHistoryLoadingMore(false);
  }

  useEffect(() => {
    if (!attemptHistory) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') closeAttemptHistory();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attemptHistory]);

  if (error) {
    return (
      <main className="admin-page">
        <p className="notice notice-error">{error}</p>
        <Link className="back-link back-button" href="/">Back to library</Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="admin-page">
        <header className="author-header">
          <div>
            <span className="eyebrow skeleton-line admin-skeleton-label" />
            <h1 className="skeleton-line admin-skeleton-title" />
            <div className="skeleton-line admin-skeleton-copy" />
          </div>
          <div className="admin-links">
            <span className="skeleton-line admin-skeleton-button" />
            <span className="skeleton-line admin-skeleton-button small" />
          </div>
        </header>
        <div className="admin-stats">
          <div className="skeleton-card admin-stat-skeleton" />
          <div className="skeleton-card admin-stat-skeleton" />
          <div className="skeleton-card admin-stat-skeleton" />
        </div>
        {Array.from({ length: 2 }, (_, index) => (
          <section className="admin-section" key={index}>
            <div className="section-heading">
              <span className="skeleton-line admin-section-heading" />
            </div>
            <div className="admin-table">
              <div className="skeleton-line admin-row-skeleton" />
              <div className="skeleton-line admin-row-skeleton" />
              <div className="skeleton-line admin-row-skeleton" />
            </div>
          </section>
        ))}
      </main>
    );
  }

  const learnerRows = [...(data.learners || [])].sort((a, b) => b.average - a.average);
  const rankedLearnerPositions = new Map(
    learnerRows
      .filter(learner => learner.attempts > 0)
      .slice(0, 3)
      .map((learner, index) => [learner.id, index + 1]),
  );
  const learnerMedals = ['🥇', '🥈', '🥉'];
  const exerciseProgressRows = [...(data.exerciseProgress || [])]
    .sort((a, b) => b.attempt_count - a.attempt_count);

  return (
    <main className="admin-page">
      <header className="author-header">
        <div>
          <h1>Learning progress</h1>
          <p>See who is practicing, how often, and which exercises are available.</p>
        </div>
        <div className="admin-links">
          <Link className="back-link back-button" href="/">Library</Link>
        </div>
      </header>
      <div className="admin-stats">
        <div><strong>{data.learnerCount}</strong><span>Learners</span></div>
        <div><strong>{data.totalAttempts}</strong><span>Total attempts</span></div>
        <div><strong>{data.exercises.length}</strong><span>Exercises</span></div>
      </div>
      <section className="admin-section">
        <div className="section-heading admin-progress-heading">
          <h2>Learner progress</h2>
          <div className="admin-filters">
            <AppSelect instanceId="admin-category" inputId="admin-category" ariaLabel="Filter learner progress by category" options={[{ value: '', label: 'All categories' }, ...(data.categories || []).map(item => ({ value: item.slug, label: item.name }))]} value={category} onChange={setCategory} />
            <AppSelect instanceId="admin-level" inputId="admin-level" ariaLabel="Filter learner progress by level" options={[{ value: '', label: 'All levels' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={level} onChange={setLevel} />
          </div>
        </div>
        {learnerRows.length ? (
          <div className="admin-table" role="table" aria-label="Learner progress">
            <div className="admin-row admin-row-header admin-row-progress-columns" role="row">
              <span role="columnheader">Learner</span>
              <span role="columnheader">Attempts</span>
              <span role="columnheader">Average score</span>
              <span role="columnheader">Avg / question</span>
              <span role="columnheader">Avg / attempt</span>
              <span role="columnheader">History</span>
            </div>
            {learnerRows.map(learner => (
              <div className="admin-row admin-row-progress-columns" role="row" key={learner.id}>
                <div className="learner-name-cell" role="cell">
                  <span className="learner-name-line">
                    <span
                      className="learner-medal"
                      aria-label={rankedLearnerPositions.has(learner.id) ? `Rank ${rankedLearnerPositions.get(learner.id)}` : undefined}
                      aria-hidden={!rankedLearnerPositions.has(learner.id)}
                    >
                      {rankedLearnerPositions.has(learner.id) ? learnerMedals[rankedLearnerPositions.get(learner.id) - 1] : ''}
                    </span>
                    <strong>{learner.full_name || 'Learner'}</strong>
                  </span>
                  {learner.email && <small className="secondary-email">{learner.email}</small>}
                </div>
                <span role="cell">{learner.attempts}</span>
                <span role="cell">{learner.average}%</span>
                <span role="cell">{formatDuration(learner.averageQuestionMs)}</span>
                <span role="cell">{formatDuration(learner.averageAttemptMs)}</span>
                <span role="cell">
                  {learner.attempts > 0 && (
                    <button className="attempt-history-trigger" type="button" onClick={() => openAttemptHistory('userId', learner.id, learner.full_name || 'Learner')}>
                      View all
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="section-empty-state">
            <div className="empty-state-illustration" aria-hidden="true">📈</div>
            <strong>No learner activity yet</strong>
            <p>As learners practice, their progress and averages will appear here.</p>
          </div>
        )}
      </section>
      <section className="admin-section">
        <div className="section-heading admin-progress-heading">
          <h2>Exercise progress</h2>
          <div className="admin-filters">
            <AppSelect instanceId="admin-exercise-category" inputId="admin-exercise-category" ariaLabel="Filter exercise progress by category" options={[{ value: '', label: 'All categories' }, ...(data.categories || []).map(item => ({ value: item.slug, label: item.name }))]} value={category} onChange={setCategory} />
            <AppSelect instanceId="admin-exercise-level" inputId="admin-exercise-level" ariaLabel="Filter exercise progress by level" options={[{ value: '', label: 'All levels' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={level} onChange={setLevel} />
          </div>
        </div>
        {exerciseProgressRows.length ? (
          <div className="admin-table" role="table" aria-label="Exercise progress">
            <div className="admin-row admin-row-header admin-row-six-columns" role="row">
              <span role="columnheader">Exercise</span>
              <span role="columnheader">Attempts</span>
              <span role="columnheader">Average score</span>
              <span role="columnheader">Leading scorer</span>
              <span role="columnheader">Last attempt</span>
              <span role="columnheader">History</span>
            </div>
            {exerciseProgressRows.map(exercise => (
              <div className="admin-row admin-row-six-columns" role="row" key={exercise.exercise_id}>
                <strong role="cell" title={exercise.title}>
                  {exercise.available
                    ? <Link className="admin-exercise-link" href={`/exercise/${exercise.exercise_id}`}>{truncateExerciseTitle(exercise.title)}</Link>
                    : truncateExerciseTitle(exercise.title)}
                </strong>
                <span role="cell">{exercise.attempt_count}</span>
                <span role="cell">{exercise.average_score}%</span>
                <span role="cell">{exercise.leading_score}% - {exercise.leading_scorer}</span>
                <span role="cell">{formatAttemptDate(exercise.last_attempt_at)}</span>
                <span role="cell">
                  {exercise.attempt_count > 0 && (
                    <button className="attempt-history-trigger" type="button" onClick={() => openAttemptHistory('exerciseId', exercise.exercise_id, exercise.title)}>
                      View all
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="section-empty-state">
            <div className="empty-state-illustration" aria-hidden="true">🎯</div>
            <strong>No exercise attempts yet</strong>
            <p>Once exercises are completed, their attempt counts and scores will appear here.</p>
          </div>
        )}
      </section>
      {attemptHistory && (
        <div className="attempt-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) closeAttemptHistory();
        }}>
          <section className="attempt-modal" role="dialog" aria-modal="true" aria-labelledby="attempt-modal-title">
            <header className="attempt-modal-header">
              <div>
                <h2 id="attempt-modal-title">Attempt history - {attemptHistory.title}</h2>
              </div>
              <button className="attempt-modal-close" type="button" onClick={closeAttemptHistory} aria-label="Close attempt history">×</button>
            </header>
            {historyError && <p className="notice notice-error" role="alert">{historyError}</p>}
            {historyLoading ? (
              <p className="attempt-history-status">Loading attempts...</p>
            ) : historyRows.length ? (
              <>
                <div className="attempt-history-table" role="table" aria-label={`${attemptHistory.title} attempts`}>
                  <div className="attempt-history-row attempt-history-header" role="row">
                    <span role="columnheader">Date</span>
                    {attemptHistory.kind === 'userId'
                      ? <span role="columnheader">Exercise</span>
                      : <span role="columnheader">Learner</span>}
                    <span role="columnheader">Score</span>
                  </div>
                  {historyRows.map(attempt => (
                    <div className="attempt-history-row" role="row" key={attempt.id}>
                      <span role="cell">{formatAttemptDate(attempt.submitted_at)}</span>
                      {attemptHistory.kind === 'userId'
                        ? <span role="cell" title={attempt.exercise_title}>{truncateExerciseTitle(attempt.exercise_title)}</span>
                        : <span role="cell">{attempt.learner_name}</span>}
                      <strong role="cell">
                        {attempt.percentage === null
                          ? 'Score unavailable'
                          : `${attempt.score ?? 0} / ${attempt.max_score} (${attempt.percentage}%)`}
                      </strong>
                    </div>
                  ))}
                </div>
                {historyLoadingMore && <p className="attempt-history-status">Loading more attempts...</p>}
                {historyHasMore && !historyLoadingMore && (
                  <button className="attempt-history-more" type="button" onClick={() => loadAttemptHistory(attemptHistory, historyRows.length)}>
                    Load more
                  </button>
                )}
              </>
            ) : !historyError ? (
              <p className="attempt-history-status">No attempts found.</p>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
