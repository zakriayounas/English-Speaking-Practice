'use client';

import { useEffect, useState } from 'react';
import RichText from './RichText';

export default function ExercisePreview({ exercise, onClose }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const questions = exercise?.questions || [];
  const question = questions[index];

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!question) return null;
  const selected = answers[index];
  const correctIndex = /^[A-D]$/.test(question.answer || '') ? question.answer.charCodeAt(0) - 65 : -1;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
        <header className="attempt-modal-header">
          <div>
            <span className="kicker">Preview</span>
            <h2 id="preview-title">{exercise.title || 'Untitled exercise'}</h2>
          </div>
          <button type="button" className="attempt-modal-close" onClick={onClose} aria-label="Close preview">×</button>
        </header>
        <p className="question-meta">Question {index + 1} of {questions.length}</p>
        <RichText className="question-prompt" text={question.prompt} />
        {question.options.map((option, optionIndex) => (
          <label className="answer-option" key={`${index}-${optionIndex}`}>
            <input type="radio" name="preview-answer" checked={selected === optionIndex} onChange={() => setAnswers(current => ({ ...current, [index]: optionIndex }))} />
            {option}
          </label>
        ))}
        {selected != null && (
          <div className={selected === correctIndex ? 'preview-correct' : 'preview-incorrect'}>
            <strong>{selected === correctIndex ? 'Correct' : `Answer: ${question.options[correctIndex] || ''}`}</strong>
            <RichText className="explanation-text" text={question.explanation} />
          </div>
        )}
        <div className="exercise-actions">
          <button type="button" disabled={index === 0} onClick={() => setIndex(current => current - 1)}>Previous</button>
          <button type="button" disabled={index === questions.length - 1} onClick={() => setIndex(current => current + 1)}>Next</button>
        </div>
      </section>
    </div>
  );
}
