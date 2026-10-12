import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { applyDiscount, calculateProgress, isCourseCompleted } from '../app/services';
import { prisma } from './db';
import { HttpError } from './http';

// ---------------------------------------------------------------- pricing

/** Price after the course's discount. */
export function effectivePrice(course: { price: number; discountPercent: number }): number {
  return applyDiscount(course.price, course.discountPercent);
}

// ---------------------------------------------------------------- progress

export interface CourseStatus {
  completedLessons: number;
  totalLessons: number;
  progress: number;
  quizzesPassed: boolean;
  completed: boolean;
}

/** True when the user has a passing attempt on every quiz of the course (vacuously true with no quizzes). */
export async function hasPassedAllQuizzes(userId: string, courseId: string): Promise<boolean> {
  const quizzes = await prisma.quiz.findMany({ where: { courseId }, select: { id: true } });
  if (quizzes.length === 0) return true;

  const passed = await prisma.quizAttempt.groupBy({
    by: ['quizId'],
    where: { userId, passed: true, quizId: { in: quizzes.map((q) => q.id) } },
  });
  return passed.length === quizzes.length;
}

/**
 * Recomputes and stores the enrollment's progress from the completed lessons. A course counts as
 * completed (and can earn a certificate) only when every lesson is done and every quiz passed.
 */
export async function recalculateEnrollment(userId: string, courseId: string): Promise<CourseStatus> {
  const [totalLessons, completedLessons, quizzesPassed] = await Promise.all([
    prisma.lesson.count({ where: { courseId } }),
    prisma.lessonProgress.count({ where: { userId, completed: true, lesson: { courseId } } }),
    hasPassedAllQuizzes(userId, courseId),
  ]);

  const progress = calculateProgress(Math.min(completedLessons, totalLessons), totalLessons);
  const completed = totalLessons > 0 && isCourseCompleted(progress) && quizzesPassed;

  const enrollment = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId } } });
  if (enrollment) {
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { progress, completedAt: completed ? enrollment.completedAt ?? new Date() : null },
    });
  }

  return { completedLessons, totalLessons, progress, quizzesPassed, completed };
}

// ---------------------------------------------------------------- quizzes

export interface QuestionForGrading {
  id: string;
  explanation: string | null;
  options: { id: string; isCorrect: boolean }[];
}

export interface GradedQuestion {
  questionId: string;
  correct: boolean;
  selected: string[];
  correctOptionIds: string[];
  explanation: string | null;
}

/** A question is right only when the selected options are exactly the correct ones (no partial credit). */
export function gradeQuiz(questions: QuestionForGrading[], answers: Record<string, string[]>) {
  const results: GradedQuestion[] = questions.map((question) => {
    const validIds = new Set(question.options.map((o) => o.id));
    const selected = [...new Set(answers[question.id] ?? [])].filter((id) => validIds.has(id));
    const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
    const correct = selected.length === correctOptionIds.length && correctOptionIds.every((id) => selected.includes(id));

    return { questionId: question.id, correct, selected, correctOptionIds, explanation: question.explanation };
  });

  const right = results.filter((r) => r.correct).length;
  const scorePercent = questions.length === 0 ? 0 : Math.round((right / questions.length) * 10000) / 100;
  return { results, right, total: questions.length, scorePercent };
}

// ---------------------------------------------------------------- certificates

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L lookalikes

export function newCertificateCode(): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

/** Issues (or returns the existing) certificate for a student who has finished the course. */
export async function issueCertificate(user: { id: string; name: string }, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId: user.id } },
    include: { course: { select: { title: true } } },
  });
  if (!enrollment) throw new HttpError(403, 'You are not enrolled in this course');

  const status = await recalculateEnrollment(user.id, courseId);
  if (!status.completed) {
    const reasons = [];
    if (status.completedLessons < status.totalLessons) reasons.push(`${status.totalLessons - status.completedLessons} lessons left`);
    if (!status.quizzesPassed) reasons.push('not all quizzes passed');
    throw new HttpError(409, `Finish the course first (${reasons.join(', ') || 'no lessons yet'})`);
  }

  const existing = await prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.certificate.create({
        data: { code: newCertificateCode(), userId: user.id, courseId, studentName: user.name, courseTitle: enrollment.course.title },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      // Either the code collided (retry) or a parallel request already issued it (return that one).
      const raced = await prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
      if (raced) return raced;
    }
  }
  throw new HttpError(500, 'Could not issue the certificate, please try again');
}

