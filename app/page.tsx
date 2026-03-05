import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-connexion-black">
      <img
        src="/connexion-logo.png"
        alt="Connexion"
        className="h-16 w-auto object-contain mb-6"
      />
      <h1 className="text-2xl font-semibold text-slate-100 mb-2">Training Hub</h1>
      <p className="text-connexion-grey mb-8">Internal MSP technician training platform</p>
      <div className="flex gap-4">
        <Link
          href="/sign-in"
          className="px-6 py-3 bg-connexion-accent hover:bg-connexion-accent-hover text-connexion-black rounded-lg font-medium transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="px-6 py-3 border border-connexion-grey-muted hover:border-connexion-accent text-connexion-grey hover:text-connexion-accent rounded-lg font-medium transition-colors"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
