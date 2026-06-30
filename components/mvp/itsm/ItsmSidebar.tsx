'use client';

import { usePathname } from 'next/navigation';
import CallumSidebar from './CallumSidebar';
import { Logo } from '@/components/shared/Logo';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/mvp', icon: '≡' },
  { label: 'Assessments', href: '/mvp/assessments', icon: '⚠' },
  { label: 'Assist', href: '/mvp/assist', icon: '💡' },
  { label: 'Clients', href: '/mvp/clients', icon: '🏢' },
  { label: 'Standards', href: '/mvp/standards', icon: '⚙' },
  { label: 'Taxonomy', href: '/mvp/taxonomy', icon: '⊞' },
  { label: 'System', href: '/mvp/system', icon: '🔧' },
  { label: 'CMDB', href: '/mvp/knowledge', icon: '🗄' },
  { label: 'Reports', href: '/mvp/analytics', icon: '📊' },
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
        <Logo size={22} showLabel />
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
      <CallumSidebar />
    </aside>
  );
}
