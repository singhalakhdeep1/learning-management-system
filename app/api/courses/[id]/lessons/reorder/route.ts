import { requireApiUser } from '@/lib/auth';
import { getManagedCourse, resequenceLessons } from '@/lib/courses';
import { prisma } from '@/lib/db';
import { json, readJson, route } from '@/lib/http';
import { reorderSchema } from '@/lib/validation';

type Ctx = { params: { id: string } };

/** Sets the lesson order. Ids not belonging to the course are ignored and missing ones keep their relative order at the end. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const course = await getManagedCourse(user, params.id);
  const { lessonIds } = reorderSchema.parse(await readJson(req));

  await resequenceLessons(course.id, lessonIds);
  const lessons = await prisma.lesson.findMany({ where: { courseId: course.id }, orderBy: { position: 'asc' }, select: { id: true, title: true, position: true } });
  return json({ lessons });
});
