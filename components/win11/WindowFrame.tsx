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

function rafThrottle(fn: () => void): (() => void) {
  let ticking = false;
  return () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => { ticking = false; fn(); });
    }
  };
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
    const dim = win?.dim || { top: 80, left: 120 };
    const ref = { startX: e.clientX, startY: e.clientY, startTop: dim.top, startLeft: dim.left };
    dragRef.current = ref;
    const throttledMove = rafThrottle(() => {
      if (!dragRef.current) return;
      move(id, dragRef.current.startTop, dragRef.current.startLeft);
    });
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = ev.clientY - ref.startY;
      const dx = ev.clientX - ref.startX;
      dragRef.current.startTop = ref.startTop + dy;
      dragRef.current.startLeft = ref.startLeft + dx;
      throttledMove();
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, [id, focus, move, win?.dim]);

  const handleResizeStart = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const el = frameRef.current;
    if (!el) return;
    const dim = win?.dim || { width: defaultWidth, height: defaultHeight, top: 80, left: 120 };
    const ref = { startX: e.clientX, startY: e.clientY, startW: dim.width, startH: dim.height, startT: dim.top, startL: dim.left, dir };
    resizeRef.current = ref;
    const throttledResize = rafThrottle(() => {
      if (!resizeRef.current) return;
      const dx = 0;
      const dy = 0;
      let w = ref.startW, h = ref.startH, t = ref.startT, l = ref.startL;
      if (ref.dir.includes('e')) w = Math.max(minWidth, ref.startW + dx);
      if (ref.dir.includes('w')) { w = Math.max(minWidth, ref.startW - dx); l = ref.startL + (ref.startW - w); }
      if (ref.dir.includes('s')) h = Math.max(minHeight, ref.startH + dy);
      if (ref.dir.includes('n')) { h = Math.max(minHeight, ref.startH - dy); t = ref.startT + (ref.startH - h); }
      resize(id, w, h, t, l);
    });
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - ref.startX;
      const dy = ev.clientY - ref.startY;
      ref.startX = ev.clientX;
      ref.startY = ev.clientY;
      let w = ref.startW, h = ref.startH, t = ref.startT, l = ref.startL;
      if (ref.dir.includes('e')) w = Math.max(minWidth, ref.startW + dx);
      if (ref.dir.includes('w')) { w = Math.max(minWidth, ref.startW - dx); l = ref.startL + (ref.startW - w); }
      if (ref.dir.includes('s')) h = Math.max(minHeight, ref.startH + dy);
      if (ref.dir.includes('n')) { h = Math.max(minHeight, ref.startH - dy); t = ref.startT + (ref.startH - h); }
      ref.startW = w; ref.startH = h; ref.startT = t; ref.startL = l;
      throttledResize();
    };
    const onUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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
