'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

const example = `Title: Business phrases
Category: Workplace English

Question: Choose the best phrase: Want to lead the project? _____!
A: Go for it
B: Never mind
C: Hold on
D: Not really
Answer: A
Explanation: Go for it means do it; I support you.`;

export default function UploadExercise() {
  const [text, setText] = useState(example), [file, setFile] = useState(null), [parsed, setParsed] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(null), [templateFormat, setTemplateFormat] = useState('txt');

  async function parseExercise(event) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    const form = new FormData();
    form.append('text', text);
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

  function downloadTemplate() {
    window.location.href = `/api/exercises/template?format=${templateFormat}`;
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
    <div className="author-layout">
      <form className="author-input-card" onSubmit={parseExercise}><div className="card-heading"><span className="kicker">Step 1</span><h2>Import content</h2><p>Use the template below or add a `.docx`, `.txt`, `.md`, or `.json` file.</p></div><label htmlFor="exercise-file">Document</label><input id="exercise-file" type="file" accept=".docx,.txt,.md,.json" onChange={event => setFile(event.target.files?.[0] || null)} /><label htmlFor="exercise-text">Paste template or JSON</label><textarea id="exercise-text" value={text} onChange={event => setText(event.target.value)} rows={15} /><button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" />Reading...</> : 'Preview questions'}</button>{message && <p className={`notice notice-${message.type}`}>{message.text}</p>}</form>
      <aside className="template-card"><span className="kicker">Accepted format</span><h2>Keep it simple</h2><pre>{example}</pre><div className="template-download"><label htmlFor="template-format">Download template</label><div className="template-download-row"><select id="template-format" value={templateFormat} onChange={event => setTemplateFormat(event.target.value)}><option value="txt">Plain text (.txt)</option><option value="md">Markdown (.md)</option><option value="json">JSON (.json)</option><option value="docx">Word document (.docx)</option></select><button type="button" className="ghost-button" onClick={downloadTemplate}>Download</button></div></div></aside>
    </div>
    {parsed && <section className="review-card"><div className="review-heading"><div><span className="kicker">Step 2</span><h2>Review before publishing</h2><p>Edit or remove anything that needs work. Nothing is public until you publish it.</p></div><div className="review-count">{parsed.questions.length}<small>questions</small></div></div><label>Exercise title<input value={parsed.title} onChange={event => setParsed({ ...parsed, title: event.target.value })} /></label><label>Category<input value={parsed.category} onChange={event => setParsed({ ...parsed, category: event.target.value })} /></label><div className="review-list">{parsed.questions.map((question, index) => <article className="review-question" key={index}><div className="review-question-heading"><strong>Question {index + 1}</strong><button type="button" className="remove-button" onClick={() => removeQuestion(index)}>Remove</button></div><label>Prompt<textarea value={question.prompt} onChange={event => updateQuestion(index, 'prompt', event.target.value)} rows={2} /></label><label>Options<input value={question.options.join(' | ')} onChange={event => updateQuestion(index, 'options', event.target.value.split('|').map(option => option.trim()).filter(Boolean))} /></label><label>Correct answer<input value={question.answer} onChange={event => updateQuestion(index, 'answer', event.target.value)} /></label><label>Explanation<input value={question.explanation} onChange={event => updateQuestion(index, 'explanation', event.target.value)} /></label></article>)}</div><div className="review-actions"><button className="ghost-button" type="button" disabled={busy} onClick={() => saveExercise(false)}>Save draft</button><button className="primary-button" type="button" disabled={busy || !parsed.questions.length} onClick={() => saveExercise(true)}>{busy ? 'Saving...' : 'Publish exercise'}</button></div></section>}
  </main>;
}
