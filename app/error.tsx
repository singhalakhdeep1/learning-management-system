'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card narrow" style={{ margin: '2rem auto' }}>
      <h1>Something went wrong</h1>
      <p className="muted">The page could not be loaded. Please try again.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
