import mammoth from 'mammoth';

function normalizeLevel(value) {
  const level = String(value || 'beginner').trim().toLowerCase();
  return ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'beginner';
}

const acceptedTemplate = `Title: Business phrases
Category: Workplace English
Level: Beginner

Question: Choose the best phrase: Want to lead the project? _____!
A: Go for it
B: Never mind
C: Hold on
D: Not really
Answer: A
Explanation: Go for it means do it; I support you.

Separate questions with a blank line.`;

function parseJson(text) {
  const input = JSON.parse(text);
  const questions = Array.isArray(input) ? input : input.questions;
  if (!Array.isArray(questions)) throw new Error('JSON must be an array or contain a questions array.');
  return {
    title: input.title || 'Untitled exercise',
    category: input.category || 'English practice',
    level: normalizeLevel(input.level),
    questions: questions.map((question, index) => ({
      prompt: question.prompt || question.question,
      options: question.options,
      answer: typeof question.answer === 'string' ? question.answer : String(question.answer),
      explanation: question.explanation || '',
      position: index + 1,
    })),
  };
}

function parseTemplate(text) {
  const title = text.match(/^Title:\s*(.+)$/im)?.[1]?.trim() || 'Untitled exercise';
  const category = text.match(/^Category:\s*(.+)$/im)?.[1]?.trim() || 'English practice';
  const level = normalizeLevel(text.match(/^Level:\s*(.+)$/im)?.[1]?.trim());
  const blocks = text.split(/\n\s*\n/).filter(block => /^Question:/im.test(block));
  const questions = blocks.map((block, index) => {
    const value = name => block.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))?.[1]?.trim() || '';
    const options = ['A', 'B', 'C', 'D'].map(letter => value(letter)).filter(Boolean);
    const answer = value('Answer');
    if (!value('Question') || options.length < 2 || !answer) throw new Error(`Question ${index + 1} needs a Question, at least two options, and an Answer.`);
    return { prompt: value('Question'), options, answer, explanation: value('Explanation'), position: index + 1 };
  });
  if (!questions.length) throw new Error('No questions found. Use the template format shown below.');
  return { title, category, level, questions };
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const pasted = form.get('text');
    const forcedLevel = normalizeLevel(form.get('level'));
    let text = typeof pasted === 'string' ? pasted.trim() : '';
    if (file && typeof file.arrayBuffer === 'function' && file.size) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith('.docx')) text = (await mammoth.extractRawText({ buffer })).value;
      else text = buffer.toString('utf8');
    }
    if (!text) return Response.json({ error: 'Paste text or upload a .txt, .md, .json, or .docx file.' }, { status: 400 });
    const parsed = text.trim().startsWith('{') || text.trim().startsWith('[') ? parseJson(text) : parseTemplate(text);
    return Response.json({ ...parsed, level: parsed.level || forcedLevel, template: acceptedTemplate });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not parse this exercise.' }, { status: 400 });
  }
}
