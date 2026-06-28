'use client';

interface CallumActionCardProps {
  action: {
    type: string;
    payload: Record<string, unknown>;
  };
  pendingActionId?: string;
}

export default function CallumActionCard({ action, pendingActionId }: CallumActionCardProps) {
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
        <button disabled style={{ padding: '5px 8px', border: '1px solid #b8b8b8', background: '#eee', color: '#777', borderRadius: 3, fontSize: 12 }}>
          Confirm soon
        </button>
        <button disabled style={{ padding: '5px 8px', border: '1px solid #b8b8b8', background: '#eee', color: '#777', borderRadius: 3, fontSize: 12 }}>
          Edit soon
        </button>
      </div>
    </div>
  );
}
