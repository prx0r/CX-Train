'use client';

import { useEffect, useState } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';

export default function AssistPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/callum/dashboard?days=7')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <ManagerShell><div className="p-4 text-gray-500">Loading Callum data...</div></ManagerShell>;

  const u = data?.stats?.usage || {};
  const topics = data?.stats?.topics || [];
  const flags = data?.stats?.flags || [];
  const proposals = data?.stats?.proposals || [];
  const training = data?.stats?.training_recommendations || [];

  return (
    <ManagerShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Assist</h1>
      <p style={{ color: '#555', marginBottom: 20, fontSize: 14 }}>
        Callum Action usage, flagged answers, proposals, and training recommendations.
      </p>

      {/* Usage cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card label="Total Actions" value={u.total_actions ?? 0} color="#3b82f6" />
        <Card label="Active Users" value={u.active_users ?? 0} color="#22c55e" />
        <Card label="Open Flags" value={u.open_flags ?? 0} color="#ef4444" />
        <Card label="Open Proposals" value={u.open_proposals ?? 0} color="#f59e0b" />
        <Card label="Low Confidence" value={u.low_confidence ?? 0} color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Top topics */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>Top Topics</h2>
          {topics.length === 0 && <p style={{ color: '#94a3b8', fontSize: 12 }}>No data yet.</p>}
          {topics.map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
              <span>{t.topic || 'Unclassified'}</span>
              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{t.count}</span>
            </div>
          ))}
        </div>

        {/* Open flags */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>Recent Flags</h2>
          {flags.length === 0 && <p style={{ color: '#94a3b8', fontSize: 12 }}>No flags yet.</p>}
          {flags.slice(0, 10).map((f: any) => (
            <div key={f.flag_id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: f.status === 'open' ? '#fee2e2' : '#dcfce7', color: f.status === 'open' ? '#ef4444' : '#22c55e' }}>
                  {f.status}
                </span>
                <span style={{ color: '#64748b' }}>{f.flag_type}</span>
                <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{f.created_at?.slice(0, 10)}</span>
              </div>
              {f.comment && <div style={{ color: '#64748b', marginTop: 2 }}>{f.comment.slice(0, 100)}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Proposals */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>Recent Proposals</h2>
          {proposals.length === 0 && <p style={{ color: '#94a3b8', fontSize: 12 }}>No proposals yet.</p>}
          {proposals.slice(0, 8).map((p: any) => (
            <div key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: p.status === 'proposed' ? '#fef3c7' : '#dcfce7', color: p.status === 'proposed' ? '#f59e0b' : '#22c55e' }}>
                  {p.status}
                </span>
                <span style={{ color: '#333' }}>{p.proposal_type?.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ color: '#64748b', marginTop: 2 }}>{p.reason?.slice(0, 80)}</div>
            </div>
          ))}
        </div>

        {/* Training recommendations */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>Training Recommendations</h2>
          {training.length === 0 && <p style={{ color: '#94a3b8', fontSize: 12 }}>No gaps detected.</p>}
          {training.map((t: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: '#333' }}>{t.title}</div>
              <div style={{ color: '#64748b' }}>{t.reason}</div>
            </div>
          ))}
        </div>
      </div>
    </ManagerShell>
  );
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
