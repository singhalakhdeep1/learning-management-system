import { prisma } from '@/lib/db';
import { HttpError, json, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: { code: string } };

/** Public verification: anyone with a certificate code can confirm it is genuine. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const certificate = await prisma.certificate.findUnique({ where: { code: params.code.toUpperCase() } });
  if (!certificate) throw new HttpError(404, 'No certificate with that code');

  return json({
    valid: true,
    code: certificate.code,
    studentName: certificate.studentName,
    courseTitle: certificate.courseTitle,
    issuedAt: certificate.issuedAt,
  });
});
