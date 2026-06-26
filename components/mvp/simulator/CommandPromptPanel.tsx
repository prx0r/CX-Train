'use client';

interface SafeAction { id: string; tool: string; label: string; }

export default function CommandPromptPanel({ actions, onAction, disabled }: {
  actions: SafeAction[];
  onAction: (id: string, tool: string) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Command Prompt</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {actions.map(a => (
          <button key={a.id} onClick={() => onAction(a.id, 'cmd')} disabled={disabled} style={{
            padding: '6px 14px', fontSize: 12, borderRadius: 4, fontWeight: 500, cursor: disabled ? 'default' : 'pointer',
            background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontFamily: 'monospace',
            opacity: disabled ? 0.5 : 1,
          }}>
            $ {a.label}
          </button>
        ))}
        {actions.length === 0 && <div style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>No actions available</div>}
      </div>
    </div>
  );
}
