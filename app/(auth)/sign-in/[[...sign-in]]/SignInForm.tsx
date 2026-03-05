'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}${redirectTo}` } });
      if (error) throw error;
      setMessage('Check your email for the sign-in link.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-xl font-semibold text-center text-slate-100">Sign in</h1>
      <form onSubmit={handleSignIn} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 bg-connexion-black-soft border border-connexion-grey-muted rounded-lg text-slate-100 placeholder-connexion-grey-muted focus:border-connexion-accent focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 bg-connexion-black-soft border border-connexion-grey-muted rounded-lg text-slate-100 placeholder-connexion-grey-muted focus:border-connexion-accent focus:outline-none"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && <p className="text-green-400 text-sm">{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-connexion-accent hover:bg-connexion-accent-hover text-connexion-black rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <form onSubmit={handleMagicLink} className="pt-4 border-t border-connexion-grey-muted">
        <p className="text-connexion-grey text-sm mb-2">No password? Get a sign-in link:</p>
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full py-2 border border-connexion-grey-muted hover:border-connexion-accent text-connexion-grey hover:text-connexion-accent rounded-lg text-sm transition-colors"
        >
          Send magic link
        </button>
      </form>
      <p className="text-center text-connexion-grey-muted text-sm">
        No account? <Link href="/sign-up" className="text-connexion-accent hover:text-connexion-accent-hover">Sign up</Link>
      </p>
    </div>
  );
}
