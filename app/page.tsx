import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import CourseCard from '@/components/CourseCard';
import { prisma } from '@/lib/db';
import { effectivePrice } from '@/lib/lms';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 12;
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; level?: string; page?: string };
}) {
  const q = searchParams.q?.trim();
  const page = Math.max(1, Number(searchParams.page) || 1);

  const where: Prisma.CourseWhereInput = { isPublished: true };
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
  if (searchParams.category) where.category = searchParams.category;
  if (searchParams.level) where.level = searchParams.level;

  const [total, courses, categories] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { instructor: { select: { name: true } }, _count: { select: { lessons: true } } },
    }),
    prisma.course.findMany({ where: { isPublished: true }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (searchParams.category) params.set('category', searchParams.category);
    if (searchParams.level) params.set('level', searchParams.level);
    params.set('page', String(p));
    return `/?${params.toString()}`;
  };

  return (
    <>
      <h1>Learning Management System</h1>
      <p className="muted">Interactive course catalog, HLS video lessons, quizzes and certificates.</p>

      <form className="card row" style={{ margin: '1rem 0' }}>
        <div style={{ flex: 2 }}>
          <label htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search courses" />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={searchParams.category ?? ''}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="level">Level</label>
          <select id="level" name="level" defaultValue={searchParams.level ?? ''}>
            <option value="">Any</option>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <button type="submit" style={{ flex: 'none' }}>
          Filter
        </button>
      </form>

      {courses.length === 0 ? (
        <div className="card">
          <p>No courses match. {q || searchParams.category || searchParams.level ? <Link href="/">Clear filters</Link> : 'Check back soon.'}</p>
        </div>
      ) : (
        <div className="grid">
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              course={{
                id: c.id,
                title: c.title,
                description: c.description,
                category: c.category,
                level: c.level,
                price: c.price,
                finalPrice: effectivePrice(c),
                instructor: c.instructor.name,
                lessonCount: c._count.lessons,
              }}
            />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="split" style={{ marginTop: '1.5rem' }}>
          {page > 1 ? <Link href={link(page - 1)}>← Previous</Link> : <span />}
          <span className="muted small">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={link(page + 1)}>Next →</Link> : <span />}
        </div>
      )}
    </>
  );
}
