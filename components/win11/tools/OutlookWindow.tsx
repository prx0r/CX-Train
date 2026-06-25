'use client';

import { useWindowManager } from '@/lib/win11/windowState';
import WindowFrame from '../WindowFrame';

interface SafeAction {
  id: string; tool: string; label: string;
}

interface OutlookWindowProps {
  safeActions: SafeAction[];
  visibleState: Record<string, unknown>;
  onAction: (actionId: string, toolId: string) => void;
  disabled: boolean;
}

export default function OutlookWindow({ safeActions, visibleState, onAction, disabled }: OutlookWindowProps) {
  const outlookActions = safeActions.filter(a => a.tool === 'outlook');

  return (
    <WindowFrame id="outlook" name="Microsoft Outlook" icon="📧" defaultWidth={680} defaultHeight={480}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Outlook Actions</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {outlookActions.map(a => (
            <button
              key={a.id}
              onClick={() => onAction(a.id, 'outlook')}
              disabled={disabled}
              className={`px-4 py-2 text-xs rounded font-medium ${
                a.id.includes('reinstall') || a.id.includes('delete')
                  ? 'bg-red-800 hover:bg-red-700 text-red-100 border border-red-700'
                  : 'bg-blue-700 hover:bg-blue-600 text-white border border-blue-600'
              } disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-600`}
            >
              {a.label}
            </button>
          ))}
          {outlookActions.length === 0 && (
            <div style={{ color: '#666', fontSize: 12, fontStyle: 'italic' }}>No actions available yet</div>
          )}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, flex: 1 }}>
          <div style={{ fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 8 }}>System Status</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {Object.entries(visibleState).filter(([k]) => ['outlook_open','outlook_mode','outbox_count','outlook_status'].includes(k)).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 6, fontSize: 12 }}>
                <span style={{ color: '#888', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</span>
                <span style={{
                  fontFamily: 'monospace',
                  color: v === true || v === 'Online' ? '#4ade80' : v === false || v === 'Offline' || v === 'Working Offline' ? '#fbbf24' : '#ccc'
                }}>
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}
