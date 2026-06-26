'use client';

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

export default function OutlookPanel({ actions, onAction, disabled, state }: {
  actions: SafeAction[];
  onAction: (id: string, tool: string) => void;
  disabled: boolean;
  state: Record<string, unknown>;
}) {
  const outlook = ((state.safe_state as any)?.outlook || (state as any).outlook || {}) as {
    workOffline?: boolean;
    outboxCount?: number;
    sentTestEmail?: boolean;
  };
  const remote = ((state.safe_state as any)?.remote || (state as any).remote || {}) as { currentApp?: string };
  const workOffline = outlook.workOffline !== false;
  const outboxCount = typeof outlook.outboxCount === 'number' ? outlook.outboxCount : 3;
  const sentTestEmail = outlook.sentTestEmail === true;
  const currentApp = remote.currentApp || 'outlook';
  const hasAction = (id: string) => actions.some(a => a.id === id);
  const run = (id: string) => {
    if (!disabled && hasAction(id)) onAction(id, 'outlook');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', color: '#111' }}>
      {/* Ribbon */}
      <div style={{ height: 82, borderBottom: '1px solid #cfcfcf', background: '#f8f8f8', flexShrink: 0 }}>
        <div style={{ display: 'flex', height: 28, alignItems: 'center', gap: 14, padding: '0 12px', borderBottom: '1px solid #e0e0e0', fontSize: 12 }}>
          <strong>File</strong><span>Home</span><span>Send / Receive</span><span>Folder</span><span>View</span>
        </div>
        <div style={{ display: 'flex', height: 54, alignItems: 'center', gap: 8, padding: '6px 10px' }}>
          <RibbonButton label="Send/Receive All Folders" disabled={workOffline} onClick={() => run('send_receive')} />
          <RibbonButton label="Update Folder" onClick={() => run('check_outbox')} />
          <RibbonToggle label="Work Offline" active={workOffline} onClick={() => run('disable_work_offline')} />
          <RibbonButton label="Send Test Email" disabled={workOffline || !hasAction('send_test_email')} onClick={() => run('send_test_email')} />
        </div>
      </div>

      {/* Mail content */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '190px 1fr', overflow: 'hidden' }}>
        <aside style={{ borderRight: '1px solid #cfcfcf', background: '#f4f4f4', padding: 8, overflow: 'auto' }}>
          <Folder label="Inbox" count={12} />
          <Folder label="Drafts" count={1} />
          <Folder label="Sent Items" count={sentTestEmail ? 1 : 0} />
          <Folder label="Outbox" count={outboxCount} active onClick={() => run('check_outbox')} />
          <Folder label="Deleted Items" count={8} />
        </aside>

        <main style={{ minWidth: 0, display: 'grid', gridTemplateRows: '1fr 150px', overflow: 'hidden' }}>
          <div style={{ overflow: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 150px 120px', padding: '7px 10px', borderBottom: '1px solid #cfcfcf', background: '#efefef', fontSize: 11, fontWeight: 700, color: '#525252', textTransform: 'uppercase' }}>
              <span />
              <span>Subject</span>
              <span>To</span>
              <span>Status</span>
            </div>
            {outboxCount > 0 ? (
              Array.from({ length: outboxCount }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => run('check_outlook_status')}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '26px 1fr 150px 120px',
                    padding: '9px 10px',
                    border: 'none',
                    borderBottom: '1px solid #e5e5e5',
                    background: index === 0 ? '#eef6ff' : '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#111',
                  }}
                >
                  <span>✉</span>
                  <span>{index === 0 ? 'Invoice batch for approval' : index === 1 ? 'Statement copies' : 'Supplier payment remittance'}</span>
                  <span>{index === 0 ? 'external.client@' : 'accounts@'}</span>
                  <span style={{ color: '#842029', fontWeight: 700 }}>Not sent</span>
                </button>
              ))
            ) : (
              <div style={{ padding: 24, color: '#0f5132', fontSize: 13, fontWeight: 700 }}>Outbox is empty. All messages sent.</div>
            )}
          </div>
          <section style={{ borderTop: '1px solid #cfcfcf', padding: 12, background: '#fff' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              {sentTestEmail ? 'Test email sent — customer confirmed receipt' : 'Selected item'}
            </div>
            <div style={{ fontSize: 12, color: '#525252', lineHeight: 1.5 }}>
              {sentTestEmail
                ? 'Resolution verified. The customer received the test email and the Outbox has been cleared.'
                : outboxCount > 0
                  ? 'Messages are waiting in the Outbox. Check the connection status and disable Work Offline to send.'
                  : workOffline
                    ? 'Outlook is working offline. Disable Work Offline in the Send/Receive tab to reconnect.'
                    : 'Outlook is connected. All messages sent successfully.'}
            </div>
            {!sentTestEmail && (
              <button onClick={() => run('check_outlook_status')} style={{ marginTop: 10, padding: '7px 12px', border: '1px solid #9f9f9f', background: '#fff', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Inspect Connection Status
              </button>
            )}
          </section>
        </main>
      </div>

      {/* Status bar - always visible */}
      <div style={{
        height: 28, border: 'none', borderTop: '1px solid #cfcfcf',
        background: workOffline ? '#fff4f2' : '#e8f3ec',
        color: workOffline ? '#842029' : '#0f5132',
        fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 16, flexShrink: 0,
      }}>
        <span>{workOffline ? 'Working Offline' : 'Connected to Microsoft Exchange'}</span>
        <span style={{ opacity: 0.7 }}>·</span>
        <span>{outboxCount} item{outboxCount === 1 ? '' : 's'} in Outbox</span>
        {sentTestEmail && (
          <>
            <span style={{ opacity: 0.7 }}>·</span>
            <span style={{ color: '#0f5132' }}>Test email sent ✓</span>
          </>
        )}
      </div>
    </div>
  );
}

function RibbonButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: 38, padding: '0 10px', border: '1px solid #b8b8b8', background: disabled ? '#efefef' : '#fff',
      borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1, color: disabled ? '#6f6f6f' : '#111',
    }}>
      {label}
    </button>
  );
}

function RibbonToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      height: 38, padding: '0 10px',
      border: `2px solid ${active ? '#842029' : '#b8b8b8'}`,
      background: active ? '#fff4f2' : '#fff',
      borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      color: active ? '#842029' : '#111',
    }}>
      {label}
    </button>
  );
}

function Folder({ label, count, active, onClick }: { label: string; count: number; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 8px', border: 'none', background: active ? '#dfefff' : 'transparent',
      color: '#111', fontSize: 12, fontWeight: active ? 700 : 500,
      textAlign: 'left', cursor: onClick ? 'pointer' : 'default', borderRadius: 2,
    }}>
      <span>{label}</span>
      {count > 0 && <span style={{ color: active ? '#004b8d' : '#6f6f6f', fontWeight: 700 }}>{count}</span>}
    </button>
  );
}
