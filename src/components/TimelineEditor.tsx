"use client";
import { useEffect, useRef, useState } from "react";
import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { useTimeline } from "@/state/timelineStore";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineClip } from "./TimelineClip";
import { computeTotalDuration, snapToGrid } from "@/lib/timelineHelpers";
import type { TrackType } from "@/types";
import {
  IconZoom, IconFilm, IconVolume, IconPlay, IconPause,
  IconSkipBack, IconSkipForward, IconDuplicate, IconTrash,
} from "./icons";

type MoveDrag = {
  kind: "move";
  track: TrackType;
  clipId: string;
  pointerStartX: number;
  clipStartTimeAtPointerDown: number;
};
type ResizeRightDrag = {
  kind: "resize-right";
  track: TrackType;
  clipId: string;
  pointerStartX: number;
  originalDuration: number;
};
type ResizeLeftDrag = {
  kind: "resize-left";
  track: TrackType;
  clipId: string;
  pointerStartX: number;
  originalStart: number;
  originalDuration: number;
};
type PlayheadDrag = { kind: "playhead"; pointerStartX: number };
type DragState = MoveDrag | ResizeRightDrag | ResizeLeftDrag | PlayheadDrag | null;

function fmtTimecode(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const totalSec = Math.floor(t);
  const ms = t - totalSec;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const frames = Math.floor(ms * 30);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(frames)}`;
}

export function TimelineEditor() {
  const imageClips = useTimeline((s) => s.imageClips);
  const audioClips = useTimeline((s) => s.audioClips);
  const assets = useTimeline((s) => s.assets);
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
  const setPlayhead = useTimeline((s) => s.setPlayhead);
  const selectClip = useTimeline((s) => s.selectClip);
  const setZoom = useTimeline((s) => s.setZoom);
  const scheduleSave = useTimeline((s) => s.scheduleSave);
  const duplicateSelected = useTimeline((s) => s.duplicateSelected);
  const deleteSelected = useTimeline((s) => s.deleteSelected);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [imgDragOver, setImgDragOver] = useState(false);
  const [audDragOver, setAudDragOver] = useState(false);

  const total = computeTotalDuration(imageClips, audioClips);
  const minSeconds = Math.max(total + 5, 30);
  const containerWidth = scrollRef.current?.clientWidth ?? 800;
  const trackWidth = Math.max(minSeconds * pps, containerWidth);

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
        const t = snapEnabled ? snapToGrid(pointerX / pps) : Math.max(0, pointerX / pps);
        setPlayhead(t);
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

  // Keyboard shortcuts
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

  function startMove(track: TrackType, clipId: string, clipStart: number, e: ReactMouseEvent) {
    setDragState({
      kind: "move", track, clipId,
      pointerStartX: pointerXInScroll(e),
      clipStartTimeAtPointerDown: clipStart,
    });
  }
  function startResizeRight(track: TrackType, clipId: string, origDur: number, e: ReactMouseEvent) {
    setDragState({
      kind: "resize-right", track, clipId,
      pointerStartX: pointerXInScroll(e),
      originalDuration: origDur,
    });
  }
  function startResizeLeft(track: TrackType, clipId: string, origStart: number, origDur: number, e: ReactMouseEvent) {
    setDragState({
      kind: "resize-left", track, clipId,
      pointerStartX: pointerXInScroll(e),
      originalStart: origStart,
      originalDuration: origDur,
    });
  }
  function onRulerMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    const pointerX = pointerXInScroll(e);
    setPlayhead(snapEnabled ? snapToGrid(pointerX / pps) : Math.max(0, pointerX / pps));
    setDragState({ kind: "playhead", pointerStartX: pointerX });
  }
  function onPlayheadMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    setDragState({ kind: "playhead", pointerStartX: pointerXInScroll(e) });
  }
  function onTrackDrop(e: DragEvent<HTMLDivElement>, track: TrackType) {
    e.preventDefault();
    setImgDragOver(false);
    setAudDragOver(false);
    const assetId = e.dataTransfer.getData("application/x-asset-id");
    const assetType = e.dataTransfer.getData("application/x-asset-type") as TrackType;
    if (!assetId || assetType !== track) return;
    const pointerX = pointerXInScroll(e as unknown as ReactMouseEvent);
    const t = snapToGrid(pointerX / pps);
    if (track === "image") {
      addImageClip(assetId, t);
    } else {
      const asset = assets.find((a) => a.id === assetId);
      addAudioClip(assetId, t, asset?.duration ?? 5);
    }
  }
  function onTrackBackgroundMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) selectClip(null, null);
  }
  function jumpStart() { setPlaying(false); setPlayhead(0); }
  function jumpEnd() { setPlaying(false); setPlayhead(total); }

  const hasSelection = !!selectedClipId;
  const selectedImageClip = selectedTrack === "image"
    ? imageClips.find((c) => c.id === selectedClipId)
    : null;

  return (
    <div className="timeline-editor">
      <div className="timeline-toolbar">
        {/* Transport */}
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={jumpStart} disabled={total <= 0} title="Jump to start">
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
          <button className="toolbar-btn" onClick={jumpEnd} disabled={total <= 0} title="Jump to end">
            <IconSkipForward size={14} />
          </button>
          <span className="timecode toolbar-timecode">
            {fmtTimecode(playheadTime)} / {fmtTimecode(total)}
          </span>
        </div>

        <div className="toolbar-separator" />

        {/* Selection actions */}
        <div className="toolbar-group">
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
        </div>

        {selectedImageClip && (
          <>
            <div className="toolbar-separator" />
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
          </>
        )}

        <div className="toolbar-spacer" />

        {/* Zoom */}
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

        <div className="toolbar-separator" />

        {/* Snap toggle */}
        <button
          type="button"
          className={`snap-toggle ${snapEnabled ? "on" : ""}`}
          onClick={toggleSnap}
          title="Toggle snapping"
        >
          Snap <span className="switch" />
        </button>
      </div>

      <div className="timeline-body">
        <div className="timeline-labels">
          <div className="timeline-label-ruler" />
          <div className="timeline-label-cell" title="Image track"><IconFilm size={16} /></div>
          <div className="timeline-label-cell" title="Audio track"><IconVolume size={16} /></div>
        </div>
        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-tracks" style={{ width: trackWidth }}>
            <div onMouseDown={onRulerMouseDown}>
              <TimelineRuler totalSeconds={minSeconds} pixelsPerSecond={pps} width={trackWidth} />
            </div>
            <div
              className={`timeline-track image ${imgDragOver ? "drag-over" : ""}`}
              onMouseDown={onTrackBackgroundMouseDown}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (e.dataTransfer.types.includes("application/x-asset-type")) setImgDragOver(true);
              }}
              onDragLeave={() => setImgDragOver(false)}
              onDrop={(e) => onTrackDrop(e, "image")}
            >
              {imageClips.map((c) => {
                const asset = assets.find((a) => a.id === c.assetId);
                return (
                  <TimelineClip
                    key={c.id}
                    id={c.id}
                    startTime={c.startTime}
                    duration={c.duration}
                    pixelsPerSecond={pps}
                    trackType="image"
                    label={asset?.filename ?? "(missing)"}
                    thumbUrl={asset?.url}
                    isSelected={selectedClipId === c.id && selectedTrack === "image"}
                    onBodyMouseDown={(e) => startMove("image", c.id, c.startTime, e)}
                    onLeftHandleMouseDown={(e) => startResizeLeft("image", c.id, c.startTime, c.duration, e)}
                    onRightHandleMouseDown={(e) => startResizeRight("image", c.id, c.duration, e)}
                    onSelect={() => selectClip(c.id, "image")}
                    onDelete={() => removeImageClip(c.id)}
                  />
                );
              })}
            </div>
            <div
              className={`timeline-track audio ${audDragOver ? "drag-over" : ""}`}
              onMouseDown={onTrackBackgroundMouseDown}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (e.dataTransfer.types.includes("application/x-asset-type")) setAudDragOver(true);
              }}
              onDragLeave={() => setAudDragOver(false)}
              onDrop={(e) => onTrackDrop(e, "audio")}
            >
              {audioClips.map((c) => {
                const asset = assets.find((a) => a.id === c.assetId);
                return (
                  <TimelineClip
                    key={c.id}
                    id={c.id}
                    startTime={c.startTime}
                    duration={c.duration}
                    pixelsPerSecond={pps}
                    trackType="audio"
                    label={asset?.filename ?? "(missing)"}
                    isSelected={selectedClipId === c.id && selectedTrack === "audio"}
                    onBodyMouseDown={(e) => startMove("audio", c.id, c.startTime, e)}
                    onLeftHandleMouseDown={(e) => startResizeLeft("audio", c.id, c.startTime, c.duration, e)}
                    onRightHandleMouseDown={(e) => startResizeRight("audio", c.id, c.duration, e)}
                    onSelect={() => selectClip(c.id, "audio")}
                    onDelete={() => removeAudioClip(c.id)}
                  />
                );
              })}
            </div>
            <div className="playhead" style={{ left: playheadTime * pps }}>
              <div className="playhead-head" onMouseDown={onPlayheadMouseDown} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
