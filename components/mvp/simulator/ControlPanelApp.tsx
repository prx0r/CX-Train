'use client';

import { useState } from 'react';

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

type CategoryId = 'home' | 'programs' | 'mail' | 'network' | 'system';

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'home', label: 'Control Panel Home' },
  { id: 'programs', label: 'Programs' },
  { id: 'mail', label: 'Mail' },
  { id: 'network', label: 'Network and Internet' },
  { id: 'system', label: 'System' },
];

export default function ControlPanelApp({ actions, onAction, onRecordInteraction }: {
  actions: SafeAction[];
  onAction: (id: string, tool: string) => void;
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}) {
  const [selected, setSelected] = useState<CategoryId>('programs');

  const reinstall = actions.find(a => a.id === 'reinstall_outlook');
  const deleteProfile = actions.find(a => a.id === 'delete_mail_profile');

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '220px 1fr', background: '#fff', color: '#111' }}>
      <aside style={{ background: '#f4f4f4', borderRight: '1px solid #cfcfcf', padding: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#004b8d', marginBottom: 12, paddingLeft: 4 }}>Control Panel</div>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => { setSelected(c.id); onRecordInteraction?.(`cp_${c.id}`, `Control Panel: ${c.label}`); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
              border: 'none', background: selected === c.id ? '#dfefff' : 'transparent',
              color: '#111', fontSize: 12, fontWeight: selected === c.id ? 700 : 500,
              cursor: 'pointer', borderRadius: 2,
            }}
          >
            {c.label}
          </button>
        ))}
      </aside>

      <main style={{ padding: 18, overflow: 'auto' }}>
        {selected === 'home' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Adjust your computer&apos;s settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 600 }}>
              {[{ label: 'System', desc: 'View RAM, processor speed' }, { label: 'Network and Internet', desc: 'View network status' }, { label: 'Programs', desc: 'Uninstall programs' }, { label: 'Mail', desc: 'Microsoft Outlook profiles' }].map(i => (
                <div key={i.label} style={{ padding: 10, border: '1px solid #cfcfcf', borderRadius: 3, fontSize: 11, color: '#525252' }}>
                  <div style={{ fontWeight: 700, color: '#111', marginBottom: 4 }}>{i.label}</div>
                  <div>{i.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {selected === 'programs' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Programs and Features</div>
            <div style={{ fontSize: 12, color: '#525252', marginBottom: 16 }}>Uninstall or change programs on this computer. Some actions can be disruptive and will be recorded.</div>
            <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
              <ActionCard label="Repair Microsoft 365 Apps" description="Starts Office quick repair — non-destructive." disabled />
              {reinstall && (
                <ActionCard label={reinstall.label} description="Removes and reinstalls Outlook entirely. Disruptive — try basic checks first." danger onClick={() => { onAction(reinstall.id, 'control_panel'); onRecordInteraction?.(reinstall.id, reinstall.label); }} />
              )}
            </div>
          </>
        )}

        {selected === 'mail' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Mail (Microsoft Outlook)</div>
            <div style={{ fontSize: 12, color: '#525252', marginBottom: 16 }}>Manage Outlook mail profiles. Deleting a profile removes all cached email data.</div>
            <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
              {deleteProfile && (
                <ActionCard label={deleteProfile.label} description="Deletes all cached Outlook data and requires full profile reconfiguration." danger onClick={() => { onAction(deleteProfile.id, 'control_panel'); onRecordInteraction?.(deleteProfile.id, deleteProfile.label); }} />
              )}
            </div>
          </>
        )}

        {selected === 'network' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Network and Sharing Center</div>
            <div style={{ fontSize: 12, color: '#525252', marginBottom: 16 }}>View basic network information and set up connections.</div>
            <div style={{ padding: 12, border: '1px solid #cfcfcf', borderRadius: 3, maxWidth: 400, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Active Networks</div>
              <div>Network: Connexion Internal</div>
              <div style={{ color: '#525252' }}>Access type: Internet</div>
              <div style={{ color: '#525252', marginTop: 2 }}>Connections: Ethernet0</div>
            </div>
          </>
        )}

        {selected === 'system' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>System</div>
            <div style={{ fontSize: 12, color: '#525252', marginBottom: 16 }}>View information about your computer.</div>
            <div style={{ padding: 12, border: '1px solid #cfcfcf', borderRadius: 3, maxWidth: 400, fontSize: 12, display: 'grid', gap: 6 }}>
              <div><strong>Device name:</strong> ALDER-LT-023</div>
              <div><strong>Processor:</strong> Intel Core i7-1265U</div>
              <div><strong>Installed RAM:</strong> 16.0 GB</div>
              <div><strong>System type:</strong> 64-bit OS, x64 processor</div>
              <div><strong>Edition:</strong> Windows 11 Pro</div>
              <div><strong>Version:</strong> 22H2</div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ActionCard({ label, description, danger, disabled, onClick }: {
  label: string; description: string; danger?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled || !onClick} style={{
      textAlign: 'left', padding: 12, borderRadius: 3, width: '100%',
      border: `1px solid ${danger ? '#d99a91' : '#cfcfcf'}`,
      background: danger ? '#fff4f2' : disabled ? '#efefef' : '#fff',
      cursor: disabled || !onClick ? 'default' : 'pointer',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: danger ? '#842029' : disabled ? '#6f6f6f' : '#111', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#525252' }}>{description}</div>
      {danger && <div style={{ fontSize: 11, color: '#842029', fontWeight: 700, marginTop: 6 }}>⚠ This is a risky action and will be flagged in your assessment.</div>}
    </button>
  );
}
