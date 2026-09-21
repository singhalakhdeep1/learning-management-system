import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Learning Management System database...');

  await prisma.course.create({
    data: {
      title: 'Full-Stack Web Development Bootcamp',
      description: 'Master React, Next.js, Node.js, TypeScript, and PostgreSQL.',
      price: 199.99,
      isPublished: true,
      lessons: {
        create: [
          { title: 'Introduction to Modern Web Architecture', position: 1, videoUrl: 'https://cdn.lms.com/v1.mp4' },
          { title: 'State Management with Zustand & React Query', position: 2, videoUrl: 'https://cdn.lms.com/v2.mp4' },
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
