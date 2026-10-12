'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import { api } from '@/lib/client';
import { formatDuration } from '@/lib/format';

export interface PlayerLesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  durationSeconds: number;
}

export interface PlayerQuiz {
  id: string;
  title: string;
  passPercent: number;
  attempts: number;
  bestScore: number;
  passed: boolean;
}

interface CourseStatus {
  completedLessons: number;
  totalLessons: number;
  progress: number;
  quizzesPassed: boolean;
  completed: boolean;
}

interface Props {
  courseId: string;
  courseTitle: string;
  lessons: PlayerLesson[];
  quizzes: PlayerQuiz[];
  /** lessonId -> state. Empty when previewing without an enrollment. */
  initialProgress: Record<string, { completed: boolean; positionSeconds: number }>;
  initialStatus: CourseStatus;
  certificateCode: string | null;
  /** False for an instructor previewing the course: nothing is saved. */
  trackProgress: boolean;
}

export default function CoursePlayer(props: Props) {
  const { courseId, courseTitle, lessons, quizzes, trackProgress } = props;
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(props.initialProgress);
  const [status, setStatus] = useState(props.initialStatus);
  const [certificate, setCertificate] = useState(props.certificateCode);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const lastSaved = useRef(0);

  const lesson = lessons[current];

  const save = useCallback(
    async (lessonId: string, body: { completed?: boolean; positionSeconds?: number }) => {
      if (!trackProgress) return;
      try {
        const result = await api<{
          lesson: { lessonId: string; completed: boolean; positionSeconds: number };
          course: CourseStatus;
        }>(`/api/lessons/${lessonId}/progress`, { body });
        setProgress((p) => ({ ...p, [lessonId]: { completed: result.lesson.completed, positionSeconds: result.lesson.positionSeconds } }));
        setStatus(result.course);
      } catch (e) {
        setMessage({ kind: 'error', text: (e as Error).message });
      }
    },
    [trackProgress],
  );

  function onProgress(position: number, duration: number) {
    if (!lesson || !trackProgress) return;
    const alreadyDone = progress[lesson.id]?.completed;

    // Watching 90% counts as finishing the lesson.
    const watchedMost = duration > 0 && position / duration >= 0.9;
    if (watchedMost && !alreadyDone) {
      void save(lesson.id, { completed: true, positionSeconds: position });
    } else if (Math.abs(position - lastSaved.current) >= 5) {
      lastSaved.current = position;
      void save(lesson.id, { positionSeconds: position });
    }
  }

  async function toggleComplete() {
    if (!lesson) return;
    await save(lesson.id, { completed: !progress[lesson.id]?.completed });
  }

  async function getCertificate() {
    setMessage(null);
    try {
      const result = await api<{ code: string }>(`/api/courses/${courseId}/certificate`, { method: 'POST', body: {} });
      setCertificate(result.code);
      setMessage({ kind: 'success', text: 'Your certificate is ready.' });
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    }
  }

  return (
    <div>
      <div className="split" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>{courseTitle}</h1>
          {!trackProgress && <p className="muted small">Instructor preview: progress is not saved.</p>}
        </div>
        {trackProgress && (
          <div style={{ minWidth: 220 }}>
            <div className="small muted">
              {status.completedLessons}/{status.totalLessons} lessons · {status.progress}%
            </div>
            <div className="bar">
              <span style={{ width: `${status.progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {message && <div className={`alert ${message.kind}`}>{message.text}</div>}

      <div className="learn">
        <aside className="card">
          <h3>Lessons</h3>
          <ul className="lesson-list">
            {lessons.map((l, index) => (
              <li key={l.id} className={index === current ? 'active' : ''}>
                <button onClick={() => setCurrent(index)}>
                  <span className={progress[l.id]?.completed ? 'done' : ''}>
                    {index + 1}. {l.title}
                  </span>
                  {l.durationSeconds > 0 && <span className="muted small"> · {formatDuration(l.durationSeconds)}</span>}
                </button>
              </li>
            ))}
          </ul>

          {quizzes.length > 0 && (
            <>
              <h3 style={{ marginTop: '1rem' }}>Quizzes</h3>
              <ul className="lesson-list">
                {quizzes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/learn/${courseId}/quiz/${q.id}`} style={{ display: 'block', padding: '0.6rem 0.4rem' }}>
                      <span className={q.passed ? 'done' : ''}>{q.title}</span>
                      <div className="muted small">
                        Pass mark {q.passPercent}%{q.attempts > 0 && ` · best ${q.bestScore}%`}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {trackProgress && (
            <div style={{ marginTop: '1rem' }}>
              {certificate ? (
                <Link className="button" href={`/certificates/${certificate}`}>
                  View certificate
                </Link>
              ) : (
                <button onClick={getCertificate} disabled={!status.completed}>
                  Get certificate
                </button>
              )}
              {!status.completed && !certificate && (
                <p className="muted small" style={{ marginTop: '0.5rem' }}>
                  Finish all lessons{quizzes.length > 0 && ' and pass every quiz'} to unlock it.
                </p>
              )}
            </div>
          )}
        </aside>

        <section>
          {lesson ? (
            <>
              {lesson.videoUrl ? (
                <VideoPlayer
                  key={lesson.id}
                  src={lesson.videoUrl}
                  startAt={progress[lesson.id]?.positionSeconds ?? 0}
                  onProgress={onProgress}
                />
              ) : (
                <div className="card muted">This lesson has no video. Read the description below.</div>
              )}

              <div className="split" style={{ marginTop: '1rem' }}>
                <h2 style={{ margin: 0 }}>{lesson.title}</h2>
                {trackProgress && (
                  <button className={progress[lesson.id]?.completed ? 'secondary' : ''} onClick={toggleComplete}>
                    {progress[lesson.id]?.completed ? 'Mark as not done' : 'Mark as complete'}
                  </button>
                )}
              </div>
              {lesson.description && <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.description}</p>}

              <div className="split no-print" style={{ marginTop: '1rem' }}>
                <button className="secondary" disabled={current === 0} onClick={() => setCurrent(current - 1)}>
                  ← Previous
                </button>
                <button className="secondary" disabled={current >= lessons.length - 1} onClick={() => setCurrent(current + 1)}>
                  Next →
                </button>
              </div>
            </>
          ) : (
            <div className="card">This course has no lessons yet.</div>
          )}
        </section>
      </div>
    </div>
  );
}
