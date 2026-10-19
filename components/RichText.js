'use client';

import { splitInlineMarkup } from '../lib/rich-text.js';

export default function RichText({ text, className = '' }) {
  const parts = splitInlineMarkup(text);
  return (
    <div className={`rich-text ${className}`.trim()}>
      {parts.map((part, index) => part.type === 'bold'
        ? <strong key={index}>{part.value}</strong>
        : <span key={index}>{part.value}</span>)}
    </div>
  );
}
