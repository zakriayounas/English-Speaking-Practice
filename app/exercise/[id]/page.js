'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

const scoreFeedback = [
  { max: 9, emoji: '🌱', title: 'A fresh start', message: 'Every attempt builds your English. Review the answers and try again when you are ready.' },
  { max: 19, emoji: '🧭', title: 'Keep finding your way', message: 'You have started the journey. A little more practice will make these phrases familiar.' },
  { max: 29, emoji: '🔎', title: 'Keep exploring', message: 'You are noticing new patterns. Focus on one phrase at a time and keep moving forward.' },
  { max: 39, emoji: '🛠️', title: 'Building your skills', message: 'Your practice is taking shape. Review the tricky answers and give this set another go.' },
  { max: 49, emoji: '🚀', title: 'Almost halfway there', message: 'You are close to the next milestone. A focused review can make a big difference.' },
  { max: 59, emoji: '🌤️', title: 'Nice progress', message: 'You are building a useful foundation. Keep practicing to make these phrases stick.' },
  { max: 69, emoji: '💪', title: 'Strong work', message: 'Your confidence is growing. Keep this rhythm and the next level is within reach.' },
  { max: 79, emoji: '🎉', title: 'Great job', message: 'You handled most of the exercise very well. Keep sharpening the few phrases that challenged you.' },
  { max: 89, emoji: '⭐', title: 'Excellent work', message: 'Your practice is paying off. You have a strong command of this exercise.' },
  { max: 100, emoji: '🏆', title: 'Outstanding', message: 'Brilliant work. You have mastered this exercise and built real momentum.' },
];

