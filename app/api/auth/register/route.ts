import { Prisma } from '@prisma/client';
import { hashPassword, startSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, json, readJson, route } from '@/lib/http';
import { registerSchema } from '@/lib/validation';

export const POST = route(async (req) => {
  const input = registerSchema.parse(await readJson(req));

  try {
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password) },
      select: { id: true, name: true, email: true, role: true },
    });

    await startSession(user);
    return json({ user }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'An account with this email already exists');
    }
    throw error;
  }
});
