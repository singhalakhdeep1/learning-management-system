import { requireApiUser } from '@/lib/auth';
import { json, route } from '@/lib/http';
import { issueCertificate } from '@/lib/lms';

type Ctx = { params: { id: string } };

/** Issues (or returns) the signed-in student's certificate once every lesson is done and every quiz passed. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser();
  const certificate = await issueCertificate(user, params.id);
  return json({ code: certificate.code, issuedAt: certificate.issuedAt }, 201);
});
