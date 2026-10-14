import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { LoginClient } from './_components/login-client';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }
  return <LoginClient />;
}
