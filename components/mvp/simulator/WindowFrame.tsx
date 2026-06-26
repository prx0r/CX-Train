'use client';

import type React from 'react';

export default function WindowFrame({ title, appId, zIndex, onClose, onFocus, children }: {
  title: string;
  appId: string;
  zIndex: number;
  onClose: () => void;
  onFocus: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onMouseDown={onFocus}
      style={{
        position: 'absolute',
        inset: 12,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid #5f5f5f',
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        borderRadius: 8,
        overflow: 'hidden',
        zIndex,
      }}
    >
      <div style={{
        height: 36,
        background: '#f4f4f4',
        borderBottom: '1px solid #cfcfcf',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: 8,
        flexShrink: 0,
        cursor: 'default',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#111', flex: 1, userSelect: 'none' }}>
          {title}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            width: 28, height: 22, border: '1px solid #b8b8b8', background: '#fff',
            borderRadius: 3, cursor: 'pointer', fontSize: 14, fontWeight: 700,
            color: '#525252', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
