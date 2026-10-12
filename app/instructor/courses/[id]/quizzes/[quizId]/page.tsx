import QuizBuilder from '@/components/QuizBuilder';
import { requirePageUser } from '@/lib/auth';

export const metadata = { title: 'Quiz' };

/** `quizId` is either an existing quiz id or the literal "new". */
export default async function QuizEditorPage({ params }: { params: { id: string; quizId: string } }) {
  await requirePageUser(`/instructor/courses/${params.id}/quizzes/${params.quizId}`, 'INSTRUCTOR', 'ADMIN');
  return <QuizBuilder courseId={params.id} quizId={params.quizId === 'new' ? undefined : params.quizId} />;
}
