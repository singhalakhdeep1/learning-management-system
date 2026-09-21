import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateProgress,
  isCourseCompleted,
  applyDiscount,
  EnrollmentService,
  CourseService,
  type Course,
} from '../app/services';

// ────────────────────────────────────────────────────────────────────────────
// Progress calculator
// ────────────────────────────────────────────────────────────────────────────

describe('calculateProgress()', () => {
  it('calculates 70% for 7 of 10 lessons', () => {
    expect(calculateProgress(7, 10)).toBe(70);
  });

  it('returns 0 for 0 completed lessons', () => {
    expect(calculateProgress(0, 10)).toBe(0);
  });

  it('returns 100 for all lessons completed', () => {
    expect(calculateProgress(10, 10)).toBe(100);
  });

  it('returns 0 when totalLessons is 0', () => {
    expect(calculateProgress(0, 0)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    // 1/3 of 10 = 33.33%
    expect(calculateProgress(1, 3)).toBeCloseTo(33.33, 1);
  });

  it('throws for negative completedLessons', () => {
    expect(() => calculateProgress(-1, 10)).toThrow(RangeError);
  });

  it('throws when completedLessons exceeds totalLessons', () => {
    expect(() => calculateProgress(11, 10)).toThrow(RangeError);
  });
});

describe('isCourseCompleted()', () => {
  it('returns true for 100% progress', () => {
    expect(isCourseCompleted(100)).toBe(true);
  });

  it('returns false for 99.99% progress', () => {
    expect(isCourseCompleted(99.99)).toBe(false);
  });

  it('returns false for 0% progress', () => {
    expect(isCourseCompleted(0)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Discount / pricing
// ────────────────────────────────────────────────────────────────────────────

describe('applyDiscount()', () => {
  it('applies 10% discount to $99.99', () => {
    expect(applyDiscount(99.99, 10)).toBeCloseTo(89.99, 2);
  });

  it('0% discount returns original price', () => {
    expect(applyDiscount(50, 0)).toBe(50);
  });

  it('100% discount returns $0', () => {
    expect(applyDiscount(50, 100)).toBe(0);
  });

  it('throws for negative discount', () => {
    expect(() => applyDiscount(50, -1)).toThrow(RangeError);
  });

  it('throws for discount > 100', () => {
    expect(() => applyDiscount(50, 101)).toThrow(RangeError);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// EnrollmentService
// ────────────────────────────────────────────────────────────────────────────

describe('EnrollmentService', () => {
  let service: EnrollmentService;

  beforeEach(() => { service = new EnrollmentService(); });

  it('creates a new enrollment with progress 0', () => {
    const enrollment = service.enroll('course-1', 'user-1');
    expect(enrollment.progress).toBe(0);
    expect(enrollment.courseId).toBe('course-1');
    expect(enrollment.userId).toBe('user-1');
  });

  it('throws on duplicate enrollment', () => {
    service.enroll('course-1', 'user-1');
    expect(() => service.enroll('course-1', 'user-1')).toThrow(/already enrolled/);
  });

  it('allows same user to enroll in different courses', () => {
    service.enroll('course-1', 'user-1');
    expect(() => service.enroll('course-2', 'user-1')).not.toThrow();
  });

  it('allows different users to enroll in same course', () => {
    service.enroll('course-1', 'user-1');
    expect(() => service.enroll('course-1', 'user-2')).not.toThrow();
  });

  it('updates progress correctly', () => {
    service.enroll('course-1', 'user-1');
    const updated = service.updateProgress('course-1', 'user-1', 5, 10);
    expect(updated.progress).toBe(50);
  });

  it('throws on updateProgress for non-enrolled user', () => {
    expect(() => service.updateProgress('course-1', 'ghost', 1, 10)).toThrow('Enrollment not found');
  });

  it('returns all enrollments for a user', () => {
    service.enroll('course-1', 'user-1');
    service.enroll('course-2', 'user-1');
    expect(service.getUserEnrollments('user-1')).toHaveLength(2);
  });

  it('returns empty array when user has no enrollments', () => {
    expect(service.getUserEnrollments('nobody')).toHaveLength(0);
  });

  it('getEnrollment returns undefined for unknown pair', () => {
    expect(service.getEnrollment('c', 'u')).toBeUndefined();
  });

  it('marks enrollment complete when progress reaches 100', () => {
    service.enroll('course-1', 'user-1');
    const updated = service.updateProgress('course-1', 'user-1', 10, 10);
    expect(isCourseCompleted(updated.progress)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CourseService
// ────────────────────────────────────────────────────────────────────────────

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c-1',
    title: 'React Fundamentals',
    description: 'Learn React',
    price: 99,
    isPublished: true,
    lessons: [
      { id: 'l-1', title: 'Intro', position: 1, courseId: 'c-1' },
      { id: 'l-2', title: 'Hooks', position: 2, courseId: 'c-1' },
    ],
    ...overrides,
  };
}

describe('CourseService', () => {
  let service: CourseService;

  beforeEach(() => { service = new CourseService(); });

  it('adds and retrieves a course by id', () => {
    service.addCourse(makeCourse());
    expect(service.getById('c-1')).toBeDefined();
  });

  it('throws on duplicate course id', () => {
    service.addCourse(makeCourse());
    expect(() => service.addCourse(makeCourse())).toThrow(/already exists/);
  });

  it('getPublished returns only published courses', () => {
    service.addCourse(makeCourse({ id: 'c-1', isPublished: true }));
    service.addCourse(makeCourse({ id: 'c-2', isPublished: false }));
    const published = service.getPublished();
    expect(published).toHaveLength(1);
    expect(published[0].id).toBe('c-1');
  });

  it('getById returns undefined for unknown id', () => {
    expect(service.getById('nope')).toBeUndefined();
  });

  it('getLessonsOrdered returns lessons sorted by position', () => {
    const course = makeCourse({
      lessons: [
        { id: 'l-3', title: 'Advanced', position: 3, courseId: 'c-1' },
        { id: 'l-1', title: 'Intro', position: 1, courseId: 'c-1' },
        { id: 'l-2', title: 'Hooks', position: 2, courseId: 'c-1' },
      ],
    });
    service.addCourse(course);
    const ordered = service.getLessonsOrdered('c-1');
    expect(ordered.map((l) => l.position)).toEqual([1, 2, 3]);
  });

  it('getLessonsOrdered throws for unknown course', () => {
    expect(() => service.getLessonsOrdered('unknown')).toThrow('Course not found');
  });

  it('totalLessons returns correct count', () => {
    service.addCourse(makeCourse());
    expect(service.totalLessons('c-1')).toBe(2);
  });

  it('totalLessons returns 0 for unknown course', () => {
    expect(service.totalLessons('nope')).toBe(0);
  });
});
