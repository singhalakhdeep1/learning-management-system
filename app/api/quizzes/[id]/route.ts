import { canManageCourse, requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, json, readJson, route } from '@/lib/http';
import { canViewCourseContent } from '@/lib/lms';
import { quizSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

async function loadQuiz(id: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, title: true, instructorId: true } },
      questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
    },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  return quiz;
}

/**
 * Students get the questions without the answer key; the instructor (and admins) also see which options
 * are correct so they can edit the quiz.
 */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser();
  const quiz = await loadQuiz(params.id);

  if (!(await canViewCourseContent(user, quiz.course))) throw new HttpError(403, 'Enroll in the course to take this quiz');
  const manager = canManageCourse(user, quiz.course.instructorId);

  return json({
    id: quiz.id,
    title: quiz.title,
    passPercent: quiz.passPercent,
    course: { id: quiz.course.id, title: quiz.course.title },
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      ...(manager && { explanation: q.explanation }),
      options: q.options.map((o) => ({ id: o.id, text: o.text, ...(manager && { isCorrect: o.isCorrect }) })),
    })),
  });
});

/** Replaces the quiz's title, pass mark and questions. Existing attempts are kept for the record. */
export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const quiz = await loadQuiz(params.id);
  if (!canManageCourse(user, quiz.course.instructorId)) throw new HttpError(403, 'Only the instructor can change this quiz');

  const input = quizSchema.parse(await readJson(req));

  await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { quizId: quiz.id } });
    await tx.quiz.update({
      where: { id: quiz.id },
      data: {
        title: input.title,
        passPercent: input.passPercent,
        questions: {
          create: input.questions.map((q, qi) => ({
            text: q.text,
            type: q.type,
            explanation: q.explanation ?? null,
            position: qi + 1,
            options: { create: q.options.map((o, oi) => ({ text: o.text, isCorrect: o.isCorrect, position: oi + 1 })) },
          })),
        },
      },
    });
  });

  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const quiz = await loadQuiz(params.id);
  if (!canManageCourse(user, quiz.course.instructorId)) throw new HttpError(403, 'Only the instructor can change this quiz');

  await prisma.quiz.delete({ where: { id: quiz.id } });
  return json({ ok: true });
});
