'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password,
        name,
      });
      if (signUpError) throw signUpError;
      router.push('/profile');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || err?.statusText || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    await authClient.signIn.social({ provider: 'google', callbackURL: '/profile' });
  };

  const handleGitHub = async () => {
    await authClient.signIn.social({ provider: 'github', callbackURL: '/profile' });
  };

  return (
    <div className="min-h-screen bg-connexion-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div style={{ width: 40, height: 40, border: '2px solid #7dd3fc', borderRadius: 8, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
          <h1 className="text-xl font-semibold text-slate-100">Create account</h1>
          <p className="text-sm text-connexion-grey-muted mt-1">start practising support calls</p>
        </div>

        <div className="space-y-3">
          <button onClick={handleGoogle} className="w-full py-2.5 border border-connexion-grey-muted hover:border-connexion-accent text-connexion-grey hover:text-connexion-accent rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign up with Google
          </button>
          <button onClick={handleGitHub} className="w-full py-2.5 border border-connexion-grey-muted hover:border-connexion-accent text-connexion-grey hover:text-connexion-accent rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            Sign up with GitHub
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-connexion-grey-muted" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-connexion-black px-2 text-connexion-grey-muted">or sign up with email</span></div>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <input
            type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required
            className="w-full px-4 py-2 bg-connexion-black-soft border border-connexion-grey-muted rounded-lg text-slate-100 placeholder-connexion-grey-muted focus:border-connexion-accent focus:outline-none text-sm"
          />
          <input
            type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full px-4 py-2 bg-connexion-black-soft border border-connexion-grey-muted rounded-lg text-slate-100 placeholder-connexion-grey-muted focus:border-connexion-accent focus:outline-none text-sm"
          />
          <input
            type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
            className="w-full px-4 py-2 bg-connexion-black-soft border border-connexion-grey-muted rounded-lg text-slate-100 placeholder-connexion-grey-muted focus:border-connexion-accent focus:outline-none text-sm"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading || !name || !email || !password}
            className="w-full py-2.5 bg-connexion-accent hover:bg-connexion-accent-hover text-connexion-black rounded-lg font-medium disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-connexion-grey-muted text-sm">
          Already have an account? <Link href="/sign-in" className="text-connexion-accent hover:text-connexion-accent-hover">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
