"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useTimeline } from "@/state/timelineStore";
import type { MediaAsset, TrackType } from "@/types";
import { IconChevron } from "./icons";

function fmtDuration(d?: number) {
  if (!d) return "";
  const m = Math.floor(d / 60);
  const s = (d - m * 60).toFixed(1);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const STORAGE_KEY = "svg.assetSections";

type SectionState = { images: boolean; audio: boolean };

function useSectionState(): [SectionState, (k: keyof SectionState) => void] {
  const [state, setState] = useState<SectionState>({ images: true, audio: true });
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({
          images: parsed.images !== false,
          audio: parsed.audio !== false,
        });
      }
    } catch { /* ignore */ }
  }, []);
  function toggle(k: keyof SectionState) {
    setState((s) => {
      const next = { ...s, [k]: !s[k] };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  return [state, toggle];
}

function Section({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="asset-section">
      <button className={`asset-section-header ${open ? "open" : ""}`} onClick={onToggle} type="button">
        <IconChevron className="chevron" />
        <span className="asset-section-title">{label}</span>
        <span className="asset-section-count">{count}</span>
      </button>
      {open && <div className="asset-section-body">{children}</div>}
    </div>
  );
}

function AssetRow({ a, type }: { a: MediaAsset; type: TrackType }) {
  return (
    <div
      className="asset"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", `asset:${a.id}`);
        e.dataTransfer.setData("application/x-asset-id", a.id);
        e.dataTransfer.setData("application/x-asset-type", type);
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={`Drag onto the ${type} track`}
    >
      <div className="asset-thumb">
        {type === "image" ? <img src={a.url} alt="" /> : <span>♪</span>}
      </div>
      <div className="asset-meta">
        <div className="asset-name">{a.filename}</div>
        <div className="asset-sub">
          {type === "image" ? `${a.width}×${a.height}` : fmtDuration(a.duration)}
        </div>
      </div>
    </div>
  );
}

export function AssetLibrary() {
  const assets = useTimeline((s) => s.assets);
  const images = assets.filter((a) => a.type === "image");
  const audios = assets.filter((a) => a.type === "audio");
  const [sections, toggle] = useSectionState();

  return (
    <>
      <Section label="Images" count={images.length} open={sections.images} onToggle={() => toggle("images")}>
        {images.length === 0 && <div className="asset-empty">No images yet</div>}
        {images.map((a) => <AssetRow key={a.id} a={a} type="image" />)}
      </Section>

      <Section label="Audio" count={audios.length} open={sections.audio} onToggle={() => toggle("audio")}>
        {audios.length === 0 && <div className="asset-empty">No audio yet</div>}
        {audios.map((a) => <AssetRow key={a.id} a={a} type="audio" />)}
      </Section>
    </>
  );
}
