'use client';

import { useState } from 'react';

interface CallumActionCardProps {
  action: {
    type: string;
    payload: Record<string, unknown>;
  };
  pendingActionId?: string;
}

export default function CallumActionCard({ action, pendingActionId }: CallumActionCardProps) {
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function resolve(kind: 'confirm' | 'reject') {
    if (!pendingActionId || busy) return;
    setBusy(kind);
    setResult(null);
    try {
      const res = await fetch(`/api/mvp/callum/proposals/${pendingActionId}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok && kind === 'confirm') {
        const invite = data.result?.invite_url ? ` Invite: ${data.result.invite_url}` : '';
        setResult(`Training assignment created.${invite}`);
      } else if (data.ok && kind === 'reject') {
        setResult('Proposal rejected.');
      } else {
        setResult(data.message || data.error || 'Proposal update failed.');
      }
    } catch {
      setResult('Proposal update failed.');
    }
    setBusy(null);
  }

  return (
    <div style={{ marginTop: 10, border: '1px solid #c8b66a', background: '#fff8d8', borderRadius: 4, padding: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#4b3b00', marginBottom: 6 }}>
        Proposed action: {action.type}
      </div>
      {pendingActionId && (
        <div style={{ fontSize: 11, color: '#6b5a12', marginBottom: 6 }}>Proposal ID: {pendingActionId}</div>
      )}
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11, color: '#222' }}>
        {JSON.stringify(action.payload, null, 2)}
      </pre>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button
          disabled={!pendingActionId || !!busy || !!result}
          onClick={() => resolve('confirm')}
          style={{ padding: '5px 8px', border: '1px solid #0f5132', background: busy || result ? '#eee' : '#0f5132', color: busy || result ? '#777' : '#fff', borderRadius: 3, fontSize: 12 }}
        >
          {busy === 'confirm' ? 'Confirming...' : 'Confirm'}
        </button>
        <button
          disabled={!pendingActionId || !!busy || !!result}
          onClick={() => resolve('reject')}
          style={{ padding: '5px 8px', border: '1px solid #8a1f1f', background: busy || result ? '#eee' : '#fff', color: busy || result ? '#777' : '#8a1f1f', borderRadius: 3, fontSize: 12 }}
        >
          {busy === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
      </div>
      {result && (
        <div style={{ marginTop: 8, fontSize: 12, color: result.includes('failed') || result.includes('stale') || result.includes('expired') ? '#8a1f1f' : '#0f5132' }}>
          {result}
        </div>
      )}
    </div>
  );
}
