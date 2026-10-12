import { requireApiUser } from '@/lib/auth';
import { getManagedCourse } from '@/lib/courses';
import { prisma } from '@/lib/db';
import { json, readJson, route } from '@/lib/http';
import { quizSchema } from '@/lib/validation';

type Ctx = { params: { id: string } };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const course = await getManagedCourse(user, params.id);
  const input = quizSchema.parse(await readJson(req));

  const last = await prisma.quiz.aggregate({ where: { courseId: course.id }, _max: { position: true } });
  const quiz = await prisma.quiz.create({
    data: {
      courseId: course.id,
      title: input.title,
      passPercent: input.passPercent,
      position: (last._max.position ?? 0) + 1,
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
    select: { id: true },
  });

  return json({ id: quiz.id }, 201);
});
