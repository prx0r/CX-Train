import { useState, useCallback } from 'react';

export interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const show = useCallback((e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - items.length * 32 - 20);
    setMenu({ x, y, items });
  }, []);

  const hide = useCallback(() => setMenu(null), []);

  return { menu, show, hide };
}
