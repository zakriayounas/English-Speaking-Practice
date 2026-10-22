import { requireUser } from '../../../lib/server-auth';
import { summarize, summarizeByCategory } from '../../../lib/stats';

function normalize(attempt) {
  const exercise = attempt.exercises || {};
  const category = exercise.categories || {};
  return {
    id: attempt.id,
    exerciseId: attempt.exercise_id,
    score: attempt.score,
    max_score: attempt.max_score,
    duration_ms: attempt.duration_ms,
    target_seconds: attempt.target_seconds,
    submitted_at: attempt.submitted_at,
    category_id: exercise.category_id || null,
    categoryName: category.name || 'Uncategorized',
    categorySlug: category.slug || null,
    exerciseTitle: exercise.title || 'Exercise',
  };
}

export async function GET(request) {
  const result = await requireUser(request);
  if (result.error) return result.error;
  const { user, admin } = result;
  const { data: attempts, error } = await admin.from('attempts')
    .select('id,score,max_score,duration_ms,target_seconds,submitted_at,exercise_id,exercises(title,level,category_id,categories(name,slug))')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false });
  if (error) return Response.json({ error: 'Could not load your progress.' }, { status: 500 });
  const ids = (attempts || []).map(attempt => attempt.id);
  let answers = [];
  if (ids.length) {
    const answerResult = await admin.from('attempt_answers').select('attempt_id,time_ms').in('attempt_id', ids);
    if (answerResult.error) return Response.json({ error: 'Could not load your progress.' }, { status: 500 });
    answers = answerResult.data || [];
  }
  const normalized = (attempts || []).map(normalize);
  const chart = [...normalized].reverse().filter(attempt => attempt.max_score).map(attempt => ({
    date: attempt.submitted_at,
    score: Math.round(((attempt.score || 0) / attempt.max_score) * 100),
  }));
  return Response.json({
    summary: summarize(normalized, answers),
    categories: summarizeByCategory(normalized, answers),
    chart,
    recent: normalized.slice(0, 8).map(attempt => ({
      id: attempt.id,
      exerciseId: attempt.exerciseId,
      exerciseTitle: attempt.exerciseTitle,
      score: attempt.score,
      maxScore: attempt.max_score,
      durationMs: attempt.duration_ms,
      targetSeconds: attempt.target_seconds,
      submittedAt: attempt.submitted_at,
    })),
  });
}
