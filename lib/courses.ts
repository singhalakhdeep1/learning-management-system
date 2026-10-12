import { canManageCourse, type SessionUser } from './auth';
import { prisma } from './db';
import { HttpError } from './http';

/** Loads a course the user may edit (its instructor, or an admin); 404 if missing, 403 otherwise. */
export async function getManagedCourse(user: SessionUser, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Course not found');
  if (!canManageCourse(user, course.instructorId)) throw new HttpError(403, 'Only the instructor can change this course');
  return course;
}

/** Closes gaps in lesson positions after a delete or reorder so they always run 1..n. */
export async function resequenceLessons(courseId: string, orderedIds?: string[]): Promise<void> {
  const lessons = await prisma.lesson.findMany({ where: { courseId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  const byId = new Map(lessons.map((l) => [l.id, l]));

  let ordered = lessons.map((l) => l.id);
  if (orderedIds) {
    const listed = orderedIds.filter((id) => byId.has(id));
    const missing = ordered.filter((id) => !listed.includes(id));
    ordered = [...new Set([...listed, ...missing])];
  }

  await prisma.$transaction(
    ordered.map((id, index) => prisma.lesson.update({ where: { id }, data: { position: index + 1 } })),
  );
}
