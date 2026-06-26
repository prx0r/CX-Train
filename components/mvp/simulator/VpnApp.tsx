'use client';

interface VpnState {
  connected?: boolean;
  dnsFlushed?: boolean;
  lastError?: string | null;
  serverHostname?: string;
}

export default function VpnApp({ onAction, onRecordInteraction, state }: {
  onAction?: (actionId: string, tool: string) => void;
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
  state?: Record<string, unknown>;
}) {
  const vpn: VpnState = ((state as any)?.vpn || {}) as VpnState;
  const connected = vpn.connected === true;
  const lastError = vpn.lastError || null;
  const serverHostname = vpn.serverHostname || 'connexionvpn.corp.com';

  const handleToggle = () => {
    if (!connected) {
      onAction?.('connect_vpn', 'vpn');
    }
    onRecordInteraction?.(connected ? 'vpn_disconnect' : 'vpn_connect', connected ? 'Disconnected VPN' : 'Attempted VPN connection');
  };

  const handleCheckStatus = () => {
    onAction?.('check_vpn_status', 'vpn');
    onRecordInteraction?.('vpn_check_status', 'Checked VPN status');
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
              <div style={{ fontSize: 11, color: '#525252' }}>{serverHostname}</div>
            </div>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: connected ? '#22c55e' : '#808080',
            }} />
          </div>
          <div style={{ fontSize: 12, color: connected ? '#0f5132' : '#525252', fontWeight: 600, marginBottom: 10 }}>
            {connected ? 'Connected' : 'Not connected'}
          </div>

          {!connected && lastError && (
            <div style={{ padding: '6px 10px', background: '#fff4f2', border: '1px solid #d99a91', borderRadius: 3, fontSize: 11, color: '#842029', marginBottom: 10 }}>
              Last error: {lastError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleToggle} style={{
              padding: '7px 16px', borderRadius: 3, border: '1px solid #111',
              background: connected ? '#fff' : '#111', color: connected ? '#111' : '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {connected ? 'Disconnect' : 'Connect'}
            </button>
            {!connected && onAction && (
              <button onClick={handleCheckStatus} style={{
                padding: '7px 14px', borderRadius: 3, border: '1px solid #9f9f9f',
                background: '#fff', color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                Check Status
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 10, border: '1px solid #b8b8b8', borderRadius: 3, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>VPN type</div>
          <div style={{ fontSize: 12, color: '#525252' }}>L2TP/IPsec with pre-shared key</div>
          <div style={{ fontSize: 12, color: '#525252', marginTop: 2 }}>Server: {serverHostname}</div>
        </div>

        {!connected && lastError && (
          <div style={{ padding: 10, border: '1px solid #d99a91', borderRadius: 3, background: '#fff4f2', fontSize: 11, color: '#842029', lineHeight: 1.5 }}>
            <strong>Troubleshooting hint:</strong> The VPN client reports a DNS resolution error. Check if the DNS cache needs flushing (Command Prompt: ipconfig /flushdns).
          </div>
        )}

        <div style={{ fontSize: 11, color: '#6f6f6f', marginTop: 16 }}>
          In a real troubleshooting scenario, a tech would check VPN connectivity when remote users report issues accessing internal resources or when network changes occur.
        </div>
      </div>
    </div>
  );
}
