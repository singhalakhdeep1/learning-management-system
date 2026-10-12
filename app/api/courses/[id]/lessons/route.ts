import { requireApiUser } from '@/lib/auth';
import { getManagedCourse } from '@/lib/courses';
import { prisma } from '@/lib/db';
import { json, readJson, route } from '@/lib/http';
import { lessonSchema } from '@/lib/validation';

type Ctx = { params: { id: string } };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const course = await getManagedCourse(user, params.id);
  const input = lessonSchema.parse(await readJson(req));

  const last = await prisma.lesson.aggregate({ where: { courseId: course.id }, _max: { position: true } });
  const lesson = await prisma.lesson.create({
    data: { ...input, videoUrl: input.videoUrl ?? null, courseId: course.id, position: (last._max.position ?? 0) + 1 },
  });
  return json(lesson, 201);
});
