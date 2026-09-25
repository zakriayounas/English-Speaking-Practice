'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ reset }) {
  useEffect(() => {
    console.error('Application error');
  }, []);

  return (
    <main className="status-page">
      <section className="status-panel status-error-panel">
        <span className="eyebrow">FluentPal</span>
        <div className="status-mark status-error-mark" aria-hidden="true">!</div>
        <h1>Something went off script.</h1>
        <p>We could not load this page right now. Try again, or return to your practice library.</p>
        <div className="status-actions">
          <button className="primary-button status-button" type="button" onClick={() => reset()}>Try again</button>
          <Link className="back-button" href="/">Back to library</Link>
        </div>
      </section>
    </main>
  );
}
