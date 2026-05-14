"use client";
import { useTimeline } from "@/state/timelineStore";
import { IconScissors, IconDuplicate, IconTrash } from "./icons";

export function BottomToolbar() {
  const selectedClipId = useTimeline((s) => s.selectedClipId);
  const snapEnabled = useTimeline((s) => s.snapEnabled);
  const toggleSnap = useTimeline((s) => s.toggleSnap);
  const duplicateSelected = useTimeline((s) => s.duplicateSelected);
  const deleteSelected = useTimeline((s) => s.deleteSelected);
  const hasSelection = !!selectedClipId;

  return (
    <div className="bottom-toolbar">
      <button
        className="toolbar-btn"
        disabled
        title="Split at playhead (coming soon)"
      >
        <IconScissors />
      </button>
      <button
        className="toolbar-btn"
        onClick={duplicateSelected}
        disabled={!hasSelection}
        title="Duplicate selected (⌘D)"
      >
        <IconDuplicate />
      </button>
      <button
        className="toolbar-btn danger"
        onClick={deleteSelected}
        disabled={!hasSelection}
        title="Delete selected (Del)"
      >
        <IconTrash />
      </button>
      <div style={{ flex: 1 }} />
      <button
        className={`snap-toggle ${snapEnabled ? "on" : ""}`}
        onClick={toggleSnap}
        title="Toggle snapping"
      >
        Snapping {snapEnabled ? "on" : "off"} <span className="switch" />
      </button>
    </div>
  );
}
