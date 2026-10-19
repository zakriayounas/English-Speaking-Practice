const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

function trimBlock(value) {
  return String(value || '').replace(/^\n+|\n+$/g, '');
}

function pushError(errors, line, path, message) {
  errors.push({ line: line || null, path, message });
}

function normalizeLevel(value) {
  const level = String(value || '').trim().toLowerCase();
  return LEVELS.has(level) ? level : '';
}

function normalizeVisibility(value) {
  const visibility = String(value || '').trim().toLowerCase();
  if (visibility === 'public') return 'public';
  if (visibility === 'members' || visibility === 'members-only' || visibility === 'members only') return 'members';
  return '';
}

function normalizeAnswer(answer, options) {
  const raw = String(answer || '').trim();
  if (/^[A-D]$/i.test(raw)) return raw.toUpperCase();
  const index = options.findIndex(option => option.trim().toLowerCase() === raw.toLowerCase());
  return index >= 0 ? String.fromCharCode(65 + index) : raw;
}

function questionFromParts({ prompt, options, answer, explanation, line }, errors, index) {
  const path = `questions[${index}]`;
  const cleanOptions = options.map(option => String(option ?? ''));
  const cleanPrompt = trimBlock(prompt);
  const cleanExplanation = trimBlock(explanation);
  if (!cleanPrompt) pushError(errors, line, `${path}.prompt`, `Question ${index + 1} needs a prompt.`);
  if (cleanOptions.length !== 4 || cleanOptions.some(option => !option.trim())) {
    pushError(errors, line, `${path}.options`, `Question ${index + 1} needs exactly four answers.`);
  }
  const normalized = normalizeAnswer(answer, cleanOptions);
  if (!/^[A-D]$/.test(normalized)) {
    pushError(errors, line, `${path}.answer`, `Question ${index + 1} needs a valid answer.`);
  }
  if (!cleanExplanation) pushError(errors, line, `${path}.explanation`, `Question ${index + 1} needs an explanation.`);
  return {
    prompt: cleanPrompt,
    options: cleanOptions.slice(0, 4),
    answer: /^[A-D]$/.test(normalized) ? normalized : String(answer || '').trim(),
    explanation: cleanExplanation,
    line,
  };
}

function headerValue(lines, name) {
  const match = lines.find(entry => entry.text.match(new RegExp(`^${name}:\\s*(.*)$`, 'i')));
  if (!match) return { value: '', line: null };
  return { value: match.text.replace(new RegExp(`^${name}:\\s*`, 'i'), '').trim(), line: match.line };
}

function parseFieldTemplate(text) {
  const errors = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((textLine, index) => ({ text: textLine, line: index + 1 }));
  const firstQuestion = lines.findIndex(entry => /^Question:\s*/i.test(entry.text));
  if (firstQuestion === -1) {
    pushError(errors, 1, 'questions', 'No questions found. Start each question with Question:.');
    return { ok: false, errors };
  }
  const header = lines.slice(0, firstQuestion);
  const title = headerValue(header, 'Title');
  const category = headerValue(header, 'Category');
  const level = headerValue(header, 'Level');
  const target = headerValue(header, 'Target');
  const visibility = headerValue(header, 'Visibility');
  const questions = [];
  let current = null;

  function finish(block) {
    if (!block) return;
    questions.push(questionFromParts(block, errors, questions.length));
  }

  lines.slice(firstQuestion).forEach(entry => {
    const questionMatch = entry.text.match(/^Question:\s?(.*)$/i);
    const optionMatch = entry.text.match(/^([A-D]):\s*(.*)$/);
    const answerMatch = entry.text.match(/^Answer:\s*(.*)$/i);
    const explanationMatch = entry.text.match(/^Explanation:\s?(.*)$/i);
    if (questionMatch) {
      finish(current);
      current = { prompt: questionMatch[1], options: ['', '', '', ''], answer: '', explanation: '', line: entry.line, mode: 'prompt' };
      return;
    }
    if (!current) return;
    if (explanationMatch) {
      current.mode = 'explanation';
      current.explanation = explanationMatch[1];
      return;
    }
    if (current.mode === 'explanation') {
      current.explanation += `\n${entry.text}`;
      return;
    }
    if (optionMatch) {
      current.mode = 'options';
      current.options[optionMatch[1].charCodeAt(0) - 65] = optionMatch[2];
      return;
    }
    if (answerMatch) {
      current.mode = 'answer';
      current.answer = answerMatch[1].trim();
      return;
    }
    if (current.mode === 'prompt') current.prompt += `\n${entry.text}`;
  });
  finish(current);

  const targetMinutes = target.value === '' ? '' : Number(target.value);
  if (target.value !== '' && (!Number.isInteger(targetMinutes) || targetMinutes <= 0)) {
    pushError(errors, target.line, 'target', 'Target time must be a positive whole number of minutes.');
  }
  const parsedVisibility = visibility.value ? normalizeVisibility(visibility.value) : 'members';
  if (visibility.value && !parsedVisibility) pushError(errors, visibility.line, 'visibility', 'Visibility must be Public or Members.');

  return finishExercise({
    title: title.value,
    titleLine: title.line,
    category: category.value,
    categoryLine: category.line,
    level: normalizeLevel(level.value),
    levelLine: level.line,
    rawLevel: level.value,
    targetMinutes: target.value === '' ? '' : targetMinutes,
    visibility: parsedVisibility || 'members',
    questions,
  }, errors);
}

