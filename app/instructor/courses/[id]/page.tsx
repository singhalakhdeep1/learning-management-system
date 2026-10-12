import { notFound, redirect } from 'next/navigation';
import CourseEditor from '@/components/CourseEditor';
import { canManageCourse, requirePageUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit course' };

export default async function EditCoursePage({ params }: { params: { id: string } }) {
  const user = await requirePageUser(`/instructor/courses/${params.id}`, 'INSTRUCTOR', 'ADMIN');

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      lessons: { orderBy: { position: 'asc' } },
      quizzes: { orderBy: { position: 'asc' }, include: { _count: { select: { questions: true } } } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) notFound();
  if (!canManageCourse(user, course.instructorId)) redirect('/instructor');

  return (
    <CourseEditor
      course={{
        id: course.id,
        title: course.title,
        description: course.description,
        price: course.price,
        discountPercent: course.discountPercent,
        category: course.category,
        level: course.level,
        isPublished: course.isPublished,
        enrollmentCount: course._count.enrollments,
      }}
      lessons={course.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        videoUrl: l.videoUrl,
        durationSeconds: l.durationSeconds,
      }))}
      quizzes={course.quizzes.map((q) => ({ id: q.id, title: q.title, passPercent: q.passPercent, questionCount: q._count.questions }))}
    />
  );
}
