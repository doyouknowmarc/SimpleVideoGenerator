"use client";
import { useEffect, useRef, useState } from "react";
import { useTimeline } from "@/state/timelineStore";
import { withStartTimes, totalDuration } from "@/lib/timelineCalc";

function fmt(t: number) {
  if (!isFinite(t)) return "0:00.0";
  const m = Math.floor(t / 60);
  const s = (t - m * 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

export function PreviewPlayer() {
  const items = useTimeline((s) => s.items);
  const assets = useTimeline((s) => s.assets);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const activeAudioRef = useRef<string | null>(null);

  const scenes = withStartTimes(items);
  const total = totalDuration(items);

  function currentScene() {
    if (scenes.length === 0) return null;
    for (const s of scenes) {
      if (time >= s.startTime && time < s.startTime + s.duration) return s;
    }
    return scenes[scenes.length - 1];
  }

  const scene = currentScene();
  const image = scene ? assets.find((a) => a.id === scene.imageAssetId) : null;
  const audioAssetId = scene?.audioAssetId ?? null;

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
      setTime((t) => {
        const next = t + dt;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, total]);

  useEffect(() => {
    const prev = activeAudioRef.current;
    if (prev && prev !== audioAssetId) {
      const el = audioRefs.current[prev];
      if (el) { el.pause(); el.currentTime = 0; }
    }
    if (playing && audioAssetId && scene) {
      const el = audioRefs.current[audioAssetId];
      if (el) {
        const offset = Math.max(0, time - scene.startTime);
        if (Math.abs(el.currentTime - offset) > 0.25) el.currentTime = offset;
        el.play().catch(() => {});
      }
    } else if (!playing && audioAssetId) {
      const el = audioRefs.current[audioAssetId];
      if (el) el.pause();
    }
    activeAudioRef.current = audioAssetId;
  }, [audioAssetId, playing, scene?.startTime, time, scene]);

  function togglePlay() {
    if (total <= 0) return;
    if (time >= total) setTime(0);
    setPlaying((p) => !p);
  }

  function seek(pct: number) {
    const t = Math.max(0, Math.min(total, total * pct));
    setTime(t);
  }

  const audioAssets = assets.filter((a) => a.type === "audio");

  return (
    <div>
      <div className="preview">
        {image ? (
          <img src={image.url} className={scene?.fitMode === "cover" ? "cover" : "contain"} alt="" />
        ) : (
          <div className="preview-empty">No scenes yet — add an image from the sidebar.</div>
        )}
      </div>
      <div className="preview-controls">
        <button className="btn" onClick={togglePlay} disabled={total <= 0}>
          {playing ? "Pause" : time >= total && total > 0 ? "Replay" : "Play"}
        </button>
        <div
          className="timebar"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            seek((e.clientX - rect.left) / rect.width);
          }}
        >
          <div className="timebar-fill" style={{ width: `${total > 0 ? (time / total) * 100 : 0}%` }} />
        </div>
        <div className="time-label">{fmt(time)} / {fmt(total)}</div>
      </div>
      {audioAssets.map((a) => (
        <audio
          key={a.id}
          ref={(el) => { audioRefs.current[a.id] = el; }}
          src={a.url}
          preload="auto"
        />
      ))}
    </div>
  );
}
