'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { WindowState, WindowAction, WinWindow } from './types';

export const initialWindowState: WindowState = {
  windows: {},
  zCounter: 0,
  startMenuOpen: false,
  desktopContextMenu: null,
};

export function windowReducer(state: WindowState, action: WindowAction): WindowState {
  switch (action.type) {
    case 'OPEN': {
      if (state.windows[action.id] && !state.windows[action.id].hide) {
        return {
          ...state,
          windows: {
            ...state.windows,
            [action.id]: { ...state.windows[action.id], max: true, hide: false, z: state.zCounter + 1 },
          },
          zCounter: state.zCounter + 1,
        };
      }
      const newWindow: WinWindow = {
        id: action.id,
        name: action.name,
        icon: action.icon,
        hide: false,
        max: true,
        z: state.zCounter + 1,
        dim: { width: 800, height: 560, top: 60, left: 80 },
        appType: action.appType,
      };
      return {
        ...state,
        windows: { ...state.windows, [action.id]: newWindow },
        zCounter: state.zCounter + 1,
        startMenuOpen: false,
      };
    }
    case 'CLOSE':
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: { ...state.windows[action.id], hide: true, max: false },
        },
      };
    case 'MINIMIZE':
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: { ...state.windows[action.id], max: false },
        },
      };
    case 'RESTORE':
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: { ...state.windows[action.id], max: true, z: state.zCounter + 1 },
        },
        zCounter: state.zCounter + 1,
      };
    case 'FOCUS':
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: { ...state.windows[action.id], z: state.zCounter + 1 },
        },
        zCounter: state.zCounter + 1,
      };
    case 'MOVE':
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: {
            ...state.windows[action.id],
            dim: { ...state.windows[action.id].dim, top: action.top, left: action.left },
          },
        },
      };
    case 'RESIZE':
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: {
            ...state.windows[action.id],
            dim: {
              width: Math.max(300, action.width),
              height: Math.max(200, action.height),
              top: action.top ?? state.windows[action.id].dim.top,
              left: action.left ?? state.windows[action.id].dim.left,
            },
          },
        },
      };
    case 'TOGGLE_START_MENU':
      return { ...state, startMenuOpen: !state.startMenuOpen, desktopContextMenu: null };
    case 'CLOSE_START_MENU':
      return { ...state, startMenuOpen: false };
    case 'SHOW_DESKTOP_CONTEXT_MENU':
      return { ...state, desktopContextMenu: { x: action.x, y: action.y }, startMenuOpen: false };
    case 'HIDE_DESKTOP_CONTEXT_MENU':
      return { ...state, desktopContextMenu: null };
    default:
      return state;
  }
}

interface WindowContextValue {
  state: WindowState;
  open: (id: string, name: string, icon: string, appType: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  focus: (id: string) => void;
  move: (id: string, top: number, left: number) => void;
  resize: (id: string, width: number, height: number, top?: number, left?: number) => void;
  toggleStartMenu: () => void;
  closeStartMenu: () => void;
  showContextMenu: (x: number, y: number) => void;
  hideContextMenu: () => void;
  isOpen: (id: string) => boolean;
  isVisible: (id: string) => boolean;
  getHighestZ: () => string | null;
  cycleFocus: () => void;
}

const WindowContext = createContext<WindowContextValue | null>(null);

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(windowReducer, initialWindowState);

  const open = useCallback((id: string, name: string, icon: string, appType: string) =>
    dispatch({ type: 'OPEN', id, name, icon, appType }), []);
  const close = useCallback((id: string) => dispatch({ type: 'CLOSE', id }), []);
  const minimize = useCallback((id: string) => dispatch({ type: 'MINIMIZE', id }), []);
  const restore = useCallback((id: string) => dispatch({ type: 'RESTORE', id }), []);
  const focus = useCallback((id: string) => dispatch({ type: 'FOCUS', id }), []);
  const move = useCallback((id: string, top: number, left: number) =>
    dispatch({ type: 'MOVE', id, top, left }), []);
  const resize = useCallback((id: string, width: number, height: number, top?: number, left?: number) =>
    dispatch({ type: 'RESIZE', id, width, height, top, left }), []);
  const toggleStartMenu = useCallback(() => dispatch({ type: 'TOGGLE_START_MENU' }), []);
  const closeStartMenu = useCallback(() => dispatch({ type: 'CLOSE_START_MENU' }), []);
  const showContextMenu = useCallback((x: number, y: number) =>
    dispatch({ type: 'SHOW_DESKTOP_CONTEXT_MENU', x, y }), []);
  const hideContextMenu = useCallback(() => dispatch({ type: 'HIDE_DESKTOP_CONTEXT_MENU' }), []);

  const isOpen = useCallback((id: string) => !!state.windows[id] && !state.windows[id].hide, [state.windows]);
  const isVisible = useCallback((id: string) => !!state.windows[id] && !state.windows[id].hide && state.windows[id].max, [state.windows]);

  const getHighestZ = useCallback((): string | null => {
    let highest: string | null = null;
    let highestZ = -1;
    for (const [id, w] of Object.entries(state.windows)) {
      if (!w.hide && w.z > highestZ) { highestZ = w.z; highest = id; }
    }
    return highest;
  }, [state.windows]);

  const cycleFocus = useCallback(() => {
    const ids = Object.entries(state.windows)
      .filter(([, w]) => !w.hide)
      .sort(([, a], [, b]) => a.z - b.z);
    if (ids.length > 0) {
      const nextId = ids[0][0];
      dispatch({ type: 'FOCUS', id: nextId });
    }
  }, [state.windows]);

  return (
    <WindowContext.Provider value={{
      state, open, close, minimize, restore, focus, move, resize,
      toggleStartMenu, closeStartMenu, showContextMenu, hideContextMenu,
      isOpen, isVisible, getHighestZ, cycleFocus,
    }}>
      {children}
    </WindowContext.Provider>
  );
}

export function useWindowManager() {
  const ctx = useContext(WindowContext);
  if (!ctx) throw new Error('useWindowManager must be used within WindowProvider');
  return ctx;
}
