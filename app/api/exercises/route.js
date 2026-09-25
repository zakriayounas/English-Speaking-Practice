import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  const { data: { user } } = await admin.auth.getUser(token);
  return user;
}

function normalizeLevel(value) {
  const level = String(value || 'beginner').trim().toLowerCase();
  return ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'beginner';
}

function normalizeAnswer(value, options) {
  const rawAnswer = String(value ?? '').trim();
  const letterIndex = /^[A-Z]$/i.test(rawAnswer) ? rawAnswer.toUpperCase().charCodeAt(0) - 65 : Number(rawAnswer);
  return Number.isInteger(letterIndex) && letterIndex >= 0 && letterIndex < options.length ? letterIndex : rawAnswer;
}

async function getOwnedExercise(id, userId) {
  const { data, error } = await admin.from('exercises').select('id,title,category,level,published,status,owner_id').eq('id', id).single();
  if (error || !data) return { error: Response.json({ error: 'Exercise not found.' }, { status: 404 }) };
  if (data.owner_id !== userId) return { error: Response.json({ error: 'You can only manage exercises you created.' }, { status: 403 }) };
  return { data };
}

export async function GET(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Exercise id is required.' }, { status: 400 });
  const owned = await getOwnedExercise(id, user.id);
  if (owned.error) return owned.error;
  const [{ data: questions, error: questionError }, { data: keys, error: keyError }] = await Promise.all([
    admin.from('questions').select('id,position,content').eq('exercise_id', id).order('position'),
    admin.from('question_keys').select('question_id,answer,explanation').in('question_id', (await admin.from('questions').select('id').eq('exercise_id', id)).data?.map(question => question.id) || []),
  ]);
  if (questionError || keyError) return Response.json({ error: questionError?.message || keyError?.message }, { status: 400 });
  const keyMap = Object.fromEntries((keys || []).map(key => [key.question_id, key]));
  return Response.json({ exercise: owned.data, questions: (questions || []).map(question => ({ id: question.id, prompt: question.content.prompt, options: question.content.options || [], answer: Number.isInteger(keyMap[question.id]?.answer) ? String.fromCharCode(65 + keyMap[question.id].answer) : String(keyMap[question.id]?.answer || ''), explanation: keyMap[question.id]?.explanation || '' })) });
}

export async function POST(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.title?.trim() || !Array.isArray(body.questions) || !body.questions.length) return Response.json({ error: 'A title and at least one question are required.' }, { status: 400 });
  const published = body.published === true;
  const level = normalizeLevel(body.level);
  const { data: exercise, error: exerciseError } = await admin.from('exercises').insert({ owner_id: user.id, title: body.title.trim(), category: body.category?.trim() || 'English practice', level, published, status: published ? 'published' : 'draft' }).select('id,title,category,level,published,status').single();
  if (exerciseError) return Response.json({ error: exerciseError.message }, { status: 400 });
  const questions = body.questions.map((question, index) => ({ exercise_id: exercise.id, position: index + 1, type: 'mcq', content: { prompt: question.prompt, options: question.options } }));
  const { data: inserted, error: questionError } = await admin.from('questions').insert(questions).select('id,position');
  if (questionError) return Response.json({ error: questionError.message }, { status: 400 });
  const keys = inserted.map((question, index) => {
    const source = body.questions[index];
    const answer = normalizeAnswer(source.answer, source.options);
    return { question_id: question.id, answer, explanation: source.explanation || '' };
  });
  const { error: keyError } = await admin.from('question_keys').insert(keys);
  if (keyError) return Response.json({ error: keyError.message }, { status: 400 });
  return Response.json({ exercise });
}

export async function PUT(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const owned = await getOwnedExercise(body.id, user.id);
  if (owned.error) return owned.error;
  if (!body.title?.trim() || !Array.isArray(body.questions) || !body.questions.length) return Response.json({ error: 'A title and at least one question are required.' }, { status: 400 });
  const existingQuestionResult = await admin.from('questions').select('id').eq('exercise_id', body.id);
  if (existingQuestionResult.error) return Response.json({ error: existingQuestionResult.error.message }, { status: 400 });
  const existingIds = existingQuestionResult.data || [];
  const existingIdSet = new Set(existingIds.map(question => question.id));
  const submittedIds = new Set(body.questions.filter(question => question.id).map(question => question.id));
  const invalidIds = [...submittedIds].filter(questionId => !existingIdSet.has(questionId));
  if (invalidIds.length) return Response.json({ error: 'One or more questions do not belong to this exercise.' }, { status: 400 });
  const removedIds = existingIds.filter(question => !submittedIds.has(question.id)).map(question => question.id);
  if (removedIds.length) {
    const { data: usedAnswers } = await admin.from('attempt_answers').select('question_id').in('question_id', removedIds);
    if (usedAnswers?.length) return Response.json({ error: 'Questions used in learner attempts cannot be removed.' }, { status: 400 });
    await admin.from('question_keys').delete().in('question_id', removedIds);
    const { error: removeError } = await admin.from('questions').delete().in('id', removedIds);
    if (removeError) return Response.json({ error: removeError.message }, { status: 400 });
  }
  const { error: exerciseError } = await admin.from('exercises').update({ title: body.title.trim(), category: body.category?.trim() || 'English practice', level: normalizeLevel(body.level), published: body.published === true, status: body.published === true ? 'published' : 'draft' }).eq('id', body.id).eq('owner_id', user.id);
  if (exerciseError) return Response.json({ error: exerciseError.message }, { status: 400 });
  for (const [index, question] of body.questions.entries()) {
    const content = { prompt: question.prompt, options: question.options };
    let questionId = question.id;
    if (questionId) {
      const { error } = await admin.from('questions').update({ position: index + 1, content }).eq('id', questionId).eq('exercise_id', body.id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
    } else {
      const { data, error } = await admin.from('questions').insert({ exercise_id: body.id, position: index + 1, type: 'mcq', content }).select('id').single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      if (!data?.id) return Response.json({ error: 'The new question could not be created.' }, { status: 400 });
      questionId = data.id;
    }
    const { data: savedQuestion, error: savedQuestionError } = await admin.from('questions').select('id').eq('id', questionId).eq('exercise_id', body.id).maybeSingle();
    if (savedQuestionError || !savedQuestion) return Response.json({ error: 'The question could not be verified before saving its answer.' }, { status: 400 });
    const { error: keyError } = await admin.from('question_keys').upsert({ question_id: questionId, answer: normalizeAnswer(question.answer, question.options), explanation: question.explanation || '' });
    if (keyError) return Response.json({ error: keyError.message }, { status: 400 });
  }
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  const owned = await getOwnedExercise(id, user.id);
  if (owned.error) return owned.error;
  await admin.from('attempts').update({ exercise_id: null }).eq('exercise_id', id);
  const { error } = await admin.from('exercises').delete().eq('id', id).eq('owner_id', user.id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true });
}
