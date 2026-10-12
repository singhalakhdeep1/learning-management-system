import { notFound, redirect } from 'next/navigation';
import CoursePlayer from '@/components/CoursePlayer';
import { canManageCourse, requirePageUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recalculateEnrollment } from '@/lib/lms';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Learn' };

export default async function LearnPage({ params }: { params: { id: string } }) {
  const user = await requirePageUser(`/learn/${params.id}`);

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: { lessons: { orderBy: { position: 'asc' } } },
  });
  if (!course) notFound();

  const manager = canManageCourse(user, course.instructorId);
  const enrollment = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: course.id, userId: user.id } } });
  if (!enrollment && !manager) redirect(`/courses/${course.id}`);

  const trackProgress = enrollment !== null;

  const [status, lessonProgress, quizzes, certificate] = trackProgress
    ? await Promise.all([
        recalculateEnrollment(user.id, course.id),
        prisma.lessonProgress.findMany({ where: { userId: user.id, lesson: { courseId: course.id } } }),
        prisma.quiz.findMany({
          where: { courseId: course.id },
          orderBy: { position: 'asc' },
          include: { attempts: { where: { userId: user.id } } },
        }),
        prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }),
      ])
    : [
        { completedLessons: 0, totalLessons: course.lessons.length, progress: 0, quizzesPassed: true, completed: false },
        [],
        await prisma.quiz.findMany({ where: { courseId: course.id }, orderBy: { position: 'asc' }, include: { attempts: { where: { userId: user.id } } } }),
        null,
      ];

  return (
    <CoursePlayer
      courseId={course.id}
      courseTitle={course.title}
      trackProgress={trackProgress}
      certificateCode={certificate?.code ?? null}
      initialStatus={status}
      initialProgress={Object.fromEntries(
        lessonProgress.map((p) => [p.lessonId, { completed: p.completed, positionSeconds: p.positionSeconds }]),
      )}
      lessons={course.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        videoUrl: l.videoUrl,
        durationSeconds: l.durationSeconds,
      }))}
      quizzes={quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        passPercent: q.passPercent,
        attempts: q.attempts.length,
        bestScore: q.attempts.reduce((best, a) => Math.max(best, a.scorePercent), 0),
        passed: q.attempts.some((a) => a.passed),
      }))}
    />
  );
}
