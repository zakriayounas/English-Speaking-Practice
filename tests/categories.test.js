import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const schema = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'schema.sql'), 'utf8');

const expected = [
  ['grammar-mistakes', 'Grammar'],
  ['vocabulary-synonyms', 'Vocabulary'],
  ['phrasal-verbs-collocations', 'Vocabulary'],
  ['idioms-phrases', 'Vocabulary'],
  ['daily-conversation', 'Daily life'],
  ['speaking-conversation', 'Communication'],
  ['listening-pronunciation', 'Communication'],
  ['workplace-english', 'Work'],
  ['software-dev-communication', 'Work'],
  ['reading-writing', 'Reading and writing'],
  ['ielts-speaking', 'Exams'],
];

test('the category seed covers each learning area once', () => {
  for (const [slug, area] of expected) {
    assert.match(schema, new RegExp(`'${slug}', '[^']+', '[^']+', '${area}'`));
  }
  assert.match(schema, /slug = 'emotions-expressions'/);
  assert.match(schema, /set active = false/);
  assert.doesNotMatch(schema, /'emotions-expressions', 'Emotions and Expressions'/);
});
