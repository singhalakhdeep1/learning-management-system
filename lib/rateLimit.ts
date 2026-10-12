// Minimal in-memory sliding-window limiter for sign-in attempts. It is per server process, which is
// fine for a single instance; put a shared store (Redis) behind it before scaling out horizontally.
const attempts = new Map<string, number[]>();

export function tooManyAttempts(key: string, limit = 10, windowMs = 15 * 60 * 1000, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  recent.push(now);
  attempts.set(key, recent);

  // Keep the map from growing without bound.
  if (attempts.size > 5000) {
    for (const [k, times] of attempts) {
      if (times.every((time) => now - time >= windowMs)) attempts.delete(k);
    }
  }

  return recent.length > limit;
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
