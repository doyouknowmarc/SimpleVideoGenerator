"use client";
import { useEffect, useRef, useState } from "react";
import { useTimeline } from "@/state/timelineStore";

export function ProjectTitle() {
  const title = useTimeline((s) => s.title);
  const setTitle = useTimeline((s) => s.setTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) {
      void setTitle(trimmed);
    } else {
      setDraft(title);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(title);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="brand-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
        maxLength={80}
      />
    );
  }

  return (
    <button
      type="button"
      className="app-brand"
      onClick={() => { setDraft(title); setEditing(true); }}
      title="Click to rename"
    >
      {title || "Untitled Project"}
    </button>
  );
}
