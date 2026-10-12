import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card narrow" style={{ margin: '2rem auto' }}>
      <h1>Not found</h1>
      <p className="muted">That page or course does not exist, or you do not have access to it.</p>
      <Link className="button" href="/">
        Back to courses
      </Link>
    </div>
  );
}
