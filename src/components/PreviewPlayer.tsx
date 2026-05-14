"use client";
import { useEffect, useRef } from "react";
import { useTimeline } from "@/state/timelineStore";
import { computeTotalDuration } from "@/lib/timelineHelpers";

export function PreviewPlayer() {
  const imageClips = useTimeline((s) => s.imageClips);
  const audioClips = useTimeline((s) => s.audioClips);
  const assets = useTimeline((s) => s.assets);
  const playheadTime = useTimeline((s) => s.playheadTime);
  const setPlayhead = useTimeline((s) => s.setPlayhead);
  const playing = useTimeline((s) => s.playing);
  const setPlaying = useTimeline((s) => s.setPlaying);

  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const activeClipsRef = useRef<Set<string>>(new Set());

  const total = computeTotalDuration(imageClips, audioClips);

  const activeImageClip = [...imageClips]
    .reverse()
    .find((c) => playheadTime >= c.startTime && playheadTime < c.startTime + c.duration);
  const activeImage = activeImageClip
    ? assets.find((a) => a.id === activeImageClip.assetId)
    : null;

  const activeAudioClips = audioClips.filter(
    (c) => playheadTime >= c.startTime && playheadTime < c.startTime + c.duration,
  );

  // Playback loop, driven by store's `playing`
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastFrameRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      const cur = useTimeline.getState().playheadTime;
      const next = cur + dt;
      if (next >= total) {
        setPlayhead(total);
        setPlaying(false);
        return;
      }
      setPlayhead(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, total, setPlayhead, setPlaying]);

  // Audio sync
  useEffect(() => {
    const activeIds = new Set(activeAudioClips.map((c) => c.id));
    for (const id of activeClipsRef.current) {
      if (!activeIds.has(id)) {
        const el = audioRefs.current[id];
        if (el) {
          el.pause();
          el.currentTime = 0;
        }
      }
    }
    for (const clip of activeAudioClips) {
      const el = audioRefs.current[clip.id];
      if (!el) continue;
      const offset = Math.max(0, playheadTime - clip.startTime);
      if (Math.abs(el.currentTime - offset) > 0.2) {
        try { el.currentTime = offset; } catch { /* ignore */ }
      }
      if (playing) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    }
    activeClipsRef.current = activeIds;
  }, [activeAudioClips, playing, playheadTime]);

  return (
    <>
      <div className="preview-stage">
        {activeImage ? (
          <img
            src={activeImage.url}
            className={activeImageClip?.fitMode === "cover" ? "cover" : "contain"}
            alt=""
          />
        ) : (
          <div className="preview-empty">
            {imageClips.length === 0
              ? "Add media and drag it to the timeline to preview"
              : "(no image at this time)"}
          </div>
        )}
      </div>
      {audioClips.map((c) => {
        const asset = assets.find((a) => a.id === c.assetId);
        if (!asset) return null;
        return (
          <audio
            key={c.id}
            ref={(el) => { audioRefs.current[c.id] = el; }}
            src={asset.url}
            preload="auto"
          />
        );
      })}
    </>
  );
}
