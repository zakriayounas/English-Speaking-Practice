import { GOAL_VALUES } from '../../../lib/goals';
import { requireUser } from '../../../lib/server-auth';

const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

export async function GET(request) {
  const result = await requireUser(request);
  if (result.error) return result.error;
  const { user, admin } = result;
  const [{ data: profile, error }, goalsResult, categoriesResult] = await Promise.all([
    admin.from('profiles').select('id,full_name,role,english_level,onboarding_status,show_timer,daily_goal_minutes,created_at').eq('id', user.id).maybeSingle(),
    admin.from('profile_goals').select('goal').eq('profile_id', user.id),
    admin.from('profile_categories').select('category_id').eq('profile_id', user.id),
  ]);
  if (error || goalsResult.error || categoriesResult.error) return Response.json({ error: 'Could not load your profile.' }, { status: 500 });
  if (!profile) return Response.json({ error: 'Your profile is not ready yet. Wait a moment and try again.' }, { status: 404 });
  return Response.json({
    profile,
    email: user.email,
    goals: (goalsResult.data || []).map(row => row.goal),
    categoryIds: (categoriesResult.data || []).map(row => row.category_id),
  });
}

export async function PATCH(request) {
  const result = await requireUser(request);
  if (result.error) return result.error;
  const { user, admin } = result;
  const body = await request.json();
  const updates = {};
  let deferredStatus = null;

  if (body.onboarding_status === 'skipped') {
    const { error } = await admin.from('profiles').update({ onboarding_status: 'skipped' }).eq('id', user.id);
    if (error) return Response.json({ error: 'Could not skip onboarding.' }, { status: 400 });
    return Response.json({ success: true });
  }

  if ('full_name' in body) {
    const name = String(body.full_name || '').trim();
    if (name.length < 2 || name.length > 60) return Response.json({ error: 'Enter a full name between 2 and 60 characters.' }, { status: 400 });
    updates.full_name = name;
  }
  if ('english_level' in body) {
    if (body.english_level == null || body.english_level === '') updates.english_level = null;
    else if (!LEVELS.has(body.english_level)) return Response.json({ error: 'Choose a valid English level.' }, { status: 400 });
    else updates.english_level = body.english_level;
  }
  if ('show_timer' in body) updates.show_timer = Boolean(body.show_timer);
  if ('daily_goal_minutes' in body) {
    if (body.daily_goal_minutes == null || body.daily_goal_minutes === '') updates.daily_goal_minutes = null;
    else {
      const minutes = Number(body.daily_goal_minutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) return Response.json({ error: 'Daily goal must be a whole number from 1 to 240 minutes.' }, { status: 400 });
      updates.daily_goal_minutes = minutes;
    }
  }
  if ('onboarding_status' in body) {
    if (!['pending', 'completed'].includes(body.onboarding_status)) return Response.json({ error: 'Invalid onboarding status.' }, { status: 400 });
    deferredStatus = body.onboarding_status;
  }
  if ('goals' in body && (!Array.isArray(body.goals) || body.goals.some(goal => !GOAL_VALUES.has(goal)))) {
    return Response.json({ error: 'One or more learning goals are not recognized.' }, { status: 400 });
  }
  if ('categoryIds' in body) {
    if (!Array.isArray(body.categoryIds)) return Response.json({ error: 'Preferred categories are invalid.' }, { status: 400 });
    const uniqueIds = [...new Set(body.categoryIds)];
    if (uniqueIds.length) {
      const { data, error } = await admin.from('categories').select('id').in('id', uniqueIds).eq('active', true);
      if (error || (data || []).length !== uniqueIds.length) return Response.json({ error: 'One or more categories are unavailable.' }, { status: 400 });
    }
  }

  if (Object.keys(updates).length) {
    const { error } = await admin.from('profiles').update(updates).eq('id', user.id);
    if (error) return Response.json({ error: 'Could not save your profile.' }, { status: 400 });
  }
  if ('goals' in body) {
    const removed = await admin.from('profile_goals').delete().eq('profile_id', user.id);
    if (removed.error) return Response.json({ error: 'Could not save learning goals.' }, { status: 400 });
    if (body.goals.length) {
      const inserted = await admin.from('profile_goals').insert(body.goals.map(goal => ({ profile_id: user.id, goal })));
      if (inserted.error) return Response.json({ error: 'Could not save learning goals.' }, { status: 400 });
    }
  }
  if ('categoryIds' in body) {
    const removed = await admin.from('profile_categories').delete().eq('profile_id', user.id);
    if (removed.error) return Response.json({ error: 'Could not save preferred categories.' }, { status: 400 });
    const uniqueIds = [...new Set(body.categoryIds)];
    if (uniqueIds.length) {
      const inserted = await admin.from('profile_categories').insert(uniqueIds.map(category_id => ({ profile_id: user.id, category_id })));
      if (inserted.error) return Response.json({ error: 'Could not save preferred categories.' }, { status: 400 });
    }
  }
  if (deferredStatus) {
    const { error } = await admin.from('profiles').update({ onboarding_status: deferredStatus }).eq('id', user.id);
    if (error) return Response.json({ error: 'Your preferences were saved, but onboarding could not be completed. Try again.' }, { status: 400 });
  }
  return Response.json({ success: true });
}
