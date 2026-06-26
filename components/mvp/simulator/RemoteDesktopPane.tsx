'use client';

import { useState } from 'react';
import OutlookPanel from './OutlookPanel';
import BrowserPanel from './BrowserPanel';
import CommandPromptPanel from './CommandPromptPanel';

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

const TOOL_TABS = [
  { id: 'outlook', label: 'Outlook', icon: '📧' },
  { id: 'browser', label: 'Browser', icon: '🌐' },
  { id: 'cmd', label: 'Command Prompt', icon: '💻' },
];

export default function RemoteDesktopPane({ actions, visibleState, onAction, disabled }: {
  actions: SafeAction[];
  visibleState: Record<string, unknown>;
  onAction: (id: string, tool: string) => void;
  disabled: boolean;
}) {
  const [activeTab, setActiveTab] = useState('outlook');

  const toolActions = (tool: string) => actions.filter(a => a.tool === tool);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '0 12px', gap: 0, flexShrink: 0,
      }}>
        {TOOL_TABS.map(tab => {
          const count = toolActions(tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: activeTab === tab.id ? '#0f172a' : 'transparent',
                border: 'none', borderBottom: activeTab === tab.id ? '2px solid #60a5fa' : '2px solid transparent',
                color: activeTab === tab.id ? '#e2e8f0' : '#64748b',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {count > 0 && <span style={{ fontSize: 10, color: '#64748b' }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Active tool panel */}
      <div style={{ flex: 1, overflow: 'auto', background: '#0f172a' }}>
        {activeTab === 'outlook' && (
          <OutlookPanel actions={toolActions('outlook')} onAction={onAction} disabled={disabled} state={visibleState} />
        )}
        {activeTab === 'browser' && (
          <BrowserPanel actions={toolActions('browser')} onAction={onAction} disabled={disabled} />
        )}
        {activeTab === 'cmd' && (
          <CommandPromptPanel actions={toolActions('cmd')} onAction={onAction} disabled={disabled} />
        )}
      </div>
    </div>
  );
}
