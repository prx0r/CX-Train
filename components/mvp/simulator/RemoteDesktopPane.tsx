'use client';

import { useReducer, useCallback } from 'react';
import WindowFrame from './WindowFrame';
import DesktopSurface from './DesktopSurface';
import Taskbar from './Taskbar';
import OutlookApp from './OutlookApp';
import BrowserApp from './BrowserApp';
import CmdApp from './CmdApp';
import ControlPanelApp from './ControlPanelApp';
import NetworkApp from './NetworkApp';
import VpnApp from './VpnApp';
import PrinterApp from './PrinterApp';

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

interface WindowEntry { id: string; app: string; title: string; zIndex: number; }
interface DesktopState { windows: WindowEntry[]; nextZ: number; }
type DesktopAction =
  | { type: 'OPEN'; app: string; title: string }
  | { type: 'CLOSE'; app: string }
  | { type: 'FOCUS'; app: string }
  | { type: 'CLOSE_ALL' };

function reducer(state: DesktopState, action: DesktopAction): DesktopState {
  switch (action.type) {
    case 'OPEN': {
      const existing = state.windows.filter(w => w.app !== action.app);
      return { ...state, nextZ: state.nextZ + 1, windows: [...existing, { id: `${action.app}-${state.nextZ}`, app: action.app, title: action.title, zIndex: state.nextZ }] };
    }
    case 'CLOSE':
      return { ...state, windows: state.windows.filter(w => w.app !== action.app) };
    case 'FOCUS':
      return { ...state, nextZ: state.nextZ + 1, windows: state.windows.map(w => w.app === action.app ? { ...w, zIndex: state.nextZ } : w) };
    case 'CLOSE_ALL':
      return { windows: [], nextZ: 0 };
    default:
      return state;
  }
}

const APP_TITLES: Record<string, string> = {
  outlook: 'Outlook — Sarah@Connexion Dental',
  browser: 'Microsoft Edge',
  cmd: 'Command Prompt — C:\\Windows\\System32\\cmd.exe',
  control_panel: 'Control Panel',
  network: 'Network & Internet Settings',
  vpn: 'VPN Connections',
  printer: 'Printers & Scanners',
};

export default function RemoteDesktopPane({ actions, visibleState, onAction, onRecordInteraction }: {
  actions: SafeAction[];
  visibleState: Record<string, unknown>;
  onAction: (id: string, tool: string) => void;
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
  disabled?: boolean;
}) {
  const safeState = (visibleState.safe_state || visibleState) as Record<string, any>;
  const [desktop, dispatch] = useReducer(reducer, { windows: [], nextZ: 0 });

  const openApp = useCallback((app: string) => {
    dispatch({ type: 'OPEN', app, title: APP_TITLES[app] || app });
    onRecordInteraction?.(`open_${app}`, `Opened ${APP_TITLES[app] || app}`);

    if (app === 'outlook') onAction('open_outlook', 'outlook');
    if (app === 'browser') onAction('open_browser', 'browser');
    if (app === 'cmd') onAction('run_ipconfig', 'cmd');
  }, [onAction, onRecordInteraction]);

  const closeApp = useCallback((app: string) => {
    dispatch({ type: 'CLOSE', app });
    onRecordInteraction?.(`close_${app}`, `Closed ${APP_TITLES[app] || app}`);
  }, [onRecordInteraction]);

  const focusApp = useCallback((app: string) => {
    dispatch({ type: 'FOCUS', app });
  }, []);

  const activeApp = desktop.windows.length > 0
    ? desktop.windows.reduce((a, b) => a.zIndex > b.zIndex ? a : b).app
    : null;

  const toolActions = (tool: string) => actions.filter(a => a.tool === tool);

  const renderApp = (win: WindowEntry) => {
    const common = {
      actions: toolActions(win.app),
      state: safeState,
      onAction,
      onRecordInteraction,
    };
    switch (win.app) {
      case 'outlook': return <OutlookApp {...common} />;
      case 'browser': return <BrowserApp {...common} />;
      case 'cmd': return <CmdApp state={safeState} actions={toolActions(win.app)} onAction={onAction} onRecordInteraction={onRecordInteraction} />;
      case 'control_panel': return <ControlPanelApp {...common} />;
      case 'network': return <NetworkApp onRecordInteraction={onRecordInteraction} />;
      case 'vpn': return <VpnApp state={safeState} onAction={onAction} onRecordInteraction={onRecordInteraction} />;
      case 'printer': return <PrinterApp state={safeState} onAction={onAction} onRecordInteraction={onRecordInteraction} />;
      default: return <div style={{ padding: 16, color: '#525252', fontSize: 13 }}>Application not available.</div>;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0b5ea8' }}>
      {/* Remote header */}
      <div style={{
        height: 28, background: '#f2f2f2', borderBottom: '1px solid #9f9f9f',
        display: 'flex', alignItems: 'center', padding: '0 8px', gap: 8,
        fontSize: 11, color: '#222', flexShrink: 0,
      }}>
        <strong>ScreenConnect</strong>
        <span>ALDER-LT-023</span>
        <span style={{ marginLeft: 'auto' }}>Connected</span>
      </div>

      {/* Desktop surface */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <DesktopSurface onOpenApp={openApp} />

        {/* Open windows */}
        {desktop.windows.sort((a, b) => a.zIndex - b.zIndex).map(win => (
          <WindowFrame
            key={win.id}
            title={win.title}
            appId={win.app}
            zIndex={win.zIndex}
            onClose={() => closeApp(win.app)}
            onFocus={() => focusApp(win.app)}
          >
            {renderApp(win)}
          </WindowFrame>
        ))}
      </div>

      {/* Taskbar */}
      <Taskbar
        windows={desktop.windows}
        activeApp={activeApp}
        onFocusApp={focusApp}
        onOpenDesktop={() => {}}
      />
    </div>
  );
}
