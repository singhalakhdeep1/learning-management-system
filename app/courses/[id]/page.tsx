import Link from 'next/link';
import { notFound } from 'next/navigation';
import EnrollPanel from '@/components/EnrollPanel';
import { canManageCourse, getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDuration, money } from '@/lib/format';
import { effectivePrice } from '@/lib/lms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const course = await prisma.course.findUnique({ where: { id: params.id }, select: { title: true, isPublished: true } });
  return { title: course?.isPublished ? course.title : 'Course' };
}

export default async function CoursePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      instructor: { select: { name: true } },
      lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true, description: true, durationSeconds: true } },
      quizzes: { orderBy: { position: 'asc' }, select: { id: true, title: true } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) notFound();

  const canManage = user !== null && canManageCourse(user, course.instructorId);
  if (!course.isPublished && !canManage) notFound();

  const enrolled = user !== null && (await prisma.enrollment.count({ where: { courseId: course.id, userId: user.id } })) > 0;
  const finalPrice = effectivePrice(course);
  const totalSeconds = course.lessons.reduce((sum, l) => sum + l.durationSeconds, 0);

  return (
    <div className="learn" style={{ gridTemplateColumns: '1fr 340px' }}>
      <div>
        <div className="tags">
          <span className="tag">{course.category}</span>
          <span className="tag">{course.level}</span>
          {!course.isPublished && <span className="tag">Draft: only you can see this</span>}
        </div>
        <h1 style={{ marginTop: '0.5rem' }}>{course.title}</h1>
        <p className="muted">
          By {course.instructor.name} · {course.lessons.length} lessons
          {totalSeconds > 0 && ` · ${formatDuration(totalSeconds)}`} · {course._count.enrollments} students
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{course.description}</p>

        <h2 style={{ marginTop: '1.5rem' }}>Lessons</h2>
        <div className="card">
          <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {course.lessons.map((lesson) => (
              <li key={lesson.id} style={{ margin: '0.4rem 0' }}>
                {lesson.title} <span className="muted small">{formatDuration(lesson.durationSeconds)}</span>
              </li>
            ))}
          </ol>
          {course.lessons.length === 0 && <p className="muted">No lessons yet.</p>}
        </div>

        {course.quizzes.length > 0 && (
          <>
            <h2 style={{ marginTop: '1.5rem' }}>Quizzes</h2>
            <div className="card">
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {course.quizzes.map((q) => (
                  <li key={q.id}>{q.title}</li>
                ))}
              </ul>
              <p className="muted small" style={{ marginTop: '0.5rem' }}>
                Finish every lesson and pass every quiz to earn a certificate.
              </p>
            </div>
          </>
        )}
      </div>

      <aside>
        <EnrollPanel
          courseId={course.id}
          signedIn={user !== null}
          enrolled={enrolled}
          canManage={canManage}
          price={course.price}
          finalPrice={finalPrice}
        />
        {canManage && (
          <p style={{ marginTop: '1rem' }}>
            <Link href={`/instructor/courses/${course.id}`}>Edit this course →</Link>
          </p>
        )}
        {course.discountPercent > 0 && (
          <p className="muted small" style={{ marginTop: '0.75rem' }}>
            {course.discountPercent}% off, from {money(course.price)}.
          </p>
        )}
      </aside>
    </div>
  );
}
