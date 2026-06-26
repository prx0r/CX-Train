'use client';

import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/mvp', icon: '≡' },
  { label: 'Assessments', href: '/mvp/assessments', icon: '⚠' },
  { label: 'Standards', href: '/mvp/standards', icon: '⚙' },
  { label: 'Taxonomy', href: '/mvp/taxonomy', icon: '⊞' },
  { label: 'CMDB', href: '/mvp/knowledge', icon: '🗄' },
  { label: 'Reports', href: '/mvp/analytics', icon: '📊' },
  { label: 'Settings', href: '/mvp/settings', icon: '⚙' },
];

export default function ItsmSidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220, background: '#111', color: '#dcdcdc',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      minHeight: '100vh', borderRight: '1px solid #000',
    }}>
      <div style={{
        padding: '14px 16px', background: '#000', borderBottom: '1px solid #2f2f2f',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 22, height: 22, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Connexion PSA</div>
      </div>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #2f2f2f' }}>
        <input
          type="text"
          placeholder="Search..."
          readOnly
          style={{ width: '100%', background: '#000', border: '1px solid #4a4a4a', borderRadius: 2, padding: '5px 8px', color: '#ccc', fontSize: 12 }}
        />
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/mvp' && pathname.startsWith(item.href));
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                color: active ? '#fff' : '#999', fontSize: 13, textDecoration: 'none',
                background: active ? '#2f2f2f' : 'transparent',
                borderLeft: '2px solid', borderLeftColor: active ? '#fff' : 'transparent',
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div style={{
        padding: '12px 16px', borderTop: '1px solid #2f2f2f',
        display: 'flex', alignItems: 'center', gap: 8, color: '#999', fontSize: 12,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
        <span>Service Desk</span>
      </div>
    </aside>
  );
}
