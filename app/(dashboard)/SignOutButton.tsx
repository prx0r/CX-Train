'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function SignOutButton({ isDemo = false }: { isDemo?: boolean }) {
  const router = useRouter();

  async function handleSignOut() {
    if (isDemo) {
      window.location.href = '/demo/exit';
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-connexion-grey hover:text-connexion-accent text-sm transition-colors"
    >
      {isDemo ? 'Exit demo' : 'Sign out'}
    </button>
  );
}
