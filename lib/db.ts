import { PrismaClient } from '@prisma/client';

// One client per process (Next.js dev reloads would otherwise open a new connection pool every time).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
