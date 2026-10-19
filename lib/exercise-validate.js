import { resolveCategory } from './exercise-parse.js';

const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

export function validateExercise(input, categories) {
  const errors = [];
  const title = String(input?.title || '').trim();
  if (!title) errors.push({ path: 'title', message: 'Title is required.' });

  let category = null;
  if (input?.categoryId) {
    category = (categories || []).find(item => item.id === input.categoryId) || null;
    if (!category) errors.push({ path: 'category', message: 'Choose a category.' });
  } else {
    const resolved = resolveCategory(input?.category, categories);
    if (resolved.error) errors.push({ path: 'category', message: resolved.error });
    else category = resolved.category;
  }

  const level = String(input?.level || '').trim();
  if (!LEVELS.has(level)) errors.push({ path: 'level', message: 'Level is required.' });

  let targetSeconds = null;
  if (input?.targetMinutes !== '' && input?.targetMinutes != null) {
    const minutes = Number(input.targetMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) errors.push({ path: 'target', message: 'Target time must be a positive whole number of minutes.' });
    else targetSeconds = minutes * 60;
  } else if (input?.targetSeconds != null && input.targetSeconds !== '') {
    const seconds = Number(input.targetSeconds);
    if (!Number.isInteger(seconds) || seconds <= 0) errors.push({ path: 'target', message: 'Target time must be a positive whole number of minutes.' });
    else targetSeconds = seconds;
  }

  const visibility = input?.visibility === 'public' ? 'public' : input?.visibility === 'members' ? 'members' : '';
  if (!visibility) errors.push({ path: 'visibility', message: 'Choose Public or Members only.' });

  const questions = Array.isArray(input?.questions) ? input.questions : [];
  if (!questions.length) errors.push({ path: 'questions', message: 'Add at least one question.' });
  const normalizedQuestions = questions.map((question, index) => {
    const prompt = String(question?.prompt || '');
    const options = Array.isArray(question?.options) ? question.options.map(option => String(option ?? '')) : [];
    const explanation = String(question?.explanation || '');
    if (!prompt.trim()) errors.push({ path: `questions.${index}.prompt`, message: `Question ${index + 1} needs a prompt.` });
    if (options.length !== 4 || options.some(option => !option.trim())) errors.push({ path: `questions.${index}.options`, message: `Question ${index + 1} needs exactly four answers.` });
    const answer = String(question?.answer ?? '').trim();
    const letter = /^[A-D]$/i.test(answer) ? answer.toUpperCase() : '';
    const matched = options.findIndex(option => option.trim().toLowerCase() === answer.toLowerCase());
    if (!letter && matched < 0) errors.push({ path: `questions.${index}.answer`, message: `Question ${index + 1} needs a valid answer.` });
    if (!explanation.trim()) errors.push({ path: `questions.${index}.explanation`, message: `Question ${index + 1} needs an explanation.` });
    return {
      id: question.id,
      prompt,
      options,
      answer: letter || (matched >= 0 ? String.fromCharCode(65 + matched) : answer),
      explanation,
    };
  });

  return {
    ok: errors.length === 0,
    errors,
    exercise: {
      title,
      categoryId: category?.id || null,
      categoryName: category?.name || '',
      level,
      targetSeconds,
      visibility: visibility || 'members',
      questions: normalizedQuestions,
    },
  };
}
