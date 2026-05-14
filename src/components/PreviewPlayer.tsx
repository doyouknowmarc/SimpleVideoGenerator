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
  const prevPlayingRef = useRef<boolean>(playing);

  const total = computeTotalDuration(imageClips, audioClips);

  // Active image clip: among all clips covering playheadTime, take the highest trackIndex.
  const activeImageClip = imageClips
    .filter((c) => playheadTime >= c.startTime && playheadTime < c.startTime + c.duration)
    .reduce<typeof imageClips[number] | null>(
      (best, c) => (best == null || c.trackIndex > best.trackIndex ? c : best),
      null,
    );
  const activeImage = activeImageClip
    ? assets.find((a) => a.id === activeImageClip.assetId)
    : null;

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

  // Explicit play/pause kickoff when `playing` toggles.
  // Seeks each audio element to the correct offset, waits for readyState
  // if needed, then starts playback. This fixes "playhead in middle of
  // clip → audio doesn't play" because the prior gentle-sync was racing
  // with seek completion.
  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = playing;

    if (playing && !wasPlaying) {
      const t = useTimeline.getState().playheadTime;
      for (const clip of audioClips) {
        const inside = t >= clip.startTime && t < clip.startTime + clip.duration;
        if (!inside) continue;
        const el = audioRefs.current[clip.id];
        if (!el) continue;
        const offset = Math.max(0, t - clip.startTime);
        const start = () => {
          try { el.currentTime = offset; } catch { /* ignore */ }
          el.play().catch(() => { /* autoplay restrictions: silently ignore */ });
        };
        if (el.readyState >= 1) {
          start();
        } else {
          const onLoaded = () => {
            el.removeEventListener("loadedmetadata", onLoaded);
            start();
          };
          el.addEventListener("loadedmetadata", onLoaded);
          try { el.load(); } catch { /* ignore */ }
        }
      }
    } else if (!playing && wasPlaying) {
      // Pause everything when stopping
      for (const id in audioRefs.current) {
        const el = audioRefs.current[id];
        if (el && !el.paused) el.pause();
      }
    }
  }, [playing, audioClips]);

  // Continuous sync while playing: bring elements in/out as clips
  // enter/exit the active range, correct drift, and pause everything
  // when not playing.
  useEffect(() => {
    for (const clip of audioClips) {
      const el = audioRefs.current[clip.id];
      if (!el) continue;
      const inside = playheadTime >= clip.startTime && playheadTime < clip.startTime + clip.duration;
      if (!inside) {
        if (!el.paused) el.pause();
        continue;
      }
      const offset = Math.max(0, playheadTime - clip.startTime);
      if (playing) {
        if (el.paused) {
          try { el.currentTime = offset; } catch { /* ignore */ }
          el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - offset) > 0.3) {
          try { el.currentTime = offset; } catch { /* ignore */ }
        }
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - offset) > 0.3) {
          try { el.currentTime = offset; } catch { /* ignore */ }
        }
      }
    }
  }, [audioClips, playheadTime, playing]);

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
