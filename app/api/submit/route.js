import { serviceClient } from '../../../lib/server-auth';

const graders = { mcq: (answer, key) => answer === key };

function cleanMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 24 * 60 * 60 * 1000) return null;
  return Math.round(number);
}

export async function POST(request) {
  const admin = serviceClient();
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const { exerciseId, answers, timing } = await request.json();
  const { data: exercise } = await admin.from('exercises').select('id,visibility,target_seconds,category_id,title').eq('id', exerciseId).maybeSingle();
  if (!exercise) return Response.json({ error: 'Exercise not found' }, { status: 404 });
  if (exercise.visibility !== 'public' && !user) return Response.json({ error: 'Exercise not found' }, { status: 404 });

  const { data: questions } = await admin.from('questions').select('id,points,type,question_keys(answer,explanation)').eq('exercise_id', exerciseId);
  if (!questions?.length) return Response.json({ error: 'Exercise has no questions' }, { status: 400 });

  let score = 0;
  let max = 0;
  const review = {};
  const rows = [];
  for (const question of questions) {
    const key = [].concat(question.question_keys)[0];
    const correct = Boolean(graders[question.type]?.(answers?.[question.id], key?.answer));
    max += question.points || 0;
    if (correct) score += question.points || 0;
    review[question.id] = { correct, answer: key?.answer, explanation: key?.explanation || '' };
    rows.push({
      question_id: question.id,
      answer: answers?.[question.id] ?? null,
      is_correct: correct,
      time_ms: cleanMs(timing?.questionTimes?.[question.id]),
    });
  }

  const durationMs = cleanMs(timing?.durationMs);
  const startedAt = timing?.startedAt && !Number.isNaN(new Date(timing.startedAt).getTime()) ? timing.startedAt : null;
  const payload = {
    score,
    max,
    review,
    publicAttempt: !user,
    timing: { durationMs, questionTimes: Object.fromEntries(rows.map(row => [row.question_id, row.time_ms])) },
    targetSeconds: exercise.target_seconds,
  };

  let nextExercise = null;
  if (exercise.category_id) {
    const next = await admin.from('exercises').select('id,title,visibility').eq('category_id', exercise.category_id).neq('id', exercise.id).limit(8);
    nextExercise = (next.data || []).find(item => item.visibility === 'public' || (user && item.visibility === 'members')) || null;
  }
  if (!user) return Response.json({ ...payload, nextExercise });

  const saved = await admin.rpc('save_completed_attempt', {
    p_user_id: user.id,
    p_exercise_id: exerciseId,
    p_score: score,
    p_max_score: max,
    p_started_at: startedAt,
    p_duration_ms: durationMs,
    p_target_seconds: exercise.target_seconds,
    p_answers: rows,
  });
  if (saved.error) {
    const attempt = await admin.from('attempts').insert({
      user_id: user.id,
      exercise_id: exerciseId,
      score,
      max_score: max,
      started_at: startedAt,
      duration_ms: durationMs,
      target_seconds: exercise.target_seconds,
    }).select('id').single();
    if (attempt.error || !attempt.data) return Response.json({ error: 'Could not save attempt' }, { status: 500 });
    const answersResult = await admin.from('attempt_answers').insert(rows.map(row => ({ ...row, attempt_id: attempt.data.id })));
    if (answersResult.error) {
      await admin.from('attempts').delete().eq('id', attempt.data.id);
      return Response.json({ error: 'Could not save answers' }, { status: 500 });
    }
  }

  return Response.json({ ...payload, nextExercise });
}
