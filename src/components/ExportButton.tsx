"use client";
import { useEffect, useRef, useState } from "react";
import { useTimeline } from "@/state/timelineStore";
import { validateClipsForRender, computeTotalDuration } from "@/lib/timelineHelpers";

type Job = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  videoUrl?: string;
  errorMessage?: string;
};

export function ExportButton() {
  const projectId = useTimeline((s) => s.projectId);
  const imageClips = useTimeline((s) => s.imageClips);
  const audioClips = useTimeline((s) => s.audioClips);
  const saveNow = useTimeline((s) => s.saveNow);

  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const errs = validateClipsForRender(imageClips, audioClips);
  const total = computeTotalDuration(imageClips, audioClips);
  const inProgress = job?.status === "queued" || job?.status === "running";

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function poll(jobId: string) {
    const res = await fetch(`/api/render/${jobId}`, { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as Job;
    setJob(j);
    if (j.status === "completed" || j.status === "failed") {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function startRender() {
    if (!projectId) return;
    setErr(null);
    setStarting(true);
    setJob(null);
    setShowPopover(true);
    try {
      await saveNow();
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "render failed to start");
      setJob({ id: j.jobId, status: "queued", progress: 0 });
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => { void poll(j.jobId); }, 1000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const buttonLabel = starting
    ? "Starting…"
    : inProgress
    ? `Rendering ${Math.round((job?.progress ?? 0) * 100)}%`
    : "Export MP4";

  return (
    <div className="export-wrap">
      <button
        className="btn"
        onClick={() => {
          if (errs.length === 0 && !inProgress) startRender();
          else setShowPopover((v) => !v);
        }}
        disabled={starting || inProgress || errs.length > 0}
        title={errs.length > 0 ? errs.join(" ") : "Render the timeline as MP4"}
      >
        {buttonLabel}
      </button>
      {showPopover && (job || err || errs.length > 0) && (
        <div className="export-popover">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Export</div>
            <button className="btn ghost" onClick={() => setShowPopover(false)}>×</button>
          </div>
          <div style={{ color: "#8a93a3", fontSize: 12, marginTop: 4 }}>
            {imageClips.length} image · {audioClips.length} audio · {total.toFixed(1)}s · 1920×1080
          </div>
          {errs.length > 0 && <div className="error">{errs.join(" ")}</div>}
          {err && <div className="error">{err}</div>}
          {job && (
            <>
              <div style={{ fontSize: 12, color: "#8a93a3", marginTop: 8 }}>
                Status: {job.status} · {Math.round(job.progress * 100)}%
              </div>
              <div className="progress"><div className="progress-fill" style={{ width: `${Math.round(job.progress * 100)}%` }} /></div>
              {job.status === "completed" && job.videoUrl && (
                <a className="btn small" href={job.videoUrl} download>Download MP4</a>
              )}
              {job.status === "failed" && <div className="error">{job.errorMessage}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
