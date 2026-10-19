import { requireAdmin } from '../../../lib/server-auth';
import { summarize, summarizePeople } from '../../../lib/stats';

async function listEmails(admin) {
  const emails = new Map();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    (data?.users || []).forEach(user => emails.set(user.id, user.email || ''));
    if ((data?.users || []).length < 200) break;
  }
  return emails;
}

async function paged(admin, table, select) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const { data, error } = await admin.from(table).select(select).range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function GET(request) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;
  const { admin } = result;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const exerciseId = url.searchParams.get('exerciseId');

  if (userId !== null || exerciseId !== null) {
    if ((userId !== null) === (exerciseId !== null)) return Response.json({ error: 'Select a learner or an exercise attempt history' }, { status: 400 });
    const offsetValue = Number(url.searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(offsetValue) || offsetValue < 0) return Response.json({ error: 'Invalid attempt history offset' }, { status: 400 });
    const pageSize = 25;
    let query = admin.from('attempts').select('id,user_id,exercise_id,score,max_score,duration_ms,submitted_at').order('submitted_at', { ascending: false }).order('id', { ascending: false }).range(offsetValue, offsetValue + pageSize);
    query = userId !== null ? (userId === 'guest' ? query.is('user_id', null) : query.eq('user_id', userId)) : query.eq('exercise_id', exerciseId);
    const { data: attempts, error } = await query;
    if (error) return Response.json({ error: 'Could not load attempt history' }, { status: 500 });
    const page = attempts || [];
    const visible = page.slice(0, pageSize);
    const userIds = [...new Set(visible.map(attempt => attempt.user_id).filter(Boolean))];
    const exerciseIds = [...new Set(visible.map(attempt => attempt.exercise_id).filter(Boolean))];
    const [profilesResult, exercisesResult] = await Promise.all([
      userIds.length ? admin.from('profiles').select('id,full_name').in('id', userIds) : Promise.resolve({ data: [] }),
      exerciseIds.length ? admin.from('exercises').select('id,title').in('id', exerciseIds) : Promise.resolve({ data: [] }),
    ]);
    const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    const exercises = new Map((exercisesResult.data || []).map(exercise => [exercise.id, exercise]));
    return Response.json({
      attempts: visible.map(attempt => ({
        id: attempt.id,
        submitted_at: attempt.submitted_at,
        score: attempt.score,
        max_score: attempt.max_score,
        duration_ms: attempt.duration_ms,
        percentage: attempt.max_score ? Math.round(((attempt.score || 0) / attempt.max_score) * 100) : null,
        learner_name: attempt.user_id ? profiles.get(attempt.user_id)?.full_name || 'Learner' : 'Guest',
        exercise_title: attempt.exercise_id ? exercises.get(attempt.exercise_id)?.title || 'Deleted exercise' : 'Unassigned exercise',
      })),
      hasMore: page.length > pageSize,
    });
  }

  try {
    const [profiles, exercises, categories, attempts, answers, emails] = await Promise.all([
      paged(admin, 'profiles', 'id,full_name,role'),
      paged(admin, 'exercises', 'id,title,level,category_id,published,owner_id'),
      paged(admin, 'categories', 'id,slug,name,sort_order'),
      paged(admin, 'attempts', 'id,user_id,exercise_id,score,max_score,duration_ms,submitted_at'),
      paged(admin, 'attempt_answers', 'attempt_id,time_ms'),
      listEmails(admin),
    ]);
    const categoryFilter = url.searchParams.get('category') || '';
    const levelFilter = url.searchParams.get('level') || '';
    const exerciseMap = new Map(exercises.map(exercise => [exercise.id, exercise]));
    const categoryMap = new Map(categories.map(category => [category.id, category]));
    const filtered = attempts.filter(attempt => {
      const exercise = exerciseMap.get(attempt.exercise_id);
      if (!exercise) return !categoryFilter && !levelFilter;
      if (categoryFilter && categoryMap.get(exercise.category_id)?.slug !== categoryFilter) return false;
      if (levelFilter && exercise.level !== levelFilter) return false;
      return true;
    });
    const filteredIds = new Set(filtered.map(attempt => attempt.id));
    const filteredAnswers = answers.filter(answer => filteredIds.has(answer.attempt_id));
    const people = summarizePeople(filtered, filteredAnswers);
    const peopleMap = new Map(people.map(person => [person.userId, person]));
    const learners = profiles.filter(profile => profile.role === 'learner').map(profile => {
      const stats = peopleMap.get(profile.id);
      return {
        id: profile.id,
        full_name: profile.full_name || 'Learner',
        email: emails.get(profile.id) || '',
        attempts: stats?.completed || 0,
        average: stats?.averageScore == null ? 0 : Math.round(stats.averageScore * 100),
        averageQuestionMs: stats?.averageTimePerQuestionMs ?? null,
        averageAttemptMs: stats?.averageTimePerAttemptMs ?? null,
        last_attempt_at: stats?.lastAttemptAt || null,
      };
    });
    const exerciseStats = new Map();
    filtered.forEach(attempt => {
      const key = attempt.exercise_id || 'unassigned';
      const current = exerciseStats.get(key) || [];
      current.push(attempt);
      exerciseStats.set(key, current);
    });
    const exerciseProgress = [...exerciseStats.entries()].map(([id, rows]) => {
      const exercise = exerciseMap.get(id);
      const stats = summarize(rows, filteredAnswers.filter(answer => rows.some(row => row.id === answer.attempt_id)));
      const leader = [...rows].sort((a, b) => ((b.max_score ? b.score / b.max_score : 0) - (a.max_score ? a.score / a.max_score : 0)))[0];
      const leaderProfile = profiles.find(profile => profile.id === leader?.user_id);
      return {
        exercise_id: id,
        title: exercise?.title || 'Deleted exercise',
        available: Boolean(exercise),
        level: exercise?.level || '',
        category: categoryMap.get(exercise?.category_id)?.name || '',
        attempt_count: stats.completed,
        average_score: stats.averageScore == null ? 0 : Math.round(stats.averageScore * 100),
        leading_score: leader?.max_score ? Math.round((leader.score / leader.max_score) * 100) : 0,
        leading_scorer: leader?.user_id ? leaderProfile?.full_name || 'Learner' : 'Guest',
        last_attempt_at: rows.reduce((latest, attempt) => !latest || attempt.submitted_at > latest ? attempt.submitted_at : latest, null),
      };
    });
    const totals = summarize(filtered, filteredAnswers);
    return Response.json({
      learnerCount: profiles.filter(profile => profile.role === 'learner').length,
      learners,
      totalAttempts: totals.completed,
      averageScore: totals.averageScore,
      exercises,
      categories: [...categories].sort((a, b) => a.sort_order - b.sort_order),
      exerciseProgress,
    });
  } catch {
    return Response.json({ error: 'Could not load progress data' }, { status: 500 });
  }
}
