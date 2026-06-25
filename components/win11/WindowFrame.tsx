'use client';

import { useRef, useCallback, useState } from 'react';
import { useWindowManager } from '@/lib/win11/windowState';
import './WindowFrame.scss';

interface WindowFrameProps {
  id: string;
  name: string;
  icon: string;
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export default function WindowFrame({
  id, name, icon, children,
  defaultWidth = 720, defaultHeight = 480,
  minWidth = 300, minHeight = 200,
}: WindowFrameProps) {
  const { state, close, minimize, restore, focus, move, resize } = useWindowManager();
  const win = state.windows[id];
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startT: number; startL: number; dir: string } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    focus(id);
    e.stopPropagation();
  }, [id, focus]);

  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    focus(id);
    const el = frameRef.current;
    if (!el) return;
    if ((e.target as HTMLElement).closest('.win-btn')) return;
    const currentDim = win?.dim || { top: 80, left: 120 };
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: currentDim.top,
      startLeft: currentDim.left,
    };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = ev.clientY - dragRef.current.startY;
      const dx = ev.clientX - dragRef.current.startX;
      move(id, dragRef.current.startTop + dy, dragRef.current.startLeft + dx);
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  }, [id, focus, move, win?.dim]);

  const handleResizeStart = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const el = frameRef.current;
    if (!el) return;
    const currentDim = win?.dim || { width: defaultWidth, height: defaultHeight, top: 80, left: 120 };
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: currentDim.width,
      startH: currentDim.height,
      startT: currentDim.top,
      startL: currentDim.left,
      dir,
    };
    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startY, startW, startH, startT, startL, dir: d } = resizeRef.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let w = startW, h = startH, t = startT, l = startL;
      if (d.includes('e')) w = Math.max(minWidth, startW + dx);
      if (d.includes('w')) { w = Math.max(minWidth, startW - dx); l = startL + (startW - w); }
      if (d.includes('s')) h = Math.max(minHeight, startH + dy);
      if (d.includes('n')) { h = Math.max(minHeight, startH - dy); t = startT + (startH - h); }
      resize(id, w, h, t, l);
    };
    const handleUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [id, resize, win?.dim, defaultWidth, defaultHeight, minWidth, minHeight]);

  if (!win) return null;

  const dim = win.dim || { width: defaultWidth, height: defaultHeight, top: 80, left: 120 };
  const zIndex = win.z;
  const isTop = zIndex === state.zCounter;

  const dimStyle = win.dim ? { top: win.dim.top, left: win.dim.left, width: win.dim.width, height: win.dim.height } : {};

  return (
    <div
      ref={frameRef}
      className={`win-window ${isTop ? 'win-top' : ''} ${win.max ? 'win-visible' : 'win-hidden'} ${isResizing ? 'win-resizing' : ''}`}
      style={{ zIndex, ...dimStyle }}
      onMouseDown={handleMouseDown}
      data-hide={win.hide ? 'true' : 'false'}
      data-max={win.max ? 'true' : 'false'}
    >
      <div className="win-titlebar" onMouseDown={handleTitleMouseDown}>
        <div className="win-titlebar-drag" />
        <div className="win-title">
          <span className="win-title-icon">{icon}</span>
          <span className="win-title-text">{name}</span>
        </div>
        <div className="win-controls">
          <button className="win-btn win-btn-min" onClick={() => minimize(id)} aria-label="Minimize">─</button>
          <button className="win-btn win-btn-max" onClick={() => win.max ? null : focus(id)} aria-label="Maximize">□</button>
          <button className="win-btn win-btn-close" onClick={() => close(id)} aria-label="Close">✕</button>
        </div>
      </div>
      <div className="win-body">
        {children}
      </div>
      <div className="win-resize-handle win-rh-n" onMouseDown={e => handleResizeStart(e, 'n')} />
      <div className="win-resize-handle win-rh-s" onMouseDown={e => handleResizeStart(e, 's')} />
      <div className="win-resize-handle win-rh-e" onMouseDown={e => handleResizeStart(e, 'e')} />
      <div className="win-resize-handle win-rh-w" onMouseDown={e => handleResizeStart(e, 'w')} />
      <div className="win-resize-handle win-rh-ne" onMouseDown={e => handleResizeStart(e, 'ne')} />
      <div className="win-resize-handle win-rh-nw" onMouseDown={e => handleResizeStart(e, 'nw')} />
      <div className="win-resize-handle win-rh-se" onMouseDown={e => handleResizeStart(e, 'se')} />
      <div className="win-resize-handle win-rh-sw" onMouseDown={e => handleResizeStart(e, 'sw')} />
    </div>
  );
}
