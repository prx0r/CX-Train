import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createServerClient();
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('clerk_id', userId)
    .single();

  const role = user?.role ?? 'trainee';

  if (role === 'admin') {
    redirect('/dashboard/admin');
  }
  redirect('/dashboard/trainee');
}
