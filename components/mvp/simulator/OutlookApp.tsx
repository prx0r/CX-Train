'use client';

import { useState } from 'react';
import { useContextMenu } from './useContextMenu';
import ContextMenu from './ContextMenu';
import type { MenuItem } from './useContextMenu';

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

type FolderId = 'inbox' | 'drafts' | 'sent' | 'outbox' | 'deleted' | 'calendar' | 'contacts';
type RibbonTabId = 'home' | 'send_receive' | 'folder' | 'view';

const MOCK_EMAILS: Record<string, { subject: string; from: string; time: string; body: string }[]> = {
  inbox: [
    { subject: 'Invoice batch for approval', from: 'external.client@supplier.com', time: '10:15 AM', body: 'Hi Sarah, Please find attached the invoice batch for the quarterly review...' },
    { subject: 'Statement copies — March', from: 'accounts@client.co.uk', time: '9:42 AM', body: 'Could you send over the statement copies for March? We need them for audit...' },
    { subject: 'Supplier payment remittance', from: 'payments@vendor.com', time: '9:05 AM', body: 'Payment remittance notice for order #4421. Please confirm receipt...' },
    { subject: 'Team lunch Friday', from: 'reception@connexiondental.com', time: 'Yesterday', body: 'Reminder: team lunch this Friday at 1pm in the break room...' },
    { subject: 'Monthly report due', from: 'manager@connexiondental.com', time: 'Yesterday', body: 'Friendly reminder that monthly reports are due by EOD Friday...' },
    { subject: 'Software update notification', from: 'it@connexiondental.com', time: 'Mon', body: 'Microsoft 365 updates will be deployed this weekend. Please save all work...' },
    { subject: 'Dental supplies order', from: 'procurement@connexiondental.com', time: 'Mon', body: 'Q3 dental supplies order approved. Expected delivery next Wednesday...' },
    { subject: 'New patient registration', from: 'admin@connexiondental.com', time: 'Last week', body: 'New patient intake forms for the Johnson family have been processed...' },
  ],
  drafts: [
    { subject: 'RE: Insurance claim follow-up', from: '', time: 'Draft', body: 'Draft email regarding insurance claim follow-up...' },
  ],
  sent: [],
  deleted: [],
};

const RIBBON_TABS: { id: RibbonTabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'send_receive', label: 'Send / Receive' },
  { id: 'folder', label: 'Folder' },
  { id: 'view', label: 'View' },
];

const FOLDERS: { id: FolderId; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'drafts', label: 'Drafts', icon: '📝' },
  { id: 'sent', label: 'Sent Items', icon: '📤' },
  { id: 'outbox', label: 'Outbox', icon: '📨' },
  { id: 'deleted', label: 'Deleted Items', icon: '🗑' },
];