// ---------------------------------------------------------------- payment (simulated gateway)

function luhnValid(digits: string): boolean {
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export interface CardCharge {
  ok: boolean;
  last4: string;
  message: string;
  /** True when the processor itself refused the card; false for input errors caught before any charge is attempted. */
  declined: boolean;
}

/**
 * Stand-in for a real card processor. Test cards: 4242 4242 4242 4242 succeeds,
 * 4000 0000 0000 0002 is declined, 4000 0000 0000 9995 has insufficient funds.
 * The card number is only inspected here and never stored or logged.
 */
export function chargeSimulatedCard(cardNumber: string, expMonth: number, expYear: number, now = new Date()): CardCharge {
  const digits = cardNumber.replace(/[\s-]/g, '');
  const last4 = digits.slice(-4);

  if (!/^\d+$/.test(digits) || !luhnValid(digits)) return { ok: false, declined: false, last4, message: 'The card number is not valid' };

  const expired = expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1);
  if (expired) return { ok: false, declined: false, last4, message: 'The card has expired' };

  if (digits === '4000000000000002') return { ok: false, declined: true, last4, message: 'Your card was declined' };
  if (digits === '4000000000009995') return { ok: false, declined: true, last4, message: 'Your card has insufficient funds' };
  return { ok: true, declined: false, last4, message: 'Payment approved' };
}

/**
 * Enrolls the user in a published course. Free courses (after discount) enroll immediately; paid ones
 * charge the card first and record a Purchase either way. A user can only be enrolled once.
 */
export async function enrollUser(
  user: { id: string },
  courseId: string,
  card?: { cardNumber: string; expMonth: number; expYear: number },
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !course.isPublished) throw new HttpError(404, 'Course not found');
  if (course.instructorId === user.id) throw new HttpError(409, 'You teach this course, so you already have access');

  const already = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (already) throw new HttpError(409, 'You are already enrolled in this course');

  const price = effectivePrice(course);
  let payment: { amountCents: number; reference: string; cardLast4: string } | null = null;

  if (price > 0) {
    if (!card) throw new HttpError(402, 'This course needs payment details');

    const charge = chargeSimulatedCard(card.cardNumber, card.expMonth, card.expYear);
    const record = { amountCents: Math.round(price * 100), reference: `PUR-${randomUUID()}`, cardLast4: charge.last4 };

    if (!charge.ok) {
      // Only record attempts the processor actually refused; a mistyped number never reached it.
      if (charge.declined) await prisma.purchase.create({ data: { userId: user.id, courseId, ...record, status: 'FAILED' } });
      throw new HttpError(402, charge.message);
    }

    payment = record;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (payment) await tx.purchase.create({ data: { userId: user.id, courseId, ...payment, status: 'PAID' } });
      return tx.enrollment.create({ data: { courseId, userId: user.id } });
    });
  } catch (error) {
    // Two simultaneous requests: the unique index let only one enrollment through (and rolled back the other's purchase).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'You are already enrolled in this course');
    }
    throw error;
  }
}

// ---------------------------------------------------------------- access

/** Students need an enrollment; the course's instructor and admins can always view it. */
export async function canViewCourseContent(user: { id: string; role: string }, course: { id: string; instructorId: string }): Promise<boolean> {
  if (user.role === 'ADMIN' || user.id === course.instructorId) return true;
  const enrollment = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: course.id, userId: user.id } } });
  return enrollment !== null;
}
