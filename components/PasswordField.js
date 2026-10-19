'use client';

import { useState } from 'react';

function EyeIcon({ hidden }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {hidden ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c5 0 9.3 3.1 11 7a11.6 11.6 0 0 1-4.1 5.1" />
          <path d="M6.1 6.1A11.6 11.6 0 0 0 1 12c1.7 3.9 6 7 11 7 1.3 0 2.6-.2 3.8-.7" />
        </>
      ) : (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function PasswordField({ id, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input id={id} {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible(current => !current)}
      >
        <EyeIcon hidden={visible} />
      </button>
    </div>
  );
}
