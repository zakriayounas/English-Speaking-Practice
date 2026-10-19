import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { validateExercise } from '../lib/exercise-validate.js';

export const OWNER_ID = '3b455c49-cd89-406c-ba2d-c02dedcbf920';

export function parseExercises(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.exercises)) return input.exercises;
  if (input && typeof input === 'object') return [input];
  throw new Error('The JSON file must contain an exercise object, an array, or an "exercises" array.');
}

export function validateExercises(input, categories) {
  const exercises = parseExercises(input);
  if (!exercises.length) throw new Error('The JSON file contains no exercises.');

  const validated = [];
  const errors = [];
  exercises.forEach((inputExercise, index) => {
    const result = validateExercise(inputExercise, categories);
    if (!result.ok) {
      errors.push(...result.errors.map(error => `Exercise ${index + 1} "${inputExercise?.title || 'untitled'}" — ${error.path}: ${error.message}`));
      return;
    }
    const exercise = result.exercise;
    const category = categories.find(item => item.id === exercise.categoryId);
    validated.push({
      title: exercise.title,
      category: category.name,
      category_id: category.id,
      level: exercise.level,
      visibility: exercise.visibility,
      target_seconds: exercise.targetSeconds,
      time_limit_min: exercise.targetSeconds ? exercise.targetSeconds / 60 : null,
      questions: exercise.questions,
    });
  });

  if (errors.length) throw new Error(`Validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
  return validated;
}

function answerIndex(answer, options) {
  return answer.toUpperCase().charCodeAt(0) - 65;
}

async function insertExercise(db, exercise) {
  const { data: created, error: exerciseError } = await db.from('exercises').insert({
    owner_id: OWNER_ID,
    title: exercise.title,
    category: exercise.category,
    category_id: exercise.category_id,
    level: exercise.level,
    visibility: exercise.visibility,
    target_seconds: exercise.target_seconds,
    time_limit_min: exercise.time_limit_min,
    published: true,
    status: 'published',
  }).select('id').single();
  if (exerciseError) throw new Error(`Could not create "${exercise.title}": ${exerciseError.message}`);

  try {
    const questions = exercise.questions.map((question, index) => ({
      exercise_id: created.id,
      position: index + 1,
      type: 'mcq',
      prompt: question.prompt,
      content: { prompt: question.prompt, options: question.options },
    }));
    const { data: inserted, error: questionError } = await db.from('questions').insert(questions).select('id,position');
    if (questionError) throw new Error(`Could not add questions to "${exercise.title}": ${questionError.message}`);

    const ordered = [...inserted].sort((a, b) => a.position - b.position);
    const keys = ordered.map((question, index) => ({
      question_id: question.id,
      answer: answerIndex(exercise.questions[index].answer, exercise.questions[index].options),
      explanation: exercise.questions[index].explanation,
    }));
    const { error: keyError } = await db.from('question_keys').insert(keys);
    if (keyError) throw new Error(`Could not add answer keys to "${exercise.title}": ${keyError.message}`);
  } catch (error) {
    const { error: cleanupError } = await db.from('exercises').delete().eq('id', created.id);
    if (cleanupError) {
      throw new Error(`${error.message} Cleanup also failed for exercise ${created.id}: ${cleanupError.message}`);
    }
    throw error;
  }

  return created.id;
}

async function main(args) {
  const dryRunIndex = args.indexOf('--dry-run');
  const dryRun = dryRunIndex >= 0;
  if (dryRun) args.splice(dryRunIndex, 1);
  if (args.length !== 1 || args[0].startsWith('-')) {
    throw new Error('Usage: node --env-file=.env.local scripts/bulk-upload.mjs <json-file> [--dry-run]');
  }

  const filePath = path.resolve(args[0]);
  const input = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  }

  const db = createClient(url, serviceKey);
  const { data: categories, error } = await db.from('categories').select('id,slug,name').eq('active', true);
  if (error) throw new Error(`Could not load active categories: ${error.message}`);
  const exercises = validateExercises(input, categories || []);

  if (dryRun) {
    console.log(`Validation passed: ${exercises.length} exercise(s) ready. No database changes were made.`);
    exercises.forEach((exercise, index) => console.log(`${index + 1}. ${exercise.title} — ${exercise.category} — ${exercise.level}`));
    return;
  }

  for (const [index, exercise] of exercises.entries()) {
    const id = await insertExercise(db, exercise);
    console.log(`Uploaded ${index + 1}/${exercises.length}: ${exercise.title} (${id})`);
  }
  console.log(`Finished uploading ${exercises.length} exercise(s) for owner ${OWNER_ID}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
