/**
 * LMS — core business logic services (no DB dependency, pure TypeScript)
 *
 * These are extracted from handler logic so they are testable without Prisma.
 */

export interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  isPublished: boolean;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  videoUrl?: string;
  position: number;
  courseId: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  progress: number; // 0.0 – 100.0
}

// ─── Progress ────────────────────────────────────────────────────────────────

export function calculateProgress(completedLessons: number, totalLessons: number): number {
  if (totalLessons === 0) return 0;
  if (completedLessons < 0 || completedLessons > totalLessons) {
    throw new RangeError(`completedLessons (${completedLessons}) must be 0..${totalLessons}`);
  }
  return Math.round((completedLessons / totalLessons) * 100 * 100) / 100; // 2dp
}

export function isCourseCompleted(progress: number): boolean {
  return progress >= 100;
}

// ─── Enrollment ──────────────────────────────────────────────────────────────

export class EnrollmentService {
  private enrollments: Enrollment[] = [];

  enroll(courseId: string, userId: string): Enrollment {
    const existing = this.enrollments.find(
      (e) => e.courseId === courseId && e.userId === userId,
    );
    if (existing) throw new Error(`User ${userId} is already enrolled in course ${courseId}`);

    const enrollment: Enrollment = {
      id: `enr-${courseId}-${userId}`,
      courseId,
      userId,
      progress: 0,
    };
    this.enrollments.push(enrollment);
    return enrollment;
  }

  updateProgress(courseId: string, userId: string, completedLessons: number, totalLessons: number): Enrollment {
    const enrollment = this.enrollments.find(
      (e) => e.courseId === courseId && e.userId === userId,
    );
    if (!enrollment) throw new Error('Enrollment not found');
    enrollment.progress = calculateProgress(completedLessons, totalLessons);
    return enrollment;
  }

  getEnrollment(courseId: string, userId: string): Enrollment | undefined {
    return this.enrollments.find((e) => e.courseId === courseId && e.userId === userId);
  }

  getUserEnrollments(userId: string): Enrollment[] {
    return this.enrollments.filter((e) => e.userId === userId);
  }
}

// ─── Course catalogue ────────────────────────────────────────────────────────

export class CourseService {
  private courses: Course[] = [];

  addCourse(course: Course): Course {
    if (this.courses.find((c) => c.id === course.id)) {
      throw new Error(`Course with id ${course.id} already exists`);
    }
    this.courses.push(course);
    return course;
  }

  getPublished(): Course[] {
    return this.courses.filter((c) => c.isPublished);
  }

  getById(id: string): Course | undefined {
    return this.courses.find((c) => c.id === id);
  }

  getLessonsOrdered(courseId: string): Lesson[] {
    const course = this.courses.find((c) => c.id === courseId);
    if (!course) throw new Error('Course not found');
    return [...course.lessons].sort((a, b) => a.position - b.position);
  }

  totalLessons(courseId: string): number {
    const course = this.courses.find((c) => c.id === courseId);
    return course?.lessons.length ?? 0;
  }
}

// ─── Pricing / discount ──────────────────────────────────────────────────────

export function applyDiscount(price: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new RangeError('discountPercent must be 0–100');
  }
  return Math.round(price * (1 - discountPercent / 100) * 100) / 100;
}
