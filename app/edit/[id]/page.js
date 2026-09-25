'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function EditExercise() {
  const { id } = useParams();
  const router = useRouter();
  const [exercise, setExercise] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('English practice');
  const [level, setLevel] = useState('beginner');
  const [questions, setQuestions] = useState([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    async function loadExercise() {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/exercises?id=${id}`, { headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Unable to load this exercise.' });
        setBusy(false);
        return;
      }
      setExercise(result.exercise);
      setTitle(result.exercise.title);
      setCategory(result.exercise.category || 'English practice');
      setLevel(result.exercise.level || 'beginner');
      setQuestions(result.questions);
      setBusy(false);
    }
    if (id) loadExercise();
  }, [id]);

  function updateQuestion(index, field, value) {
    setQuestions(current => current.map((question, questionIndex) => questionIndex === index ? { ...question, [field]: value } : question));
  }

  function removeQuestion(index) {
    setQuestions(current => current.filter((_, questionIndex) => questionIndex !== index));
  }

  function confirmQuestionDelete() {
    removeQuestion(questionToDelete);
    setQuestionToDelete(null);
  }

  function addQuestion() {
    setQuestions(current => [...current, { prompt: '', options: ['', '', '', ''], answer: 'A', explanation: '' }]);
  }

  async function saveExercise(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/exercises', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ id, title, category, level, published: exercise.published, questions }) });
    const result = await response.json();
    setMessage(response.ok ? { type: 'success', text: 'Exercise changes saved.' } : { type: 'error', text: result.error || 'Unable to save changes.' });
    setBusy(false);
  }

  async function deleteExercise() {
    setBusy(true);
    setConfirmDelete(false);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/exercises?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
    const result = await response.json();
    if (!response.ok) {
      setMessage({ type: 'error', text: result.error || 'Unable to delete this exercise.' });
      setBusy(false);
      return;
    }
    router.push('/');
  }

  if (busy && !exercise) return <main className="author-page"><header className="author-header skeleton-edit-header"><div><span className="skeleton-line edit-loading-label" /><span className="skeleton-line edit-loading-title" /><span className="skeleton-line edit-loading-copy" /></div><span className="skeleton-line edit-loading-back" /></header><section className="edit-exercise-card edit-loading-card"><div className="skeleton-line edit-loading-kicker" /><div className="edit-loading-details"><span className="skeleton-line edit-loading-input" /><span className="skeleton-line edit-loading-input" /><span className="skeleton-line edit-loading-input" /></div><div className="edit-loading-save"><span className="skeleton-line edit-loading-button" /></div><div className="edit-loading-questions-heading"><span className="skeleton-line edit-loading-kicker" /><span className="skeleton-line edit-loading-add" /></div><div className="edit-loading-question-list"><span className="skeleton-line edit-loading-question" /><span className="skeleton-line edit-loading-question" /><span className="skeleton-line edit-loading-question" /></div><div className="edit-loading-save edit-loading-bottom"><span className="skeleton-line edit-loading-button" /></div></section></main>;
  if (!exercise) return <main className="author-page"><section className="section-empty-state"><strong>{message?.text || 'Exercise unavailable'}</strong><Link className="back-button" href="/">Back to library</Link></section></main>;

  return <main className="author-page">
    <header className="author-header"><div><span className="eyebrow">Exercise studio</span><h1>Edit exercise</h1><p>Update the title, level, and questions. Changes apply only to exercises you created.</p></div><Link className="back-link back-button icon-button" href="/" aria-label="Back to library" title="Back to library"><span aria-hidden="true">&#8592;</span></Link></header>
    <form className="edit-exercise-card" onSubmit={saveExercise}>
      <div className="edit-exercise-heading"><span className="kicker">Exercise details</span></div>
      <div className="edit-details-grid"><label>Title<input value={title} onChange={event => setTitle(event.target.value)} required /></label><label>Category<input value={category} onChange={event => setCategory(event.target.value)} /></label><label>Level<select value={level} onChange={event => setLevel(event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div>
      <div className="edit-actions"><button className="primary-button" disabled={busy || !questions.length}>{busy ? 'Saving...' : 'Save changes'}</button></div>
      <div className="edit-questions-heading"><div><span className="kicker">Questions</span><h2>{questions.length} questions</h2></div><button type="button" className="ghost-button" onClick={addQuestion}>Add question</button></div>
      <div className="edit-question-list">{questions.map((question, index) => <details className="edit-question" key={question.id || `new-${index}`} open={index === 0}><summary><strong>Q {index + 1}</strong><span className="question-preview">{question.prompt || 'Untitled question'}</span><button type="button" className="remove-button question-delete-button" aria-label={`Delete question ${index + 1}`} title="Delete question" onClick={event => { event.preventDefault(); event.stopPropagation(); setQuestionToDelete(index); }}>&#128465;</button><span className="collapse-indicator" aria-hidden="true" /></summary><div className="edit-question-fields"><label>Prompt<textarea value={question.prompt} onChange={event => updateQuestion(index, 'prompt', event.target.value)} rows={3} required /></label><label>Options<input value={question.options.join(' | ')} onChange={event => updateQuestion(index, 'options', event.target.value.split('|').map(option => option.trim()))} required /></label><label>Correct answer<input value={question.answer} onChange={event => updateQuestion(index, 'answer', event.target.value)} required /></label><label>Explanation<textarea value={question.explanation} onChange={event => updateQuestion(index, 'explanation', event.target.value)} rows={2} /></label></div></details>)}</div>
      <div className="edit-actions edit-actions-bottom"><button type="button" className="danger-button" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete exercise</button><button className="primary-button" disabled={busy || !questions.length}>{busy ? 'Saving...' : 'Save changes'}</button></div>
    </form>
    {message && <div className={`toast toast-${message.type}`} role="status"><span>{message.text}</span><button type="button" aria-label="Dismiss notification" onClick={() => setMessage(null)}>&times;</button></div>}
    {questionToDelete !== null && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="question-delete-title" aria-describedby="question-delete-description"><span className="kicker">Remove question</span><h2 id="question-delete-title">Delete Q {questionToDelete + 1}?</h2><p id="question-delete-description">This question will be removed from the exercise when you save your changes.</p><div className="confirm-actions"><button type="button" className="back-button" onClick={() => setQuestionToDelete(null)}>Cancel</button><button type="button" className="danger-button" onClick={confirmQuestionDelete}>Delete question</button></div></section></div>}
    {confirmDelete && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><span className="kicker">Permanent action</span><h2 id="delete-title">Delete this exercise?</h2><p id="delete-description">This will permanently remove the exercise and its questions. This action cannot be undone.</p><div className="confirm-actions"><button type="button" className="back-button" onClick={() => setConfirmDelete(false)}>Cancel</button><button type="button" className="danger-button" onClick={deleteExercise}>Delete exercise</button></div></section></div>}
  </main>;
}
