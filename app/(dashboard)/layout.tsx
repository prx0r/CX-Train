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
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/dashboard" className="flex items-center">
            <img
              src="/connexion-logo.png"
              alt="Connexion"
              className="h-7 w-auto object-contain"
            />
          </Link>
          <nav className="flex items-center gap-8">
            {isAdmin && (
              <>
                <Link href="/dashboard/admin" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  Home
                </Link>
                <Link href="/dashboard/admin/trainees" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  Trainees
                </Link>
                <Link href="/dashboard/admin/bots" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  Bots
                </Link>
                <Link href="/dashboard/admin/sessions" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  Sessions
                </Link>
                <Link href="/dashboard/how-it-works" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  How it works
                </Link>
              </>
            )}
            {!isAdmin && (
              <>
                <Link href="/dashboard/trainee" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  My Progress
                </Link>
                <Link href="/dashboard/trainee/history" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  History
                </Link>
                <Link href="/dashboard/how-it-works" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  How it works
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
