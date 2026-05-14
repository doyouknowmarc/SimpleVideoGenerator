"use client";
import { useEffect, useRef, useState } from "react";
import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { useTimeline } from "@/state/timelineStore";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineClip } from "./TimelineClip";
import { EditableTimecode } from "./EditableTimecode";
import { computeTotalDuration, snapToGrid } from "@/lib/timelineHelpers";
import type { TrackType } from "@/types";
import {
  IconFilm, IconVolume, IconPlay, IconPause,
  IconSkipBack, IconSkipForward, IconDuplicate, IconTrash, IconEye, IconEyeOff, IconScissors,
} from "./icons";
import { ZoomControl } from "./ZoomControl";

export const TIMELINE_LEFT_PAD = 12; // px of breathing room at start of timeline

type MoveDrag = {
  kind: "move";
  track: TrackType;
  trackIndex: number;
  clipId: string;
  pointerStartX: number;
  clipStartTimeAtPointerDown: number;
};
type ResizeRightDrag = {
  kind: "resize-right";
  track: TrackType;
  trackIndex: number;
  clipId: string;
  pointerStartX: number;
  originalDuration: number;
};
type ResizeLeftDrag = {
  kind: "resize-left";
  track: TrackType;
  trackIndex: number;
  clipId: string;
  pointerStartX: number;
  originalStart: number;
  originalDuration: number;
};
type PlayheadDrag = { kind: "playhead"; pointerStartX: number };
type DragState = MoveDrag | ResizeRightDrag | ResizeLeftDrag | PlayheadDrag | null;
type SelectedTrackRow = { type: TrackType; index: number } | null;

