import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My learning' };

export default async function MyLearningPage() {
  const user = await requirePageUser('/my-learning');

  const [enrollments, certificates] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { id: true, title: true, category: true, instructor: { select: { name: true } } } } },
    }),
    prisma.certificate.findMany({ where: { userId: user.id }, select: { courseId: true, code: true } }),
  ]);
  const certificateByCourse = new Map(certificates.map((c) => [c.courseId, c.code]));

  return (
    <>
      <h1>My learning</h1>

      {enrollments.length === 0 ? (
        <div className="card">
          <p>You have not enrolled in any course yet.</p>
          <Link className="button" href="/">
            Browse courses
          </Link>
        </div>
      ) : (
        <div className="grid">
          {enrollments.map((e) => {
            const code = certificateByCourse.get(e.courseId);
            return (
              <div key={e.id} className="card">
                <div className="tags">
                  <span className="tag">{e.course.category}</span>
                  {code && <span className="tag">Certified</span>}
                </div>
                <h3 style={{ marginTop: '0.4rem' }}>{e.course.title}</h3>
                <p className="muted small">By {e.course.instructor.name}</p>
                <div className="bar">
                  <span style={{ width: `${e.progress}%` }} />
                </div>
                <p className="muted small">{e.progress}% complete</p>
                <div className="row tight">
                  <Link className="button small" href={`/learn/${e.courseId}`}>
                    {e.progress > 0 ? 'Continue' : 'Start'}
                  </Link>
                  {code && (
                    <Link className="button secondary small" href={`/certificates/${code}`}>
                      Certificate
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
