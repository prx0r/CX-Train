import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <header className="border-b border-zinc-800/80 px-4 py-4">
        <Link href="/" className="inline-block">
          <img src="/connexion-logo.png" alt="Connexion" className="h-6 w-auto" />
        </Link>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold text-white tracking-tight text-center">
          Training Hub
        </h1>
        <p className="text-zinc-500 text-center mt-2 max-w-md">
          Internal MSP technician training — call simulation, qualifications (A+, tutors), escalation, ticket simulation
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/demo"
            className="px-8 py-3.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-medium transition-colors"
          >
            View demo
          </Link>
          <p className="text-zinc-600 text-sm">No login required</p>
          <div className="flex gap-3">
            <Link
              href="/sign-in"
              className="px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Sign in
            </Link>
            <span className="text-zinc-600">·</span>
            <Link
              href="/sign-up"
              className="px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
