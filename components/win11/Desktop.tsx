'use client';

import { useWindowManager } from '@/lib/win11/windowState';
import './Desktop.scss';

const DESKTOP_APPS = [
  { id: 'outlook', name: 'Outlook', icon: '📧', appType: 'outlook' },
  { id: 'browser', name: 'Edge', icon: '🌐', appType: 'browser' },
  { id: 'cmd', name: 'Command Prompt', icon: '💻', appType: 'cmd' },
  { id: 'chat', name: 'Customer Chat', icon: '💬', appType: 'chat' },
  { id: 'ticket', name: 'Ticket', icon: '🎫', appType: 'ticket' },
];

export default function Desktop() {
  const { state, open, closeStartMenu, showContextMenu, hideContextMenu } = useWindowManager();

  const handleDesktopClick = () => {
    closeStartMenu();
    hideContextMenu();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  };

  const handleAppDoubleClick = (id: string, name: string, icon: string, appType: string) => {
    open(id, name, icon, appType);
  };

  return (
    <div
      className="win-desktop"
      onClick={handleDesktopClick}
      onContextMenu={handleContextMenu}
    >
      <div className="win-desktop-icons">
        {DESKTOP_APPS.map(app => (
          <div
            key={app.id}
            className="win-desktop-icon"
            onDoubleClick={() => handleAppDoubleClick(app.id, app.name, app.icon, app.appType)}
          >
            <div className="win-desktop-icon-img">{app.icon}</div>
            <div className="win-desktop-icon-label">{app.name}</div>
          </div>
        ))}
      </div>

      {/* Right-click context menu */}
      {state.desktopContextMenu && (
        <>
          <div className="win-context-overlay" onClick={hideContextMenu} />
          <div
            className="win-context-menu"
            style={{ top: state.desktopContextMenu.y, left: state.desktopContextMenu.x }}
          >
            <div className="win-context-item" onClick={() => { DESKTOP_APPS.forEach(a => open(a.id, a.name, a.icon, a.appType)); hideContextMenu(); }}>
              <span>⊞</span> Open all tools
            </div>
            <div className="win-context-sep" />
            <div className="win-context-item" onClick={hideContextMenu}>
              <span>🔄</span> Refresh
            </div>
            <div className="win-context-sep" />
            <div className="win-context-item disabled">
              <span>📐</span> Display settings
            </div>
            <div className="win-context-item disabled">
              <span>🎨</span> Personalize
            </div>
          </div>
        </>
      )}
    </div>
  );
}
