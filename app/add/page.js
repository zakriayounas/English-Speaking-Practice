'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

const formatSamples = {
  txt: `Title: Business phrases
Category: Workplace English
Level: Beginner

Question: Choose the best phrase: Want to lead the project? _____!
A: Go for it
B: Never mind
C: Hold on
D: Not really
Answer: A
Explanation: Go for it means do it; I support you.`,
  md: `Title: Business phrases
Category: Workplace English
Level: Beginner

## Question 1
**Prompt:** Choose the best phrase: Want to lead the project? _____!
- Go for it
- Never mind
- Hold on
- Not really
**Answer:** Go for it
**Explanation:** Go for it means do it; I support you.`,
  json: `{
  "title": "Business phrases",
  "category": "Workplace English",
  "level": "beginner",
  "questions": [{
    "prompt": "Choose the best phrase: Want to lead the project? _____!",
    "options": ["Go for it", "Never mind", "Hold on", "Not really"],
    "answer": "Go for it",
    "explanation": "Go for it means do it; I support you."
  }]
}`,
};

export default function AddExercise() {
  const [text, setText] = useState(''), [file, setFile] = useState(null), [parsed, setParsed] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(null), [templateFormat, setTemplateFormat] = useState('txt'), [downloadOpen, setDownloadOpen] = useState(false), [exerciseLevel, setExerciseLevel] = useState('beginner'), [sampleFormat, setSampleFormat] = useState('txt'), [pasteMode, setPasteMode] = useState(false), [dragging, setDragging] = useState(false);

  async function parseExercise(event) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    const form = new FormData();
    form.append('text', text);
    form.append('level', exerciseLevel);
    if (file) form.append('file', file);
    const response = await fetch('/api/exercises/parse', { method: 'POST', body: form });
    const result = await response.json();
    setParsed(response.ok ? result : null);
    setMessage(response.ok ? { type: 'success', text: 'Review the parsed questions below before saving.' } : { type: 'error', text: result.error });
    setBusy(false);
  }

  function updateQuestion(index, field, value) {
    setParsed(current => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, [field]: value } : question) }));
  }

  function removeQuestion(index) {
    setParsed(current => ({ ...current, questions: current.questions.filter((_, questionIndex) => questionIndex !== index) }));
  }

  function downloadTemplate(format = templateFormat) {
    setTemplateFormat(format);
    setDownloadOpen(false);
    window.location.href = `/api/exercises/template?format=${format}`;
  }

  function chooseFile(selectedFile) {
    if (selectedFile) setFile(selectedFile);
    setDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function saveExercise(published) {
    setBusy(true); setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ ...parsed, published }) });
    const result = await response.json();
    setMessage(response.ok ? { type: 'success', text: published ? 'Exercise published for learners.' : 'Draft saved. You can publish it after more edits.' } : { type: 'error', text: result.error });
    if (response.ok) setParsed(null);
    setBusy(false);
  }

  return <main className="author-page">
    <header className="author-header"><div><span className="eyebrow">Exercise studio</span><h1>Add a practice set</h1><p>Paste the template, add a document, review every question, then publish when it is ready.</p></div><Link className="back-link back-button" href="/"><span aria-hidden="true">&#8592;</span> Library</Link></header>
    {!pasteMode ? <section className="upload-stage">
      <div className="upload-stage-heading"><div><span className="kicker">Step 1</span><h2>Upload an exercise file</h2><p>Drop a `.docx`, `.txt`, `.md`, or `.json` file here to get started.</p></div><div className="download-menu"><button type="button" className="ghost-button download-menu-trigger" aria-expanded={downloadOpen} onClick={() => setDownloadOpen(open => !open)}>Download sample <span aria-hidden="true">&#9662;</span></button>{downloadOpen && <div className="download-menu-options" role="menu"><button type="button" role="menuitem" onClick={() => downloadTemplate('txt')}>Plain text (.txt)</button><button type="button" role="menuitem" onClick={() => downloadTemplate('md')}>Markdown (.md)</button><button type="button" role="menuitem" onClick={() => downloadTemplate('json')}>JSON (.json)</button><button type="button" role="menuitem" onClick={() => downloadTemplate('docx')}>Word document (.docx)</button></div>}</div></div>
      <form onSubmit={parseExercise}>
        <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={event => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={handleDrop}>
          <div className="drop-zone-icon" aria-hidden="true">&#8593;</div>
          <strong>{file ? file.name : 'Drag and drop your file here'}</strong>
          <span>{file ? 'Ready to preview' : 'or choose a file from your device'}</span>
          <label className="file-picker-button" htmlFor="exercise-file">Choose file</label>
          <input id="exercise-file" className="visually-hidden-input" type="file" accept=".docx,.txt,.md,.json" onChange={event => chooseFile(event.target.files?.[0])} />
        </div>
        <div className="upload-stage-actions"><button className="primary-button upload-action" disabled={busy || !file}>{busy ? <><span className="spinner" />Reading...</> : 'Preview questions'}</button><button type="button" className="ghost-button upload-action" onClick={() => setPasteMode(true)}>Skip to paste</button></div>
        {message && <p className={`notice notice-${message.type}`}>{message.text}</p>}
      </form>
    </section> : <div className="author-layout">
      <form className="author-input-card" onSubmit={parseExercise}><div className="card-heading"><span className="kicker">Step 2</span><h2>Paste exercise content</h2><p>Choose the level and paste content using one of the supported formats.</p></div><label htmlFor="exercise-level">Exercise level</label><select id="exercise-level" value={exerciseLevel} onChange={event => setExerciseLevel(event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select><label htmlFor="exercise-text">Paste content</label><textarea id="exercise-text" value={text} onChange={event => setText(event.target.value)} placeholder="Paste your exercise content here..." rows={15} /><div className="paste-actions"><button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" />Reading...</> : 'Preview questions'}</button><button type="button" className="back-button" onClick={() => setPasteMode(false)}>Back to upload</button></div>{message && <p className={`notice notice-${message.type}`}>{message.text}</p>}</form>
      <aside className="template-card"><span className="kicker">Accepted formats</span><span className="format-guide-note">Use the sample as a guide. It is not added to your exercise.</span><div className="format-tabs" role="tablist" aria-label="Sample formats"><button type="button" role="tab" aria-selected={sampleFormat === 'txt'} className={sampleFormat === 'txt' ? 'active' : ''} onClick={() => setSampleFormat('txt')}>Plain text</button><button type="button" role="tab" aria-selected={sampleFormat === 'md'} className={sampleFormat === 'md' ? 'active' : ''} onClick={() => setSampleFormat('md')}>Markdown</button><button type="button" role="tab" aria-selected={sampleFormat === 'json'} className={sampleFormat === 'json' ? 'active' : ''} onClick={() => setSampleFormat('json')}>JSON</button></div><pre className="format-sample" role="tabpanel">{formatSamples[sampleFormat]}</pre></aside>
    </div>}
    {parsed && <section className="review-card"><div className="review-heading"><div><span className="kicker">Step 2</span><h2>Review before publishing</h2><p>Edit or remove anything that needs work. Nothing is public until you publish it.</p></div><div className="review-count">{parsed.questions.length}<small>questions</small></div></div><label>Exercise title<input value={parsed.title} onChange={event => setParsed({ ...parsed, title: event.target.value })} /></label><label>Category<input value={parsed.category} onChange={event => setParsed({ ...parsed, category: event.target.value })} /></label><label>Exercise level<select value={parsed.level || exerciseLevel} onChange={event => setParsed({ ...parsed, level: event.target.value })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><div className="review-list">{parsed.questions.map((question, index) => <article className="review-question" key={index}><div className="review-question-heading"><strong>Question {index + 1}</strong><button type="button" className="remove-button" onClick={() => removeQuestion(index)}>Remove</button></div><label>Prompt<textarea value={question.prompt} onChange={event => updateQuestion(index, 'prompt', event.target.value)} rows={2} /></label><label>Options<input value={question.options.join(' | ')} onChange={event => updateQuestion(index, 'options', event.target.value.split('|').map(option => option.trim()).filter(Boolean))} /></label><label>Correct answer<input value={question.answer} onChange={event => updateQuestion(index, 'answer', event.target.value)} /></label><label>Explanation<input value={question.explanation} onChange={event => updateQuestion(index, 'explanation', event.target.value)} /></label></article>)}</div><div className="review-actions"><button className="ghost-button" type="button" disabled={busy} onClick={() => saveExercise(false)}>Save draft</button><button className="primary-button" type="button" disabled={busy || !parsed.questions.length} onClick={() => saveExercise(true)}>{busy ? 'Saving...' : 'Publish exercise'}</button></div></section>}
  </main>;
}
