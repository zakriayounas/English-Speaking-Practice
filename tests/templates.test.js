import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';
import { parseExercise, applyCategory } from '../lib/exercise-parse.js';
import { splitInlineMarkup } from '../lib/rich-text.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = path.join(root, 'public', 'templates');
const categories = [{ id: 'workplace', slug: 'workplace-english', name: 'Workplace and Business English' }];

function read(name) {
  return fs.readFileSync(path.join(templateDir, name), 'utf8');
}

function comparable(exercise) {
  return {
    title: exercise.title,
    category: exercise.category,
    level: exercise.level,
    targetMinutes: exercise.targetMinutes,
    visibility: exercise.visibility,
    questions: exercise.questions.map(question => ({
      prompt: question.prompt,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
    })),
  };
}

test('static template files exist and are not generated in application code', () => {
  for (const name of ['exercise.txt', 'exercise.md', 'exercise.json', 'exercise.docx']) {
    assert.equal(fs.existsSync(path.join(templateDir, name)), true, `${name} is missing`);
  }
  const sources = [
    'components/ExerciseEditor.js',
    'app/api/exercises/parse/route.js',
    'app/api/exercises/template/route.js',
    'app/add/page.js',
    'app/upload/page.js',
  ];
  const title = 'Starting a standup';
  for (const source of sources) {
    const contents = fs.readFileSync(path.join(root, source), 'utf8');
    assert.equal(contents.includes(title), false, `${source} hardcodes the template`);
  }
  const editor = fs.readFileSync(path.join(root, 'components', 'ExerciseEditor.js'), 'utf8');
  assert.match(editor, /\/templates\/exercise\.md/);
  assert.match(editor, /\/templates\/exercise\.txt/);
  assert.match(editor, /\/templates\/exercise\.json/);
  assert.match(editor, /\/templates\/exercise\.docx/);
});

test('text, markdown, and json templates parse to the same exercise', () => {
  const text = applyCategory(parseExercise(read('exercise.txt')), categories);
  const markdown = applyCategory(parseExercise(read('exercise.md')), categories);
  const json = applyCategory(parseExercise(read('exercise.json')), categories);
  assert.equal(text.ok, true, JSON.stringify(text.errors));
  assert.equal(markdown.ok, true, JSON.stringify(markdown.errors));
  assert.equal(json.ok, true, JSON.stringify(json.errors));
  assert.deepEqual(comparable(markdown.exercise), comparable(text.exercise));
  assert.deepEqual(comparable(json.exercise), comparable(text.exercise));
  assert.equal(text.exercise.categoryId, 'workplace');
  assert.match(text.exercise.questions[0].prompt, /Want to lead the standup/);
  assert.match(text.exercise.questions[0].prompt, /You were late/);
  assert.match(text.exercise.questions[0].explanation, /\*\*I'll keep this short\*\*/);
  assert.match(text.exercise.questions[0].explanation, /Sorry I'm late/);
  assert.match(text.exercise.questions[0].explanation, /Use this when you still want to contribute/);
  assert.equal(text.exercise.questions[0].options.length, 4);
});

test('invalid imports keep field paths and do not invent an exercise', () => {
  const parsed = parseExercise(`Title: Broken set
Category: workplace-english
Level: beginner

Question:
Where is the prompt going?

A: One
B: Two
C:
D: Four
Answer: Q
Explanation:
`);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors.some(error => /four answers/.test(error.message)));
  assert.ok(parsed.errors.some(error => /valid answer/.test(error.message)));
  assert.ok(parsed.errors.some(error => /explanation/.test(error.message)));
  assert.ok(parsed.errors.every(error => error.path));
});

test('unknown categories are rejected without changing the parsed text', () => {
  const parsed = applyCategory(parseExercise(read('exercise.txt')), [{ id: 'other', slug: 'daily-conversation', name: 'Daily Life Conversations' }]);
  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.at(-1).message, /Unknown category/);
  assert.equal(parsed.exercise.title, 'Starting a standup');
});

test('the word template parses and keeps the same prompts', async () => {
  const buffer = fs.readFileSync(path.join(templateDir, 'exercise.docx'));
  const extracted = await mammoth.extractRawText({ buffer });
  const parsed = parseExercise(extracted.value);
  const text = parseExercise(read('exercise.txt'));
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  assert.deepEqual(parsed.exercise.questions.map(question => question.prompt.replace(/\n+/g, '\n')), text.exercise.questions.map(question => question.prompt));
  assert.match(parsed.exercise.questions[0].explanation, /\*\*I'll keep this short\*\*/);
});

test('legacy markdown blocks still import', () => {
  const parsed = parseExercise(`Title: Legacy
Category: workplace-english
Level: intermediate

## Question 1
**Prompt:** Choose the best phrase.
- Go for it
- Never mind
- Hold on
- Not really
**Answer:** Go for it
**Explanation:** **Go for it** means I support you.
`);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  assert.equal(parsed.exercise.questions[0].answer, 'A');
  assert.match(parsed.exercise.questions[0].explanation, /\*\*Go for it\*\*/);
});

test('long explanations keep quotes, bold markers, and paragraphs', () => {
  const explanation = [
    'She said, "Try again tomorrow."',
    '**Bold stays bold** across the first paragraph.',
    '',
    'Second paragraph with "quotes" and more detail.',
    'C'.repeat(1200),
  ].join('\n');
  const parsed = parseExercise(`Title: Long explanation
Category: workplace-english
Level: advanced

Question:
Explain the tone of this sentence.
It has two lines.

A: Polite
B: Rude
C: Unclear
D: Angry
Answer: A
Explanation:
${explanation}
`);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  assert.equal(parsed.exercise.questions[0].explanation, explanation);
  const parts = splitInlineMarkup(parsed.exercise.questions[0].explanation);
  assert.equal(parts.some(part => part.type === 'bold' && part.value === 'Bold stays bold'), true);
  assert.equal(parts.map(part => part.value).join(''), parsed.exercise.questions[0].explanation.replace(/\*\*/g, ''));
  assert.match(parts.map(part => part.value).join(''), /Second paragraph/);
  assert.equal(parts.some(part => part.value.includes('<')), false);
});
