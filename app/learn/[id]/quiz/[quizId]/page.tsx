import QuizRunner from '@/components/QuizRunner';
import { requirePageUser } from '@/lib/auth';

export const metadata = { title: 'Quiz' };

export default async function QuizPage({ params }: { params: { id: string; quizId: string } }) {
  await requirePageUser(`/learn/${params.id}/quiz/${params.quizId}`);
  return <QuizRunner quizId={params.quizId} />;
}
