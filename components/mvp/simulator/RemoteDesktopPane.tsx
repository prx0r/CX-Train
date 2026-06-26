'use client';

import { useState } from 'react';
import type React from 'react';
import OutlookPanel from './OutlookPanel';
import BrowserPanel from './BrowserPanel';
import CommandPromptPanel from './CommandPromptPanel';

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

type TabId = 'desktop' | 'outlook' | 'browser' | 'cmd' | 'control_panel';

const TABS: { id: TabId; label: string }[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'outlook', label: 'Outlook' },
  { id: 'browser', label: 'Edge' },
  { id: 'cmd', label: 'Command' },
  { id: 'control_panel', label: 'Control Panel' },
];

export default function RemoteDesktopPane({ actions, visibleState, onAction, disabled }: {
  actions: SafeAction[];
  visibleState: Record<string, unknown>;
  onAction: (id: string, tool: string) => void;
  disabled: boolean;
}) {
  const safeState = (visibleState.safe_state || visibleState) as Record<string, any>;
  const remote = (safeState.remote || {}) as Record<string, unknown>;
  const initialTab: TabId = typeof remote.currentApp === 'string' && remote.currentApp !== 'none'
    ? remote.currentApp as TabId : 'desktop';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const toolActions = (tool: string) => actions.filter(a => a.tool === tool);

  const openApp = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'outlook') onAction('open_outlook', 'outlook');
    if (tab === 'browser') onAction('open_browser', 'browser');
    if (tab === 'cmd') onAction('run_ipconfig', 'cmd');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0b5ea8' }}>
      {/* Remote bar */}
      <div style={{
        height: 28, background: '#f2f2f2', borderBottom: '1px solid #9f9f9f',
        display: 'flex', alignItems: 'center', padding: '0 8px', gap: 8,
        fontSize: 11, color: '#222', flexShrink: 0,
      }}>
        <strong>ScreenConnect</strong>
        <span>ALDER-LT-023</span>
        <span style={{ marginLeft: 'auto' }}>Connected</span>
      </div>

      {/* Tab bar */}
      <div style={{
        height: 30, background: '#e5e5e5', borderBottom: '1px solid #9f9f9f',
        display: 'flex', alignItems: 'center', padding: '0 4px', gap: 2, flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => t.id === 'desktop' ? setActiveTab('desktop') : openApp(t.id)}
            style={{
              height: 26, padding: '0 12px', border: '1px solid #b8b8b8',
              borderBottom: activeTab === t.id ? '1px solid #fff' : '1px solid #b8b8b8',
              background: activeTab === t.id ? '#fff' : '#d4d4d4',
              color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              borderRadius: '2px 2px 0 0', marginTop: 2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #0b5ea8 0%, #0f77c8 55%, #1b8ad8 100%)' }}>
        {activeTab === 'desktop' && (
          <div style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <DesktopIcon label="Outlook" glyph="O" onOpen={() => openApp('outlook')} />
            <DesktopIcon label="Edge" glyph="E" onOpen={() => openApp('browser')} />
            <DesktopIcon label="Command Prompt" glyph="C:\\>" onOpen={() => openApp('cmd')} wide />
            <DesktopIcon label="Control Panel" glyph="⚙" onOpen={() => setActiveTab('control_panel')} wide />
          </div>
        )}

        {activeTab === 'outlook' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <OutlookPanel actions={toolActions('outlook')} onAction={onAction} disabled={disabled} state={safeState} />
          </div>
        )}
        {activeTab === 'browser' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <BrowserPanel actions={toolActions('browser')} onAction={onAction} disabled={disabled} />
          </div>
        )}
        {activeTab === 'cmd' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
            <CommandPromptPanel actions={toolActions('cmd')} onAction={onAction} disabled={disabled} />
          </div>
        )}
        {activeTab === 'control_panel' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <ControlPanelClone actions={toolActions('control_panel')} onAction={onAction} disabled={disabled} />
          </div>
        )}
      </div>

      {/* Taskbar */}
      <div style={{
        height: 34, background: '#e5e5e5', borderTop: '1px solid #9f9f9f',
        display: 'flex', alignItems: 'center', padding: '0 6px', gap: 4, flexShrink: 0,
      }}>
        <button onClick={() => setActiveTab('desktop')} style={{ height: 26, minWidth: 32, border: '1px solid #b8b8b8', background: '#fff', borderRadius: 2, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>⊞</button>
        <TaskButton active={activeTab === 'outlook'} label="Outlook" onClick={() => openApp('outlook')} />
        <TaskButton active={activeTab === 'browser'} label="Edge" onClick={() => openApp('browser')} />
        <TaskButton active={activeTab === 'cmd'} label="Command" onClick={() => openApp('cmd')} />
        <TaskButton active={activeTab === 'control_panel'} label="Control Panel" onClick={() => setActiveTab('control_panel')} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#333', paddingRight: 4 }}>10:42 AM</span>
      </div>
    </div>
  );
}

