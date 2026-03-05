import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const role = user.role ?? 'trainee';

  if (role === 'admin') {
    redirect('/dashboard/admin');
  }
  redirect('/dashboard/trainee');
}
