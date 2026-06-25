export interface WindowDim {
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface WinWindow {
  id: string;
  name: string;
  icon: string;
  hide: boolean;
  max: boolean;
  z: number;
  dim: WindowDim;
  appType: string;
}

export interface WindowState {
  windows: Record<string, WinWindow>;
  zCounter: number;
  startMenuOpen: boolean;
  desktopContextMenu: { x: number; y: number } | null;
}

export type WindowAction =
  | { type: 'OPEN'; id: string; name: string; icon: string; appType: string }
  | { type: 'CLOSE'; id: string }
  | { type: 'MINIMIZE'; id: string }
  | { type: 'RESTORE'; id: string }
  | { type: 'FOCUS'; id: string }
  | { type: 'MOVE'; id: string; top: number; left: number }
  | { type: 'RESIZE'; id: string; width: number; height: number; top?: number; left?: number }
  | { type: 'TOGGLE_START_MENU' }
  | { type: 'CLOSE_START_MENU' }
  | { type: 'SHOW_DESKTOP_CONTEXT_MENU'; x: number; y: number }
  | { type: 'HIDE_DESKTOP_CONTEXT_MENU' };
