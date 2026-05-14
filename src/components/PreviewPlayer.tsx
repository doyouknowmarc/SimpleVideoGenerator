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
  // Tracks clips whose audio playback has been successfully started.
  // We only do drift-correction on these, not seek-and-play (which races).
  const startedRef = useRef<Set<string>>(new Set());
  // Tracks clips whose start() promise is currently in flight, so the
  // effect doesn't kick off the same clip multiple times.
  const startingRef = useRef<Set<string>>(new Set());

  const total = computeTotalDuration(imageClips, audioClips);

  // Topmost image clip at playheadTime
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

  // Single source of truth for audio playback. The key insight is that
  // setting `el.currentTime` is asynchronous (browsers fire a `seeked`
  // event when the seek completes), so calling `play()` immediately
  // after a seek can race and start playback from the wrong position
  // — which is the "starts mid-clip but plays nothing" bug. We resolve
  // that by awaiting `seeked` before `play()`, and by tracking which
  // clips have been "started" so the per-frame drift-correction
  // doesn't re-trigger kickoff.
  useEffect(() => {
    // Not playing → pause everything we started, reset.
    if (!playing) {
      for (const id of startedRef.current) {
        const el = audioRefs.current[id];
        if (el && !el.paused) el.pause();
      }
      startedRef.current.clear();
      // Don't clear startingRef — those promises may still resolve and need cleanup.
      return;
    }

    // Playing → ensure each clip is either kicked off or drift-corrected.
    for (const clip of audioClips) {
      const el = audioRefs.current[clip.id];
      if (!el) continue;
      const inside = playheadTime >= clip.startTime && playheadTime < clip.startTime + clip.duration;

      if (!inside) {
        // Clip just exited the playhead window.
        if (startedRef.current.has(clip.id)) {
          if (!el.paused) el.pause();
          startedRef.current.delete(clip.id);
        }
        continue;
      }

      const offset = Math.max(0, playheadTime - clip.startTime);

      if (startedRef.current.has(clip.id)) {
        // Already playing — only seek if drift is significant and we're not already seeking.
        if (Math.abs(el.currentTime - offset) > 0.4 && !el.seeking) {
          try { el.currentTime = offset; } catch { /* ignore */ }
        }
        continue;
      }

      if (startingRef.current.has(clip.id)) continue; // kickoff in flight

      // Kick off this clip's playback.
      startingRef.current.add(clip.id);
      const clipId = clip.id;
      void (async () => {
        try {
          // Wait for metadata if needed
          if (el.readyState < 1) {
            await new Promise<void>((resolve) => {
              const onReady = () => { cleanup(); resolve(); };
              const cleanup = () => {
                el.removeEventListener("loadedmetadata", onReady);
                el.removeEventListener("error", onReady);
              };
              el.addEventListener("loadedmetadata", onReady);
              el.addEventListener("error", onReady);
              try { el.load(); } catch { /* ignore */ }
              setTimeout(() => { cleanup(); resolve(); }, 2000);
            });
          }

          const currentOffset = () => {
            const state = useTimeline.getState();
            const latestClip = state.audioClips.find((c) => c.id === clipId);
            if (!state.playing || !latestClip || audioRefs.current[clipId] !== el) return null;
            const nextOffset = state.playheadTime - latestClip.startTime;
            if (nextOffset < 0 || nextOffset >= latestClip.duration) return null;
            return Math.max(0, nextOffset);
          };

          let latestOffset = currentOffset();
          if (latestOffset == null) return;

          // Seek and wait for seek to complete
          if (Math.abs(el.currentTime - latestOffset) > 0.05) {
            try { el.currentTime = latestOffset; } catch { /* ignore */ }
            if (el.seeking) {
              await new Promise<void>((resolve) => {
                const onSeeked = () => { el.removeEventListener("seeked", onSeeked); resolve(); };
                el.addEventListener("seeked", onSeeked);
                setTimeout(() => { el.removeEventListener("seeked", onSeeked); resolve(); }, 500);
              });
            }
          }

          latestOffset = currentOffset();
          if (latestOffset == null) return;
          if (Math.abs(el.currentTime - latestOffset) > 0.05 && !el.seeking) {
            try { el.currentTime = latestOffset; } catch { /* ignore */ }
          }

          await el.play();
          if (currentOffset() == null) {
            el.pause();
            return;
          }
          startedRef.current.add(clipId);
        } catch { /* autoplay restrictions or interrupted seek: silently ignore */ }
        finally {
          startingRef.current.delete(clipId);
        }
      })();
    }
  }, [playing, audioClips, playheadTime]);

  // Clean up unrendered clips' refs on unmount
  useEffect(() => () => {
    for (const id in audioRefs.current) {
      const el = audioRefs.current[id];
      if (el && !el.paused) el.pause();
    }
  }, []);

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
