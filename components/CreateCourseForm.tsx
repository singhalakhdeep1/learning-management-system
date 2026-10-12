'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function CreateCourseForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const form = new FormData(event.currentTarget);
    try {
      const course = await api<{ id: string }>('/api/courses', {
        body: {
          title: form.get('title'),
          description: form.get('description'),
          price: Number(form.get('price')),
          category: form.get('category') || 'General',
          level: form.get('level'),
        },
      });
      router.push(`/instructor/courses/${course.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>New course</h2>
      <label htmlFor="title">Title</label>
      <input id="title" name="title" required minLength={3} maxLength={150} />
      <label htmlFor="description">Description</label>
      <textarea id="description" name="description" required minLength={10} maxLength={5000} />
      <div className="row">
        <div>
          <label htmlFor="price">Price (USD, 0 = free)</label>
          <input id="price" name="price" type="number" min={0} step="0.01" defaultValue={0} required />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <input id="category" name="category" defaultValue="General" />
        </div>
        <div>
          <label htmlFor="level">Level</label>
          <select id="level" name="level" defaultValue="Beginner">
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="spacer" />
      <button type="submit" disabled={busy}>
        {busy ? 'Creating…' : 'Create course'}
      </button>
    </form>
  );
}
