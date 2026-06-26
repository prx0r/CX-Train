'use client';

import { useEffect, useRef } from 'react';
import type { MenuItem } from './useContextMenu';

export default function ContextMenu({ menu, onClose }: {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const handler = () => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <div ref={ref} style={{
      position: 'fixed',
      left: menu.x,
      top: menu.y,
      zIndex: 99999,
      background: '#fff',
      border: '1px solid #9f9f9f',
      boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
      borderRadius: 3,
      minWidth: 180,
      padding: '2px 0',
      overflow: 'hidden',
    }}>
      {menu.items.map((item, i) => (
        item.separator ? (
          <div key={i} style={{ borderTop: '1px solid #cfcfcf', margin: '3px 0' }} />
        ) : (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              item.action();
              onClose();
            }}
            disabled={item.disabled}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '6px 12px', border: 'none', background: 'transparent',
              fontSize: 12, color: item.disabled ? '#9f9f9f' : '#111',
              cursor: item.disabled ? 'default' : 'pointer',
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = '#dfefff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {item.label}
          </button>
        )
      ))}
    </div>
  );
}
