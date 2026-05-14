"use client";
import { useEffect, useState } from "react";
import { useTimeline } from "@/state/timelineStore";
import { AssetLibrary } from "@/components/AssetLibrary";
import { AddMediaButton } from "@/components/AddMediaButton";
import { TimelineEditor } from "@/components/TimelineEditor";
import { PreviewPlayer } from "@/components/PreviewPlayer";
import { ExportButton } from "@/components/ExportButton";
import { QuickAddWizard } from "@/components/QuickAddWizard";
import { ProjectTitle } from "@/components/ProjectTitle";
import { WorkspaceSplit } from "@/components/WorkspaceSplit";

export default function Page() {
  const loaded = useTimeline((s) => s.loaded);
  const saving = useTimeline((s) => s.saving);
  const load = useTimeline((s) => s.load);

  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => { void load(); }, [load]);

  if (!loaded) {
    return <div style={{ padding: 24, color: "#64748b" }}>Loading…</div>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <ProjectTitle />
        <div className="header-right">
          <span className="save-status">{saving ? "Saving…" : "Saved"}</span>
          <ExportButton />
        </div>
      </header>
      <div className="app-body">
        <aside className="asset-panel">
          <h2 className="asset-panel-title">Library</h2>
          <AddMediaButton onClick={() => setWizardOpen(true)} />
          <AssetLibrary />
        </aside>
        <div className="workspace">
          <WorkspaceSplit
            preview={<PreviewPlayer />}
            timeline={<TimelineEditor />}
          />
        </div>
      </div>
      <QuickAddWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
