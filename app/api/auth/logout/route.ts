import { endSession } from '@/lib/auth';
import { json, route } from '@/lib/http';

export const POST = route(async () => {
  endSession();
  return json({ ok: true });
});
