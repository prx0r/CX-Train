'use client';

import { useState } from 'react';

export default function VpnApp({ onRecordInteraction }: {
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}) {
  const [connected, setConnected] = useState(false);

  const toggle = () => {
    setConnected(p => !p);
    onRecordInteraction?.('vpn_toggle', connected ? 'Disconnected VPN' : 'Connected VPN');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', color: '#111' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #cfcfcf', background: '#f4f4f4' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>VPN — Settings</div>
        <div style={{ fontSize: 11, color: '#525252', marginTop: 2 }}>Manage virtual private network connections</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, maxWidth: 500 }}>
        <div style={{
          padding: 14, border: `2px solid ${connected ? '#8db99b' : '#cfcfcf'}`,
          borderRadius: 4, marginBottom: 12,
          background: connected ? '#e8f3ec' : '#f8f8f8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Connexion VPN</div>
              <div style={{ fontSize: 11, color: '#525252' }}>connexionvpn.corp.com</div>
            </div>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: connected ? '#22c55e' : '#808080',
            }} />
          </div>
          <div style={{ fontSize: 12, color: connected ? '#0f5132' : '#525252', fontWeight: 600, marginBottom: 10 }}>
            {connected ? 'Connected' : 'Not connected'}
          </div>
          <button onClick={toggle} style={{
            padding: '7px 16px', borderRadius: 3, border: '1px solid #111',
            background: connected ? '#fff' : '#111', color: connected ? '#111' : '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>

        <div style={{ padding: 10, border: '1px solid #b8b8b8', borderRadius: 3, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>VPN type</div>
          <div style={{ fontSize: 12, color: '#525252' }}>L2TP/IPsec with pre-shared key</div>
          <div style={{ fontSize: 12, color: '#525252', marginTop: 2 }}>Server: connexionvpn.corp.com</div>
        </div>

        <div style={{ fontSize: 11, color: '#6f6f6f', marginTop: 16 }}>
          In a real troubleshooting scenario, a tech would check VPN connectivity when remote users report issues accessing internal resources or when network changes occur.
        </div>
      </div>
    </div>
  );
}
