'use client';

import { useState } from 'react';

type TabId = 'status' | 'wifi' | 'adapter';

export default function NetworkApp({ onRecordInteraction }: {
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}) {
  const [tab, setTab] = useState<TabId>('status');

  const log = (id: string, label: string) => onRecordInteraction?.(id, label);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', color: '#111' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #cfcfcf', background: '#f4f4f4', flexShrink: 0 }}>
        {([{ id: 'status', label: 'Status' }, { id: 'wifi', label: 'Wi-Fi' }, { id: 'adapter', label: 'Ethernet' }] as const).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); log(`network_${t.id}`, `Network: ${t.label} tab`); }}
            style={{
              padding: '8px 16px', border: 'none', borderBottom: tab === t.id ? '2px solid #111' : '2px solid transparent',
              background: tab === t.id ? '#fff' : 'transparent', fontSize: 12, fontWeight: 700,
              color: tab === t.id ? '#111' : '#525252', cursor: 'pointer',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'status' && (
          <div style={{ maxWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Network Status</div>
            <div style={{ padding: 12, border: '1px solid #8db99b', borderRadius: 3, background: '#e8f3ec', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f5132' }}>You're connected to the Internet</div>
              <div style={{ fontSize: 12, color: '#525252', marginTop: 4 }}>Connected via Ethernet0 — Connexion Internal network.</div>
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ color: '#525252' }}>IPv4 Address</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>10.0.50.23</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ color: '#525252' }}>Default Gateway</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>10.0.50.1</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ color: '#525252' }}>DNS Servers</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>8.8.8.8, 8.8.4.4</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ color: '#525252' }}>DHCP</span>
                <span style={{ fontWeight: 700, color: '#0f5132' }}>Enabled</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'wifi' && (
          <div style={{ maxWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Wi-Fi</div>
            <div style={{ padding: 12, border: '1px solid #cfcfcf', borderRadius: 3, background: '#f8f8f8', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Wi-Fi</span>
                <span style={{ padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 700, background: '#6f6f6f', color: '#fff' }}>Off</span>
              </div>
              <div style={{ fontSize: 12, color: '#525252', marginTop: 6 }}>Wi-Fi is turned off. The device is using wired Ethernet instead.</div>
            </div>
            <div style={{ fontSize: 12, color: '#525252' }}>No wireless networks are available while Wi-Fi is turned off.</div>
          </div>
        )}

        {tab === 'adapter' && (
          <div style={{ maxWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Ethernet Adapter</div>
            <div style={{ padding: 10, border: '1px solid #8db99b', borderRadius: 3, background: '#e8f3ec', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f5132' }}>Ethernet0 — Connected</div>
            </div>
            <div style={{ fontSize: 12, color: '#525252', lineHeight: 1.7 }}>
              <div>Adapter: Intel Ethernet Connection I219-LM</div>
              <div>Speed: 1.0 Gbps</div>
              <div>MAC Address: 00-1A-2B-3C-4D-5E</div>
              <div>IPv4: 10.0.50.23 / 255.255.255.0</div>
              <div>Gateway: 10.0.50.1</div>
              <div>DHCP lease expires: 2026-06-28 08:00</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
