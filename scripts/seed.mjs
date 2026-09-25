// Turns phrase_bank.json into published MCQ exercises (10 phrases each).
import { createClient } from '@supabase/supabase-js';
import bank from './phrase_bank.json' with { type: 'json' };

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
// Distractors always come from OTHER groups, so near-synonyms never appear together.
const others = p => shuffle(bank.filter(x => x.group !== p.group)).slice(0, 3);

function makeQuestion(p) {
  const key = p.phrase.replace(/\.\.\.$/, '');
  const at = p.example.toLowerCase().indexOf(key.toLowerCase());
  let prompt, correct, wrong;
  if (at >= 0) {
    prompt = 'Choose the best phrase: ' + p.example.slice(0, at) + '_____' + p.example.slice(at + key.length);
    correct = p.phrase; wrong = others(p).map(x => x.phrase);
  } else {
    prompt = `What does "${p.phrase}" mean?`;
    correct = p.meaning; wrong = others(p).map(x => x.meaning);
  }
  const options = shuffle([correct, ...wrong]);
  return { content: { prompt, options }, answer: options.indexOf(correct), explanation: `${p.phrase}: ${p.meaning}. Tone: ${p.tone}. Example: ${p.example}` };
}

for (let s = 0; s * 10 < bank.length; s++) {
  const chunk = bank.slice(s * 10, s * 10 + 10);
  const { data: ex } = await db.from('exercises').insert({ title: `Business Phrases - Set ${s + 1}`, category: 'Idioms & phrases', published: true }).select('id').single();
  const made = chunk.map(makeQuestion);
  const { data: qs } = await db.from('questions').insert(made.map((m, i) => ({ exercise_id: ex.id, position: i + 1, type: 'mcq', content: m.content }))).select('id,position').order('position');
  await db.from('question_keys').insert(qs.map((q, i) => ({ question_id: q.id, answer: made[i].answer, explanation: made[i].explanation })));
  console.log('Created set', s + 1);
}
