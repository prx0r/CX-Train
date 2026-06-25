'use client';

import WindowFrame from '../WindowFrame';

interface SafeAction {
  id: string; tool: string; label: string;
}

interface BrowserWindowProps {
  safeActions: SafeAction[];
  onAction: (actionId: string, toolId: string) => void;
  disabled: boolean;
}

export default function BrowserWindow({ safeActions, onAction, disabled }: BrowserWindowProps) {
  const browserActions = safeActions.filter(a => a.tool === 'browser');

  return (
    <WindowFrame id="browser" name="Microsoft Edge" icon="🌐" defaultWidth={720} defaultHeight={520}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Browser Actions</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {browserActions.map(a => (
            <button
              key={a.id}
              onClick={() => onAction(a.id, 'browser')}
              disabled={disabled}
              className="px-4 py-2 text-xs rounded font-medium bg-teal-700 hover:bg-teal-600 text-white border border-teal-600 disabled:bg-gray-700 disabled:text-gray-500"
            >
              {a.label}
            </button>
          ))}
          {browserActions.length === 0 && (
            <div style={{ color: '#666', fontSize: 12, fontStyle: 'italic' }}>Open browser to see available actions</div>
          )}
        </div>
      </div>
    </WindowFrame>
  );
}
