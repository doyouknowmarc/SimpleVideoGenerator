"use client";
import { useRef, useState } from "react";
import { useTimeline } from "@/state/timelineStore";

export function UploadPanel() {
  const projectId = useTimeline((s) => s.projectId);
  const addAsset = useTimeline((s) => s.addAsset);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !projectId) return;
    setErr(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("projectId", projectId);
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `upload failed (${res.status})`);
        }
        const asset = await res.json();
        addAsset(asset);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div
        className="upload-zone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}
      >
        {uploading ? "Uploading…" : "Click or drop images / audio"}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/mp4,audio/x-m4a,audio/m4a"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {err && <div className="error">{err}</div>}
    </div>
  );
}
