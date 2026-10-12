import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Public sample media so the player has something to play out of the box. Replace with your own CDN links.
const HLS_SAMPLE = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const MP4_SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

async function upsertUser(email: string, name: string, role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN', password: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
  });
}

async function main() {
  console.log('Seeding Learning Management System database...');

  const password = process.env.SEED_PASSWORD;
  const instructorEmail = process.env.SEED_INSTRUCTOR_EMAIL;
  const studentEmail = process.env.SEED_STUDENT_EMAIL;
  const adminEmail = process.env.SEED_ADMIN_EMAIL;

  if (!password || !instructorEmail) {
    console.log('SEED_PASSWORD and SEED_INSTRUCTOR_EMAIL are not set: nothing to seed. See .env.example.');
    return;
  }

  const instructor = await upsertUser(instructorEmail, 'Demo Instructor', 'INSTRUCTOR', password);
  if (studentEmail) await upsertUser(studentEmail, 'Demo Student', 'STUDENT', password);
  if (adminEmail) await upsertUser(adminEmail, 'Administrator', 'ADMIN', password);

  const title = 'Full-Stack Web Development Bootcamp';
  const existing = await prisma.course.findFirst({ where: { title, instructorId: instructor.id } });
  if (existing) {
    console.log('Demo course already exists, leaving it as it is.');
    return;
  }

  await prisma.course.create({
    data: {
      title,
      description: 'Master React, Next.js, Node.js, TypeScript, and PostgreSQL by building real projects.',
      price: 199.99,
      discountPercent: 25,
      category: 'Web Development',
      level: 'Intermediate',
      isPublished: true,
      instructorId: instructor.id,
      lessons: {
        create: [
          { title: 'Introduction to Modern Web Architecture', position: 1, videoUrl: HLS_SAMPLE, durationSeconds: 600, description: 'How the pieces of a modern web app fit together.' },
          { title: 'State Management with Zustand & React Query', position: 2, videoUrl: MP4_SAMPLE, durationSeconds: 540, description: 'Client state versus server state, and when to use each.' },
        ],
      },
      quizzes: {
        create: [
          {
            title: 'Web architecture basics',
            passPercent: 60,
            position: 1,
            questions: {
              create: [
                {
                  text: 'Which of these is server state?',
                  type: 'SINGLE',
                  position: 1,
                  explanation: 'Server state lives on the server and is cached on the client; a library like React Query manages that.',
                  options: {
                    create: [
                      { text: 'Whether a modal is open', isCorrect: false, position: 1 },
                      { text: 'A list of courses fetched from an API', isCorrect: true, position: 2 },
                      { text: 'The current value of a text box', isCorrect: false, position: 3 },
                    ],
                  },
                },
                {
                  text: 'Which of these are valid HTTP methods for reading or removing a resource?',
                  type: 'MULTIPLE',
                  position: 2,
                  explanation: 'GET reads and DELETE removes. FETCH and READ are not HTTP methods.',
                  options: {
                    create: [
                      { text: 'GET', isCorrect: true, position: 1 },
                      { text: 'DELETE', isCorrect: true, position: 2 },
                      { text: 'FETCH', isCorrect: false, position: 3 },
                      { text: 'READ', isCorrect: false, position: 4 },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log('Seeding complete for LMS.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
