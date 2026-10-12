'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface QuizData {
  id: string;
  title: string;
  passPercent: number;
  course: { id: string; title: string };
  questions: { id: string; text: string; type: 'SINGLE' | 'MULTIPLE'; options: { id: string; text: string }[] }[];
}

interface AttemptResult {
  scorePercent: number;
  passPercent: number;
  passed: boolean;
  correct: number;
  total: number;
  results: { questionId: string; correct: boolean; selected: string[]; correctOptionIds: string[]; explanation: string | null }[];
  course: { completed: boolean; progress: number };
}

export default function QuizRunner({ quizId }: { quizId: string }) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<QuizData>(`/api/quizzes/${quizId}`)
      .then(setQuiz)
      .catch((e: Error) => setError(e.message));
  }, [quizId]);

  function choose(question: QuizData['questions'][number], optionId: string, checked: boolean) {
    setAnswers((current) => {
      const selected = current[question.id] ?? [];
      if (question.type === 'SINGLE') return { ...current, [question.id]: [optionId] };
      return { ...current, [question.id]: checked ? [...selected, optionId] : selected.filter((id) => id !== optionId) };
    });
  }

  async function submit() {
    if (!quiz) return;
    setBusy(true);
    setError('');
    try {
      setResult(await api<AttemptResult>(`/api/quizzes/${quiz.id}/attempts`, { body: { answers } }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setAnswers({});
    setResult(null);
  }

  if (error && !quiz) return <div className="alert error">{error}</div>;
  if (!quiz) return <p className="muted">Loading quiz…</p>;

  const resultFor = (questionId: string) => result?.results.find((r) => r.questionId === questionId);
  const unanswered = quiz.questions.filter((q) => (answers[q.id] ?? []).length === 0).length;

  return (
    <div>
      <p className="small">
        <Link href={`/learn/${quiz.course.id}`}>← {quiz.course.title}</Link>
      </p>
      <h1>{quiz.title}</h1>
      <p className="muted">
        {quiz.questions.length} questions · pass mark {quiz.passPercent}%
      </p>

      {result && (
        <div className={`alert ${result.passed ? 'success' : 'error'}`}>
          <strong>
            {result.passed ? 'Passed' : 'Not passed'}: {result.scorePercent}%
          </strong>{' '}
          ({result.correct} of {result.total} correct).{' '}
          {result.passed && result.course.completed && 'You have completed the course. Claim your certificate from the course page.'}
          {!result.passed && 'Review the answers below and try again.'}
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      {quiz.questions.map((question, index) => {
        const graded = resultFor(question.id);
        return (
          <div key={question.id} className="card question">
            <strong>
              {index + 1}. {question.text}
            </strong>
            <div className="muted small">{question.type === 'MULTIPLE' ? 'Select all that apply' : 'Select one'}</div>

            {question.options.map((option) => {
              const selected = (answers[question.id] ?? []).includes(option.id);
              const isCorrect = graded?.correctOptionIds.includes(option.id);
              const className = graded ? (isCorrect ? 'option right' : selected ? 'option wrong' : 'option') : 'option';

              return (
                <label key={option.id} className={className}>
                  <input
                    type={question.type === 'SINGLE' ? 'radio' : 'checkbox'}
                    name={question.id}
                    checked={selected}
                    disabled={Boolean(result)}
                    onChange={(e) => choose(question, option.id, e.target.checked)}
                  />
                  {option.text}
                </label>
              );
            })}

            {graded && (
              <p className="small" style={{ marginTop: '0.5rem' }}>
                {graded.correct ? '✓ Correct.' : '✗ Not quite.'} {graded.explanation}
              </p>
            )}
          </div>
        );
      })}

      {result ? (
        <button onClick={retake}>{result.passed ? 'Take it again' : 'Try again'}</button>
      ) : (
        <button onClick={submit} disabled={busy || unanswered > 0}>
          {busy ? 'Submitting…' : unanswered > 0 ? `${unanswered} unanswered` : 'Submit answers'}
        </button>
      )}
    </div>
  );
}