export function TimelineEditor() {
  const imageClips = useTimeline((s) => s.imageClips);
  const audioClips = useTimeline((s) => s.audioClips);
  const assets = useTimeline((s) => s.assets);
  const imageTrackCount = useTimeline((s) => s.imageTrackCount);
  const audioTrackCount = useTimeline((s) => s.audioTrackCount);
  const hiddenImageTracks = useTimeline((s) => s.hiddenImageTracks);
  const hiddenAudioTracks = useTimeline((s) => s.hiddenAudioTracks);
  const playheadTime = useTimeline((s) => s.playheadTime);
  const playing = useTimeline((s) => s.playing);
  const togglePlay = useTimeline((s) => s.togglePlay);
  const setPlaying = useTimeline((s) => s.setPlaying);
  const selectedClipId = useTimeline((s) => s.selectedClipId);
  const selectedTrack = useTimeline((s) => s.selectedTrack);
  const pps = useTimeline((s) => s.pixelsPerSecond);
  const snapEnabled = useTimeline((s) => s.snapEnabled);
  const toggleSnap = useTimeline((s) => s.toggleSnap);
  const cutMode = useTimeline((s) => s.cutMode);
  const toggleCutMode = useTimeline((s) => s.toggleCutMode);

  const updateImageClip = useTimeline((s) => s.updateImageClip);
  const updateAudioClip = useTimeline((s) => s.updateAudioClip);
  const removeImageClip = useTimeline((s) => s.removeImageClip);
  const removeAudioClip = useTimeline((s) => s.removeAudioClip);
  const cutImageClip = useTimeline((s) => s.cutImageClip);
  const cutAudioClip = useTimeline((s) => s.cutAudioClip);
  const addImageClip = useTimeline((s) => s.addImageClip);
  const addAudioClip = useTimeline((s) => s.addAudioClip);
  const addImageTrack = useTimeline((s) => s.addImageTrack);
  const addAudioTrack = useTimeline((s) => s.addAudioTrack);
  const removeImageTrack = useTimeline((s) => s.removeImageTrack);
  const removeAudioTrack = useTimeline((s) => s.removeAudioTrack);
  const toggleImageTrackHidden = useTimeline((s) => s.toggleImageTrackHidden);
  const toggleAudioTrackHidden = useTimeline((s) => s.toggleAudioTrackHidden);
  const setPlayhead = useTimeline((s) => s.setPlayhead);
  const selectClip = useTimeline((s) => s.selectClip);
  const setZoom = useTimeline((s) => s.setZoom);
  const scheduleSave = useTimeline((s) => s.scheduleSave);
  const duplicateSelected = useTimeline((s) => s.duplicateSelected);
  const deleteSelected = useTimeline((s) => s.deleteSelected);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dragOverTrack, setDragOverTrack] = useState<string | null>(null);
  const [selectedTrackRow, setSelectedTrackRow] = useState<SelectedTrackRow>(null);

  const total = computeTotalDuration(imageClips, audioClips);
  const minSeconds = Math.max(total + 5, 30);
  const containerWidth = scrollRef.current?.clientWidth ?? 800;
  const trackContentWidth = Math.max(minSeconds * pps, containerWidth - TIMELINE_LEFT_PAD);
  const trackWidth = TIMELINE_LEFT_PAD + trackContentWidth;

  function neighborEdges(track: TrackType, excludeId: string): number[] {
    const arr = track === "image" ? imageClips : audioClips;
    const out: number[] = [0];
    for (const c of arr) {
      if (c.id === excludeId) continue;
      out.push(c.startTime);
      out.push(c.startTime + c.duration);
    }
    return out;
  }

  function snapTime(t: number, edges: number[]): number {
    if (!snapEnabled) return Math.max(0, t);
    const gridSnapped = snapToGrid(t);
    if (edges.length === 0) return gridSnapped;
    const tolerance = Math.max(0.05, 8 / pps);
    let best = gridSnapped;
    let bestDist = Math.abs(t - gridSnapped);
    for (const e of edges) {
      const d = Math.abs(t - e);
      if (d < tolerance && d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return Math.max(0, best);
  }

  useEffect(() => {
    if (!dragState) return;

    const onMouseMove = (e: MouseEvent) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const rect = scrollEl.getBoundingClientRect();
      const pointerX = e.clientX - rect.left + scrollEl.scrollLeft;
      const pointerStartX = dragState.pointerStartX;
      const deltaSec = (pointerX - pointerStartX) / pps;

      if (dragState.kind === "playhead") {
        const t = (pointerX - TIMELINE_LEFT_PAD) / pps;
        setPlayhead(snapEnabled ? snapToGrid(t) : Math.max(0, t));
        return;
      }
      if (dragState.kind === "move") {
        const edges = neighborEdges(dragState.track, dragState.clipId);
        const rawStart = Math.max(0, dragState.clipStartTimeAtPointerDown + deltaSec);
        const newStart = snapTime(rawStart, edges);
        if (dragState.track === "image") updateImageClip(dragState.clipId, { startTime: newStart });
        else updateAudioClip(dragState.clipId, { startTime: newStart });
        return;
      }
      if (dragState.kind === "resize-right") {
        const clipStart = dragState.track === "image"
          ? imageClips.find((c) => c.id === dragState.clipId)?.startTime ?? 0
          : audioClips.find((c) => c.id === dragState.clipId)?.startTime ?? 0;
        const edges = neighborEdges(dragState.track, dragState.clipId);
        const rawEnd = clipStart + dragState.originalDuration + deltaSec;
        const snappedEnd = snapTime(rawEnd, edges);
        const newDuration = Math.max(0.1, snappedEnd - clipStart);
        if (dragState.track === "image") updateImageClip(dragState.clipId, { duration: newDuration });
        else updateAudioClip(dragState.clipId, { duration: newDuration });
        return;
      }
      if (dragState.kind === "resize-left") {
        const rightEdge = dragState.originalStart + dragState.originalDuration;
        const edges = neighborEdges(dragState.track, dragState.clipId);
        const rawStart = dragState.originalStart + deltaSec;
        const snapped = snapTime(rawStart, edges);
        const newStart = Math.max(0, Math.min(snapped, rightEdge - 0.1));
        const newDuration = Math.max(0.1, rightEdge - newStart);
        if (dragState.track === "image") {
          updateImageClip(dragState.clipId, { startTime: newStart, duration: newDuration });
        } else {
          updateAudioClip(dragState.clipId, { startTime: newStart, duration: newDuration });
        }
        return;
      }
    };

    const onMouseUp = () => {
      if (dragState && dragState.kind !== "playhead") scheduleSave();
      setDragState(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragState, pps, snapEnabled, imageClips, audioClips, setPlayhead, updateImageClip, updateAudioClip, scheduleSave]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      if (target?.closest(".modal")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) { e.preventDefault(); deleteSelected(); }
      } else if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
        if (selectedClipId) { e.preventDefault(); duplicateSelected(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedClipId, duplicateSelected, deleteSelected, togglePlay]);

  function pointerXInScroll(e: ReactMouseEvent | MouseEvent): number {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return 0;
    const rect = scrollEl.getBoundingClientRect();
    return e.clientX - rect.left + scrollEl.scrollLeft;
  }

  function startMove(track: TrackType, trackIndex: number, clipId: string, clipStart: number, e: ReactMouseEvent) {
    setDragState({
      kind: "move", track, trackIndex, clipId,
      pointerStartX: pointerXInScroll(e),
      clipStartTimeAtPointerDown: clipStart,
    });
  }
  function startResizeRight(track: TrackType, trackIndex: number, clipId: string, origDur: number, e: ReactMouseEvent) {
    setDragState({
      kind: "resize-right", track, trackIndex, clipId,
      pointerStartX: pointerXInScroll(e),
      originalDuration: origDur,
    });
  }
  function startResizeLeft(track: TrackType, trackIndex: number, clipId: string, origStart: number, origDur: number, e: ReactMouseEvent) {
    setDragState({
      kind: "resize-left", track, trackIndex, clipId,
      pointerStartX: pointerXInScroll(e),
      originalStart: origStart,
      originalDuration: origDur,
    });
  }
  function onRulerMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    const pointerX = pointerXInScroll(e);
    const t = (pointerX - TIMELINE_LEFT_PAD) / pps;
    setPlayhead(snapEnabled ? snapToGrid(t) : Math.max(0, t));
    setDragState({ kind: "playhead", pointerStartX: pointerX });
  }
  function onPlayheadMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    setDragState({ kind: "playhead", pointerStartX: pointerXInScroll(e) });
  }
  function onTrackDrop(e: DragEvent<HTMLDivElement>, track: TrackType, trackIndex: number) {
    e.preventDefault();
    setDragOverTrack(null);
    const assetId = e.dataTransfer.getData("application/x-asset-id");
    const assetType = e.dataTransfer.getData("application/x-asset-type") as TrackType;
    if (!assetId || assetType !== track) return;
    const pointerX = pointerXInScroll(e as unknown as ReactMouseEvent);
    const t = Math.max(0, snapToGrid((pointerX - TIMELINE_LEFT_PAD) / pps));
    if (track === "image") {
      addImageClip(assetId, t, trackIndex);
    } else {
      const asset = assets.find((a) => a.id === assetId);
      addAudioClip(assetId, t, asset?.duration ?? 5, trackIndex);
    }
  }
  function onTrackBackgroundMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) selectClip(null, null);
  }
  function selectTrackRow(type: TrackType, index: number) {
    setSelectedTrackRow({ type, index });
    selectClip(null, null);
  }
  function selectClipInTimeline(id: string, track: TrackType) {
    setSelectedTrackRow(null);
    selectClip(id, track);
  }
  function renameImageClip(id: string, name: string) {
    updateImageClip(id, { name });
    scheduleSave();
  }
  function renameAudioClip(id: string, name: string) {
    updateAudioClip(id, { name });
    scheduleSave();
  }
  function selectedTrackHidden() {
    if (!selectedTrackRow) return false;
    return selectedTrackRow.type === "image"
      ? hiddenImageTracks.includes(selectedTrackRow.index)
      : hiddenAudioTracks.includes(selectedTrackRow.index);
  }
  function selectedTrackCanDelete() {
    if (!selectedTrackRow) return false;
    return selectedTrackRow.type === "image" ? imageTrackCount > 1 : audioTrackCount > 1;
  }
  function toggleSelectedTrackHidden() {
    if (!selectedTrackRow) return;
    if (selectedTrackRow.type === "image") toggleImageTrackHidden(selectedTrackRow.index);
    else toggleAudioTrackHidden(selectedTrackRow.index);
  }
  function deleteSelectedTrackRow() {
    if (!selectedTrackRow || !selectedTrackCanDelete()) return;
    if (selectedTrackRow.type === "image") removeImageTrack(selectedTrackRow.index);
    else removeAudioTrack(selectedTrackRow.index);
    setSelectedTrackRow(null);
  }

  // Skip to previous/next clip boundary (image clip starts).
  function jumpPrev() {
    setPlaying(false);
    const starts = imageClips.map((c) => c.startTime).filter((t) => t < playheadTime - 0.05).sort((a, b) => b - a);
    setPlayhead(starts[0] ?? 0);
  }
  function jumpNext() {
    setPlaying(false);
    const starts = imageClips.map((c) => c.startTime).filter((t) => t > playheadTime + 0.05).sort((a, b) => a - b);
    setPlayhead(starts[0] ?? total);
  }

  const hasSelection = !!selectedClipId;
  const selectedImageClip = selectedTrack === "image"
    ? imageClips.find((c) => c.id === selectedClipId)
    : null;
  const selectedTrackLabel = selectedTrackRow
    ? `${selectedTrackRow.type === "image" ? "Image" : "Audio"} ${selectedTrackRow.index + 1}`
    : null;
  const isSelectedTrackHidden = selectedTrackHidden();

  const dragHoverKey = (track: TrackType, idx: number) => `${track}-${idx}`;

  return (
    <div className={`timeline-editor ${cutMode ? "cut-mode" : ""}`}>
      <div className="timeline-toolbar">
        <div className="toolbar-left">
          <button
            className={`toolbar-btn ${cutMode ? "active" : ""}`}
            onClick={toggleCutMode}
            title={cutMode ? "Disable cut tool" : "Cut clips"}
          >
            <IconScissors size={14} />
          </button>
          <button
            className="toolbar-btn"
            onClick={duplicateSelected}
            disabled={!hasSelection}
            title="Duplicate (⌘D)"
          >
            <IconDuplicate size={14} />
          </button>
          <button
            className="toolbar-btn danger"
            onClick={deleteSelected}
            disabled={!hasSelection}
            title="Delete (Del)"
          >
            <IconTrash size={14} />
          </button>
          {selectedImageClip && (
            <div className="selection-info">
              <label>Fit:</label>
              <select
                value={selectedImageClip.fitMode}
                onChange={(e) => {
                  updateImageClip(selectedImageClip.id, { fitMode: e.target.value as "cover" | "contain" });
                  scheduleSave();
                }}
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
              </select>
            </div>
          )}
          {selectedTrackRow && (
            <div className="selection-info track-selection-info">
              <span>{selectedTrackLabel}</span>
              <button
                className="toolbar-btn"
                onClick={toggleSelectedTrackHidden}
                title={isSelectedTrackHidden ? "Show track" : "Hide track"}
              >
                {isSelectedTrackHidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              </button>
              <button
                className="toolbar-btn danger"
                onClick={deleteSelectedTrackRow}
                disabled={!selectedTrackCanDelete()}
                title={selectedTrackCanDelete() ? "Delete track" : "At least one track is required"}
              >
                <IconTrash size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-center">
          <button
            className="toolbar-btn"
            onClick={jumpPrev}
            disabled={total <= 0}
            title="Previous clip"
          >
            <IconSkipBack size={14} />
          </button>
          <button
            className={`toolbar-btn play ${playing ? "playing" : ""}`}
            onClick={togglePlay}
            disabled={total <= 0}
            title={playing ? "Pause (Space)" : "Play (Space)"}
          >
            {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
          </button>
          <button
            className="toolbar-btn"
            onClick={jumpNext}
            disabled={total <= 0}
            title="Next clip"
          >
            <IconSkipForward size={14} />
          </button>
          <EditableTimecode
            current={playheadTime}
            total={total}
            onSeek={(t) => { setPlaying(false); setPlayhead(t); }}
          />
        </div>

        <div className="toolbar-right">
          <ZoomControl value={pps} onChange={setZoom} />
          <button
            type="button"
            className={`snap-toggle ${snapEnabled ? "on" : ""}`}
            onClick={toggleSnap}
            title="Toggle snapping"
          >
            Snap <span className="switch" />
          </button>
        </div>
      </div>

      <div className="timeline-body">
        <div className="timeline-labels">
          <div className="timeline-label-ruler" />
          <button
            className="add-track-btn"
            onClick={addImageTrack}
            title="Add image track above"
          >
            <span className="plus">+</span>
          </button>
          {Array.from({ length: imageTrackCount }).map((_, i) => {
            const idx = imageTrackCount - 1 - i;
            const hidden = hiddenImageTracks.includes(idx);
            const selected = selectedTrackRow?.type === "image" && selectedTrackRow.index === idx;
            return (
              <button
                type="button"
                className={`timeline-label-cell track-label-btn ${selected ? "selected" : ""} ${hidden ? "hidden" : ""}`}
                key={`img-${idx}`}
                title={`Select image track ${idx + 1}`}
                onClick={() => selectTrackRow("image", idx)}
              >
                {hidden ? <IconEyeOff size={15} /> : <IconFilm size={16} />}
              </button>
            );
          })}
          <button
            className="add-track-btn"
            onClick={addAudioTrack}
            title="Add audio track above"
          >
            <span className="plus">+</span>
          </button>
          {Array.from({ length: audioTrackCount }).map((_, i) => {
            const idx = audioTrackCount - 1 - i;
            const hidden = hiddenAudioTracks.includes(idx);
            const selected = selectedTrackRow?.type === "audio" && selectedTrackRow.index === idx;
            return (
              <button
                type="button"
                className={`timeline-label-cell track-label-btn ${selected ? "selected" : ""} ${hidden ? "hidden" : ""}`}
                key={`aud-${idx}`}
                title={`Select audio track ${idx + 1}`}
                onClick={() => selectTrackRow("audio", idx)}
              >
                {hidden ? <IconEyeOff size={15} /> : <IconVolume size={16} />}
              </button>
            );
          })}
        </div>
        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-tracks" style={{ width: trackWidth }}>
            <div onMouseDown={onRulerMouseDown}>
              <TimelineRuler
                totalSeconds={minSeconds}
                pixelsPerSecond={pps}
                width={trackWidth}
                leftPad={TIMELINE_LEFT_PAD}
              />
            </div>

            <div className="add-track-row" />
            {Array.from({ length: imageTrackCount }).map((_, i) => {
              const idx = imageTrackCount - 1 - i;
              const key = dragHoverKey("image", idx);
              const hidden = hiddenImageTracks.includes(idx);
              return (
                <div
                  key={`img-${idx}`}
                  className={`timeline-track image ${dragOverTrack === key ? "drag-over" : ""} ${hidden ? "hidden-track" : ""}`}
                  onMouseDown={onTrackBackgroundMouseDown}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    if (e.dataTransfer.types.includes("application/x-asset-type")) setDragOverTrack(key);
                  }}
                  onDragLeave={() => setDragOverTrack((cur) => (cur === key ? null : cur))}
                  onDrop={(e) => onTrackDrop(e, "image", idx)}
                >
                  {imageClips
                    .filter((c) => c.trackIndex === idx)
                    .filter(() => !hidden)
                    .map((c) => {
                      const asset = assets.find((a) => a.id === c.assetId);
                      return (
                        <TimelineClip
                          key={c.id}
                          id={c.id}
                          startTime={c.startTime}
                          duration={c.duration}
                          pixelsPerSecond={pps}
                          leftPad={TIMELINE_LEFT_PAD}
                          trackType="image"
                          label={c.name || asset?.filename || "(missing)"}
                          thumbUrl={asset?.url}
                          isSelected={selectedClipId === c.id && selectedTrack === "image"}
                          cutMode={cutMode}
                          onBodyMouseDown={(e) => startMove("image", idx, c.id, c.startTime, e)}
                          onLeftHandleMouseDown={(e) => startResizeLeft("image", idx, c.id, c.startTime, c.duration, e)}
                          onRightHandleMouseDown={(e) => startResizeRight("image", idx, c.id, c.duration, e)}
                          onSelect={() => selectClipInTimeline(c.id, "image")}
                          onDelete={() => removeImageClip(c.id)}
                          onRename={(name) => renameImageClip(c.id, name)}
                          onCut={(cutTime) => cutImageClip(c.id, cutTime)}
                        />
                      );
                    })}
                </div>
              );
            })}

            <div className="add-track-row" />
            {Array.from({ length: audioTrackCount }).map((_, i) => {
              const idx = audioTrackCount - 1 - i;
              const key = dragHoverKey("audio", idx);
              const hidden = hiddenAudioTracks.includes(idx);
              return (
                <div
                  key={`aud-${idx}`}
                  className={`timeline-track audio ${dragOverTrack === key ? "drag-over" : ""} ${hidden ? "hidden-track" : ""}`}
                  onMouseDown={onTrackBackgroundMouseDown}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    if (e.dataTransfer.types.includes("application/x-asset-type")) setDragOverTrack(key);
                  }}
                  onDragLeave={() => setDragOverTrack((cur) => (cur === key ? null : cur))}
                  onDrop={(e) => onTrackDrop(e, "audio", idx)}
                >
                  {audioClips
                    .filter((c) => c.trackIndex === idx)
                    .filter(() => !hidden)
                    .map((c) => {
                      const asset = assets.find((a) => a.id === c.assetId);
                      return (
                        <TimelineClip
                          key={c.id}
                          id={c.id}
                          startTime={c.startTime}
                          duration={c.duration}
                          pixelsPerSecond={pps}
                          leftPad={TIMELINE_LEFT_PAD}
                          trackType="audio"
                          label={c.name || asset?.filename || "(missing)"}
                          waveformUrl={`/api/assets/${c.assetId}/waveform`}
                          isSelected={selectedClipId === c.id && selectedTrack === "audio"}
                          cutMode={cutMode}
                          onBodyMouseDown={(e) => startMove("audio", idx, c.id, c.startTime, e)}
                          onLeftHandleMouseDown={(e) => startResizeLeft("audio", idx, c.id, c.startTime, c.duration, e)}
                          onRightHandleMouseDown={(e) => startResizeRight("audio", idx, c.id, c.duration, e)}
                          onSelect={() => selectClipInTimeline(c.id, "audio")}
                          onDelete={() => removeAudioClip(c.id)}
                          onRename={(name) => renameAudioClip(c.id, name)}
                          onCut={(cutTime) => cutAudioClip(c.id, cutTime)}
                        />
                      );
                    })}
                </div>
              );
            })}

            <div className="playhead" style={{ left: TIMELINE_LEFT_PAD + playheadTime * pps }}>
              <div className="playhead-head" onMouseDown={onPlayheadMouseDown} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
