import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// One grader per question type. Add new types here (fill_blank, matching, ...).
const graders = { mcq: (answer, key) => answer === key };

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const { data: { user } } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null } };

  const { exerciseId, answers } = await req.json();
  const { data: exercise } = await admin.from('exercises').select('id').eq('id', exerciseId).eq('published', true).maybeSingle();
  if (!exercise) return Response.json({ error: 'Exercise not found' }, { status: 404 });

  const { data: qs } = await admin.from('questions').select('id,points,type,question_keys(answer,explanation)').eq('exercise_id', exerciseId);
  if (!qs?.length) return Response.json({ error: 'Exercise has no questions' }, { status: 400 });

  let score = 0, max = 0;
  const review = {}, rows = [];
  for (const q of qs) {
    const k = [].concat(q.question_keys)[0];
    const correct = !!graders[q.type]?.(answers[q.id], k.answer);
    max += q.points; if (correct) score += q.points;
    review[q.id] = { correct, answer: k.answer, explanation: k.explanation };
    rows.push({ question_id: q.id, answer: answers[q.id] ?? null, is_correct: correct });
  }
  if (user) {
    const { data: att, error: attemptError } = await admin.from('attempts').insert({ user_id: user.id, exercise_id: exerciseId, score, max_score: max }).select('id').single();
    if (attemptError) return Response.json({ error: 'Could not save attempt' }, { status: 500 });
    const { error: answersError } = await admin.from('attempt_answers').insert(rows.map(r => ({ ...r, attempt_id: att.id })));
    if (answersError) return Response.json({ error: 'Could not save answers' }, { status: 500 });
  }
  return Response.json({ score, max, review });
}