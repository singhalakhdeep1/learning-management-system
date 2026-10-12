import { requireApiUser } from '@/lib/auth';
import { getManagedCourse, resequenceLessons } from '@/lib/courses';
import { prisma } from '@/lib/db';
import { HttpError, json, readJson, route } from '@/lib/http';
import { recalculateEnrollment } from '@/lib/lms';
import { lessonPatchSchema } from '@/lib/validation';

type Ctx = { params: { id: string } };

async function loadLesson(id: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  return lesson;
}

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const lesson = await loadLesson(params.id);
  await getManagedCourse(user, lesson.courseId);

  const input = lessonPatchSchema.parse(await readJson(req));
  return json(await prisma.lesson.update({ where: { id: lesson.id }, data: input }));
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const lesson = await loadLesson(params.id);
  const course = await getManagedCourse(user, lesson.courseId);

  const lessonCount = await prisma.lesson.count({ where: { courseId: course.id } });
  if (course.isPublished && lessonCount <= 1) {
    throw new HttpError(409, 'A published course needs at least one lesson. Unpublish it first.');
  }

  await prisma.lesson.delete({ where: { id: lesson.id } });
  await resequenceLessons(course.id);

  // Students' stored progress depended on the old lesson count.
  const enrollments = await prisma.enrollment.findMany({ where: { courseId: course.id }, select: { userId: true } });
  await Promise.all(enrollments.map((e) => recalculateEnrollment(e.userId, course.id)));

  return json({ ok: true });
});
