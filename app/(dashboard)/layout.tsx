import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { SignOutButton } from './SignOutButton';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const role = user.role ?? 'trainee';
  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-connexion-black">
      <header className="border-b border-connexion-black-soft bg-connexion-black-soft/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-3">
            <img
              src="/connexion-logo.png"
              alt="Connexion"
              className="h-8 w-auto object-contain"
            />
            <span className="text-lg font-medium text-slate-100 hidden sm:inline">
              Training Hub
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            {isAdmin && (
              <>
                <Link href="/dashboard/admin" className="text-connexion-grey hover:text-connexion-accent transition-colors">
                  Overview
                </Link>
                <Link href="/dashboard/admin/trainees" className="text-connexion-grey hover:text-connexion-accent transition-colors">
                  Trainees
                </Link>
                <Link href="/dashboard/admin/bots" className="text-connexion-grey hover:text-connexion-accent transition-colors">
                  Bots
                </Link>
                <Link href="/dashboard/admin/sessions" className="text-connexion-grey hover:text-connexion-accent transition-colors">
                  Sessions
                </Link>
              </>
            )}
            {!isAdmin && (
              <>
                <Link href="/dashboard/trainee" className="text-connexion-grey hover:text-connexion-accent transition-colors">
                  My Progress
                </Link>
                <Link href="/dashboard/trainee/history" className="text-connexion-grey hover:text-connexion-accent transition-colors">
                  History
                </Link>
              </>
            )}
            <SignOutButton isDemo={user.id === '11111111-1111-1111-1111-111111111111'} />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
