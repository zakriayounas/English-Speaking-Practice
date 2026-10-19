'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAppShell } from '../../components/AppShell';
import AppSelect from '../../components/AppSelect';
import { LEARNING_GOALS } from '../../lib/goals';
import { SettingsSkeleton } from '../../components/PageSkeletons';

export default function SettingsPage() {
  const router = useRouter();
  const shell = useAppShell();
  const [categories, setCategories] = useState([]);
  const [level, setLevel] = useState('');
  const [categoryIds, setCategoryIds] = useState([]);
  const [goals, setGoals] = useState([]);
  const [dailyGoal, setDailyGoal] = useState('');
  const [showTimer, setShowTimer] = useState(true);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!shell?.ready || shell.user) return undefined;
    let ignore = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!ignore && !data.session) router.replace('/login?next=/settings');
    });
    return () => { ignore = true; };
  }, [shell?.ready, shell?.user, router]);

  useEffect(() => {
    setLevel(shell?.profile?.english_level || '');
    setCategoryIds(shell?.categoryIds || []);
    setGoals(shell?.goals || []);
    setDailyGoal(shell?.profile?.daily_goal_minutes ? String(shell.profile.daily_goal_minutes) : '');
    setShowTimer(shell?.profile?.show_timer !== false);
  }, [shell?.profile, shell?.categoryIds, shell?.goals]);

  useEffect(() => {
    supabase.from('categories').select('id,name').eq('active', true).order('sort_order').then(({ data }) => setCategories(data || []));
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({
        english_level: level || null,
        categoryIds,
        goals,
        daily_goal_minutes: dailyGoal === '' ? null : Number(dailyGoal),
        show_timer: showTimer,
      }),
    });
    const result = await response.json();
    if (!response.ok) setMessage({ type: 'error', text: result.error || 'Settings could not be saved.' });
    else {
      setMessage({ type: 'success', text: 'Settings saved.' });
      await shell.refreshProfile();
    }
    setBusy(false);
  }

  if (!shell?.ready || !shell?.user) return <SettingsSkeleton />;

  return (
    <main className="dashboard">
      <header className="page-intro"><h1>Settings</h1></header>
      <form className="edit-exercise-card settings-form" onSubmit={save}>
        <div className="settings-fields">
          <AppSelect instanceId="settings-level" inputId="settings-level" label="English level" options={[{ value: '', label: 'Not sure yet' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={level} onChange={setLevel} />
          <AppSelect instanceId="settings-categories" inputId="settings-categories" label="Preferred categories" options={categories.map(category => ({ value: category.id, label: category.name }))} isMulti value={categoryIds} onChange={setCategoryIds} />
          <AppSelect instanceId="settings-goals" inputId="settings-goals" label="Learning goals" options={LEARNING_GOALS} isMulti value={goals} onChange={setGoals} />
          <label htmlFor="daily-goal">Daily goal in minutes
            <input id="daily-goal" inputMode="numeric" value={dailyGoal} onChange={event => setDailyGoal(event.target.value)} placeholder="Optional" />
          </label>
        </div>
        <label className="check-row" htmlFor="show-timer">
          <input id="show-timer" type="checkbox" checked={showTimer} onChange={event => setShowTimer(event.target.checked)} />
          Show the timer during an attempt
        </label>
        <div className="paste-actions">
          <button className="primary-button profile-save" disabled={busy}>{busy ? 'Saving...' : 'Save settings'}</button>
        </div>
        {message && <p className={`notice notice-${message.type}`} role="status">{message.text}</p>}
      </form>
    </main>
  );
}
