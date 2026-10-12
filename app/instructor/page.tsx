import CourseCard from '@/components/CourseCard';
import CreateCourseForm from '@/components/CreateCourseForm';
import { requirePageUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { effectivePrice } from '@/lib/lms';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Teach' };

export default async function InstructorPage() {
  const user = await requirePageUser('/instructor', 'INSTRUCTOR', 'ADMIN');

  const courses = await prisma.course.findMany({
    where: user.role === 'ADMIN' ? {} : { instructorId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { instructor: { select: { name: true } }, _count: { select: { lessons: true, enrollments: true } } },
  });

  return (
    <>
      <h1>Your courses</h1>
      {courses.length === 0 ? (
        <p className="muted">You have not created a course yet.</p>
      ) : (
        <div className="grid" style={{ marginBottom: '2rem' }}>
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              href={`/instructor/courses/${c.id}`}
              course={{
                id: c.id,
                title: c.title,
                description: `${c._count.enrollments} students enrolled. ${c.description}`,
                category: c.category,
                level: c.level,
                price: c.price,
                finalPrice: effectivePrice(c),
                instructor: c.instructor.name,
                lessonCount: c._count.lessons,
                isPublished: c.isPublished,
              }}
            />
          ))}
        </div>
      )}
      <CreateCourseForm />
    </>
  );
}
