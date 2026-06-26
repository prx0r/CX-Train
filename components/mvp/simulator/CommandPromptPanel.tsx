'use client';

interface SafeAction { id: string; tool: string; label: string; }

export default function CommandPromptPanel({ actions, onAction, disabled }: {
  actions: SafeAction[];
  onAction: (id: string, tool: string) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ fontSize: 12, color: '#111', fontWeight: 700, textTransform: 'uppercase' }}>Command Prompt</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {actions.map(a => (
          <button key={a.id} onClick={() => onAction(a.id, 'cmd')} disabled={disabled} style={{
            padding: '6px 14px', fontSize: 12, borderRadius: 3, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
            background: '#111', border: '1px solid #111', color: '#f5f5f5', fontFamily: 'monospace',
            opacity: disabled ? 0.5 : 1,
          }}>
            $ {a.label}
          </button>
        ))}
        {actions.length === 0 && <div style={{ color: '#6f6f6f', fontSize: 12, fontStyle: 'italic' }}>No actions available</div>}
      </div>
    </div>
  );
}
