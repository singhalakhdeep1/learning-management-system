'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/auth/${mode}`, {
        body:
          mode === 'login'
            ? { email: form.get('email'), password: form.get('password') }
            : { name: form.get('name'), email: form.get('email'), password: form.get('password'), role: form.get('role') },
      });
      // Only follow same-site paths from ?next=
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>

      {mode === 'register' && (
        <>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required minLength={2} autoComplete="name" />
        </>
      )}

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={mode === 'register' ? 8 : 1}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />
      {mode === 'register' && <p className="muted small">At least 8 characters.</p>}

      {mode === 'register' && (
        <>
          <label htmlFor="role">I want to</label>
          <select id="role" name="role" defaultValue="STUDENT">
            <option value="STUDENT">Learn (student)</option>
            <option value="INSTRUCTOR">Teach (instructor)</option>
          </select>
        </>
      )}

      {error && <div className="alert error">{error}</div>}

      <div className="spacer" />
      <button type="submit" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <p className="muted small" style={{ marginTop: '1rem' }}>
        {mode === 'login' ? (
          <>
            New here? <Link href="/register">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
