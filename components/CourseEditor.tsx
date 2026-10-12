'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

export interface EditorCourse {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPercent: number;
  category: string;
  level: string;
  isPublished: boolean;
  enrollmentCount: number;
}

export interface EditorLesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  durationSeconds: number;
}

export interface EditorQuiz {
  id: string;
  title: string;
  passPercent: number;
  questionCount: number;
}

export default function CourseEditor({ course, lessons, quizzes }: { course: EditorCourse; lessons: EditorLesson[]; quizzes: EditorQuiz[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage({ kind: 'success', text: success });
      router.refresh();
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const saveDetails = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    return run(
      () =>
        api(`/api/courses/${course.id}`, {
          method: 'PATCH',
          body: {
            title: form.get('title'),
            description: form.get('description'),
            price: Number(form.get('price')),
            discountPercent: Number(form.get('discountPercent')),
            category: form.get('category'),
            level: form.get('level'),
          },
        }),
      'Course details saved',
    );
  };

  const togglePublish = () =>
    run(() => api(`/api/courses/${course.id}`, { method: 'PATCH', body: { isPublished: !course.isPublished } }), course.isPublished ? 'Course unpublished' : 'Course published');

  const addLesson = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const url = String(form.get('videoUrl') ?? '').trim();
    return run(async () => {
      await api(`/api/courses/${course.id}/lessons`, {
        body: {
          title: form.get('title'),
          description: form.get('description') ?? '',
          videoUrl: url || null,
          durationSeconds: Math.round(Number(form.get('minutes') || 0) * 60),
        },
      });
      formElement.reset();
    }, 'Lesson added');
  };

  const saveLesson = (event: React.FormEvent<HTMLFormElement>, lessonId: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get('videoUrl') ?? '').trim();
    return run(async () => {
      await api(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        body: {
          title: form.get('title'),
          description: form.get('description') ?? '',
          videoUrl: url || null,
          durationSeconds: Math.round(Number(form.get('minutes') || 0) * 60),
        },
      });
      setEditing(null);
    }, 'Lesson saved');
  };

  const move = (index: number, delta: number) => {
    const ids = lessons.map((l) => l.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    return run(() => api(`/api/courses/${course.id}/lessons/reorder`, { body: { lessonIds: ids } }));
  };

  const removeLesson = (lessonId: string) =>
    confirm('Delete this lesson? Students lose their progress on it.') ? run(() => api(`/api/lessons/${lessonId}`, { method: 'DELETE' }), 'Lesson deleted') : undefined;

  const removeQuiz = (quizId: string) =>
    confirm('Delete this quiz and its attempts?') ? run(() => api(`/api/quizzes/${quizId}`, { method: 'DELETE' }), 'Quiz deleted') : undefined;

  const removeCourse = () => {
    if (!confirm('Delete this course permanently?')) return;
    return run(async () => {
      await api(`/api/courses/${course.id}`, { method: 'DELETE' });
      router.push('/instructor');
    });
  };

  return (
    <div>
      <div className="split">
        <div>
          <p className="small">
            <Link href="/instructor">← Your courses</Link>
          </p>
          <h1>{course.title}</h1>
        </div>
        <div className="row tight">
          <Link className="button secondary" href={`/courses/${course.id}`}>
            View page
          </Link>
          <button onClick={togglePublish} disabled={busy}>
            {course.isPublished ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>
      <p className="muted small">
        {course.isPublished ? 'Published: visible in the catalog.' : 'Draft: only you can see it. Add at least one lesson, then publish.'}{' '}
        {course.enrollmentCount} students enrolled.
      </p>

      {message && <div className={`alert ${message.kind}`}>{message.text}</div>}

      <form className="card" onSubmit={saveDetails} style={{ marginTop: '1rem' }}>
        <h2>Details</h2>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={course.title} required minLength={3} />
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={course.description} required minLength={10} />
        <div className="row">
          <div>
            <label htmlFor="price">Price (USD)</label>
            <input id="price" name="price" type="number" min={0} step="0.01" defaultValue={course.price} />
          </div>
          <div>
            <label htmlFor="discountPercent">Discount %</label>
            <input id="discountPercent" name="discountPercent" type="number" min={0} max={100} defaultValue={course.discountPercent} />
          </div>
          <div>
            <label htmlFor="category">Category</label>
            <input id="category" name="category" defaultValue={course.category} />
          </div>
          <div>
            <label htmlFor="level">Level</label>
            <select id="level" name="level" defaultValue={course.level}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
        </div>
        <div className="spacer" />
        <button type="submit" disabled={busy}>
          Save details
        </button>
      </form>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2>Lessons</h2>
        <p className="muted small">
          Video URL can be an HLS stream (.m3u8) or a direct MP4/WebM link. Videos are not hosted here; paste a link from your CDN or video host.
        </p>
        {lessons.length === 0 && <p className="muted">No lessons yet.</p>}
        {lessons.map((lesson, index) => (
          <div key={lesson.id} style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 0' }}>
            {editing === lesson.id ? (
              <form onSubmit={(e) => saveLesson(e, lesson.id)}>
                <label>Title</label>
                <input name="title" defaultValue={lesson.title} required minLength={2} />
                <label>Video URL</label>
                <input name="videoUrl" defaultValue={lesson.videoUrl ?? ''} placeholder="https://…/stream.m3u8" />
                <div className="row">
                  <div>
                    <label>Minutes</label>
                    <input name="minutes" type="number" min={0} step="0.5" defaultValue={lesson.durationSeconds / 60} />
                  </div>
                </div>
                <label>Description</label>
                <textarea name="description" defaultValue={lesson.description} />
                <div className="row tight" style={{ marginTop: '0.5rem' }}>
                  <button type="submit" className="small" disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="secondary small" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="split">
                <div>
                  <strong>
                    {index + 1}. {lesson.title}
                  </strong>
                  <div className="muted small">{lesson.videoUrl ?? 'No video'}</div>
                </div>
                <div className="row tight">
                  <button className="secondary small" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                    ↑
                  </button>
                  <button className="secondary small" disabled={busy || index === lessons.length - 1} onClick={() => move(index, 1)} aria-label="Move down">
                    ↓
                  </button>
                  <button className="secondary small" onClick={() => setEditing(lesson.id)}>
                    Edit
                  </button>
                  <button className="danger small" disabled={busy} onClick={() => removeLesson(lesson.id)}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <form onSubmit={addLesson} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
          <h3>Add a lesson</h3>
          <label htmlFor="newTitle">Title</label>
          <input id="newTitle" name="title" required minLength={2} />
          <label htmlFor="newVideo">Video URL (optional)</label>
          <input id="newVideo" name="videoUrl" placeholder="https://…/stream.m3u8 or https://…/video.mp4" />
          <div className="row">
            <div>
              <label htmlFor="newMinutes">Length in minutes</label>
              <input id="newMinutes" name="minutes" type="number" min={0} step="0.5" defaultValue={0} />
            </div>
          </div>
          <label htmlFor="newDescription">Description (optional)</label>
          <textarea id="newDescription" name="description" />
          <div className="spacer" />
          <button type="submit" disabled={busy}>
            Add lesson
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="split">
          <h2 style={{ margin: 0 }}>Quizzes</h2>
          <Link className="button small" href={`/instructor/courses/${course.id}/quizzes/new`}>
            New quiz
          </Link>
        </div>
        {quizzes.length === 0 && <p className="muted">No quizzes. Students earn a certificate by finishing every lesson and passing every quiz.</p>}
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="split" style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 0', marginTop: '0.6rem' }}>
            <div>
              <strong>{quiz.title}</strong>
              <div className="muted small">
                {quiz.questionCount} questions · pass mark {quiz.passPercent}%
              </div>
            </div>
            <div className="row tight">
              <Link className="button secondary small" href={`/instructor/courses/${course.id}/quizzes/${quiz.id}`}>
                Edit
              </Link>
              <button className="danger small" disabled={busy} onClick={() => removeQuiz(quiz.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2>Danger zone</h2>
        <p className="muted small">A course with enrolled students cannot be deleted; unpublish it instead.</p>
        <button className="danger" onClick={removeCourse} disabled={busy}>
          Delete course
        </button>
      </div>
    </div>
  );
}
