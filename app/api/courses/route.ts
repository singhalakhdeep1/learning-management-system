import type { Prisma } from '@prisma/client';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { json, readJson, route } from '@/lib/http';
import { effectivePrice } from '@/lib/lms';
import { courseSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Public catalog of published courses. `?mine=1` lists the signed-in instructor's own courses (drafts included). */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const category = url.searchParams.get('category')?.trim();
  const level = url.searchParams.get('level')?.trim();
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 12));

  const where: Prisma.CourseWhereInput = {};
  if (url.searchParams.get('mine') === '1') {
    const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
    if (user.role !== 'ADMIN') where.instructorId = user.id;
  } else {
    where.isPublished = true;
  }

  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
  if (category) where.category = category;
  if (level) where.level = level;

  const [total, courses] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { instructor: { select: { name: true } }, _count: { select: { lessons: true, enrollments: true } } },
    }),
  ]);

  return json({
    page,
    pageSize,
    total,
    items: courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level,
      price: c.price,
      discountPercent: c.discountPercent,
      finalPrice: effectivePrice(c),
      isPublished: c.isPublished,
      instructor: c.instructor.name,
      lessonCount: c._count.lessons,
      enrollmentCount: c._count.enrollments,
    })),
  });
});

export const POST = route(async (req) => {
  const user = await requireApiUser('INSTRUCTOR', 'ADMIN');
  const input = courseSchema.parse(await readJson(req));

  const course = await prisma.course.create({ data: { ...input, instructorId: user.id } });
  return json(course, 201);
});
