'use client';

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

export default function OutlookPanel({ actions, onAction, disabled, state }: {
  actions: SafeAction[];
  onAction: (id: string, tool: string) => void;
  disabled: boolean;
  state: Record<string, unknown>;
}) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Outlook Actions</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {actions.map(a => (
          <button key={a.id} onClick={() => onAction(a.id, 'outlook')} disabled={disabled} style={{
            padding: '6px 14px', fontSize: 12, borderRadius: 4, fontWeight: 500, cursor: disabled ? 'default' : 'pointer',
            background: a.redFlag ? '#450a0a' : '#1e3a5f',
            border: `1px solid ${a.redFlag ? '#7f1d1d' : '#334155'}`,
            color: a.redFlag ? '#fca5a5' : '#93c5fd',
            opacity: disabled ? 0.5 : 1,
          }}>
            {a.redFlag ? '⚠ ' : ''}{a.label}
          </button>
        ))}
        {actions.length === 0 && <div style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>No actions available</div>}
      </div>
      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>System Status</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {Object.entries(state).filter(([k]) => ['outlook_open','outlook_mode','outbox_count','outlook_status','workOffline','outboxCount','sentTestEmail'].includes(k)).map(([k, v]) => (
            <div key={k} style={{ fontSize: 12, color: '#94a3b8' }}>
              <span style={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}: </span>
              <span style={{ fontFamily: 'monospace', color: v === true || v === 'Online' ? '#4ade80' : v === false || v === 'Offline' || v === 'Working Offline' ? '#fbbf24' : '#e2e8f0' }}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
