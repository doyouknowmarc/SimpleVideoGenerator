"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "svg.sidebarWidth";
const MIN_WIDTH = 200;
const MAX_WIDTH = 520;
const DEFAULT_WIDTH = 280;

type Props = { children: ReactNode };

export function SidebarResize({ children }: Props) {
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const v = parseInt(stored, 10);
      if (!isNaN(v) && v >= MIN_WIDTH && v <= MAX_WIDTH) setWidth(v);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, d.startWidth + (e.clientX - d.startX)));
      setWidth(next);
    }
    function onUp() { dragRef.current = null; document.body.style.cursor = ""; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function onHandleMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  }

  return (
    <aside className="asset-panel" style={{ width }}>
      {children}
      <div
        className="sidebar-divider"
        onMouseDown={onHandleMouseDown}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
      >
        <div className="sidebar-divider-handle" />
      </div>
    </aside>
  );
}