export default function OutlookApp({ actions, onAction, state, onRecordInteraction }: {
  actions: SafeAction[];
  onAction: (id: string, tool: string) => void;
  state: Record<string, unknown>;
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}) {
  const outlook = ((state.safe_state as any)?.outlook || (state as any).outlook || {}) as {
    workOffline?: boolean; outboxCount?: number; sentTestEmail?: boolean;
  };
  const workOffline = outlook.workOffline !== false;
  const outboxCount = typeof outlook.outboxCount === 'number' ? outlook.outboxCount : 3;
  const sentTestEmail = outlook.sentTestEmail === true;

  const [selectedFolder, setSelectedFolder] = useState<FolderId>('inbox');
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTabId>('home');
  const [selectedEmail, setSelectedEmail] = useState<number | null>(null);
  const [showReadingPane, setShowReadingPane] = useState(false);
  const { menu, show, hide } = useContextMenu();

  const hasAction = (id: string) => actions.some(a => a.id === id);
  const run = (id: string) => {
    if (hasAction(id)) onAction(id, 'outlook');
    onRecordInteraction?.(id, `Outlook action: ${id}`);
  };

  const folderCount = (id: FolderId): number => {
    if (id === 'inbox') return MOCK_EMAILS.inbox.length;
    if (id === 'drafts') return MOCK_EMAILS.drafts.length;
    if (id === 'sent') return sentTestEmail ? 1 : 0;
    if (id === 'outbox') return outboxCount;
    if (id === 'deleted') return 8;
    return 0;
  };

  const handleFolderClick = (id: FolderId) => {
    setSelectedFolder(id);
    setSelectedEmail(null);
    setShowReadingPane(false);
    onRecordInteraction?.(`folder_${id}`, `Opened ${id} folder`);
  };

  const handleEmailClick = (index: number) => {
    setSelectedEmail(index);
    setShowReadingPane(true);
    const email = getCurrentEmails()[index];
    if (email) onRecordInteraction?.('select_email', `Selected email: ${email.subject}`);
  };

  const handleEmailContext = (e: React.MouseEvent, index: number) => {
    setSelectedEmail(index);
    const items: MenuItem[] = [
      { label: 'Open', action: () => { setShowReadingPane(true); onRecordInteraction?.('right_click_open', 'Right-click: Open email'); } },
      { label: 'Mark as Read', action: () => onRecordInteraction?.('right_click_mark_read', 'Right-click: Mark as read') },
      { label: 'Mark as Unread', action: () => onRecordInteraction?.('right_click_mark_unread', 'Right-click: Mark as unread') },
      { label: '', action: () => {}, separator: true },
      { label: 'Delete', action: () => onRecordInteraction?.('right_click_delete', 'Right-click: Delete email') },
      { label: 'Print', action: () => onRecordInteraction?.('right_click_print', 'Right-click: Print email'), disabled: true },
    ];
    show(e, items);
  };

  const getCurrentEmails = () => {
    if (selectedFolder === 'inbox') return MOCK_EMAILS.inbox;
    if (selectedFolder === 'drafts') return MOCK_EMAILS.drafts;
    if (selectedFolder === 'sent') return MOCK_EMAILS.sent;
    if (selectedFolder === 'outbox') {
      return Array.from({ length: outboxCount }).map((_, i) => ({
        subject: i === 0 ? 'Invoice batch for approval' : i === 1 ? 'Statement copies' : 'Supplier payment remittance',
        from: i === 0 ? 'external.client@supplier.com' : i === 1 ? 'accounts@client.co.uk' : 'payments@vendor.com',
        time: 'Not sent',
        body: 'This message is stuck in the Outbox.',
      }));
    }
    return [];
  };

  const emails = getCurrentEmails();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', color: '#111' }}>
      {/* Ribbon */}
      <div style={{ borderBottom: '1px solid #cfcfcf', background: '#f8f8f8', flexShrink: 0 }}>
        <div style={{ display: 'flex', height: 28, alignItems: 'center', gap: 0, borderBottom: '1px solid #e0e0e0' }}>
          {RIBBON_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveRibbonTab(t.id); onRecordInteraction?.(`ribbon_${t.id}`, `Switched to ${t.label} tab`); }}
              style={{
                height: 28, padding: '0 14px', border: 'none',
                background: activeRibbonTab === t.id ? '#fff' : 'transparent',
                color: activeRibbonTab === t.id ? '#111' : '#525252',
                fontSize: 12, fontWeight: activeRibbonTab === t.id ? 700 : 500,
                cursor: 'pointer', borderRight: '1px solid #e0e0e0',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', height: 54, alignItems: 'center', gap: 8, padding: '6px 10px' }}>
          {activeRibbonTab === 'home' && (
            <>
              <RibbonBtn label="New Email" disabled />
              <RibbonBtn label="Reply" disabled />
              <RibbonBtn label="Forward" disabled />
              <RibbonBtn label="Delete" disabled />
            </>
          )}
          {activeRibbonTab === 'send_receive' && (
            <>
              <RibbonBtn label="Send/Receive All Folders" disabled={workOffline} onClick={() => run('send_receive')} />
              <RibbonBtn label="Update Folder" onClick={() => run('check_outbox')} />
              <RibbonToggle label="Work Offline" active={workOffline} onClick={() => run('disable_work_offline')} />
              <RibbonBtn label="Send Test Email" disabled={workOffline || !hasAction('send_test_email')} onClick={() => run('send_test_email')} />
            </>
          )}
          {activeRibbonTab === 'folder' && (
            <>
              <RibbonBtn label="New Folder" disabled />
              <RibbonBtn label="Rename Folder" disabled />
            </>
          )}
          {activeRibbonTab === 'view' && (
            <>
              <RibbonBtn label="Reading Pane: Right" disabled />
              <RibbonBtn label="Reading Pane: Bottom" disabled />
              <RibbonBtn label="Message Preview" disabled />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '190px 1fr', overflow: 'hidden' }}>
        {/* Folder sidebar */}
        <aside style={{ borderRight: '1px solid #cfcfcf', background: '#f4f4f4', padding: '6px 4px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#6f6f6f', textTransform: 'uppercase', marginBottom: 2 }}>
            sarah@connexiondental.com
          </div>
          {FOLDERS.map(f => (
            <button
              key={f.id}
              onClick={() => handleFolderClick(f.id)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 8px', border: 'none',
                background: selectedFolder === f.id ? '#dfefff' : 'transparent',
                color: selectedFolder === f.id ? '#004b8d' : '#111',
                fontSize: 12, fontWeight: selectedFolder === f.id ? 700 : 500,
                textAlign: 'left', cursor: 'pointer', borderRadius: 2,
              }}
            >
              <span>{f.icon} {f.label}</span>
              {folderCount(f.id) > 0 && (
                <span style={{ color: selectedFolder === f.id ? '#004b8d' : '#6f6f6f', fontWeight: 700, fontSize: 11 }}>
                  {folderCount(f.id)}
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* Email area */}
        <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {showReadingPane ? (
            /* Reading pane */
            <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setShowReadingPane(false); setSelectedEmail(null); }}
                style={{ alignSelf: 'flex-start', padding: '4px 10px', border: '1px solid #b8b8b8', background: '#fff', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#004b8d' }}>
                &larr; Back to list
              </button>
              {selectedEmail !== null && emails[selectedEmail] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>{emails[selectedEmail].subject}</div>
                  <div style={{ fontSize: 12, color: '#525252', display: 'flex', gap: 12 }}>
                    <span><strong>From:</strong> {emails[selectedEmail].from || 'Sarah Thompson'}</span>
                    <span><strong>Time:</strong> {emails[selectedEmail].time}</span>
                  </div>
                  <div style={{ borderTop: '1px solid #cfcfcf', paddingTop: 10, fontSize: 13, color: '#222', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {emails[selectedEmail].body}
                  </div>
                  {selectedFolder === 'outbox' && (
                    <div style={{ marginTop: 10, padding: 10, background: '#fff4f2', border: '1px solid #d99a91', borderRadius: 3, fontSize: 12, color: '#842029', fontWeight: 700 }}>
                      This message is stuck in the Outbox. Check the Send/Receive tab for Work Offline status.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Email list */
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px 100px', padding: '7px 10px', borderBottom: '1px solid #cfcfcf', background: '#efefef', fontSize: 11, fontWeight: 700, color: '#525252', textTransform: 'uppercase' }}>
                <span />
                <span>Subject</span>
                <span>From</span>
                <span>Received</span>
              </div>
              {emails.length > 0 ? emails.map((email, i) => (
                <button
                  key={i}
                  onClick={() => handleEmailClick(i)}
                  onContextMenu={(e) => handleEmailContext(e, i)}
                  style={{
                    width: '100%', display: 'grid', gridTemplateColumns: '40px 1fr 160px 100px',
                    padding: '8px 10px', border: 'none', borderBottom: '1px solid #e5e5e5',
                    background: selectedEmail === i ? '#dfefff' : i === 0 && selectedFolder === 'inbox' ? '#f2f6fb' : '#fff',
                    textAlign: 'left', cursor: 'pointer', fontSize: 12, color: '#111',
                  }}
                >
                  <span style={{ fontSize: 14 }}>✉</span>
                  <span style={{ fontWeight: selectedEmail === i ? 700 : 500 }}>{email.subject}</span>
                  <span style={{ color: '#525252' }}>{email.from}</span>
                  <span style={{
                    color: selectedFolder === 'outbox' ? '#842029' : '#6f6f6f',
                    fontWeight: selectedFolder === 'outbox' ? 700 : 400,
                    fontSize: 11,
                  }}>
                    {email.time}
                  </span>
                </button>
              )) : (
                <div style={{ padding: 24, color: '#0f5132', fontSize: 13, fontWeight: 700 }}>This folder is empty.</div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Status bar */}
      <div style={{
        height: 28, border: 'none', borderTop: '1px solid #cfcfcf',
        background: workOffline ? '#fff4f2' : '#e8f3ec',
        color: workOffline ? '#842029' : '#0f5132', fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', padding: '0 10px', gap: 14, flexShrink: 0,
        cursor: hasAction('check_outlook_status') ? 'pointer' : 'default',
      }}
        onClick={() => { if (hasAction('check_outlook_status')) run('check_outlook_status'); }}
      >
        <span>{workOffline ? 'Working Offline' : 'Connected to Microsoft Exchange'}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>{outboxCount} in Outbox</span>
        {sentTestEmail && <><span style={{ opacity: 0.5 }}>·</span><span>Test email sent ✓</span></>}
        {hasAction('check_outlook_status') && workOffline && (
          <span style={{ marginLeft: 'auto', fontStyle: 'italic', fontWeight: 500 }}>Click to inspect</span>
        )}
      </div>

      <ContextMenu menu={menu} onClose={hide} />
    </div>
  );
}

function RibbonBtn({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled || !onClick} style={{
      height: 38, padding: '0 12px', border: '1px solid #b8b8b8', background: '#fff',
      borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.45 : 1, color: disabled ? '#6f6f6f' : '#111',
    }}>{label}</button>
  );
}

function RibbonToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      height: 38, padding: '0 12px', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: `2px solid ${active ? '#842029' : '#b8b8b8'}`,
      background: active ? '#fff4f2' : '#fff',
      color: active ? '#842029' : '#111',
    }}>{label}</button>
  );
}
