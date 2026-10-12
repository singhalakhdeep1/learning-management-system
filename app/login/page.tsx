import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <AuthForm mode="login" next={searchParams.next} />
    </div>
  );
}
