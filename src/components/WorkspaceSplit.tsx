"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "svg.previewHeight";
const MIN_PREVIEW = 220;
const MIN_TIMELINE = 200;

type Props = {
  preview: ReactNode;
  timeline: ReactNode;
};

export function WorkspaceSplit({ preview, timeline }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      const v = parseInt(stored, 10);
      if (!isNaN(v)) {
        setPreviewHeight(v);
        return;
      }
    }
    // Default: 55% of available height
    const h = containerRef.current?.clientHeight ?? 600;
    setPreviewHeight(Math.round(h * 0.55));
  }, []);

  useEffect(() => {
    if (previewHeight == null) return;
    window.localStorage.setItem(STORAGE_KEY, String(previewHeight));
  }, [previewHeight]);

  // Clamp on container resize
  useEffect(() => {
    const onResize = () => {
      const containerH = containerRef.current?.clientHeight ?? 0;
      if (containerH <= 0) return;
      setPreviewHeight((h) => {
        if (h == null) return h;
        const maxPreview = containerH - MIN_TIMELINE - 6;
        return Math.max(MIN_PREVIEW, Math.min(maxPreview, h));
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onDividerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (previewHeight == null) return;
    dragRef.current = { startY: e.clientY, startHeight: previewHeight };
    e.preventDefault();
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const containerH = containerRef.current?.clientHeight ?? 0;
      if (containerH <= 0) return;
      const maxPreview = containerH - MIN_TIMELINE - 6;
      const next = Math.max(MIN_PREVIEW, Math.min(maxPreview, d.startHeight + (e.clientY - d.startY)));
      setPreviewHeight(next);
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="workspace-split">
      <div className="preview-pane" style={{ height: previewHeight ?? "55%" }}>
        {preview}
      </div>
      <div
        className="workspace-divider"
        onMouseDown={onDividerMouseDown}
        role="separator"
        aria-orientation="horizontal"
        title="Drag to resize"
      >
        <div className="workspace-divider-handle" />
      </div>
      <div className="timeline-pane">
        {timeline}
      </div>
    </div>
  );
}
