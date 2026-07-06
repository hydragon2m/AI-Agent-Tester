import { useCallback, useEffect, useRef, useState } from 'react';

export function useResizableWidth({ storageKey, defaultWidth, min = 160, max = 480 }) {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return saved >= min && saved <= max ? saved : defaultWidth;
  });
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!resizing) return;
    document.body.classList.add('sidebar-resizing');
    const handleMove = e => {
      const { startX, startWidth, direction } = dragRef.current;
      const delta = (e.clientX - startX) * direction;
      const next = Math.min(max, Math.max(min, startWidth + delta));
      setWidth(next);
    };
    const handleUp = () => setResizing(false);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.body.classList.remove('sidebar-resizing');
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [resizing, min, max]);

  useEffect(() => {
    if (!resizing) localStorage.setItem(storageKey, String(width));
  }, [resizing, width, storageKey]);

  const startResize = useCallback((e, direction = 1) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width, direction };
    setResizing(true);
  }, [width]);

  return { width, resizing, startResize };
}
