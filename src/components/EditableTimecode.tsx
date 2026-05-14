"use client";
import { useEffect, useRef, useState } from "react";
import { formatTimecode, parseTimecode } from "@/lib/timecode";

type Props = {
  current: number;
  total: number;
  onSeek: (t: number) => void;
};

export function EditableTimecode({ current, total, onSeek }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setDraft(formatTimecode(current));
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    const parsed = parseTimecode(draft);
    if (parsed != null && isFinite(parsed)) {
      onSeek(Math.max(0, Math.min(total, parsed)));
    }
  }
  function cancel() {
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="timecode timecode-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
          e.stopPropagation();
        }}
        placeholder="00:00:00.00"
        aria-label="Jump to time"
      />
    );
  }

  return (
    <button
      type="button"
      className="timecode timecode-display"
      onClick={startEdit}
      title="Click to type a target time"
    >
      <span className="cur">{formatTimecode(current)}</span>
      <span className="sep"> / </span>
      <span className="tot">{formatTimecode(total)}</span>
    </button>
  );
}
