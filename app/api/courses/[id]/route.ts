import { canManageCourse, getSessionUser, requireApiUser } from '@/lib/auth';
import { getManagedCourse } from '@/lib/courses';
import { prisma } from '@/lib/db';
import { HttpError, json, readJson, route } from '@/lib/http';
import { canViewCourseContent, effectivePrice } from '@/lib/lms';
import { coursePatchSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * Course detail. Drafts are visible only to their instructor (and admins). Lesson video URLs are only
 * included for people who can watch them: enrolled students, the instructor and admins.
 */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await getSessionUser();

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      instructor: { select: { id: true, name: true } },
      lessons: { orderBy: { position: 'asc' } },
      quizzes: { orderBy: { position: 'asc' }, select: { id: true, title: true, passPercent: true, _count: { select: { questions: true } } } },
    },
  });
  if (!course) throw new HttpError(404, 'Course not found');

  const isManager = user !== null && canManageCourse(user, course.instructorId);
  if (!course.isPublished && !isManager) throw new HttpError(404, 'Course not found');

  const canWatch = user !== null && (await canViewCourseContent(user, course));
  const enrolled = user !== null && (await prisma.enrollment.count({ where: { courseId: course.id, userId: user.id } })) > 0;

  return json({
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    price: course.price,
    discountPercent: course.discountPercent,
    finalPrice: effectivePrice(course),
    isPublished: course.isPublished,
    instructor: course.instructor,
    canWatch,
    enrolled,
    canManage: isManager,
    lessons: course.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      position: lesson.position,
      durationSeconds: lesson.durationSeconds,
      hasVideo: Boolean(lesson.videoUrl),
      videoUrl: canWatch ? lesson.videoUrl : null,
    })),
    quizzes: course.quizzes.map((q) => ({ id: q.id, title: q.title, passPercent: q.passPercent, questionCount: q._count.questions })),
  });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const course = await getManagedCourse(user, params.id);
  const input = coursePatchSchema.parse(await readJson(req));

  if (input.isPublished === true) {
    const lessonCount = await prisma.lesson.count({ where: { courseId: course.id } });
    if (lessonCount === 0) throw new HttpError(409, 'Add at least one lesson before publishing');
  }

  return json(await prisma.course.update({ where: { id: course.id }, data: input }));
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const course = await getManagedCourse(user, params.id);

  const enrolled = await prisma.enrollment.count({ where: { courseId: course.id } });
  if (enrolled > 0) throw new HttpError(409, 'Students are enrolled in this course. Unpublish it instead of deleting it.');

  await prisma.course.delete({ where: { id: course.id } });
  return json({ ok: true });
});
