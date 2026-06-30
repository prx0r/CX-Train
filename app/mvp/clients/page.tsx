'use client';

import { useEffect, useState } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';

export default function ClientsPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/callum/dashboard?days=30').then(r => r.json()),
      fetch('/api/actions/client-profiles', { headers: { Authorization: 'Bearer ' + (window as any).CALLUM_KEY || '' } }).then(r => r.json().catch(() => ({}))),
    ]).then(([d, c]) => {
      setDashboard(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <ManagerShell><div className="p-4 text-gray-500">Loading clients...</div></ManagerShell>;

  const c = dashboard?.stats?.clients || {};
  const proposals = c.protocol_proposals || [];

  return (
    <ManagerShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Clients</h1>
      <p style={{ color: '#555', marginBottom: 20, fontSize: 14 }}>
        Client profiles, protocols, and Callum-suggested rule proposals.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Client profile gaps */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>Client Profile Gaps</h2>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            Tickets where no client profile was matched. Consider adding profiles for these.
          </p>
          {(c.gaps || []).length === 0 && <p style={{ color: '#94a3b8', fontSize: 12 }}>No gaps detected.</p>}
          {(c.gaps || []).map((g: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
              <span>{g.client_id || 'Unknown'} <span style={{ color: '#94a3b8' }}>({g.count} queries)</span></span>
            </div>
          ))}
        </div>

        {/* Protocol proposals */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>Client Protocol Proposals</h2>
          {proposals.length === 0 && <p style={{ color: '#94a3b8', fontSize: 12 }}>No proposals yet. Flag answers to suggest client-specific rules.</p>}
          {proposals.map((p: any) => (
            <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#f59e0b' }}>{p.status}</span>
                <span style={{ color: '#333', fontWeight: 600 }}>{p.client_name || 'No client'}</span>
              </div>
              <div style={{ color: '#64748b', marginTop: 2 }}>{p.reason?.slice(0, 100)}</div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{p.created_at?.slice(0, 10)} · {p.requested_by}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick reference */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>Client Protocol Reference</h2>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
          Client-specific rules override global taxonomy when relevant. To add a new protocol, flag an answer where the taxonomy does not match the expected client-specific behaviour.
        </p>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b' }}>Protocol Type</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b' }}>Trigger Keywords</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b' }}>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>new_starter</td>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>contractor, new starter, onboarding</td>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>T1 handles initial access setup; escalate only if manager approval missing</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>leaver</td>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>leaver, offboarding, deprovision</td>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Follow client-specific offboarding checklist; confirm with POC before disabling</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>escalation</td>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>escalation exception, VIP, urgent</td>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Client-specific escalation paths that override global T1/T2 rules</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ManagerShell>
  );
}
