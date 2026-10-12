import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <AuthForm mode="register" />
    </div>
  );
}