export default function Exercise() {
  const { id } = useParams();
  const [ex, setEx] = useState(null), [qs, setQs] = useState([]), [i, setI] = useState(0);
  const [ans, setAns] = useState({}), [res, setRes] = useState(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [user, setUser] = useState(null), [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    setLoading(true);
    (async () => {
      const { data: e } = await supabase.from('exercises').select('title').eq('id', id).single();
      setEx(e);
      const { data: q } = await supabase.from('questions').select('id,content').eq('exercise_id', id).order('position');
      setQs(q || []);
      setLoading(false);
    })();
    return () => authListener.subscription.unsubscribe();
  }, [id]);

  async function submit() {
    setBusy(true);
    setSubmitError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        setRes({ localOnly: true });
        return;
      }
      const r = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ exerciseId: id, answers: ans }),
      });
      const result = await r.json();
      if (r.ok) setRes(result);
      else setSubmitError(result.error || 'Your answers could not be submitted. Please try again.');
    } catch {
      setSubmitError('Your answers could not be submitted. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || authLoading) return <main className="exercise-page"><div className="exercise-header skeleton-header"><div><span className="skeleton-line skeleton-label" /><span className="skeleton-line skeleton-title" /></div><span className="skeleton-line skeleton-progress" /></div><section className="question-card skeleton-question"><span className="skeleton-line skeleton-prompt" />{Array.from({ length: 6 }, (_, index) => <span className="skeleton-line skeleton-option" key={index} />)}</section></main>;
  if (!ex) return <main className="exercise-page"><p>Exercise not found.</p>{user && <Link href="/">Back to exercises</Link>}</main>;
  if (res) {
    const localOnly = res.localOnly;
    const scorePercent = res.max ? Math.round((res.score / res.max) * 100) : 0;
    const feedback = localOnly
      ? { emoji: '📝', title: 'Practice complete', message: 'This local summary has not been sent or saved. Sign in to check your answers and track progress.' }
      : scoreFeedback.find(item => scorePercent <= item.max) || scoreFeedback[scoreFeedback.length - 1];
    const answeredCount = Object.keys(ans).length;
    const correctCount = localOnly ? answeredCount : qs.filter(question => res.review[question.id]?.correct).length;
    const incorrectCount = localOnly ? qs.length - answeredCount : qs.length - correctCount;
    return (
    <main className="exercise-page">
      <div className="exercise-header"><div className="exercise-title-group"><span className="eyebrow">{localOnly ? 'Local summary' : 'Session complete'}</span><div className="exercise-title-row">{user && <Link className="back-button icon-button" href="/" aria-label="Back to exercises" title="Back to exercises"><span aria-hidden="true">&#8592;</span></Link>}<h1>{ex.title}</h1></div></div><div className="exercise-header-actions">{localOnly ? <strong className="progress-label">Not submitted</strong> : <strong className="progress-label">Score: {res.score} / {res.max}</strong>}</div></div>
      <section className="feedback-banner"><span className="feedback-emoji" role="img" aria-label={feedback.title}>{feedback.emoji}</span><div><span className="kicker">You finished the exercise</span><h2>{feedback.title}</h2><p>{feedback.message}</p></div></section>
      <div className="result-workspace"><section className="result-card">
      {qs.map((q, n) => {
        const r = localOnly ? null : res.review[q.id];
        return (
          <div className="result-row" key={q.id}>
            <b>{n + 1}. {q.content.prompt}</b><br />
            {localOnly ? <>Your answer: {q.content.options[ans[q.id]] ?? '(no answer)'}</> : <>{r.correct ? '✅' : '❌'} Your answer: {q.content.options[ans[q.id]] ?? '(no answer)'}<br />{!r.correct && <>Correct: {q.content.options[r.answer]}<br /></> }<small>{r.explanation}</small></>}
          </div>
        );
      })}
      </section><aside className="progress-panel score-panel"><div className="progress-panel-heading"><div><span className="kicker">{localOnly ? 'Answer summary' : 'Final result'}</span><h2>{localOnly ? 'Your answers' : 'Your score'}</h2></div>{!localOnly && <div className="progress-ring" style={{ '--progress': `${scorePercent}%` }}><strong>{scorePercent}%</strong></div>}</div><p className="progress-copy">{localOnly ? `${answeredCount} of ${qs.length} questions answered. Your answers remain on this device.` : `You scored ${res.score} out of ${res.max} points.`}</p><div className="result-counts"><span className="correct-count"><strong>{localOnly ? answeredCount : correctCount}</strong>{localOnly ? 'Answered' : 'Correct'}</span><span className="incorrect-count"><strong>{incorrectCount}</strong>{localOnly ? 'Unanswered' : 'Incorrect'}</span></div><div className="question-map result-map" aria-label={localOnly ? 'Answer status' : 'Question results'}>{qs.map((question, index) => <span className={localOnly ? (ans[question.id] !== undefined ? 'result-correct' : 'result-incorrect') : (res.review[question.id]?.correct ? 'result-correct' : 'result-incorrect')} key={question.id}>{index + 1}</span>)}</div><div className="progress-legend"><span><i className="legend-dot answered-dot" />{localOnly ? 'Answered' : 'Correct'}</span><span><i className="legend-dot incorrect-dot" />{localOnly ? 'Unanswered' : 'Incorrect'}</span></div></aside></div>
    </main>
    );
  }
  const q = qs[i];
  if (!q) return <main className="exercise-page"><p>No questions yet.</p>{user && <Link href="/">Back to exercises</Link>}</main>;
  const answeredCount = Object.keys(ans).length;
  return (
    <main className="exercise-page">
      <div className="exercise-header"><div className="exercise-title-group"><span className="eyebrow">Practice session</span><div className="exercise-title-row">{user && <Link className="back-button icon-button" href="/" aria-label="Back to exercises" title="Back to exercises"><span aria-hidden="true">&#8592;</span></Link>}<h1>{ex.title}</h1></div></div></div>
      <div className="exercise-workspace">
        <section className="question-card">
          <div className="question-meta"><span>Question {i + 1}</span><span>{answeredCount} answered</span></div>
          <h2>{q.content.prompt}</h2>
          {q.content.options.map((o, k) => (
            <label className="answer-option" key={k}>
              <input type="radio" name={`question-${q.id}`} checked={ans[q.id] === k} onChange={() => setAns({ ...ans, [q.id]: k })} /> {o}
            </label>
          ))}
          <div className="exercise-actions"><button disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>{i < qs.length - 1 ? <button onClick={() => setI(i + 1)}>Next</button> : <button disabled={busy} onClick={submit}>{busy ? <><span className="spinner" aria-hidden="true" />{user ? 'Submitting...' : 'Finishing...'}</> : user ? 'Submit' : 'Finish'}</button>}</div>
          {submitError && <p role="alert">{submitError}</p>}
        </section>
        <aside className="progress-panel">
          <div className="progress-panel-heading"><div><span className="kicker">Session in progress</span><h2>Question map</h2></div></div>
          <p className="progress-copy">{answeredCount} of {qs.length} answered. Choose any question to review or change your answer.</p>
          <div className="question-map" aria-label="Choose a question">{qs.map((question, index) => <button className={`${index === i ? 'current ' : ''}${ans[question.id] !== undefined ? 'answered' : ''}`} key={question.id} onClick={() => setI(index)} aria-label={`Go to question ${index + 1}`} aria-current={index === i ? 'step' : undefined}>{index + 1}</button>)}</div>
          <div className="progress-legend"><span><i className="legend-dot answered-dot" />Attempted</span><span><i className="legend-dot" />Not started</span></div>
        </aside>
      </div>
    </main>
  );
}
