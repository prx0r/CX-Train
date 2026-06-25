'use client';

import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Overview', href: '/mvp', icon: '⊞' },
  { label: 'Assessments', href: '/mvp/assessments', icon: '📋' },
  { label: 'Standards', href: '/mvp/standards', icon: '⚙' },
  { label: 'Assist (planned)', href: '/mvp/assist', icon: '💬' },
  { label: 'Knowledge (planned)', href: '/mvp/knowledge', icon: '📘' },
  { label: 'Clients (planned)', href: '/mvp/clients', icon: '🏢' },
  { label: 'People (planned)', href: '/mvp/people', icon: '👤' },
  { label: 'Analytics (planned)', href: '/mvp/analytics', icon: '📊' },
  { label: 'System', href: '/mvp/system', icon: '🔍' },
  { label: 'Settings', href: '/mvp/settings', icon: '⚙' },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 min-h-screen p-3 hidden md:block">
      <div className="mb-6 px-2">
        <h2 className="text-sm font-bold text-blue-400 tracking-wide">CallCallum</h2>
        <p className="text-xs text-gray-500">Manager Dashboard</p>
      </div>
      <ul className="space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/mvp' && pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <a
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                  active
                    ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
