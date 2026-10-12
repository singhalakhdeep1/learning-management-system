import { z } from 'zod';

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Must be an http(s) URL');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  // Self-service sign-up can only create students or instructors; admins are made by an existing admin or the seed.
  role: z.enum(['STUDENT', 'INSTRUCTOR']).default('STUDENT'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const courseSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(5000),
  price: z.number().min(0).max(100000),
  category: z.string().trim().min(2).max(60).default('General'),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const coursePatchSchema = courseSchema.partial().extend({ isPublished: z.boolean().optional() });

export const lessonSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).default(''),
  videoUrl: httpUrl.nullable().optional(),
  durationSeconds: z.number().int().min(0).max(24 * 3600).default(0),
});

export const lessonPatchSchema = lessonSchema.partial();

export const reorderSchema = z.object({ lessonIds: z.array(z.string().uuid()).min(1) });

export const progressSchema = z.object({
  completed: z.boolean().optional(),
  positionSeconds: z.number().int().min(0).max(24 * 3600).optional(),
});

const optionSchema = z.object({
  text: z.string().trim().min(1).max(300),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    text: z.string().trim().min(3).max(1000),
    type: z.enum(['SINGLE', 'MULTIPLE']).default('SINGLE'),
    explanation: z.string().trim().max(1000).nullable().optional(),
    options: z.array(optionSchema).min(2, 'A question needs at least 2 options').max(8),
  })
  .superRefine((question, ctx) => {
    const correct = question.options.filter((o) => o.isCorrect).length;
    if (correct === 0) ctx.addIssue({ code: 'custom', message: 'Mark at least one option as correct', path: ['options'] });
    if (question.type === 'SINGLE' && correct !== 1) {
      ctx.addIssue({ code: 'custom', message: 'A single-choice question needs exactly one correct option', path: ['options'] });
    }
  });

export const quizSchema = z.object({
  title: z.string().trim().min(2).max(150),
  passPercent: z.number().int().min(1).max(100).default(70),
  questions: z.array(questionSchema).min(1, 'A quiz needs at least one question').max(100),
});

export const attemptSchema = z.object({
  // questionId -> selected option ids
  answers: z.record(z.string(), z.array(z.string())),
});

export const checkoutSchema = z.object({
  cardNumber: z.string().min(12).max(23),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(2000).max(2100),
});

export type CourseInput = z.infer<typeof courseSchema>;
export type QuizInput = z.infer<typeof quizSchema>;
