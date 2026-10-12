import bcrypt from 'bcryptjs';
import { startSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, json, readJson, route } from '@/lib/http';
import { clearAttempts, clientIp, tooManyAttempts } from '@/lib/rateLimit';
import { loginSchema } from '@/lib/validation';

// Compared against when the email is unknown, so unknown and known accounts take the same time to reject.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const POST = route(async (req) => {
  const { email, password } = loginSchema.parse(await readJson(req));

  const key = `${clientIp(req)}|${email}`;
  if (tooManyAttempts(key)) throw new HttpError(429, 'Too many sign-in attempts. Try again in a few minutes.');

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Invalid email or password');

  clearAttempts(key);
  await startSession(user);
  return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
