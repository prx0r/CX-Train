'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Logo } from '@/components/shared/Logo';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/profile', icon: '≡' },
  { label: 'Practice', href: '/practice', icon: '🎯' },
  { label: 'Attempts', href: '/profile/attempts', icon: '📋' },
  { label: 'Featured', href: '/profile/featured', icon: '★' },
  { label: 'Settings', href: '/profile/settings', icon: '⚙' },
];

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/sign-in');
    }
  }, [session, isPending, router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push('/');
    router.refresh();
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#dcdcdc] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) return null;

  const userName = session.user?.name || 'Candidate';

  return (
    <div className="flex min-h-screen" style={{ background: '#dcdcdc' }}>
      <aside style={{
        width: 220, background: '#111', color: '#dcdcdc',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        minHeight: '100vh', borderRight: '1px solid #000',
      }}>
        <div style={{
          padding: '14px 16px', background: '#000', borderBottom: '1px solid #2f2f2f',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Logo size={22} showLabel />
        </div>
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid #2f2f2f',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: '#2f2f2f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#ccc', fontWeight: 600, flexShrink: 0,
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userName}
          </div>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || (item.href !== '/profile' && pathname.startsWith(item.href));
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  color: active ? '#fff' : '#999', fontSize: 13, textDecoration: 'none',
                  background: active ? '#2f2f2f' : 'transparent',
                  borderLeft: '2px solid', borderLeftColor: active ? '#7dd3fc' : 'transparent',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #2f2f2f' }}>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              width: '100%', padding: '6px 12px', background: 'transparent', border: '1px solid #4a4a4a',
              borderRadius: 2, color: '#999', fontSize: 12, cursor: 'pointer', textAlign: 'left',
            }}
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6" style={{ color: '#111' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
