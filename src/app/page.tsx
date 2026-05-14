"use client";
import { useEffect } from "react";
import { useTimeline } from "@/state/timelineStore";
import { UploadPanel } from "@/components/UploadPanel";
import { AssetLibrary } from "@/components/AssetLibrary";
import { Timeline } from "@/components/Timeline";
import { PreviewPlayer } from "@/components/PreviewPlayer";
import { ExportButton } from "@/components/ExportButton";

export default function Page() {
  const loaded = useTimeline((s) => s.loaded);
  const saving = useTimeline((s) => s.saving);
  const load = useTimeline((s) => s.load);

  useEffect(() => { void load(); }, [load]);

  if (!loaded) {
    return <div style={{ padding: 24, color: "#8a93a3" }}>Loading…</div>;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="h1">Simple Video Generator</h1>
        <UploadPanel />
        <AssetLibrary />
      </aside>
      <main className="main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 className="h1">Storyboard</h1>
          <div style={{ color: "#5d6577", fontSize: 12 }}>{saving ? "Saving…" : "Saved"}</div>
        </div>
        <PreviewPlayer />
        <ExportButton />
        <div style={{ marginTop: 18 }}>
          <Timeline />
        </div>
      </main>
    </div>
  );
}
