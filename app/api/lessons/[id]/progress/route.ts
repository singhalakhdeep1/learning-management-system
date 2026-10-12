import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, json, readJson, route } from '@/lib/http';
import { recalculateEnrollment } from '@/lib/lms';
import { progressSchema } from '@/lib/validation';

type Ctx = { params: { id: string } };

/** Saves the playback position and/or marks the lesson complete (or incomplete) for the signed-in student. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser();
  const input = progressSchema.parse(await readJson(req));

  const lesson = await prisma.lesson.findUnique({ where: { id: params.id } });
  if (!lesson) throw new HttpError(404, 'Lesson not found');

  const enrollment = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: lesson.courseId, userId: user.id } } });
  if (!enrollment) throw new HttpError(403, 'Enroll in the course to track your progress');

  const saved = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    create: { userId: user.id, lessonId: lesson.id, completed: input.completed ?? false, positionSeconds: input.positionSeconds ?? 0 },
    update: {
      ...(input.completed !== undefined && { completed: input.completed }),
      ...(input.positionSeconds !== undefined && { positionSeconds: input.positionSeconds }),
    },
  });

  const status = await recalculateEnrollment(user.id, lesson.courseId);
  return json({ lesson: { lessonId: saved.lessonId, completed: saved.completed, positionSeconds: saved.positionSeconds }, course: status });
});
