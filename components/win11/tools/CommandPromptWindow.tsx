'use client';

import WindowFrame from '../WindowFrame';

interface SafeAction {
  id: string; tool: string; label: string;
}

interface CommandPromptWindowProps {
  safeActions: SafeAction[];
  onAction: (actionId: string, toolId: string) => void;
  disabled: boolean;
}

export default function CommandPromptWindow({ safeActions, onAction, disabled }: CommandPromptWindowProps) {
  const cmdActions = safeActions.filter(a => a.tool === 'cmd');

  return (
    <WindowFrame id="cmd" name="Command Prompt" icon="💻" defaultWidth={640} defaultHeight={400}>
      <div style={{ padding: 16, background: '#0c0c0c', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: "'Consolas', 'Courier New', monospace", fontSize: 11, color: '#888' }}>
          Microsoft Windows [Version 10.0.19045.3803]
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {cmdActions.map(a => (
            <button
              key={a.id}
              onClick={() => onAction(a.id, 'cmd')}
              disabled={disabled}
              className="px-4 py-2 text-xs rounded font-medium bg-gray-800 hover:bg-gray-700 text-green-400 border border-gray-700 disabled:bg-gray-900 disabled:text-gray-600 font-mono"
            >
              {a.label}
            </button>
          ))}
          {cmdActions.length === 0 && (
            <div style={{ fontFamily: "'Consolas', monospace", fontSize: 12, color: '#666', fontStyle: 'italic' }}>C:\Users\Sarah&gt; _</div>
          )}
        </div>
      </div>
    </WindowFrame>
  );
}
