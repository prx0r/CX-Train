'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MSPDashboard() {
  const [msp, setMsp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/msp/me')
      .then(r => r.json())
      .then(d => { setMsp(d.msp); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!msp) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Welcome to Connexion Training</h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>You're not yet linked to an MSP organisation.</p>
        <p style={{ color: '#94a3b8', marginBottom: 24 }}>Ask your manager for an invite link to get started.</p>
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, maxWidth: 400, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Have an invite token?</div>
          <InviteRedeemer />
        </div>
      </div>
    );
  }

  const role = msp.role;
  const cards: Array<{ title: string; desc: string; href: string; roles: string[] }> = [
    { title: 'Ticket Triage', desc: 'Paste a ticket description and get classification, playbook, and escalation rules.', href: '/msp/triage', roles: ['t1', 't2', 'manager'] },
    { title: 'Taxonomy Copilot', desc: 'Ask classification questions. Answers from source of truth only.', href: '/msp/taxonomy', roles: ['t1', 't2', 'manager'] },
    { title: 'Training Drills', desc: 'Practise call handling with role-specific scenarios.', href: '/msp/training', roles: ['t1', 't2', 'manager'] },
    { title: 'Documentation', desc: 'Browse and write operational notes linked to taxonomy items.', href: '/msp/docs', roles: ['t2', 'manager'] },
    { title: 'Admin', desc: 'Manage technicians, invites, standards, and taxonomy access.', href: '/msp/admin', roles: ['manager'] },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{msp.name}</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>{msp.display_name} · {role.toUpperCase()} technician</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {cards.filter(c => c.roles.includes(role)).map(c => (
          <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function InviteRedeemer() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');

  async function redeem() {
    if (!token.trim()) return;
    setStatus('Redeeming...');
    const res = await fetch('/api/msp/invite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim() }),
    });
    if (res.ok) {
      setStatus('Joined! Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      const d = await res.json();
      setStatus(d.error || 'Failed');
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={token} onChange={e => setToken(e.target.value)} placeholder="Paste invite token"
        style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13 }} />
      <button onClick={redeem} style={{ padding: '6px 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
        Join
      </button>
      {status && <div style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>{status}</div>}
    </div>
  );
}
