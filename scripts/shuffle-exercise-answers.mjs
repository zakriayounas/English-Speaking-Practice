import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export const OWNER_ID = '3b455c49-cd89-406c-ba2d-c02dedcbf920';
const PAGE_SIZE = 1000;

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function answerPositions(count, random = Math.random) {
  const positions = [];
  while (positions.length < count) {
    const group = shuffle([0, 1, 2, 3], random);
    if (group[0] === positions.at(-1)) group.push(group.shift());
    positions.push(...group.slice(0, count - positions.length));
  }
  return positions;
}

function answerIndex(answer, questionId) {
  const index = typeof answer === 'number'
    ? answer
    : typeof answer === 'string' && answer.trim() !== ''
      ? Number(answer)
      : Number.NaN;
  if (!Number.isInteger(index) || index < 0 || index > 3) {
    throw new Error(`Question ${questionId} has an invalid stored answer key.`);
  }
  return index;
}

export function createShufflePlan(exercises, questions, keys, random = Math.random) {
  const exercisesById = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const keysByQuestionId = new Map(keys.map(key => [key.question_id, key]));
  const questionsByExerciseId = new Map();

  for (const question of questions) {
    const exercise = exercisesById.get(question.exercise_id);
    if (!exercise) throw new Error(`Question ${question.id} is not attached to a selected exercise.`);
    if (!Array.isArray(question.content?.options)
      || question.content.options.length !== 4
      || question.content.options.some(option => typeof option !== 'string')) {
      throw new Error(`"${exercise.title}" question ${question.position} does not have exactly four stored options.`);
    }

    const exerciseQuestions = questionsByExerciseId.get(exercise.id) || [];
    exerciseQuestions.push(question);
    questionsByExerciseId.set(exercise.id, exerciseQuestions);
  }

  const plan = [];
  for (const exercise of exercises) {
    const exerciseQuestions = (questionsByExerciseId.get(exercise.id) || [])
      .sort((a, b) => a.position - b.position);
    if (!exerciseQuestions.length) continue;

    const targetAnswers = answerPositions(exerciseQuestions.length, random);

    for (const [index, question] of exerciseQuestions.entries()) {
      const key = keysByQuestionId.get(question.id);
      if (!key) throw new Error(`"${exercise.title}" question ${question.position} has no stored answer key.`);
      const oldAnswer = answerIndex(key.answer, question.id);
      const correctOption = question.content.options[oldAnswer];
      const distractors = shuffle(
        question.content.options.filter((_, optionIndex) => optionIndex !== oldAnswer),
        random,
      );
      const newAnswer = targetAnswers[index];
      distractors.splice(newAnswer, 0, correctOption);

      plan.push({
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        id: question.id,
        position: question.position,
        oldContent: question.content,
        oldAnswer: key.answer,
        content: { ...question.content, options: distractors },
        answer: newAnswer,
      });
    }
  }

  return plan;
}

async function fetchAll(createQuery) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await createQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function loadPlan(db) {
  const exercises = await fetchAll(() => db.from('exercises')
    .select('id,title')
    .eq('owner_id', OWNER_ID)
    .order('created_at'));
  if (!exercises.length) return { exercises, plan: [] };

  const questions = [];
  for (let offset = 0; offset < exercises.length; offset += 200) {
    const ids = exercises.slice(offset, offset + 200).map(exercise => exercise.id);
    questions.push(...await fetchAll(() => db.from('questions')
      .select('id,exercise_id,position,content')
      .in('exercise_id', ids)
      .order('position')));
  }
  const keys = [];
  for (let offset = 0; offset < questions.length; offset += 200) {
    const ids = questions.slice(offset, offset + 200).map(question => question.id);
    keys.push(...await fetchAll(() => db.from('question_keys')
      .select('question_id,answer')
      .in('question_id', ids)));
  }

  return { exercises, plan: createShufflePlan(exercises, questions, keys) };
}

async function restoreChanges(db, questions) {
  const failures = [];
  for (const question of [...questions].reverse()) {
    const { error: contentError } = await db.from('questions')
      .update({ content: question.oldContent })
      .eq('id', question.id);
    if (contentError) failures.push(`question ${question.id}: ${contentError.message}`);

    const { error: keyError } = await db.from('question_keys')
      .update({ answer: question.oldAnswer })
      .eq('question_id', question.id);
    if (keyError) failures.push(`answer key ${question.id}: ${keyError.message}`);
  }
  return failures;
}

async function applyPlan(db, plan) {
  const changed = [];
  for (const question of plan) {
    const { error: contentError } = await db.from('questions')
      .update({ content: question.content })
      .eq('id', question.id);
    if (contentError) {
      const rollbackErrors = await restoreChanges(db, changed);
      throw new Error(`Could not update options for "${question.exerciseTitle}" question ${question.position}: ${contentError.message}${rollbackErrors.length ? ` Rollback errors: ${rollbackErrors.join('; ')}` : ' Previous changes were rolled back.'}`);
    }

    const { error: keyError } = await db.from('question_keys')
      .update({ answer: question.answer })
      .eq('question_id', question.id);
    if (keyError) {
      const rollbackErrors = await restoreChanges(db, [...changed, question]);
      throw new Error(`Could not update the answer key for "${question.exerciseTitle}" question ${question.position}: ${keyError.message}${rollbackErrors.length ? ` Rollback errors: ${rollbackErrors.join('; ')}` : ' Changes were rolled back.'}`);
    }
    changed.push(question);
  }
}

async function main(args) {
  const dryRunIndex = args.indexOf('--dry-run');
  const dryRun = dryRunIndex >= 0;
  if (dryRun) args.splice(dryRunIndex, 1);
  if (args.length) {
    throw new Error('Usage: node --env-file=.env.local scripts/shuffle-exercise-answers.mjs [--dry-run]');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  }

  const db = createClient(url, serviceKey);
  const { exercises, plan } = await loadPlan(db);
  if (!exercises.length) {
    console.log(`No exercises found for owner ${OWNER_ID}.`);
    return;
  }

  const exercisesWithQuestions = new Set(plan.map(question => question.exerciseId));
  for (const exercise of exercises) {
    const exerciseQuestions = plan.filter(question => question.exerciseId === exercise.id);
    if (!exercisesWithQuestions.has(exercise.id)) {
      console.warn(`Skipping "${exercise.title}": it has no stored questions.`);
      continue;
    }
    const answerCounts = [0, 0, 0, 0];
    exerciseQuestions.forEach(question => { answerCounts[question.answer] += 1; });
    console.log(`${dryRun ? 'Ready' : 'Validated'}: ${exercise.title} — ${exerciseQuestions.length} questions; answer positions A-D: ${answerCounts.join('/')}`);
  }

  if (!plan.length) {
    throw new Error(`No questions were found for exercises owned by ${OWNER_ID}; nothing was changed.`);
  }

  if (dryRun) {
    console.log(`Dry run complete. ${plan.length} questions checked; no database changes were made.`);
    return;
  }

  await applyPlan(db, plan);
  console.log(`Shuffled options and updated answer keys for ${plan.length} questions across ${exercisesWithQuestions.size} exercise(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
