import { requireAdmin } from '../../../lib/server-auth';
import { validateExercise } from '../../../lib/exercise-validate';

function answerIndex(answer, options) {
  const raw = String(answer ?? '').trim();
  if (/^[A-D]$/i.test(raw)) return raw.toUpperCase().charCodeAt(0) - 65;
  const index = options.findIndex(option => option.trim().toLowerCase() === raw.toLowerCase());
  return index >= 0 ? index : 0;
}

async function categoriesFor(admin) {
  const { data, error } = await admin.from('categories').select('id,slug,name').eq('active', true);
  if (error) throw new Error('Categories could not be loaded.');
  return data || [];
}

export async function GET(request) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Exercise id is required.' }, { status: 400 });
  const { data: exercise, error } = await result.admin.from('exercises').select('id,title,category,category_id,level,visibility,target_seconds,published,status,owner_id').eq('id', id).maybeSingle();
  if (error || !exercise) return Response.json({ error: 'Exercise not found.' }, { status: 404 });
  const { data: questions, error: questionError } = await result.admin.from('questions').select('id,position,prompt,content').eq('exercise_id', id).order('position');
  if (questionError) return Response.json({ error: questionError.message }, { status: 400 });
  const ids = (questions || []).map(question => question.id);
  const { data: keys, error: keyError } = ids.length
    ? await result.admin.from('question_keys').select('question_id,answer,explanation').in('question_id', ids)
    : { data: [], error: null };
  if (keyError) return Response.json({ error: keyError.message }, { status: 400 });
  const keyMap = Object.fromEntries((keys || []).map(key => [key.question_id, key]));
  return Response.json({
    exercise,
    questions: (questions || []).map(question => {
      const options = question.content?.options || [];
      const stored = keyMap[question.id]?.answer;
      const answer = Number.isInteger(stored) ? String.fromCharCode(65 + stored) : String(stored || 'A');
      return {
        id: question.id,
        prompt: question.prompt || question.content?.prompt || '',
        options,
        answer,
        explanation: keyMap[question.id]?.explanation || '',
      };
    }),
  });
}

export async function POST(request) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;
  const body = await request.json();
  const categories = await categoriesFor(result.admin);
  const validated = validateExercise(body, categories);
  if (!validated.ok) return Response.json({ error: validated.errors[0].message, errors: validated.errors }, { status: 400 });
  const exercise = validated.exercise;
  const category = categories.find(item => item.id === exercise.categoryId);
  const { data: created, error } = await result.admin.from('exercises').insert({
    owner_id: result.user.id,
    title: exercise.title,
    category: category?.name || '',
    category_id: exercise.categoryId,
    level: exercise.level,
    visibility: exercise.visibility,
    target_seconds: exercise.targetSeconds,
    time_limit_min: exercise.targetSeconds ? exercise.targetSeconds / 60 : null,
    published: true,
    status: 'published',
  }).select('id').single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  const questions = exercise.questions.map((question, index) => ({
    exercise_id: created.id,
    position: index + 1,
    type: 'mcq',
    prompt: question.prompt,
    content: { prompt: question.prompt, options: question.options },
  }));
  const { data: inserted, error: questionError } = await result.admin.from('questions').insert(questions).select('id,position');
  if (questionError) return Response.json({ error: questionError.message }, { status: 400 });
  const ordered = [...inserted].sort((a, b) => a.position - b.position);
  const keys = ordered.map((question, index) => ({
    question_id: question.id,
    answer: answerIndex(exercise.questions[index].answer, exercise.questions[index].options),
    explanation: exercise.questions[index].explanation,
  }));
  const { error: keyError } = await result.admin.from('question_keys').insert(keys);
  if (keyError) return Response.json({ error: keyError.message }, { status: 400 });
  return Response.json({ id: created.id });
}

export async function PUT(request) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;
  const body = await request.json();
  if (!body.id) return Response.json({ error: 'Exercise id is required.' }, { status: 400 });
  const categories = await categoriesFor(result.admin);
  const validated = validateExercise(body, categories);
  if (!validated.ok) return Response.json({ error: validated.errors[0].message, errors: validated.errors }, { status: 400 });
  const exercise = validated.exercise;
  const category = categories.find(item => item.id === exercise.categoryId);
  const existing = await result.admin.from('questions').select('id').eq('exercise_id', body.id);
  if (existing.error) return Response.json({ error: existing.error.message }, { status: 400 });
  const existingIds = new Set((existing.data || []).map(question => question.id));
  const keptIds = new Set(exercise.questions.map(question => question.id).filter(Boolean));
  for (const id of keptIds) {
    if (!existingIds.has(id)) return Response.json({ error: 'One or more questions do not belong to this exercise.' }, { status: 400 });
  }
  const removedIds = [...existingIds].filter(id => !keptIds.has(id));
  if (removedIds.length) {
    const { data: used } = await result.admin.from('attempt_answers').select('question_id').in('question_id', removedIds);
    if (used?.length) return Response.json({ error: 'Questions used in learner attempts cannot be removed.' }, { status: 400 });
    await result.admin.from('question_keys').delete().in('question_id', removedIds);
    const removed = await result.admin.from('questions').delete().in('id', removedIds);
    if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 });
  }
  const { error } = await result.admin.from('exercises').update({
    title: exercise.title,
    category: category?.name || '',
    category_id: exercise.categoryId,
    level: exercise.level,
    visibility: exercise.visibility,
    target_seconds: exercise.targetSeconds,
    time_limit_min: exercise.targetSeconds ? exercise.targetSeconds / 60 : null,
    published: true,
    status: 'published',
  }).eq('id', body.id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  for (const [index, question] of exercise.questions.entries()) {
    const content = { prompt: question.prompt, options: question.options };
    let questionId = question.id;
    if (questionId) {
      const updated = await result.admin.from('questions').update({ position: index + 1, prompt: question.prompt, content }).eq('id', questionId).eq('exercise_id', body.id);
      if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
    } else {
      const inserted = await result.admin.from('questions').insert({ exercise_id: body.id, position: index + 1, type: 'mcq', prompt: question.prompt, content }).select('id').single();
      if (inserted.error || !inserted.data) return Response.json({ error: inserted.error?.message || 'The question could not be created.' }, { status: 400 });
      questionId = inserted.data.id;
    }
    const saved = await result.admin.from('question_keys').upsert({
      question_id: questionId,
      answer: answerIndex(question.answer, question.options),
      explanation: question.explanation,
    });
    if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  }
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Exercise id is required.' }, { status: 400 });
  const attempts = await result.admin.from('attempts').select('id').eq('exercise_id', id);
  if (attempts.error) return Response.json({ error: attempts.error.message }, { status: 400 });
  const attemptIds = (attempts.data || []).map(attempt => attempt.id);
  if (attemptIds.length) {
    const answers = await result.admin.from('attempt_answers').delete().in('attempt_id', attemptIds);
    if (answers.error) return Response.json({ error: answers.error.message }, { status: 400 });
    const removedAttempts = await result.admin.from('attempts').delete().in('id', attemptIds);
    if (removedAttempts.error) return Response.json({ error: removedAttempts.error.message }, { status: 400 });
  }
  const { error } = await result.admin.from('exercises').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true });
}
