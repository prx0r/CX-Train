'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/mvp', color: '#004b8d' },
  { label: 'Assessments', href: '/mvp/assessments', color: '#7c3aed' },
  { label: 'Standards', href: '/mvp/standards', color: '#059669' },
  { label: 'Taxonomy', href: '/mvp/taxonomy', color: '#d97706' },
  { label: 'System', href: '/mvp/system', color: '#dc2626' },
  { label: 'Settings', href: '/mvp/settings', color: '#6b7280' },
];

export default function NavPills() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  /* Don't show on candidate/sim pages */
  if (pathname.startsWith('/mvp/assessment/')) return null;

  return (
    <div style={{
      position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 9998,
      display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center',
    }}>
      <img
        src="/callcallum-logo.png"
        alt="CallCallum"
        style={{ width: 36, height: 36, borderRadius: '50%', opacity: 0.8, marginBottom: 4 }}
      />
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href || (item.href !== '/mvp' && pathname.startsWith(item.href));
        return (
          <div key={item.href} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <a
              href={item.href}
              style={{
                width: 44, height: 44, borderRadius: '50%', textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                background: active ? item.color : hovered === item.href ? item.color : 'rgba(24,24,27,0.7)',
                border: `1px solid ${active ? item.color : 'rgba(255,255,255,0.08)'}`,
                color: active || hovered === item.href ? '#fff' : '#52525b',
                boxShadow: active ? `0 0 24px ${item.color}33, 0 0 0 1px ${item.color}22` : '0 0 0 1px rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)',
                transform: active ? 'scale(1.1)' : hovered === item.href ? 'scale(1.08)' : 'scale(1)',
              }}
              onMouseEnter={() => setHovered(item.href)}
              onMouseLeave={() => setHovered(null)}
            >
              {item.label[0]}
            </a>
            {hovered === item.href && (
              <span style={{
                position: 'absolute', left: 56, whiteSpace: 'nowrap',
                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                background: '#18181b', border: '1px solid #27272a',
                color: '#e4e4e7', pointerEvents: 'none',
              }}>{item.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
