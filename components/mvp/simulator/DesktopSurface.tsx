'use client';

interface DesktopIconDef {
  id: string;
  label: string;
  glyph: string;
  wide?: boolean;
}

const ICONS: DesktopIconDef[] = [
  { id: 'outlook', label: 'Outlook', glyph: 'O' },
  { id: 'browser', label: 'Edge', glyph: 'E' },
  { id: 'cmd', label: 'Command Prompt', glyph: 'C:\\>', wide: true },
  { id: 'control_panel', label: 'Control Panel', glyph: '⚙', wide: true },
  { id: 'network', label: 'Network Settings', glyph: '🔗', wide: true },
  { id: 'vpn', label: 'VPN', glyph: '🔒', wide: true },
  { id: 'printer', label: 'Printers', glyph: '🖨', wide: true },
];

export default function DesktopSurface({ onOpenApp }: { onOpenApp: (app: string) => void }) {
  return (
    <div style={{
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #0b5ea8 0%, #0f77c8 55%, #1b8ad8 100%)',
      userSelect: 'none',
    }}>
      <div style={{
        position: 'absolute', left: 16, top: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {ICONS.map(icon => (
          <DesktopIcon
            key={icon.id}
            label={icon.label}
            glyph={icon.glyph}
            wide={icon.wide}
            onOpen={() => onOpenApp(icon.id)}
          />
        ))}
      </div>
    </div>
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
      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
      padding: 6,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{
        width: 44, height: 44, marginBottom: 6,
        background: 'rgba(255,255,255,0.92)',
        color: '#0b5ea8', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        {glyph}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.2, textAlign: 'center' }}>{label}</div>
    </button>
  );
}
