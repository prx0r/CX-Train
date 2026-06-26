'use client';

interface WindowEntry { id: string; app: string; title: string; zIndex: number; }

const APP_LABELS: Record<string, string> = {
  outlook: 'Outlook',
  browser: 'Edge',
  cmd: 'Command',
  control_panel: 'Control Panel',
  network: 'Network',
  vpn: 'VPN',
  printer: 'Printers',
};

export default function Taskbar({ windows, activeApp, onFocusApp, onOpenDesktop }: {
  windows: WindowEntry[];
  activeApp: string | null;
  onFocusApp: (app: string) => void;
  onOpenDesktop: () => void;
}) {
  return (
    <div style={{
      height: 40,
      background: '#1a1a1a',
      borderTop: '1px solid #000',
      display: 'flex',
      alignItems: 'center',
      padding: '0 6px',
      flexShrink: 0,
      zIndex: 150,
    }}>
      <button onClick={onOpenDesktop} style={{
        height: 30, minWidth: 36, border: '1px solid transparent',
        background: activeApp === null ? '#333' : 'transparent',
        color: '#fff', borderRadius: 2, fontSize: 14, fontWeight: 700,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        ⊞
      </button>
      <div style={{ display: 'flex', gap: 2, flex: 1, padding: '0 4px', overflow: 'hidden' }}>
        {windows.map(w => (
          <button
            key={w.id}
            onClick={() => onFocusApp(w.app)}
            style={{
              height: 30, padding: '0 12px', border: '1px solid #3a3a3a',
              background: activeApp === w.app ? '#333' : '#1a1a1a',
              color: activeApp === w.app ? '#fff' : '#999',
              borderRadius: 2, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 140,
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {APP_LABELS[w.app] || w.title}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#999', paddingRight: 6, whiteSpace: 'nowrap' }}>
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
