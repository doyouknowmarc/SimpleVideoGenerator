"use client";
import { useEffect, useState } from "react";
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
  waveformUrl?: string;
  isSelected: boolean;
  cutMode: boolean;
  onBodyMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onLeftHandleMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onRightHandleMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onCut: (cutTime: number) => void;
};

export function TimelineClip({
  startTime,
  duration,
  pixelsPerSecond,
  leftPad = 0,
  trackType,
  label,
  thumbUrl,
  waveformUrl,
  isSelected,
  cutMode,
  onBodyMouseDown,
  onLeftHandleMouseDown,
  onRightHandleMouseDown,
  onSelect,
  onDelete,
  onRename,
  onCut,
}: Props) {
  const [draft, setDraft] = useState(label);
  const left = leftPad + startTime * pixelsPerSecond;
  const width = Math.max(8, duration * pixelsPerSecond);

  useEffect(() => {
    setDraft(label);
  }, [label]);

  function commitName() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) onRename(trimmed);
    else setDraft(label);
  }

  return (
    <div
      className={`timeline-clip ${trackType}-clip ${isSelected ? "selected" : ""}`}
      style={{ left, width }}
      onMouseDown={(e) => {
        onSelect();
        if (cutMode) {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          onCut(startTime + x / pixelsPerSecond);
          return;
        }
        onBodyMouseDown(e);
      }}
    >
      <input
        className="clip-name-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          onSelect();
          e.currentTarget.select();
        }}
        onBlur={commitName}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(label);
            e.currentTarget.blur();
          }
          e.stopPropagation();
        }}
        spellCheck={false}
        aria-label={`Rename ${label}`}
        title="Rename clip"
      />
      <div
        className="clip-resize-handle left"
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect();
          onLeftHandleMouseDown(e);
        }}
      />
      {trackType === "audio" && waveformUrl && (
        <div
          className="audio-waveform"
          style={{ backgroundImage: `url(${waveformUrl})` }}
        />
      )}
      {trackType === "image" && thumbUrl && (
        <div className="timeline-clip-thumb" style={{ backgroundImage: `url(${thumbUrl})` }} />
      )}
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
