import { notFound } from 'next/navigation';
import PrintButton from '@/components/PrintButton';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Certificate ${params.code.toUpperCase()}` };
}

/** Public page: anyone with the code can see (and so verify) a certificate. */
export default async function CertificatePage({ params }: { params: { code: string } }) {
  const certificate = await prisma.certificate.findUnique({ where: { code: params.code.toUpperCase() } });
  if (!certificate) notFound();

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="certificate">
        <p className="muted">Certificate of completion</p>
        <p>This certifies that</p>
        <div className="name">{certificate.studentName}</div>
        <p>has successfully completed the course</p>
        <div className="course">{certificate.courseTitle}</div>
        <p className="muted small">
          Issued {certificate.issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · Verification code{' '}
          <strong>{certificate.code}</strong>
        </p>
      </div>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <PrintButton />
      </p>
    </div>
  );
}
