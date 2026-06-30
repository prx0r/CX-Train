'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function AcceptInvitePage() {
  const params = useParams();
  const token = params.token as string;
  const [orgName, setOrgName] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/msp/invite?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setStatus('error'); return; }
        setOrgName(d.org_name);
        setRole(d.role);
        setStatus('ready');
      })
      .catch(() => { setError('Failed to load invite'); setStatus('error'); });
  }, [token]);

  async function accept() {
    setStatus('accepting');
    const res = await fetch('/api/msp/invite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      setStatus('done');
    } else {
      const d = await res.json();
      setError(d.error || 'Failed to accept invite');
      setStatus('error');
    }
  }

  if (status === 'checking') return <div className="p-8 text-gray-400">Checking invite...</div>;
  if (status === 'error') return <div className="p-8 text-red-400">{error}</div>;

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', textAlign: 'center' }}>
      {status === 'ready' && (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Join {orgName}</h1>
          <p style={{ color: '#64748b', marginBottom: 8 }}>You've been invited as a <strong style={{ color: '#e2e8f0' }}>{role.toUpperCase()}</strong> technician.</p>
          <p style={{ color: '#64748b', marginBottom: 24 }}>Sign in or create an account to accept.</p>
          <button onClick={accept}
            style={{ padding: '10px 24px', background: '#3b82f6', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            Sign In & Accept
          </button>
        </>
      )}
      {status === 'accepting' && <div className="p-8 text-gray-400">Accepting...</div>}
      {status === 'done' && (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#22c55e' }}>Joined {orgName}!</h1>
          <p style={{ color: '#64748b', marginBottom: 24 }}>You're now a {role.toUpperCase()} technician.</p>
          <Link href="/msp" style={{ padding: '10px 24px', background: '#3b82f6', borderRadius: 6, color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
            Go to Dashboard
          </Link>
        </>
      )}
    </div>
  );
}
