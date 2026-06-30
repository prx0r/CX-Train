'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MSPLayout({ children }: { children: React.ReactNode }) {
  const [msp, setMsp] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/msp/me')
      .then(r => r.json())
      .then(d => { setMsp(d.msp); setUser(d.user); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  const role = msp?.role || 'unknown';
  const roleColor: Record<string, string> = { t1: '#22c55e', t2: '#f59e0b', manager: '#3b82f6' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ borderBottom: '1px solid #1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/msp" style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', textDecoration: 'none' }}>
          {msp ? `${msp.name}` : 'MSP'}
        </Link>
        {msp && (
          <>
            <span style={{ fontSize: 10, padding: '2px 8px', background: roleColor[role] + '22', color: roleColor[role], borderRadius: 8, fontWeight: 600 }}>
              {role.toUpperCase()}
            </span>
            <nav style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
              <Link href="/msp/triage" style={navStyle}>Triage</Link>
              <Link href="/msp/taxonomy" style={navStyle}>Taxonomy</Link>
              <Link href="/msp/training" style={navStyle}>Training</Link>
              {(role === 't2' || role === 'manager') && (
                <Link href="/msp/docs" style={navStyle}>Docs</Link>
              )}
              {role === 'manager' && (
                <Link href="/msp/admin" style={navStyle}>Admin</Link>
              )}
            </nav>
          </>
        )}
        <div style={{ marginLeft: 16, fontSize: 11, color: '#64748b' }}>{user?.name || ''}</div>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

const navStyle: React.CSSProperties = {
  color: '#94a3b8',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 600,
  padding: '4px 8px',
  borderRadius: 4,
};
