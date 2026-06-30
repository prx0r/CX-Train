'use client';

import { useEffect, useState } from 'react';

export default function MSPTraining() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [role, setRole] = useState('t1');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [generated, setGenerated] = useState<any>(null);

  useEffect(() => {
    fetch('/api/msp/me')
      .then(r => r.json())
      .then(d => { setRole(d.msp?.role || 't1'); });
    fetch('/api/msp/scenarios?role=t1')
      .then(r => r.json())
      .then(d => { setScenarios(d.scenarios || []); setLoading(false); });
  }, []);

  async function generateScenario(id: string) {
    setGenerated(null);
    const res = await fetch('/api/taxonomy/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: id }),
    });
    const data = await res.json();
    setGenerated(data.scenario);
    setSelected(scenarios.find(s => s.id === id));
  }

  if (loading) return <div className="text-gray-400">Loading scenarios...</div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Training Drills</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>Role-specific scenarios ({role.toUpperCase()}). Select a taxonomy item and generate a practice call.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{scenarios.length} available scenarios</div>
          {scenarios.slice(0, 30).map(s => (
            <div key={s.id} onClick={() => generateScenario(s.id)}
              style={{ padding: '6px 10px', background: selected?.id === s.id ? '#1e293b' : 'transparent', borderRadius: 4, cursor: 'pointer', borderBottom: '1px solid #1e293b' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Tier: {s.tier}</div>
            </div>
          ))}
        </div>

        <div>
          {generated ? (
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Scenario</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{generated.title}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{generated.description}</div>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Expected Actions</div>
              <ul style={{ margin: '0 0 12px 0', paddingLeft: 16, fontSize: 12, color: '#cbd5e1' }}>
                {generated.expectedActions?.slice(0, 8).map((a: string, i: number) => (
                  <li key={i} style={{ marginBottom: 3 }}>{a}</li>
                ))}
              </ul>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Caller Phrasing</div>
              <div style={{ marginBottom: 12, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {generated.callerPhrasing?.slice(0, 5).map((k: string) => (
                  <span key={k} style={{ padding: '2px 6px', background: '#0f172a', borderRadius: 3, fontSize: 11, color: '#94a3b8' }}>{k}</span>
                ))}
              </div>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Tier</div>
              <div style={{ marginBottom: 8, color: generated.tier === 'T1' ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{generated.tier}</div>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Evidence Required</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#94a3b8' }}>
                {generated.evidenceRequired?.map((e: string) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ color: '#64748b', padding: 16, textAlign: 'center' }}>Select a scenario to generate practice materials</div>
          )}
        </div>
      </div>
    </div>
  );
}
