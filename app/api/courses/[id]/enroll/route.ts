import { requireApiUser } from '@/lib/auth';
import { HttpError, json, route } from '@/lib/http';
import { enrollUser } from '@/lib/lms';
import { checkoutSchema } from '@/lib/validation';

type Ctx = { params: { id: string } };

/**
 * Enrolls the signed-in user. Free courses need no body; paid courses need card details
 * ({ cardNumber, expMonth, expYear }). Payment is simulated (see lib/lms.ts for the test cards).
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser();

  let card;
  const raw = await req.text();
  if (raw.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON');
    }
    card = checkoutSchema.parse(body);
  }

  const enrollment = await enrollUser(user, params.id, card);
  return json({ enrollment }, 201);
});
