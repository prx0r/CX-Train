'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      setMessage('Check your email to confirm your account, then sign in.');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-xl font-semibold text-center text-slate-100">Sign up</h1>
      <form onSubmit={handleSignUp} className="space-y-4">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 bg-connexion-black-soft border border-connexion-grey-muted rounded-lg text-slate-100 placeholder-connexion-grey-muted focus:border-connexion-accent focus:outline-none"
        />
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
          required
          minLength={6}
          className="w-full px-4 py-2 bg-connexion-black-soft border border-connexion-grey-muted rounded-lg text-slate-100 placeholder-connexion-grey-muted focus:border-connexion-accent focus:outline-none"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && <p className="text-green-400 text-sm">{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-connexion-accent hover:bg-connexion-accent-hover text-connexion-black rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
      <p className="text-center text-connexion-grey-muted text-sm">
        Already have an account? <Link href="/sign-in" className="text-connexion-accent hover:text-connexion-accent-hover">Sign in</Link>
      </p>
    </div>
  );
}
