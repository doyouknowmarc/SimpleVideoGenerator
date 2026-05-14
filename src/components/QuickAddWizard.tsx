"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTimeline } from "@/state/timelineStore";
import { autoPair, type PairRow } from "@/lib/pairing";
import { IconClose, IconLink } from "./icons";
import type { MediaAsset } from "@/types";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_MIME = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
  "audio/aac", "audio/mp4", "audio/x-m4a", "audio/m4a",
]);

function fmtDur(d?: number) {
  if (!d) return "—";
  return d.toFixed(1) + "s";
}

type UploadItem = {
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
};

type Props = { open: boolean; onClose: () => void };

export function QuickAddWizard({ open, onClose }: Props) {
  const projectId = useTimeline((s) => s.projectId);
  const assets = useTimeline((s) => s.assets);
  const addAsset = useTimeline((s) => s.addAsset);
  const addClipPairs = useTimeline((s) => s.addClipPairs);

  const [rows, setRows] = useState<PairRow[]>([]);
  const [matchToAudio, setMatchToAudio] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenAssetIdsRef = useRef<Set<string>>(new Set());

  // When the wizard opens, snapshot which assets already exist so we only
  // auto-build rows from newly added ones (or, if there are none yet, from
  // all existing images).
  useEffect(() => {
    if (open) {
      seenAssetIdsRef.current = new Set(assets.map((a) => a.id));
      setRows([]);
      setUploads([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Whenever assets change while open: rebuild auto-pair using newly added.
  useEffect(() => {
    if (!open) return;
    const newAssets = assets.filter((a) => !seenAssetIdsRef.current.has(a.id));
    // If user uploaded something this session, pair from the new ones.
    // Otherwise pair from everything already in the library.
    const pool = newAssets.length > 0 ? newAssets : assets;
    const newImages = pool.filter((a) => a.type === "image");
    const newAudios = pool.filter((a) => a.type === "audio");
    if (newImages.length === 0) {
      setRows([]);
      return;
    }
    const next = autoPair(newImages, newAudios);
    setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.length, open]);

  // Re-apply "match to audio" when the toggle changes (only fills rows where audio is set)
  useEffect(() => {
    if (!matchToAudio) return;
    setRows((rs) =>
      rs.map((r) => {
        if (!r.audioAssetId) return r;
        const aud = assets.find((a) => a.id === r.audioAssetId);
        if (!aud?.duration) return r;
        return { ...r, duration: Number(aud.duration.toFixed(2)) };
      }),
    );
  }, [matchToAudio, assets]);

  const imagesInPool = useMemo(() => {
    const ids = new Set(rows.map((r) => r.imageAssetId));
    return assets.filter((a) => a.type === "image" && ids.has(a.id));
  }, [rows, assets]);
  const audiosInPool = useMemo(() => {
    return assets.filter((a) => a.type === "audio");
  }, [assets]);

  const validRowCount = rows.filter((r) => r.duration > 0).length;

  async function uploadFiles(files: File[]) {
    if (!projectId || files.length === 0) return;
    setIsUploading(true);
    const initial: UploadItem[] = files.map((f) => ({ name: f.name, status: "uploading" }));
    setUploads((u) => [...u, ...initial]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = IMAGE_MIME.has(file.type);
      const isAudio = AUDIO_MIME.has(file.type);
      if (!isImage && !isAudio) {
        setUploads((u) =>
          u.map((item) =>
            item.name === file.name && item.status === "uploading"
              ? { ...item, status: "error", error: "unsupported" }
              : item,
          ),
        );
        continue;
      }
      try {
        const fd = new FormData();
        fd.append("projectId", projectId);
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const asset: MediaAsset = await res.json();
        addAsset(asset);
        setUploads((u) =>
          u.map((item) =>
            item.name === file.name && item.status === "uploading"
              ? { ...item, status: "done" }
              : item,
          ),
        );
      } catch (e) {
        setUploads((u) =>
          u.map((item) =>
            item.name === file.name && item.status === "uploading"
              ? { ...item, status: "error", error: (e as Error).message }
              : item,
          ),
        );
      }
    }
    setIsUploading(false);
  }

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    void uploadFiles(Array.from(list));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    void uploadFiles(Array.from(e.dataTransfer.files));
  }

  function reAutoPair() {
    if (imagesInPool.length === 0) return;
    setRows(autoPair(imagesInPool, audiosInPool));
  }

  function setRow(idx: number, patch: Partial<PairRow>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }

  function matchRowToAudio(idx: number) {
    const r = rows[idx];
    if (!r.audioAssetId) return;
    const aud = assets.find((a) => a.id === r.audioAssetId);
    if (!aud?.duration) return;
    setRow(idx, { duration: Number(aud.duration.toFixed(2)) });
  }

  function applyAddToTimeline() {
    const valid = rows.filter((r) => r.duration > 0 && r.imageAssetId);
    if (valid.length === 0) return;
    addClipPairs(valid, replaceExisting ? "replace" : "append");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Add media to your project</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <div className="modal-body">
          <div
            className={`dropzone ${dragOver ? "active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="dropzone-title">
              {isUploading ? "Uploading…" : "Drop images and audio here, or click to choose"}
            </div>
            <div className="dropzone-sub">
              JPG, PNG, WebP · MP3, WAV, M4A, AAC · upload many at once
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/mp4,audio/x-m4a,audio/m4a"
              style={{ display: "none" }}
              onChange={(e) => onPickFiles(e.target.files)}
            />
          </div>

          {uploads.length > 0 && (
            <div className="upload-progress">
              {uploads.slice(-6).map((u, i) => (
                <div key={i} className={`item ${u.status === "done" ? "ok" : u.status === "error" ? "err" : ""}`}>
                  {u.status === "done" ? "✓" : u.status === "error" ? "✗" : "…"} {u.name}
                  {u.error ? ` — ${u.error}` : ""}
                </div>
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="pair-toolbar">
                <div className="summary">
                  {rows.length} scene{rows.length === 1 ? "" : "s"} ready
                  {" · "}
                  {rows.filter((r) => r.audioAssetId).length} paired with audio
                </div>
                <div className="spacer" />
                <button className="btn secondary small" onClick={reAutoPair}>
                  <IconLink /> Auto-pair by filename
                </button>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={matchToAudio}
                    onChange={(e) => setMatchToAudio(e.target.checked)}
                  />
                  Match duration to audio
                </label>
              </div>

              <table className="pair-table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Image</th>
                    <th>Audio</th>
                    <th style={{ width: 150 }}>Duration</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const img = assets.find((a) => a.id === r.imageAssetId);
                    return (
                      <tr key={r.imageAssetId}>
                        <td className="mono" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                        <td>
                          <div className="image-cell">
                            <div
                              className="row-thumb"
                              style={img?.url ? { backgroundImage: `url(${img.url})` } : undefined}
                            />
                            <span className="filename">{img?.filename ?? "(missing)"}</span>
                          </div>
                        </td>
                        <td>
                          <select
                            value={r.audioAssetId ?? ""}
                            onChange={(e) => {
                              const newId = e.target.value || null;
                              const aud = newId ? assets.find((a) => a.id === newId) : null;
                              setRow(idx, {
                                audioAssetId: newId,
                                duration: matchToAudio && aud?.duration ? Number(aud.duration.toFixed(2)) : r.duration,
                              });
                            }}
                          >
                            <option value="">— none —</option>
                            {audiosInPool.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.filename} ({fmtDur(a.duration)})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="duration-cell">
                            <input
                              type="number"
                              step={0.1}
                              min={0.1}
                              value={r.duration.toFixed(2)}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (isFinite(v) && v > 0) setRow(idx, { duration: v });
                              }}
                            />
                            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>s</span>
                            {r.audioAssetId && (
                              <button
                                className="btn ghost match-btn"
                                onClick={() => matchRowToAudio(idx)}
                                title="Match duration to audio"
                              >
                                ↳
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn ghost"
                            onClick={() => removeRow(idx)}
                            title="Remove this row"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="modal-footer">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Replace existing timeline
          </label>
          <div className="right">
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn"
              disabled={validRowCount === 0}
              onClick={applyAddToTimeline}
            >
              {replaceExisting ? "Replace timeline" : "Add"} {validRowCount} clip{validRowCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
