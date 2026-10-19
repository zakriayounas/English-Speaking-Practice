import test from 'node:test';
import assert from 'node:assert/strict';
import { OWNER_ID, parseExercises, validateExercises } from '../scripts/bulk-upload.mjs';

const categories = [
  { id: 'grammar-id', slug: 'grammar-mistakes', name: 'Grammar and Common Mistakes' },
];

const sampleExercise = {
  title: 'Everyday grammar',
  category: 'grammar-mistakes',
  level: 'beginner',
  targetMinutes: 5,
  visibility: 'members',
  questions: [{
    prompt: 'Choose the natural sentence.',
    options: ['She works here.', 'She work here.', 'She working here.', 'She are work here.'],
    answer: 'A',
    explanation: 'Use the third-person singular form works.',
  }],
};

test('bulk input accepts an array, an exercises wrapper, or one exercise', () => {
  assert.deepEqual(parseExercises([sampleExercise]), [sampleExercise]);
  assert.deepEqual(parseExercises({ exercises: [sampleExercise] }), [sampleExercise]);
  assert.deepEqual(parseExercises(sampleExercise), [sampleExercise]);
});

test('bulk validation resolves categories and preserves the validated exercise data', () => {
  const [exercise] = validateExercises({ exercises: [sampleExercise] }, categories);
  assert.equal(exercise.title, sampleExercise.title);
  assert.equal(exercise.category, categories[0].name);
  assert.equal(exercise.category_id, categories[0].id);
  assert.equal(exercise.level, 'beginner');
  assert.equal(exercise.target_seconds, 300);
  assert.equal(exercise.time_limit_min, 5);
  assert.equal(OWNER_ID, '3b455c49-cd89-406c-ba2d-c02dedcbf920');
});

test('bulk validation reports all invalid exercises before any upload', () => {
  assert.throws(
    () => validateExercises([{ ...sampleExercise, title: '' }, { ...sampleExercise, category: 'missing-category' }], categories),
    /Exercise 1 "untitled".*Title is required[\s\S]*Exercise 2 "Everyday grammar".*Unknown category/,
  );
});

test('bulk input rejects unsupported and empty formats', () => {
  assert.throws(() => parseExercises(null), /must contain an exercise object/);
  assert.throws(() => validateExercises({ exercises: [] }, categories), /contains no exercises/);
});