function ControlPanelClone({ actions, onAction, disabled }: {
  actions: SafeAction[];
  onAction: (id: string, tool: string) => void;
  disabled: boolean;
}) {
  const reinstall = actions.find(a => a.id === 'reinstall_outlook');
  const deleteProfile = actions.find(a => a.id === 'delete_mail_profile');
  return (
    <div style={{ height: '100%', background: '#fff', display: 'grid', gridTemplateColumns: '220px 1fr', color: '#111' }}>
      <aside style={{ background: '#f4f4f4', borderRight: '1px solid #cfcfcf', padding: 12, fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Control Panel Home</div>
        <div>Programs</div>
        <div style={{ marginTop: 6 }}>Mail</div>
        <div style={{ marginTop: 6 }}>Network and Internet</div>
      </aside>
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Programs and Mail Profiles</div>
        <div style={{ fontSize: 12, color: '#525252', marginBottom: 18 }}>
          These are available system tools. Some actions can be disruptive and are recorded.
        </div>
        <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <SystemToolButton label="Repair Microsoft 365 Apps" description="Starts an Office repair workflow." disabled={disabled} />
          {reinstall && (
            <SystemToolButton label={reinstall.label} description="Removes and reinstalls Outlook components." danger disabled={disabled} onClick={() => onAction(reinstall.id, 'control_panel')} />
          )}
          {deleteProfile && (
            <SystemToolButton label={deleteProfile.label} description="Deletes the current Outlook mail profile." danger disabled={disabled} onClick={() => onAction(deleteProfile.id, 'control_panel')} />
          )}
        </div>
      </main>
    </div>
  );
}

function SystemToolButton({ label, description, danger, disabled, onClick }: {
  label: string;
  description: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled || !onClick} style={{
      textAlign: 'left',
      padding: 12,
      border: `1px solid ${danger ? '#d99a91' : '#cfcfcf'}`,
      background: danger ? '#fff4f2' : '#fff',
      borderRadius: 3,
      cursor: disabled || !onClick ? 'default' : 'pointer',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: danger ? '#842029' : '#111', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#525252' }}>{description}</div>
    </button>
  );
}

function DesktopIcon({ label, glyph, onOpen, wide }: { label: string; glyph: string; onOpen: () => void; wide?: boolean }) {
  return (
    <button onDoubleClick={onOpen} onClick={onOpen} style={{
      width: wide ? 100 : 72,
      border: '1px solid transparent',
      background: 'transparent',
      color: '#fff',
      cursor: 'pointer',
      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      padding: 6,
      textAlign: 'center',
    }}>
      <div style={{ width: 42, height: 42, margin: '0 auto 6px', background: '#fff', color: '#0b5ea8', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>{glyph}</div>
      <div style={{ fontSize: 12, lineHeight: 1.2 }}>{label}</div>
    </button>
  );
}

function TaskButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      height: 26, padding: '0 10px', border: '1px solid #b8b8b8',
      background: active ? '#dfefff' : '#fff',
      color: '#111', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    }}>{label}</button>
  );
}
