import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import SignOutButton from './SignOutButton';

export default async function Header() {
  const user = await getSessionUser();

  return (
    <header className="site-header">
      <div className="inner">
        <Link href="/" className="brand">
          LMS
        </Link>
        <nav className="nav">
          <Link href="/">Courses</Link>
          {user && <Link href="/my-learning">My learning</Link>}
          {(user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN') && <Link href="/instructor">Teach</Link>}
        </nav>
        <div className="who">
          {user ? (
            <>
              <span className="muted small">{user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/register" className="button small">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
