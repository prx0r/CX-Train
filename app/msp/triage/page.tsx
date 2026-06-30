'use client';

import { useState } from 'react';

export default function TriagePage() {
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleTriage() {
    if (!description.trim() || loading) return;
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/msp/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: description.trim() }),
    });
    setResult(await res.json());
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Ticket Triage</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>Paste a ticket description. The system classifies it against the taxonomy and returns the playbook, escalation rules, and evidence to capture.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="User says they can't log in. Error says 'account locked'. Happened after multiple attempts. Single user, can't work."
          style={{ flex: 1, minHeight: 80, padding: 8, background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13, fontFamily: 'monospace' }} />
      </div>
      <button onClick={handleTriage} disabled={loading}
        style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, marginBottom: 16 }}>
        {loading ? 'Classifying...' : 'Classify'}
      </button>

      {result && (
        <div>
          {result.classification && !result.classification.startsWith('Not found') ? (
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Classification</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{result.classification}</div>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Tier</div>
              <div style={{ marginBottom: 12, color: result.tier === 'T1' ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{result.tier}</div>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Playbook</div>
              <pre style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', marginBottom: 12, lineHeight: 1.5 }}>{result.playbook || '—'}</pre>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Escalation</div>
              <pre style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', marginBottom: 12, lineHeight: 1.5 }}>{result.escalation || '—'}</pre>

              {result.scenario && (
                <div style={{ background: '#0f172a', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Expected Actions</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#94a3b8' }}>
                    {result.scenario.expectedActions?.slice(0, 6).map((a: string, i: number) => (
                      <li key={i} style={{ marginBottom: 2 }}>{a}</li>
                    ))}
                  </ul>
                  {result.scenario.evidenceRequired?.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>Evidence to Capture</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#94a3b8' }}>
                        {result.scenario.evidenceRequired.map((e: string, i: number) => (
                          <li key={i} style={{ marginBottom: 2 }}>{e}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <div style={{ fontSize: 10, color: '#64748b', marginTop: 12 }}>
                Source: {result.matches?.[0]?.id || 'taxonomy'}
              </div>
            </div>
          ) : (
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, color: '#94a3b8' }}>
              {result.classification || 'No match found. Try a different description.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
