import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, json, route } from '@/lib/http';
import { recalculateEnrollment } from '@/lib/lms';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** The signed-in student's progress through a course: per-lesson state, quiz results and overall status. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser();

  const enrollment = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: params.id, userId: user.id } } });
  if (!enrollment) throw new HttpError(403, 'You are not enrolled in this course');

  const [status, lessons, quizzes, certificate] = await Promise.all([
    recalculateEnrollment(user.id, params.id),
    prisma.lessonProgress.findMany({ where: { userId: user.id, lesson: { courseId: params.id } } }),
    prisma.quiz.findMany({
      where: { courseId: params.id },
      orderBy: { position: 'asc' },
      include: { attempts: { where: { userId: user.id }, orderBy: { createdAt: 'desc' } } },
    }),
    prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: params.id } } }),
  ]);

  return json({
    ...status,
    lessons: lessons.map((l) => ({ lessonId: l.lessonId, completed: l.completed, positionSeconds: l.positionSeconds })),
    quizzes: quizzes.map((q) => ({
      quizId: q.id,
      title: q.title,
      passPercent: q.passPercent,
      attempts: q.attempts.length,
      bestScore: q.attempts.reduce((best, a) => Math.max(best, a.scorePercent), 0),
      passed: q.attempts.some((a) => a.passed),
    })),
    certificateCode: certificate?.code ?? null,
  });
});
