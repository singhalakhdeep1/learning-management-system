import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, json, readJson, route } from '@/lib/http';
import { gradeQuiz, recalculateEnrollment } from '@/lib/lms';
import { attemptSchema } from '@/lib/validation';

type Ctx = { params: { id: string } };

/**
 * Grades an attempt on the server. Only enrolled students can submit; the answer key is revealed
 * per question in the response, after the attempt is recorded.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser();
  const { answers } = attemptSchema.parse(await readJson(req));

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { position: 'asc' }, include: { options: true } } },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');

  const enrollment = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: quiz.courseId, userId: user.id } } });
  if (!enrollment) throw new HttpError(403, 'Enroll in the course to take this quiz');

  const graded = gradeQuiz(quiz.questions, answers);
  const passed = graded.scorePercent >= quiz.passPercent;

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: user.id, scorePercent: graded.scorePercent, passed, answers },
  });

  const course = await recalculateEnrollment(user.id, quiz.courseId);

  return json(
    {
      attemptId: attempt.id,
      scorePercent: graded.scorePercent,
      passPercent: quiz.passPercent,
      passed,
      correct: graded.right,
      total: graded.total,
      results: graded.results,
      course,
    },
    201,
  );
});