function parseMarkdownBlocks(text) {
  const errors = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((textLine, index) => ({ text: textLine, line: index + 1 }));
  const title = headerValue(lines, 'Title');
  const category = headerValue(lines, 'Category');
  const level = headerValue(lines, 'Level');
  const questions = [];
  let current = null;

  function finish(block) {
    if (!block) return;
    questions.push(questionFromParts({
      prompt: block.prompt,
      options: block.options,
      answer: block.answer,
      explanation: block.explanation,
      line: block.line,
    }, errors, questions.length));
  }

  lines.forEach(entry => {
    if (/^##\s+Question\b/i.test(entry.text)) {
      finish(current);
      current = { prompt: '', options: [], answer: '', explanation: '', line: entry.line, mode: 'seek' };
      return;
    }
    if (!current) return;
    const promptMatch = entry.text.match(/^\*\*Prompt:\*\*\s?(.*)$/i);
    const answerMatch = entry.text.match(/^\*\*Answer:\*\*\s?(.*)$/i);
    const explanationMatch = entry.text.match(/^\*\*Explanation:\*\*\s?(.*)$/i);
    const optionMatch = entry.text.match(/^[-*]\s+(.*)$/);
    if (promptMatch) {
      current.mode = 'prompt';
      current.prompt = promptMatch[1];
      return;
    }
    if (answerMatch) {
      current.mode = 'answer';
      current.answer = answerMatch[1].trim();
      return;
    }
    if (explanationMatch) {
      current.mode = 'explanation';
      current.explanation = explanationMatch[1];
      return;
    }
    if (current.mode === 'explanation') {
      current.explanation += `\n${entry.text}`;
      return;
    }
    if (optionMatch && current.mode !== 'explanation') {
      current.options.push(optionMatch[1]);
      return;
    }
    if (current.mode === 'prompt' && entry.text.trim()) current.prompt += `\n${entry.text}`;
  });
  finish(current);

  return finishExercise({
    title: title.value,
    titleLine: title.line,
    category: category.value,
    categoryLine: category.line,
    level: normalizeLevel(level.value),
    levelLine: level.line,
    rawLevel: level.value,
    targetMinutes: '',
    visibility: 'members',
    questions,
  }, errors);
}

function parseJson(text) {
  const errors = [];
  let input;
  try {
    input = JSON.parse(text);
  } catch (error) {
    pushError(errors, 1, 'document', error instanceof Error ? error.message : 'Invalid JSON.');
    return { ok: false, errors };
  }
  const source = Array.isArray(input) ? { questions: input } : input;
  if (!source || typeof source !== 'object' || !Array.isArray(source.questions)) {
    pushError(errors, 1, 'questions', 'JSON must be an object with a questions array.');
    return { ok: false, errors };
  }
  const questions = source.questions.map((question, index) => questionFromParts({
    prompt: question.prompt || question.question || '',
    options: Array.isArray(question.options) ? question.options : [],
    answer: question.answer,
    explanation: question.explanation || '',
    line: null,
  }, errors, index));
  const target = source.targetMinutes ?? source.target ?? '';
  return finishExercise({
    title: source.title || '',
    titleLine: null,
    category: source.category || '',
    categoryLine: null,
    level: normalizeLevel(source.level),
    levelLine: null,
    rawLevel: source.level || '',
    targetMinutes: target === '' || target == null ? '' : Number(target),
    visibility: normalizeVisibility(source.visibility || 'members') || 'members',
    questions,
  }, errors);
}

function finishExercise(exercise, errors) {
  if (!String(exercise.title || '').trim()) pushError(errors, exercise.titleLine, 'title', 'Title is required.');
  if (!String(exercise.category || '').trim()) pushError(errors, exercise.categoryLine, 'category', 'Category is required.');
  if (!exercise.level) pushError(errors, exercise.levelLine, 'level', 'Level must be beginner, intermediate, or advanced.');
  if (exercise.targetMinutes !== '' && exercise.targetMinutes != null && (!Number.isInteger(exercise.targetMinutes) || exercise.targetMinutes <= 0)) {
    pushError(errors, null, 'target', 'Target time must be a positive whole number of minutes.');
  }
  if (!exercise.questions.length) pushError(errors, 1, 'questions', 'Add at least one question.');
  return {
    ok: errors.length === 0,
    errors,
    exercise: {
      title: String(exercise.title || '').trim(),
      category: String(exercise.category || '').trim(),
      categoryLine: exercise.categoryLine,
      level: exercise.level,
      targetMinutes: exercise.targetMinutes,
      visibility: exercise.visibility || 'members',
      questions: exercise.questions,
    },
  };
}

export function parseExercise(text) {
  const source = String(text || '');
  if (!source.trim()) return { ok: false, errors: [{ line: 1, path: 'document', message: 'The exercise is empty.' }] };
  const trimmed = source.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJson(source);
  if (/^##\s+Question\b/m.test(source) || /^\*\*Prompt:\*\*/m.test(source)) return parseMarkdownBlocks(source);
  return parseFieldTemplate(source);
}

export function resolveCategory(value, categories) {
  const raw = String(value || '').trim();
  if (!raw) return { error: 'Category is required.' };
  const match = (categories || []).find(category => category.slug === raw.toLowerCase() || category.name.toLowerCase() === raw.toLowerCase());
  if (!match) return { error: `Unknown category "${raw}". Use a category slug such as workplace-english.` };
  return { category: match };
}

export function applyCategory(parsed, categories) {
  if (!parsed?.ok) return parsed;
  const resolved = resolveCategory(parsed.exercise.category, categories);
  if (resolved.error) {
    return {
      ok: false,
      errors: [...parsed.errors, { line: parsed.exercise.categoryLine, path: 'category', message: resolved.error }],
      exercise: parsed.exercise,
    };
  }
  return {
    ...parsed,
    exercise: { ...parsed.exercise, categoryId: resolved.category.id, categoryName: resolved.category.name },
  };
}
