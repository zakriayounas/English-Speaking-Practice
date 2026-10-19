export const LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'Short, familiar phrases and everyday sentences.' },
  { value: 'intermediate', label: 'Intermediate', description: 'Longer answers, workplace talk, and more precise word choice.' },
  { value: 'advanced', label: 'Advanced', description: 'Nuance, idioms, and language that sounds natural at speed.' },
  { value: '', label: 'Not sure yet', description: 'Skip the level for now. You can set it later in Settings.' },
];

export const LEARNING_GOALS = [
  { value: 'speak-confidence', label: 'Speak with confidence' },
  { value: 'workplace-business', label: 'Workplace and business English' },
  { value: 'software-team', label: 'Software team communication' },
  { value: 'ielts-speaking', label: 'IELTS speaking' },
  { value: 'daily-conversations', label: 'Daily conversations' },
  { value: 'fix-mistakes', label: 'Fix common mistakes' },
  { value: 'idioms-phrases', label: 'Learn idioms and native phrases' },
];

export const GOAL_VALUES = new Set(LEARNING_GOALS.map(goal => goal.value));

export function levelLabel(value) {
  return LEVELS.find(level => level.value === (value || ''))?.label || 'Not sure yet';
}
