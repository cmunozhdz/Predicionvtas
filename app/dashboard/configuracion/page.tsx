import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ConfigClient } from './_components/config-client';

export const dynamic = 'force-dynamic';

export default async function ConfigPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== 'admin') {
    redirect('/dashboard');
  }

  return <ConfigClient />;
}
