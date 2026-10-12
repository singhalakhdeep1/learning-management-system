'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface DraftOption {
  text: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  text: string;
  type: 'SINGLE' | 'MULTIPLE';
  explanation: string;
  options: DraftOption[];
}

const blankQuestion = (): DraftQuestion => ({
  text: '',
  type: 'SINGLE',
  explanation: '',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
});

export default function QuizBuilder({ courseId, quizId }: { courseId: string; quizId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [passPercent, setPassPercent] = useState(70);
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion()]);
  const [loading, setLoading] = useState(Boolean(quizId));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    api<{
      title: string;
      passPercent: number;
      questions: { text: string; type: 'SINGLE' | 'MULTIPLE'; explanation?: string | null; options: { text: string; isCorrect?: boolean }[] }[];
    }>(`/api/quizzes/${quizId}`)
      .then((quiz) => {
        setTitle(quiz.title);
        setPassPercent(quiz.passPercent);
        setQuestions(
          quiz.questions.map((q) => ({
            text: q.text,
            type: q.type,
            explanation: q.explanation ?? '',
            options: q.options.map((o) => ({ text: o.text, isCorrect: Boolean(o.isCorrect) })),
          })),
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quizId]);

  const updateQuestion = (index: number, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  const updateOption = (qi: number, oi: number, patch: Partial<DraftOption>) =>
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi) return q;
        let options = q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o));
        // Single-choice: ticking one option unticks the others.
        if (patch.isCorrect && q.type === 'SINGLE') options = options.map((o, j) => ({ ...o, isCorrect: j === oi }));
        return { ...q, options };
      }),
    );

  function changeType(index: number, type: 'SINGLE' | 'MULTIPLE') {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== index) return q;
        if (type === 'SINGLE') {
          const first = q.options.findIndex((o) => o.isCorrect);
          return { ...q, type, options: q.options.map((o, j) => ({ ...o, isCorrect: j === Math.max(first, 0) })) };
        }
        return { ...q, type };
      }),
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const body = {
      title,
      passPercent,
      questions: questions.map((q) => ({
        text: q.text,
        type: q.type,
        explanation: q.explanation.trim() || null,
        options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      })),
    };

    try {
      if (quizId) await api(`/api/quizzes/${quizId}`, { method: 'PUT', body });
      else await api(`/api/courses/${courseId}/quizzes`, { method: 'POST', body });
      router.push(`/instructor/courses/${courseId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <form onSubmit={save}>
      <p className="small">
        <Link href={`/instructor/courses/${courseId}`}>← Back to the course</Link>
      </p>
      <h1>{quizId ? 'Edit quiz' : 'New quiz'}</h1>

      <div className="card">
        <div className="row">
          <div style={{ flex: 3 }}>
            <label htmlFor="quizTitle">Title</label>
            <input id="quizTitle" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
          </div>
          <div>
            <label htmlFor="pass">Pass mark %</label>
            <input id="pass" type="number" min={1} max={100} value={passPercent} onChange={(e) => setPassPercent(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {questions.map((question, qi) => (
        <div key={qi} className="card" style={{ marginTop: '1rem' }}>
          <div className="split">
            <strong>Question {qi + 1}</strong>
            {questions.length > 1 && (
              <button type="button" className="danger small" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}>
                Remove
              </button>
            )}
          </div>

          <label>Question</label>
          <input value={question.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })} required minLength={3} />

          <label>Type</label>
          <select value={question.type} onChange={(e) => changeType(qi, e.target.value as 'SINGLE' | 'MULTIPLE')}>
            <option value="SINGLE">Single answer</option>
            <option value="MULTIPLE">Multiple answers</option>
          </select>

          <label>Options (tick the correct ones)</label>
          {question.options.map((option, oi) => (
            <div key={oi} className="row tight" style={{ margin: '0.3rem 0', alignItems: 'center' }}>
              <input
                type={question.type === 'SINGLE' ? 'radio' : 'checkbox'}
                name={`correct-${qi}`}
                checked={option.isCorrect}
                onChange={(e) => updateOption(qi, oi, { isCorrect: e.target.checked })}
                aria-label="Correct answer"
              />
              <input
                style={{ width: 360, maxWidth: '70vw' }}
                value={option.text}
                onChange={(e) => updateOption(qi, oi, { text: e.target.value })}
                required
                placeholder={`Option ${oi + 1}`}
              />
              {question.options.length > 2 && (
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => updateQuestion(qi, { options: question.options.filter((_, j) => j !== oi) })}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {question.options.length < 8 && (
            <button
              type="button"
              className="secondary small"
              onClick={() => updateQuestion(qi, { options: [...question.options, { text: '', isCorrect: false }] })}
            >
              + Add option
            </button>
          )}

          <label>Explanation shown after answering (optional)</label>
          <input value={question.explanation} onChange={(e) => updateQuestion(qi, { explanation: e.target.value })} />
        </div>
      ))}

      <div className="row tight" style={{ margin: '1rem 0' }}>
        <button type="button" className="secondary" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}>
          + Add question
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save quiz'}
      </button>
    </form>
  );
}
