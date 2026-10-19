function finiteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function average(values) {
  const numbers = (values || []).map(finiteNumber).filter(value => value != null);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function scoreRatio(attempt) {
  const max = finiteNumber(attempt?.max_score);
  if (!max) return null;
  return (finiteNumber(attempt.score) || 0) / max;
}

export function summarize(attempts, answerRows) {
  const list = attempts || [];
  return {
    completed: list.length,
    averageScore: average(list.map(scoreRatio)),
    averageTimePerQuestionMs: average((answerRows || []).map(row => row.time_ms)),
    averageTimePerAttemptMs: average(list.map(attempt => attempt.duration_ms)),
  };
}

export function categoryKey(attempt) {
  return attempt?.category_id || attempt?.categoryId || 'uncategorized';
}

export function summarizeByCategory(attempts, answerRows) {
  const groups = new Map();
  (attempts || []).forEach(attempt => {
    const key = categoryKey(attempt);
    if (!groups.has(key)) {
      groups.set(key, {
        categoryId: key,
        name: attempt.categoryName || 'Uncategorized',
        slug: attempt.categorySlug || null,
        attempts: [],
        answerTimes: [],
      });
    }
    groups.get(key).attempts.push(attempt);
  });

  const attemptMap = new Map((attempts || []).map(attempt => [attempt.id, attempt]));
  (answerRows || []).forEach(row => {
    const attempt = attemptMap.get(row.attempt_id);
    if (!attempt) return;
    const group = groups.get(categoryKey(attempt));
    if (group) group.answerTimes.push(row);
  });

  return [...groups.values()].map(group => ({
    categoryId: group.categoryId,
    name: group.name,
    slug: group.slug,
    ...summarize(group.attempts, group.answerTimes),
  }));
}

export function summarizePeople(attempts, answerRows) {
  const people = new Map();
  (attempts || []).forEach(attempt => {
    const key = attempt.user_id || 'guest';
    if (!people.has(key)) people.set(key, { userId: key, attempts: [], answerTimes: [] });
    people.get(key).attempts.push(attempt);
  });

  const attemptMap = new Map((attempts || []).map(attempt => [attempt.id, attempt]));
  (answerRows || []).forEach(row => {
    const attempt = attemptMap.get(row.attempt_id);
    if (!attempt) return;
    const person = people.get(attempt.user_id || 'guest');
    if (person) person.answerTimes.push(row);
  });

  return [...people.values()].map(person => ({
    userId: person.userId,
    ...summarize(person.attempts, person.answerTimes),
    lastAttemptAt: person.attempts.reduce((latest, attempt) => {
      if (!attempt.submitted_at) return latest;
      if (!latest || attempt.submitted_at > latest) return attempt.submitted_at;
      return latest;
    }, null),
  }));
}
