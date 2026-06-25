'use client';

import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/mvp', icon: '⊞' },
  { label: 'Assessments', href: '/mvp/assessments', icon: '⚠' },
  { label: 'Standards', href: '/mvp/standards', icon: '⚙' },
  { label: 'Taxonomy', href: '/mvp/taxonomy', icon: '📋' },
  { label: 'CMDB', href: '/mvp/knowledge', icon: '🗄' },
  { label: 'Reports', href: '/mvp/analytics', icon: '📊' },
  { label: 'Settings', href: '/mvp/settings', icon: '⚙' },
];

export default function ItsmSidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220, background: '#1b2f53', color: '#c5cdd9',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      minHeight: '100vh',
    }}>
      <div style={{ padding: '14px 16px', background: '#0e1d35', borderBottom: '1px solid #0a1525', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, background: '#60a5fa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13 }}>CC</div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>CallCallum</div>
      </div>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #0e1d35' }}>
        <input
          type="text"
          placeholder="🔍  Search"
          readOnly
          style={{ width: '100%', background: '#0e1d35', border: '1px solid #2a3f5f', borderRadius: 4, padding: '5px 8px', color: '#ccc', fontSize: 12 }}
        />
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/mvp' && pathname.startsWith(item.href));
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                borderLeft: '3px solid transparent', color: active ? '#fff' : '#9aacbe',
                fontSize: 13, textDecoration: 'none', transition: 'all 0.12s',
                background: active ? '#0e1d35' : 'transparent',
                borderLeftColor: active ? '#60a5fa' : 'transparent',
                fontWeight: active ? 600 : 400,
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid #0e1d35', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>M</div>
        <div>
          <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Manager</div>
          <div style={{ color: '#7a8fa3', fontSize: 11 }}>Service Desk</div>
        </div>
      </div>
    </aside>
  );
}
