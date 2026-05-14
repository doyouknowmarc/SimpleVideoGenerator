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

function sanitizeFilename(s: string): string {
  return s.replace(/\.mp4$/i, "").replace(/[^a-zA-Z0-9 _\-.()]/g, "").trim().slice(0, 80);
}

export function ExportButton() {
  const projectId = useTimeline((s) => s.projectId);
  const imageClips = useTimeline((s) => s.imageClips);
  const audioClips = useTimeline((s) => s.audioClips);
  const saveNow = useTimeline((s) => s.saveNow);
  const title = useTimeline((s) => s.title);

  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [filename, setFilename] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const errs = validateClipsForRender(imageClips, audioClips);
  const total = computeTotalDuration(imageClips, audioClips);
  const inProgress = job?.status === "queued" || job?.status === "running";

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Initialize filename from project title when popover opens
  useEffect(() => {
    if (showPopover && !filename) {
      const seed = sanitizeFilename(title || "video") || "video";
      setFilename(seed);
    }
  }, [showPopover, title, filename]);

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
    try {
      await saveNow();
      const cleanFilename = sanitizeFilename(filename) || "video";
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, filename: cleanFilename }),
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
    : "Export";

  return (
    <div className="export-wrap">
      <button
        className="btn"
        onClick={() => setShowPopover((v) => !v)}
        disabled={starting}
        title={errs.length > 0 ? errs.join(" ") : "Export the timeline as MP4"}
      >
        {buttonLabel}
      </button>
      {showPopover && (
        <div className="export-popover" role="dialog">
          <div className="popover-row">
            <div style={{ fontWeight: 600, fontSize: 13 }}>Export video</div>
            <button className="modal-close" onClick={() => setShowPopover(false)} aria-label="Close">×</button>
          </div>
          <div className="popover-sub">
            {imageClips.length} image · {audioClips.length} audio · {total.toFixed(1)}s · 1920×1080
          </div>

          {errs.length > 0 && <div className="error">{errs.join(" ")}</div>}

          {!inProgress && !job?.videoUrl && (
            <>
              <label className="popover-label">File name</label>
              <div className="filename-row">
                <input
                  type="text"
                  className="filename-input"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="my-video"
                  spellCheck={false}
                />
                <span className="filename-ext">.mp4</span>
              </div>
            </>
          )}

          {err && <div className="error">{err}</div>}

          {job && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Status: {job.status} · {Math.round(job.progress * 100)}%
              </div>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${Math.round(job.progress * 100)}%` }} />
              </div>
              {job.status === "completed" && job.videoUrl && (
                <a className="btn small" href={job.videoUrl} download>Download MP4</a>
              )}
              {job.status === "failed" && <div className="error">{job.errorMessage}</div>}
            </>
          )}

          {!inProgress && job?.status !== "completed" && (
            <div className="popover-actions">
              <button
                className="btn"
                disabled={starting || errs.length > 0 || !sanitizeFilename(filename)}
                onClick={startRender}
              >
                {starting ? "Starting…" : "Start render"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
