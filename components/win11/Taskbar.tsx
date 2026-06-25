'use client';

import { useWindowManager } from '@/lib/win11/windowState';
import SystemTray from './SystemTray';
import './Taskbar.scss';

const PINNED_APPS = [
  { id: 'outlook', name: 'Outlook', icon: '📧' },
  { id: 'browser', name: 'Edge', icon: '🌐' },
  { id: 'cmd', name: 'Command Prompt', icon: '💻' },
  { id: 'chat', name: 'Chat', icon: '💬' },
  { id: 'ticket', name: 'Ticket', icon: '🎫' },
];

export default function Taskbar() {
  const { state, open, restore, minimize, focus, toggleStartMenu, closeStartMenu } = useWindowManager();
  const { windows, zCounter, startMenuOpen } = state;

  const handleAppClick = (id: string, name: string, icon: string, appType: string) => {
    closeStartMenu();
    if (windows[id]) {
      if (windows[id].hide) {
        open(id, name, icon, appType);
      } else if (!windows[id].max) {
        restore(id);
      } else {
        minimize(id);
      }
    } else {
      open(id, name, icon, appType);
    }
  };

  return (
    <div className="win-taskbar">
      <button
        className={`win-start-btn ${startMenuOpen ? 'active' : ''}`}
        onClick={toggleStartMenu}
        aria-label="Start"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="2" width="7" height="7" rx="1" fill="currentColor" opacity="0.8" />
          <rect x="11" y="2" width="7" height="7" rx="1" fill="currentColor" opacity="0.8" />
          <rect x="2" y="11" width="7" height="7" rx="1" fill="currentColor" opacity="0.8" />
          <rect x="11" y="11" width="7" height="7" rx="1" fill="currentColor" opacity="0.8" />
        </svg>
      </button>

      <div className="win-taskbar-divider" />

      <div className="win-taskbar-apps">
        {PINNED_APPS.map(app => {
          const win = windows[app.id];
          const isOpen = win && !win.hide;
          const isActive = isOpen && win.z === zCounter;
          return (
            <button
              key={app.id}
              className={`win-taskbar-app ${isOpen ? 'open' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => handleAppClick(app.id, app.name, app.icon, app.id)}
              aria-label={app.name}
              title={app.name}
            >
              <span className="win-taskbar-app-icon">{app.icon}</span>
              {isOpen && <span className="win-taskbar-indicator" />}
            </button>
          );
        })}
      </div>

      <div className="win-taskbar-right">
        <SystemTray />
      </div>
    </div>
  );
}
