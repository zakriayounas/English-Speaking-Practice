import test from 'node:test';
import assert from 'node:assert/strict';
import { createShufflePlan, OWNER_ID } from '../scripts/shuffle-exercise-answers.mjs';

function createDatabaseData() {
  const exercises = [{ id: 'exercise-1', title: 'Test exercise' }];
  const questions = Array.from({ length: 8 }, (_, index) => ({
    id: `question-${index + 1}`,
    exercise_id: 'exercise-1',
    position: index + 1,
    content: {
      prompt: `Question ${index + 1}`,
      options: [`Correct ${index + 1}`, `Wrong A ${index + 1}`, `Wrong B ${index + 1}`, `Wrong C ${index + 1}`],
    },
  }));
  const keys = questions.map(question => ({ question_id: question.id, answer: 0 }));
  return { exercises, questions, keys };
}

test('shuffle plan relocates correct options and keeps each answer key matched', () => {
  const { exercises, questions, keys } = createDatabaseData();
  const plan = createShufflePlan(exercises, questions, keys, () => 0);

  const answerCounts = [0, 0, 0, 0];
  plan.forEach(question => { answerCounts[question.answer] += 1; });
  assert.deepEqual(answerCounts, [2, 2, 2, 2]);
  assert.ok(plan.every((question, index) => index === 0 || question.answer !== plan[index - 1].answer));
  plan.forEach((question, index) => {
    assert.equal(question.content.options[question.answer], questions[index].content.options[0]);
    assert.deepEqual([...question.content.options].sort(), [...questions[index].content.options].sort());
  });
});

test('answer positions stay balanced and do not repeat consecutively for different exercise lengths', () => {
  for (const count of [1, 2, 3, 5, 6, 10, 25]) {
    const exercises = [{ id: 'exercise-1', title: `Exercise with ${count} questions` }];
    const questions = Array.from({ length: count }, (_, index) => ({
      id: `question-${index + 1}`,
      exercise_id: 'exercise-1',
      position: index + 1,
      content: { options: ['Correct', 'Wrong 1', 'Wrong 2', 'Wrong 3'] },
    }));
    const keys = questions.map(question => ({ question_id: question.id, answer: 0 }));
    const plan = createShufflePlan(exercises, questions, keys);
    const counts = [0, 0, 0, 0];
    plan.forEach((question, index) => {
      counts[question.answer] += 1;
      assert.ok(index === 0 || question.answer !== plan[index - 1].answer);
    });
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  }
});

test('shuffle plan uses questions and correct answers loaded from the database', () => {
  const { exercises, questions, keys } = createDatabaseData();
  keys[0].answer = 2;
  questions[0].content.options = ['Wrong A 1', 'Wrong B 1', 'Correct 1', 'Wrong C 1'];
  const plan = createShufflePlan(exercises, questions, keys, () => 0);
  assert.equal(plan[0].content.options[plan[0].answer], 'Correct 1');
});

test('shuffle plan rejects missing answer keys and invalid stored options', () => {
  const { exercises, questions, keys } = createDatabaseData();
  assert.throws(() => createShufflePlan(exercises, questions, keys.slice(1)), /has no stored answer key/);
  questions[0].content.options = ['Only one option'];
  assert.throws(() => createShufflePlan(exercises, questions, keys), /does not have exactly four stored options/);
});

test('shuffle plan ignores owner exercises that have no question rows', () => {
  const { exercises, questions, keys } = createDatabaseData();
  exercises.push({ id: 'empty-exercise', title: 'Simple Email Basics' });
  const plan = createShufflePlan(exercises, questions, keys, () => 0);
  assert.equal(plan.length, questions.length);
  assert.ok(plan.every(question => question.exerciseId === 'exercise-1'));
});

test('shuffle is scoped to the configured exercise owner', () => {
  assert.equal(OWNER_ID, '3b455c49-cd89-406c-ba2d-c02dedcbf920');
});
