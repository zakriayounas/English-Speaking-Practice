import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, summarizeByCategory, summarizePeople } from '../lib/stats.js';

test('joining answers does not double-count attempts', () => {
  const attempts = [
    { id: 'a1', user_id: 'u1', score: 1, max_score: 2, duration_ms: 1000, category_id: 'c1', categoryName: 'Work' },
    { id: 'a2', user_id: 'u1', score: 2, max_score: 2, duration_ms: null, category_id: 'c1', categoryName: 'Work' },
  ];
  const answers = [
    { attempt_id: 'a1', time_ms: 400 },
    { attempt_id: 'a1', time_ms: 600 },
    { attempt_id: 'a2', time_ms: null },
    { attempt_id: 'a2', time_ms: 200 },
  ];
  const summary = summarize(attempts, answers);
  assert.equal(summary.completed, 2);
  assert.equal(summary.averageScore, 0.75);
  assert.equal(summary.averageTimePerQuestionMs, 400);
  assert.equal(summary.averageTimePerAttemptMs, 1000);

  const byCategory = summarizeByCategory(attempts, answers);
  assert.equal(byCategory.length, 1);
  assert.equal(byCategory[0].completed, 2);

  const people = summarizePeople(attempts, answers);
  assert.equal(people.length, 1);
  assert.equal(people[0].completed, 2);
  assert.equal(people[0].averageTimePerQuestionMs, 400);
});

test('missing timing is left out of averages', () => {
  const summary = summarize([
    { id: 'a1', score: 0, max_score: 0, duration_ms: null },
    { id: 'a2', score: 1, max_score: 1, duration_ms: 500 },
  ], [{ attempt_id: 'a1', time_ms: null }]);
  assert.equal(summary.completed, 2);
  assert.equal(summary.averageScore, 1);
  assert.equal(summary.averageTimePerQuestionMs, null);
  assert.equal(summary.averageTimePerAttemptMs, 500);
});
