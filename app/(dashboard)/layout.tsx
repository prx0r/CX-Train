import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createServerClient();
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('clerk_id', userId)
    .single();

  const role = user?.role ?? 'trainee';
  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <Link href="/dashboard" className="text-xl font-semibold text-slate-100">
            Connexion Training Hub
          </Link>
          <nav className="flex items-center gap-6">
            {isAdmin && (
              <>
                <Link href="/dashboard/admin" className="text-slate-400 hover:text-slate-100">
                  Overview
                </Link>
                <Link href="/dashboard/admin/trainees" className="text-slate-400 hover:text-slate-100">
                  Trainees
                </Link>
                <Link href="/dashboard/admin/bots" className="text-slate-400 hover:text-slate-100">
                  Bots
                </Link>
                <Link href="/dashboard/admin/sessions" className="text-slate-400 hover:text-slate-100">
                  Sessions
                </Link>
              </>
            )}
            {!isAdmin && (
              <>
                <Link href="/dashboard/trainee" className="text-slate-400 hover:text-slate-100">
                  My Progress
                </Link>
                <Link href="/dashboard/trainee/history" className="text-slate-400 hover:text-slate-100">
                  History
                </Link>
              </>
            )}
            <UserButton afterSignOutUrl="/" />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
