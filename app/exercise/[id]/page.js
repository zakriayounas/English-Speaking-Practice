'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useAppShell } from '../../../components/AppShell';
import RichText from '../../../components/RichText';
import { formatDuration, formatTarget } from '../../../lib/format';

const scoreFeedback = [
  { max: 39, emoji: '🌱', title: 'A fresh start', message: 'Review the explanations and try the tricky questions again.' },
  { max: 69, emoji: '🌤️', title: 'Nice progress', message: 'You are building a useful foundation. Keep the phrases that challenged you.' },
  { max: 89, emoji: '⭐', title: 'Excellent work', message: 'Your practice is paying off. You have a strong command of this exercise.' },
  { max: 100, emoji: '🏆', title: 'Outstanding', message: 'Brilliant work. You have built real momentum.' },
];

export default function Exercise() {
  const { id } = useParams();
  const shell = useAppShell();
  const [exercise, setExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [elapsedByQuestion, setElapsedByQuestion] = useState({});
  const [clockNow, setClockNow] = useState(0);
  const [nextExercise, setNextExercise] = useState(null);
  const questionTimesRef = useRef({});
  const questionStartedAtRef = useRef(null);
  const attemptStartedAtRef = useRef(null);
  const targetSecondsRef = useRef(null);
  const submittedRef = useRef(false);

  const showTimer = shell?.profile?.show_timer !== false;
  const user = shell?.user || null;

  function questionPrompt(question) {
    return question.prompt || question.content?.prompt || '';
  }

  function questionOptions(question) {
    return question.content?.options || question.options || [];
  }

  function stopClock(at = Date.now()) {
    const questionId = questions[index]?.id;
    if (!questionId || questionStartedAtRef.current == null) return questionTimesRef.current;
    const updated = {
      ...questionTimesRef.current,
      [questionId]: (questionTimesRef.current[questionId] || 0) + Math.max(0, at - questionStartedAtRef.current),
    };
    questionTimesRef.current = updated;
    setElapsedByQuestion(updated);
    questionStartedAtRef.current = null;
    return updated;
  }

  function startClock(at = Date.now()) {
    if (typeof document !== 'undefined' && document.hidden) return;
    questionStartedAtRef.current = at;
    setClockNow(at);
  }

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    submittedRef.current = false;
    (async () => {
      const [{ data: loadedExercise }, { data: loadedQuestions }] = await Promise.all([
        supabase.from('exercises').select('id,title,level,visibility,target_seconds,category_id').eq('id', id).maybeSingle(),
        supabase.from('questions').select('id,position,prompt,content').eq('exercise_id', id).order('position'),
      ]);
      if (ignore) return;
      setExercise(loadedExercise);
      setQuestions(loadedQuestions || []);
      questionTimesRef.current = {};
      questionStartedAtRef.current = null;
      attemptStartedAtRef.current = new Date().toISOString();
      targetSecondsRef.current = loadedExercise?.target_seconds || null;
      setElapsedByQuestion({});
      setResult(null);
      setAnswers({});
      setIndex(0);
      setLoading(false);
    })();
    return () => { ignore = true; };
  }, [id]);

  useEffect(() => {
    if (loading || result || !questions.length) return undefined;
    startClock();
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [loading, result, questions.length, index]);

  useEffect(() => {
    if (loading || result || !questions.length) return undefined;
    function onVisibility() {
      if (document.hidden) stopClock();
      else startClock();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loading, result, questions.length, index]);

  function goToQuestion(nextIndex) {
    if (nextIndex === index || busy) return;
    stopClock();
    setIndex(nextIndex);
  }

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    setSubmitError('');
    const questionTimes = stopClock();
    const durationMs = Object.values(questionTimes).reduce((total, time) => total + time, 0);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          exerciseId: id,
          answers,
          timing: { startedAt: attemptStartedAtRef.current, durationMs, questionTimes, targetSeconds: targetSecondsRef.current },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Your answers could not be submitted.');
      submittedRef.current = true;
      setResult({ ...payload, timing: { questionTimes, totalTime: durationMs } });
      if (exercise?.category_id) {
        const { data } = await supabase.from('exercises').select('id,title').eq('category_id', exercise.category_id).neq('id', id).limit(1);
        setNextExercise(data?.[0] || payload.nextExercise || null);
      } else setNextExercise(payload.nextExercise || null);
    } catch (error) {
      submittedRef.current = false;
      setSubmitError(error.message);
      startClock();
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    submittedRef.current = false;
    questionTimesRef.current = {};
    questionStartedAtRef.current = null;
    attemptStartedAtRef.current = new Date().toISOString();
    setElapsedByQuestion({});
    setAnswers({});
    setIndex(0);
    setResult(null);
    setNextExercise(null);
  }

  if (loading || (shell && !shell.ready)) {
    return <main className="exercise-page"><div className="skeleton-card" /><div className="skeleton-card" /></main>;
  }
  if (!exercise) {
    return (
      <main className="exercise-page">
        <section className="section-empty-state">
          <strong>This exercise is unavailable</strong>
          <p>It may be for members, or it may have been removed.</p>
          {!user && <Link className="primary-button inline-cta" href={`/login?next=/exercise/${id}`}>Log in</Link>}
          <Link className="back-button" href="/exercises">Back to exercises</Link>
        </section>
      </main>
    );
  }

  if (result) {
    const scorePercent = result.max ? Math.round((result.score / result.max) * 100) : 0;
    const feedback = scoreFeedback.find(item => scorePercent <= item.max) || scoreFeedback.at(-1);
    const times = questions.map(question => result.timing.questionTimes[question.id] || 0);
    const average = questions.length ? times.reduce((total, time) => total + time, 0) / questions.length : 0;
    const slowestIndex = times.reduce((best, time, timeIndex) => time > times[best] ? timeIndex : best, 0);
    const targetLabel = formatTarget(result.targetSeconds);
    const metTarget = result.targetSeconds ? result.timing.totalTime <= result.targetSeconds * 1000 : null;
    return (
      <main className="exercise-page">
        <div className="exercise-header">
          <div>
            <span className="eyebrow">{result.publicAttempt ? 'Practice summary' : 'Saved attempt'}</span>
            <h1>{exercise.title}</h1>
          </div>
        </div>
        <section className="feedback-banner">
          <span className="feedback-emoji" role="img" aria-label={feedback.title}>{feedback.emoji}</span>
          <div><span className="kicker">Score {result.score} / {result.max}</span><h2>{feedback.title}</h2><p>{feedback.message}</p></div>
        </section>
        <div className="result-workspace">
          <section className="result-card">
            {questions.map((question, questionIndex) => {
              const review = result.review[question.id] || {};
              const options = questionOptions(question);
              return (
                <div className="result-row" key={question.id}>
                  <RichText className="question-prompt" text={`${questionIndex + 1}. ${questionPrompt(question)}`} />
                  <small>Time on question: {formatDuration(result.timing.questionTimes[question.id] || 0)}</small>
                  <div>{review.correct ? 'Correct' : 'Not quite'} — your answer: {options[answers[question.id]] ?? '(no answer)'}</div>
                  {!review.correct && <div>Answer: {options[review.answer] ?? ''}</div>}
                  <RichText className="explanation-text" text={review.explanation || ''} />
                </div>
              );
            })}
          </section>
          <aside className="progress-panel">
            <h2>Your result</h2>
            <p className="summary-time"><span>Score</span><strong>{scorePercent}%</strong></p>
            <p className="summary-time"><span>Time</span><strong>{formatDuration(result.timing.totalTime)}</strong></p>
            {targetLabel && <p className="summary-time"><span>Target {targetLabel}</span><strong>{metTarget ? 'Met' : 'Over'}</strong></p>}
            <p className="summary-time"><span>Average per question</span><strong>{formatDuration(average)}</strong></p>
            {questions[slowestIndex] && <p className="progress-copy">Slowest question: {slowestIndex + 1} ({formatDuration(times[slowestIndex])})</p>}
            <div className="result-actions">
              <button type="button" className="primary-button" onClick={retry}>Retry</button>
              {nextExercise && <Link className="ghost-button" href={`/exercise/${nextExercise.id}`}>Next: {nextExercise.title}</Link>}
            </div>
            {result.publicAttempt && <p className="progress-copy">Create an account to save this score and track your progress. <Link href={`/register?next=/exercise/${id}`}>Sign up</Link></p>}
          </aside>
        </div>
      </main>
    );
  }

  const question = questions[index];
  if (!question) return <main className="exercise-page"><p>No questions yet.</p><Link href="/exercises">Back to exercises</Link></main>;
  const active = (elapsedByQuestion[question.id] || 0) + (questionStartedAtRef.current == null ? 0 : Math.max(0, clockNow - questionStartedAtRef.current));
  const total = Object.values(elapsedByQuestion).reduce((sum, time) => sum + time, 0) + (questionStartedAtRef.current == null ? 0 : Math.max(0, clockNow - questionStartedAtRef.current));
  const targetLabel = formatTarget(exercise.target_seconds);

  return (
    <main className="exercise-page">
      <div className="exercise-header">
        <div className="exercise-title-group">
          <span className="eyebrow">Practice session</span>
          <div className="exercise-title-row">
            <Link className="back-button icon-button" href="/exercises" aria-label="Back to exercises"><span aria-hidden="true">←</span></Link>
            <h1 title={exercise.title}>{exercise.title}</h1>
          </div>
        </div>
        {showTimer && (
          <div className="exercise-header-actions">
            <strong className="progress-label">Time {formatDuration(total)}{targetLabel ? ` · Target ${targetLabel}` : ''}</strong>
          </div>
        )}
      </div>
      <div className="exercise-workspace">
        <section className="question-card">
          <div className="question-meta">
            <span>Question {index + 1}</span>
            <span>{Object.keys(answers).length} answered</span>
            {showTimer && <span>Question time {formatDuration(active)}</span>}
          </div>
          <RichText className="question-prompt" text={questionPrompt(question)} />
          {questionOptions(question).map((option, optionIndex) => (
            <label className="answer-option" key={optionIndex}>
              <input type="radio" name={`question-${question.id}`} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} />
              {option}
            </label>
          ))}
          <div className="exercise-actions">
            <button type="button" disabled={index === 0 || busy} onClick={() => goToQuestion(index - 1)}>Previous</button>
            {index < questions.length - 1
              ? <button type="button" disabled={busy} onClick={() => goToQuestion(index + 1)}>Next</button>
              : <button type="button" disabled={busy} onClick={submit}>{busy ? 'Saving...' : 'Finish'}</button>}
          </div>
          {submitError && <p className="notice notice-error" role="alert">{submitError}</p>}
        </section>
        <aside className="progress-panel">
          <h2>Question map</h2>
          <div className="question-map" aria-label="Choose a question">
            {questions.map((item, itemIndex) => (
              <button type="button" key={item.id} className={`${itemIndex === index ? 'current ' : ''}${answers[item.id] !== undefined ? 'answered' : ''}`} onClick={() => goToQuestion(itemIndex)} aria-current={itemIndex === index ? 'step' : undefined}>{itemIndex + 1}</button>
            ))}
          </div>
          {targetLabel && <p className="progress-copy">Target time is a guide. You can finish whenever you are ready.</p>}
        </aside>
      </div>
    </main>
  );
}


