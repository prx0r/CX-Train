'use client';

import { useState } from 'react';

interface Tab { id: string; title: string; url: string; }

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

export default function BrowserApp({ actions, onAction, onRecordInteraction }: {
  actions: SafeAction[];
  onAction: (id: string, tool: string) => void;
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}) {
  const hasAction = (id: string) => actions.some(a => a.id === id);

  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'tab-1', title: 'New Tab', url: 'about:blank' },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [addressInput, setAddressInput] = useState('about:blank');

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const addTab = (url: string, title: string) => {
    if (hasAction('check_webmail') && url.includes('webmail')) {
      onAction('check_webmail', 'browser');
    }
    const newTab: Tab = { id: `tab-${Date.now()}`, title, url };
    setTabs(p => [...p, newTab]);
    setActiveTabId(newTab.id);
    setAddressInput(url);
    onRecordInteraction?.('browser_navigate', `Navigated to ${title}`);
  };

  const handleAddressEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const url = addressInput.trim();
      if (url) addTab(url, url);
    }
  };

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) return;
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      const idx = tabs.findIndex(t => t.id === tabId);
      setActiveTabId(newTabs[Math.min(idx, newTabs.length - 1)].id);
    }
    onRecordInteraction?.('browser_close_tab', 'Closed tab');
  };

  const renderPage = () => {
    if (activeTab.url.includes('webmail') || activeTab.url.includes('outlook')) {
      return <OwaPage onAction={onAction} hasAction={hasAction} />;
    }
    if (activeTab.url === 'about:blank') {
      return <BlankPage addTab={addTab} hasAction={hasAction} />;
    }
    return <DefaultPage url={activeTab.url} />;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', color: '#111' }}>
      {/* Tab bar + address */}
      <div style={{ borderBottom: '1px solid #cfcfcf', background: '#f8f8f8', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, padding: '4px 6px 0' }}>
          {tabs.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center',
              padding: '5px 10px', border: '1px solid #cfcfcf',
              borderBottom: activeTabId === t.id ? '1px solid #fff' : '1px solid #cfcfcf',
              background: activeTabId === t.id ? '#fff' : '#e5e5e5',
              borderRadius: '4px 4px 0 0', marginRight: 1, cursor: 'pointer', fontSize: 12,
              color: activeTabId === t.id ? '#111' : '#525252', fontWeight: 500,
            }}>
              <span onClick={() => { setActiveTabId(t.id); setAddressInput(t.url); }}>{t.title}</span>
              {tabs.length > 1 && (
                <button onClick={() => closeTab(t.id)} style={{
                  marginLeft: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#6f6f6f', padding: 0, lineHeight: 1,
                }}>×</button>
              )}
            </div>
          ))}
          <button onClick={() => addTab('about:blank', 'New Tab')} style={{
            padding: '5px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#525252',
          }}>+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#fff' }}>
          <span style={{ fontSize: 14, color: '#6f6f6f' }}>🔒</span>
          <input
            value={addressInput}
            onChange={e => setAddressInput(e.target.value)}
            onKeyDown={handleAddressEnter}
            style={{ flex: 1, padding: '4px 8px', border: '1px solid #cfcfcf', borderRadius: 3, fontSize: 12, color: '#111', background: '#f8f8f8' }}
            placeholder="Search or enter address"
          />
        </div>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderPage()}
      </div>

      {/* Quick links bar */}
      <div style={{ height: 32, borderTop: '1px solid #cfcfcf', background: '#f4f4f4', display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px' }}>
        {hasAction('check_webmail') && (
          <button onClick={() => addTab('https://outlook.office.com/webmail', 'Outlook Web App')} style={{
            padding: '4px 10px', border: '1px solid #b8b8b8', background: '#fff', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#111',
          }}>
            Check Outlook Web App
          </button>
        )}
      </div>
    </div>
  );
}

function OwaPage({ onAction, hasAction }: { onAction: (id: string, tool: string) => void; hasAction: (id: string) => boolean }) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#004b8d' }}>Outlook Web App</div>
      <div style={{ fontSize: 12, color: '#525252', marginBottom: 16 }}>Webmail is loading successfully. You can compose and send email from here.</div>
      <div style={{ background: '#e8f3ec', border: '1px solid #8db99b', borderRadius: 3, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f5132' }}>✓ Webmail is working</div>
        <div style={{ fontSize: 12, color: '#525252', marginTop: 4 }}>
          Email can be sent via webmail. The issue is isolated to the Outlook desktop client.
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {['Inbox (2)', 'Sent Items', 'Drafts'].map(folder => (
          <div key={folder} style={{ padding: '8px 12px', border: '1px solid #cfcfcf', borderRadius: 3, fontSize: 13, color: '#111', display: 'flex', justifyContent: 'space-between' }}>
            <span>{folder}</span>
            <span style={{ color: '#6f6f6f' }}>{folder === 'Inbox (2)' ? '2' : '0'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlankPage({ addTab, hasAction }: { addTab: (url: string, title: string) => void; hasAction: (id: string) => boolean }) {
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🌐</div>
      <div style={{ fontSize: 14, color: '#6f6f6f', marginBottom: 20 }}>Type an address or choose a quick link below</div>
      <div style={{ display: 'grid', gap: 8, minWidth: 300 }}>
        {hasAction('check_webmail') && (
          <button onClick={() => addTab('https://outlook.office.com/webmail', 'Outlook Web App')} style={{
            padding: '10px 16px', border: '1px solid #b8b8b8', background: '#fff', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#004b8d', textAlign: 'left',
          }}>
            📧 Outlook Web App
          </button>
        )}
        <button onClick={() => addTab('https://portal.office.com', 'Microsoft 365 Portal')} style={{
          padding: '10px 16px', border: '1px solid #b8b8b8', background: '#fff', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#004b8d', textAlign: 'left',
        }}>
          🔲 Microsoft 365 Portal
        </button>
      </div>
    </div>
  );
}

function DefaultPage({ url }: { url: string }) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#004b8d' }}>{url}</div>
      <div style={{ fontSize: 12, color: '#525252' }}>This page is not fully simulated. Navigate to Outlook Web App for the training scenario.</div>
    </div>
  );
}
