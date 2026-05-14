"use client";
import { useEffect, useRef, useState } from "react";
import { useTimeline } from "@/state/timelineStore";
import { validateForRender, totalDuration } from "@/lib/timelineCalc";

type Job = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  videoUrl?: string;
  errorMessage?: string;
};

export function ExportButton() {
  const projectId = useTimeline((s) => s.projectId);
  const items = useTimeline((s) => s.items);
  const saveNow = useTimeline((s) => s.saveNow);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const errs = validateForRender(items);
  const total = totalDuration(items);

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

  return (
    <div className="export-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Export video</div>
          <div style={{ color: "#8a93a3", fontSize: 12 }}>
            {items.length} scene{items.length === 1 ? "" : "s"} · {total.toFixed(1)}s · 1920×1080 @ 30fps
          </div>
        </div>
        <button className="btn" disabled={starting || errs.length > 0 || (job?.status === "running" || job?.status === "queued")} onClick={startRender}>
          {starting ? "Starting…" : job?.status === "running" || job?.status === "queued" ? "Rendering…" : "Export MP4"}
        </button>
      </div>
      {errs.length > 0 && <div className="error">{errs.join(" ")}</div>}
      {err && <div className="error">{err}</div>}
      {job && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#8a93a3" }}>
            Status: {job.status} · {Math.round(job.progress * 100)}%
          </div>
          <div className="progress"><div className="progress-fill" style={{ width: `${Math.round(job.progress * 100)}%` }} /></div>
          {job.status === "completed" && job.videoUrl && (
            <a className="btn" href={job.videoUrl} download>Download MP4</a>
          )}
          {job.status === "failed" && <div className="error">{job.errorMessage}</div>}
        </div>
      )}
    </div>
  );
}
