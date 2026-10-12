'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { money } from '@/lib/format';

interface Props {
  courseId: string;
  signedIn: boolean;
  enrolled: boolean;
  canManage: boolean;
  price: number;
  finalPrice: number;
}

export default function EnrollPanel({ courseId, signedIn, enrolled, canManage, price, finalPrice }: Props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();

  if (enrolled || canManage) {
    return (
      <div className="card">
        <Link className="button" href={`/learn/${courseId}`}>
          {canManage && !enrolled ? 'Preview course' : 'Continue learning'}
        </Link>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="card">
        <p className="price">
          {finalPrice < price && <s>{money(price)}</s>} {money(finalPrice)}
        </p>
        <Link className="button" href={`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`}>
          Sign in to enroll
        </Link>
      </div>
    );
  }

  async function enroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/courses/${courseId}/enroll`, {
        body:
          finalPrice > 0
            ? { cardNumber: String(form.get('cardNumber')), expMonth: Number(form.get('expMonth')), expYear: Number(form.get('expYear')) }
            : undefined,
        method: 'POST',
      });
      router.push(`/learn/${courseId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={enroll}>
      <p className="price">
        {finalPrice < price && <s>{money(price)}</s>} {money(finalPrice)}
      </p>

      {finalPrice > 0 && (
        <>
          <label htmlFor="cardNumber">Card number</label>
          <input id="cardNumber" name="cardNumber" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" required />
          <div className="row">
            <div>
              <label htmlFor="expMonth">Month</label>
              <input id="expMonth" name="expMonth" type="number" min={1} max={12} defaultValue={12} required />
            </div>
            <div>
              <label htmlFor="expYear">Year</label>
              <input id="expYear" name="expYear" type="number" min={year} defaultValue={year + 3} required />
            </div>
          </div>
          <p className="muted small">
            Demo payments only: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined, 4000 0000 0000 9995 has insufficient funds. No real
            charge is made.
          </p>
        </>
      )}

      {error && <div className="alert error">{error}</div>}
      <button type="submit" disabled={busy}>
        {busy ? 'Please wait…' : finalPrice > 0 ? `Pay ${money(finalPrice)} and enroll` : 'Enroll for free'}
      </button>
    </form>
  );
}
