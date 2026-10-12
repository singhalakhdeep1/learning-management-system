import { getSessionUser } from '@/lib/auth';
import { json, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await getSessionUser();
  return json({ user });
});
