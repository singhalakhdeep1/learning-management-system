import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@prisma/client';
import { prisma } from './db';
import { HttpError } from './http';

export const SESSION_COOKIE = 'lms_session';
const SESSION_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters');
    }
    return new TextEncoder().encode('development-only-session-secret-change-me');
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Signs a session token and stores it in an httpOnly cookie. */
export async function startSession(user: { id: string; role: Role }): Promise<void> {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Set COOKIE_SECURE=true when serving over HTTPS.
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function endSession(): void {
  cookies().delete(SESSION_COOKIE);
}

/** The signed-in user, loaded fresh from the database so role changes and deletions apply immediately. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    return user;
  } catch {
    return null;
  }
}

/** For API routes: 401 when signed out, 403 when the role is not allowed. */
export async function requireApiUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, 'Sign in to continue');
  if (roles.length > 0 && !roles.includes(user.role)) throw new HttpError(403, 'You do not have access to this');
  return user;
}

/** For pages: redirects to the sign-in page when signed out. */
export async function requirePageUser(next: string, ...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (roles.length > 0 && !roles.includes(user.role)) redirect('/');
  return user;
}

export function canManageCourse(user: SessionUser, instructorId: string): boolean {
  return user.role === 'ADMIN' || user.id === instructorId;
}
