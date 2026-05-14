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
  IconZoom, IconFilm, IconVolume, IconPlay, IconPause,
  IconSkipBack, IconSkipForward, IconDuplicate, IconTrash,
} from "./icons";

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

export function TimelineEditor() {
  const imageClips = useTimeline((s) => s.imageClips);
  const audioClips = useTimeline((s) => s.audioClips);
  const assets = useTimeline((s) => s.assets);
  const imageTrackCount = useTimeline((s) => s.imageTrackCount);
  const audioTrackCount = useTimeline((s) => s.audioTrackCount);
  const playheadTime = useTimeline((s) => s.playheadTime);
  const playing = useTimeline((s) => s.playing);
  const togglePlay = useTimeline((s) => s.togglePlay);
  const setPlaying = useTimeline((s) => s.setPlaying);
  const selectedClipId = useTimeline((s) => s.selectedClipId);
  const selectedTrack = useTimeline((s) => s.selectedTrack);
  const pps = useTimeline((s) => s.pixelsPerSecond);
  const snapEnabled = useTimeline((s) => s.snapEnabled);
  const toggleSnap = useTimeline((s) => s.toggleSnap);

  const updateImageClip = useTimeline((s) => s.updateImageClip);
  const updateAudioClip = useTimeline((s) => s.updateAudioClip);
  const removeImageClip = useTimeline((s) => s.removeImageClip);
  const removeAudioClip = useTimeline((s) => s.removeAudioClip);
  const addImageClip = useTimeline((s) => s.addImageClip);
  const addAudioClip = useTimeline((s) => s.addAudioClip);
  const addImageTrack = useTimeline((s) => s.addImageTrack);
  const addAudioTrack = useTimeline((s) => s.addAudioTrack);
  const setPlayhead = useTimeline((s) => s.setPlayhead);
  const selectClip = useTimeline((s) => s.selectClip);
  const setZoom = useTimeline((s) => s.setZoom);
  const scheduleSave = useTimeline((s) => s.scheduleSave);
  const duplicateSelected = useTimeline((s) => s.duplicateSelected);
  const deleteSelected = useTimeline((s) => s.deleteSelected);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dragOverTrack, setDragOverTrack] = useState<string | null>(null);

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

  const dragHoverKey = (track: TrackType, idx: number) => `${track}-${idx}`;

  return (
    <div className="timeline-editor">
      <div className="timeline-toolbar">
        <div className="toolbar-left">
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
          <div className="zoom-control">
            <IconZoom />
            <input
              type="range"
              min={2}
              max={400}
              step={1}
              value={pps}
              onChange={(e) => setZoom(Number(e.target.value))}
              title={`Zoom: ${pps} px/s`}
            />
          </div>
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
          {Array.from({ length: imageTrackCount }).map((_, idx) => (
            <div className="timeline-label-cell" key={`img-${idx}`} title={`Image track ${idx + 1}`}>
              <IconFilm size={16} />
            </div>
          ))}
          <button
            className="add-track-btn"
            onClick={addImageTrack}
            title="Add image track"
          >
            <span className="plus">+</span>
          </button>
          {Array.from({ length: audioTrackCount }).map((_, idx) => (
            <div className="timeline-label-cell" key={`aud-${idx}`} title={`Audio track ${idx + 1}`}>
              <IconVolume size={16} />
            </div>
          ))}
          <button
            className="add-track-btn"
            onClick={addAudioTrack}
            title="Add audio track"
          >
            <span className="plus">+</span>
          </button>
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

            {Array.from({ length: imageTrackCount }).map((_, idx) => {
              const key = dragHoverKey("image", idx);
              return (
                <div
                  key={`img-${idx}`}
                  className={`timeline-track image ${dragOverTrack === key ? "drag-over" : ""}`}
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
                          label={asset?.filename ?? "(missing)"}
                          thumbUrl={asset?.url}
                          isSelected={selectedClipId === c.id && selectedTrack === "image"}
                          onBodyMouseDown={(e) => startMove("image", idx, c.id, c.startTime, e)}
                          onLeftHandleMouseDown={(e) => startResizeLeft("image", idx, c.id, c.startTime, c.duration, e)}
                          onRightHandleMouseDown={(e) => startResizeRight("image", idx, c.id, c.duration, e)}
                          onSelect={() => selectClip(c.id, "image")}
                          onDelete={() => removeImageClip(c.id)}
                        />
                      );
                    })}
                </div>
              );
            })}
            <div className="add-track-row" />

            {Array.from({ length: audioTrackCount }).map((_, idx) => {
              const key = dragHoverKey("audio", idx);
              return (
                <div
                  key={`aud-${idx}`}
                  className={`timeline-track audio ${dragOverTrack === key ? "drag-over" : ""}`}
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
                          label={asset?.filename ?? "(missing)"}
                          isSelected={selectedClipId === c.id && selectedTrack === "audio"}
                          onBodyMouseDown={(e) => startMove("audio", idx, c.id, c.startTime, e)}
                          onLeftHandleMouseDown={(e) => startResizeLeft("audio", idx, c.id, c.startTime, c.duration, e)}
                          onRightHandleMouseDown={(e) => startResizeRight("audio", idx, c.id, c.duration, e)}
                          onSelect={() => selectClip(c.id, "audio")}
                          onDelete={() => removeAudioClip(c.id)}
                        />
                      );
                    })}
                </div>
              );
            })}
            <div className="add-track-row" />

            <div className="playhead" style={{ left: TIMELINE_LEFT_PAD + playheadTime * pps }}>
              <div className="playhead-head" onMouseDown={onPlayheadMouseDown} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
