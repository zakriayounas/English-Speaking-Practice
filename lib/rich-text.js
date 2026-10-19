export function splitInlineMarkup(value) {
  const text = value == null ? '' : String(value);
  const parts = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) });
    parts.push({ type: 'bold', value: match[1] });
    last = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (last < text.length || !parts.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}
