import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="status-page">
      <section className="status-panel">
        <span className="eyebrow">FluentPal</span>
        <div className="status-mark" aria-hidden="true">404</div>
        <h1>This page took a wrong turn.</h1>
        <p>The page you are looking for does not exist or may have moved.</p>
        <div className="status-actions">
          <Link className="primary-button status-button" href="/">Back to library</Link>
          <Link className="back-button" href="/add">Add an exercise</Link>
        </div>
      </section>
    </main>
  );
}
