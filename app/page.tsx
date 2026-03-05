import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-slate-100 mb-2">Connexion Training Hub</h1>
      <p className="text-slate-400 mb-8">Internal MSP technician training platform</p>
      <div className="flex gap-4">
        <Link
          href="/sign-in"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="px-6 py-3 border border-slate-600 hover:border-slate-500 rounded-lg font-medium transition"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
