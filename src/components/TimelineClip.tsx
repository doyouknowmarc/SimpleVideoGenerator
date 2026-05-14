"use client";
import type { MouseEvent } from "react";

type Props = {
  id: string;
  startTime: number;
  duration: number;
  pixelsPerSecond: number;
  leftPad?: number;
  trackType: "image" | "audio";
  label: string;
  thumbUrl?: string;
  isSelected: boolean;
  onBodyMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onLeftHandleMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onRightHandleMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onDelete: () => void;
};

export function TimelineClip({
  startTime,
  duration,
  pixelsPerSecond,
  leftPad = 0,
  trackType,
  label,
  thumbUrl,
  isSelected,
  onBodyMouseDown,
  onLeftHandleMouseDown,
  onRightHandleMouseDown,
  onSelect,
  onDelete,
}: Props) {
  const left = leftPad + startTime * pixelsPerSecond;
  const width = Math.max(8, duration * pixelsPerSecond);

  return (
    <div
      className={`timeline-clip ${trackType}-clip ${isSelected ? "selected" : ""}`}
      style={{ left, width }}
      onMouseDown={(e) => {
        // Left/right handles stop propagation themselves
        onSelect();
        onBodyMouseDown(e);
      }}
    >
      <div
        className="clip-resize-handle left"
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect();
          onLeftHandleMouseDown(e);
        }}
      />
      {trackType === "image" && thumbUrl && (
        <div className="timeline-clip-thumb" style={{ backgroundImage: `url(${thumbUrl})` }} />
      )}
      <span className="clip-label">{label}</span>
      <div
        className="clip-resize-handle right"
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect();
          onRightHandleMouseDown(e);
        }}
      />
      {isSelected && (
        <button
          className="clip-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Delete clip"
        >
          ×
        </button>
      )}
    </div>
  );
}
