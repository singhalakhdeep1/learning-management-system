'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <button className="secondary small" onClick={signOut}>
      Sign out
    </button>
  );
}
