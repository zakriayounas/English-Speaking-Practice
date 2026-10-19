'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { LEARNING_GOALS, LEVELS } from '../lib/goals';
import AppSelect from './AppSelect';

function focusable(container) {
  return [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.disabled && element.tabIndex !== -1);
}

async function saveProfile(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Your preferences could not be saved.');
  return result;
}

export default function OnboardingModal({ open, initial, onClose, onSaved }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState(initial?.english_level || '');
  const [goals, setGoals] = useState(initial?.goals || []);
  const [categoryIds, setCategoryIds] = useState(initial?.categoryIds || []);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setStep(0);
    setLevel(initial?.english_level || '');
    setGoals(initial?.goals || []);
    setCategoryIds(initial?.categoryIds || []);
    setError('');
    let ignore = false;
    supabase.from('categories').select('id,name,slug').eq('active', true).order('sort_order')
      .then(({ data, error: categoryError }) => {
        if (!ignore) {
          if (categoryError) setError('Categories could not be loaded. You can retry or skip for now.');
          setCategories(data || []);
        }
      });
    return () => { ignore = true; };
  }, [open, initial]);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    function onKeyDown(event) {
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dialog.querySelector('[data-onboarding-skip]')?.click();
        return;
      }
      if (event.key !== 'Tab') return;
      const current = focusable(dialog);
      if (!current.length) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    focusable(dialogRef.current || document.body)[0]?.focus();
  }, [open, step]);

  async function skip() {
    setBusy(true);
    setError('');
    try {
      await saveProfile({ onboarding_status: 'skipped' });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError('');
    try {
      await saveProfile({
        english_level: level || null,
        goals,
        categoryIds,
        onboarding_status: 'completed',
      });
      await onSaved();
      onClose();
      router.push('/exercises');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const categoryOptions = categories.map(category => ({ value: category.id, label: category.name }));

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <p className="kicker">Step {step + 1} of 4</p>
        <div className="onboarding-progress" aria-hidden="true"><span style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
        {step === 0 && (
          <>
            <h2 id="onboarding-title">What is your English level?</h2>
            <div className="choice-grid" role="radiogroup" aria-label="English level">
              {LEVELS.map(option => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={level === option.value}
                  className={`choice-card ${level === option.value ? 'selected' : ''}`}
                  onClick={() => setLevel(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2 id="onboarding-title">What do you want to practice?</h2>
            <AppSelect instanceId="onboarding-goals" inputId="onboarding-goals" label="Learning goals" options={LEARNING_GOALS} isMulti value={goals} onChange={setGoals} placeholder="Choose any that fit" />
          </>
        )}
        {step === 2 && (
          <>
            <h2 id="onboarding-title">Which categories interest you?</h2>
            <AppSelect instanceId="onboarding-categories" inputId="onboarding-categories" label="Favorite categories" options={categoryOptions} isMulti value={categoryIds} onChange={setCategoryIds} placeholder={categories.length ? 'Choose categories' : 'Loading categories'} isDisabled={!categories.length} />
          </>
        )}
        {step === 3 && (
          <>
            <h2 id="onboarding-title">You are ready to practice.</h2>
            <p>Your exercises will favor the level and categories you chose. You can change this any time in Settings.</p>
          </>
        )}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <div className="onboarding-actions">
          <button type="button" className="text-button" data-onboarding-skip onClick={skip} disabled={busy}>Skip for now</button>
          <div className="onboarding-nav">
            {step > 0 && <button type="button" className="ghost-button" onClick={() => setStep(current => current - 1)} disabled={busy}>Back</button>}
            {step < 3
              ? <button type="button" className="primary-button" onClick={() => setStep(current => current + 1)} disabled={busy || (step === 0 && level === undefined)}>Continue</button>
              : <button type="button" className="primary-button" onClick={finish} disabled={busy}>{busy ? 'Saving...' : 'See my exercises'}</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
