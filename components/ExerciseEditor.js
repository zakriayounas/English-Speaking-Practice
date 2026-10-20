'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { parseExercise, applyCategory } from '../lib/exercise-parse';
import { validateExercise } from '../lib/exercise-validate';
import { useAppShell } from './AppShell';
import AppSelect from './AppSelect';

const emptyQuestion = () => ({ prompt: '', options: ['', '', '', ''], answer: 'A', explanation: '' });

function errorFor(errors, path) {
  return errors.find(error => error.path === path)?.message || '';
}

export default function ExerciseEditor({ mode = 'create', exerciseId = '' }) {
  const router = useRouter();
  const shell = useAppShell();
  const snapshot = useRef('');
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState('');
  const [targetMinutes, setTargetMinutes] = useState('');
  const [visibility, setVisibility] = useState('members');
  const [questions, setQuestions] = useState([]);
  const [paste, setPaste] = useState('');
  const [file, setFile] = useState(null);
  const [sample, setSample] = useState('');
  const [sampleFormat, setSampleFormat] = useState('txt');
  const [sampleError, setSampleError] = useState('');
  const [pasteMode, setPasteMode] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [imported, setImported] = useState(mode === 'edit');
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(mode === 'edit');
  const [loading, setLoading] = useState(mode === 'edit');
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = { title, categoryId, level, targetMinutes, visibility, questions };

  useEffect(() => {
    supabase.from('categories').select('id,slug,name').eq('active', true).order('sort_order')
      .then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!pasteMode) return undefined;
    let ignore = false;
    async function loadSample() {
      if (sampleFormat === 'docx') return;
      setSampleError('');
      try {
        const response = await fetch(`/templates/exercise.${sampleFormat}`);
        if (!response.ok) throw new Error('The example could not be loaded.');
        const text = await response.text();
        if (!ignore) setSample(text);
      } catch (loadError) {
        if (!ignore) setSampleError(loadError.message);
      }
    }
    loadSample();
    return () => { ignore = true; };
  }, [pasteMode, sampleFormat]);

  useEffect(() => {
    if (mode !== 'edit' || !exerciseId) return undefined;
    let ignore = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/exercises?id=${exerciseId}`, { headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      const result = await response.json();
      if (ignore) return;
      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Unable to load this exercise.' });
        setLoading(false);
        setBusy(false);
        return;
      }
      setTitle(result.exercise.title || '');
      setCategoryId(result.exercise.category_id || '');
      setLevel(result.exercise.level || '');
      setTargetMinutes(result.exercise.target_seconds ? String(result.exercise.target_seconds / 60) : '');
      setVisibility(result.exercise.visibility || 'members');
      setQuestions(result.questions || []);
      snapshot.current = JSON.stringify({
        title: result.exercise.title || '',
        categoryId: result.exercise.category_id || '',
        level: result.exercise.level || '',
        targetMinutes: result.exercise.target_seconds ? String(result.exercise.target_seconds / 60) : '',
        visibility: result.exercise.visibility || 'members',
        questions: result.questions || [],
      });
      setLoading(false);
      setBusy(false);
    })();
    return () => { ignore = true; };
  }, [mode, exerciseId]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onLeave = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (mode === 'create') setDirty(Boolean(title || categoryId || level || targetMinutes || questions.length || paste));
    else if (snapshot.current) setDirty(JSON.stringify(form) !== snapshot.current);
  }, [title, categoryId, level, targetMinutes, visibility, questions, paste, mode]);

  function updateQuestion(index, field, value) {
    setQuestions(current => current.map((question, questionIndex) => questionIndex === index ? { ...question, [field]: value } : question));
  }

  function updateOption(index, optionIndex, value) {
    setQuestions(current => current.map((question, questionIndex) => {
      if (questionIndex !== index) return question;
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  }

  function chooseFile(selectedFile) {
    if (selectedFile) setFile(selectedFile);
    setDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0]);
  }

  function downloadTemplate(format) {
    setDownloadOpen(false);
    window.location.href = `/api/exercises/template?format=${format}`;
  }

  async function importContent(event, source) {
    event?.preventDefault();
    if (source === 'file' && !file) return;
    if (source !== 'file' && !paste.trim()) {
      setMessage({ type: 'error', text: 'Paste a template before previewing questions.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const body = new FormData();
    if (source === 'file') body.append('file', file);
    else body.append('text', paste);
    const response = await fetch('/api/exercises/parse', { method: 'POST', body });
    const result = await response.json();
    if (!response.ok) {
      setMessage({ type: 'error', text: result.errors?.map(item => item.line ? `Line ${item.line}: ${item.message}` : item.message).join(' ') || result.error });
      setBusy(false);
      return;
    }
    const parsed = applyCategory({ ok: true, errors: [], exercise: result }, categories);
    if (!parsed.ok) {
      setMessage({ type: 'error', text: parsed.errors.map(item => item.message).join(' ') });
      setBusy(false);
      return;
    }
    setTitle(parsed.exercise.title);
    setCategoryId(parsed.exercise.categoryId);
    setLevel(parsed.exercise.level);
    setTargetMinutes(parsed.exercise.targetMinutes === '' ? '' : String(parsed.exercise.targetMinutes));
    setVisibility(parsed.exercise.visibility || 'members');
    setQuestions(parsed.exercise.questions.map(question => ({ ...question, options: [...question.options, '', '', '', ''].slice(0, 4) })));
    setErrors([]);
    setImported(true);
    setMessage({ type: 'success', text: 'Review the questions below before saving.' });
    setBusy(false);
  }

  async function saveExercise(event) {
    event.preventDefault();
    const validated = validateExercise({ ...form, targetMinutes: targetMinutes === '' ? '' : Number(targetMinutes) }, categories);
    setErrors(validated.errors);
    if (!validated.ok) {
      setMessage({ type: 'error', text: 'Fix the highlighted fields before saving.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/exercises', {
      method: mode === 'edit' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(mode === 'edit' ? { id: exerciseId, ...validated.exercise } : validated.exercise),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage({ type: 'error', text: result.error || 'Unable to save this exercise.' });
      setBusy(false);
      return;
    }
    if (mode === 'create') {
      setTitle('');
      setCategoryId('');
      setLevel('');
      setTargetMinutes('');
      setVisibility('members');
      setQuestions([]);
      setPaste('');
      setFile(null);
      setErrors([]);
      setDirty(false);
      setImported(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setMessage({ type: 'success', text: 'Exercise saved.' });
    } else {
      snapshot.current = JSON.stringify({ title, categoryId, level, targetMinutes, visibility, questions });
      setDirty(false);
      setMessage({ type: 'success', text: 'Exercise changes saved.' });
    }
    setBusy(false);
  }

  async function deleteExercise() {
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/exercises?id=${exerciseId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
    const result = await response.json();
    if (!response.ok) {
      setMessage({ type: 'error', text: result.error || 'Unable to delete this exercise.' });
      setBusy(false);
      setConfirmDelete(false);
      return;
    }
    router.push('/exercises');
  }

  function leave(event) {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) event.preventDefault();
  }

  if (shell?.ready && shell.profile && shell.role !== 'admin') {
    return <main className="author-page"><section className="section-empty-state"><strong>Administrators can add exercises</strong><Link className="back-button" href="/exercises">Back to exercises</Link></section></main>;
  }
  if (loading) return <main className="author-page"><section className="edit-loading-card" aria-label="Loading exercise"><span className="skeleton-line edit-loading-title" /><span className="skeleton-line edit-loading-input" /></section></main>;

  const actions = (
    <div className="editor-sticky">
      <button type="submit" className="primary-button" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Saving...</> : 'Save exercise'}</button>
    </div>
  );

  return (
    <main className="author-page">
      <header className="author-header">
        <div>
          <h1>{mode === 'edit' ? 'Edit exercise' : 'Add a practice set'}</h1>
          <p>Import a template or write questions here. Nothing is saved until you choose Save exercise.</p>
        </div>
        <Link className="back-button" href="/exercises" onClick={leave}><span aria-hidden="true">←</span> Library</Link>
      </header>
      {mode === 'create' && !pasteMode && (
        <section className="upload-stage">
          <div className="upload-stage-heading">
            <div>
              <span className="kicker">Step 1</span>
              <h2>Upload an exercise file</h2>
              <p>Drop a .docx, .txt, .md, or .json file here to get started.</p>
            </div>
            <div className="download-menu">
              <button type="button" className="ghost-button download-menu-trigger" aria-expanded={downloadOpen} onClick={() => setDownloadOpen(open => !open)}>Download sample <span aria-hidden="true">▾</span></button>
              {downloadOpen && (
                <div className="download-menu-options" role="menu">
                  <button type="button" role="menuitem" onClick={() => downloadTemplate('txt')}>Plain text (.txt)</button>
                  <button type="button" role="menuitem" onClick={() => downloadTemplate('md')}>Markdown (.md)</button>
                  <button type="button" role="menuitem" onClick={() => downloadTemplate('json')}>JSON (.json)</button>
                  <button type="button" role="menuitem" onClick={() => downloadTemplate('docx')}>Word document (.docx)</button>
                </div>
              )}
            </div>
          </div>
          <form onSubmit={event => importContent(event, 'file')}>
            <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={event => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={handleDrop}>
              <div className="drop-zone-icon" aria-hidden="true">↑</div>
              <strong>{file ? file.name : 'Drag and drop your file here'}</strong>
              <span>{file ? 'Ready to preview' : 'or choose a file from your device'}</span>
              <label className="file-picker-button" htmlFor="exercise-file">Choose file</label>
              <input id="exercise-file" className="visually-hidden-input" type="file" accept=".docx,.txt,.md,.json" onChange={event => chooseFile(event.target.files?.[0])} />
            </div>
            <div className="upload-stage-actions">
              <button className="primary-button upload-action" disabled={busy || !file}>{busy ? <><span className="spinner" aria-hidden="true" />Reading...</> : 'Preview questions'}</button>
              <button type="button" className="primary-button upload-action" disabled={busy} onClick={saveExercise}>{busy ? 'Saving...' : 'Save exercise'}</button>
              <button type="button" className="ghost-button upload-action" onClick={() => setPasteMode(true)}>Skip to paste</button>
            </div>
          </form>
        </section>
      )}
      {mode === 'create' && pasteMode && (
        <div className="author-layout">
          <form className="author-input-card" onSubmit={event => importContent(event, 'paste')}>
            <div className="card-heading paste-heading">
              <button type="button" className="back-button icon-button" aria-label="Back to upload" onClick={() => setPasteMode(false)}><span aria-hidden="true">←</span></button>
              <div>
                <span className="kicker">Step 2</span>
                <h2>Paste exercise content</h2>
                <p>Paste content using one of the supported formats.</p>
              </div>
            </div>
            <label htmlFor="exercise-paste">Paste content
              <textarea id="exercise-paste" value={paste} onChange={event => setPaste(event.target.value)} placeholder="Paste your exercise content here..." rows={15} />
            </label>
            <div className="paste-actions">
              <button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Reading...</> : 'Preview questions'}</button>
              <button type="button" className="primary-button" disabled={busy} onClick={saveExercise}>{busy ? 'Saving...' : 'Save exercise'}</button>
            </div>
          </form>
          <aside className="template-card">
            <span className="kicker">Example</span>
            <span className="format-guide-note">Use this as a guide. It is not added to your exercise.</span>
            <div className="format-tabs" role="tablist" aria-label="Sample formats">
              {[['txt', 'Plain text'], ['md', 'Markdown'], ['json', 'JSON']].map(([format, label]) => (
                <button key={format} type="button" role="tab" aria-selected={sampleFormat === format} className={sampleFormat === format ? 'active' : ''} onClick={() => setSampleFormat(format)}>{label}</button>
              ))}
            </div>
            {sampleError && <p className="notice notice-error" role="alert">{sampleError}</p>}
            <pre className="format-sample" role="tabpanel">{sample}</pre>
          </aside>
        </div>
      )}
      {(mode === 'edit' || questions.length > 0) && <form onSubmit={saveExercise}>
        <section className="edit-exercise-card">
          <div className="edit-details-grid">
            <label>Title
              <input value={title} onChange={event => setTitle(event.target.value)} aria-invalid={Boolean(errorFor(errors, 'title'))} />
              {errorFor(errors, 'title') && <span className="field-error" role="alert">{errorFor(errors, 'title')}</span>}
            </label>
            <AppSelect instanceId="editor-category" inputId="editor-category" label="Category" options={categories.map(category => ({ value: category.id, label: category.name }))} value={categoryId} onChange={setCategoryId} placeholder="Choose a category" error={errorFor(errors, 'category')} />
            <AppSelect instanceId="editor-level" inputId="editor-level" label="Level" options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={level} onChange={setLevel} placeholder="Choose a level" error={errorFor(errors, 'level')} />
            <label>Target time in minutes
              <input inputMode="numeric" value={targetMinutes} onChange={event => setTargetMinutes(event.target.value)} aria-invalid={Boolean(errorFor(errors, 'target'))} />
              {errorFor(errors, 'target') && <span className="field-error" role="alert">{errorFor(errors, 'target')}</span>}
            </label>
            <AppSelect instanceId="editor-visibility" inputId="editor-visibility" label="Visibility" options={[{ value: 'members', label: 'Members only' }, { value: 'public', label: 'Public' }]} value={visibility} onChange={setVisibility} />
          </div>
          <div className="edit-questions-heading">
            <div><span className="kicker">Questions</span><h2>{questions.length} questions</h2></div>
            <button type="button" className="ghost-button" onClick={() => setQuestions(current => [...current, emptyQuestion()])}>Add question</button>
          </div>
          {errorFor(errors, 'questions') && <p className="field-error" role="alert">{errorFor(errors, 'questions')}</p>}
          <div className="edit-question-list">
            {questions.map((question, index) => (
              <details className="edit-question" key={question.id || `new-${index}`} open>
                <summary><strong>Q {index + 1}</strong><span className="question-preview">{question.prompt || 'Untitled question'}</span></summary>
                <div className="edit-question-fields">
                  <label>Prompt
                    <textarea value={question.prompt} rows={4} onChange={event => updateQuestion(index, 'prompt', event.target.value)} />
                    {errorFor(errors, `questions.${index}.prompt`) && <span className="field-error" role="alert">{errorFor(errors, `questions.${index}.prompt`)}</span>}
                  </label>
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex}>Answer {String.fromCharCode(65 + optionIndex)}
                      <input value={option} onChange={event => updateOption(index, optionIndex, event.target.value)} />
                    </label>
                  ))}
                  {errorFor(errors, `questions.${index}.options`) && <span className="field-error" role="alert">{errorFor(errors, `questions.${index}.options`)}</span>}
                  <AppSelect instanceId={`editor-answer-${index}`} inputId={`editor-answer-${index}`} label="Correct answer" options={['A', 'B', 'C', 'D'].map(letter => ({ value: letter, label: letter }))} value={question.answer || ''} onChange={value => updateQuestion(index, 'answer', value)} error={errorFor(errors, `questions.${index}.answer`)} />
                  <label>Explanation
                    <textarea value={question.explanation} rows={5} onChange={event => updateQuestion(index, 'explanation', event.target.value)} />
                    {errorFor(errors, `questions.${index}.explanation`) && <span className="field-error" role="alert">{errorFor(errors, `questions.${index}.explanation`)}</span>}
                  </label>
                  <button type="button" className="remove-button" onClick={() => setQuestions(current => current.filter((_, questionIndex) => questionIndex !== index))}>Remove question</button>
                </div>
              </details>
            ))}
          </div>
          {mode === 'edit' && <button type="button" className="danger-button" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete exercise</button>}
        </section>
        {mode === 'edit' && actions}
      </form>}
      {message && (
        <div className={`toast toast-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
          <span>{message.text}</span>
          <button className="toast-close" type="button" aria-label="Dismiss notification" onClick={() => setMessage(null)}>×</button>
        </div>
      )}
      {confirmDelete && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">Delete this exercise?</h2>
            <p>This removes the exercise, its questions, and its saved attempts.</p>
            <div className="confirm-actions">
              <button type="button" className="back-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" className="danger-button" onClick={deleteExercise}>Delete exercise</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
