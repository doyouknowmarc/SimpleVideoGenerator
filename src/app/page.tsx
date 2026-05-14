"use client";
import { useEffect, useState } from "react";
import { useTimeline } from "@/state/timelineStore";
import { AssetLibrary } from "@/components/AssetLibrary";
import { AddMediaButton } from "@/components/AddMediaButton";
import { TimelineEditor } from "@/components/TimelineEditor";
import { PreviewPlayer } from "@/components/PreviewPlayer";
import { ExportButton } from "@/components/ExportButton";
import { QuickAddWizard } from "@/components/QuickAddWizard";
import { WorkspaceSplit } from "@/components/WorkspaceSplit";
import { SidebarResize } from "@/components/SidebarResize";
import { IconSidebar } from "@/components/icons";

const SIDEBAR_VISIBLE_KEY = "svg.sidebarVisible";

export default function Page() {
  const loaded = useTimeline((s) => s.loaded);
  const saving = useTimeline((s) => s.saving);
  const load = useTimeline((s) => s.load);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_VISIBLE_KEY);
    if (stored !== null) setSidebarVisible(stored !== "0");
  }, []);

  function toggleSidebar() {
    setSidebarVisible((v) => {
      const next = !v;
      window.localStorage.setItem(SIDEBAR_VISIBLE_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (!loaded) {
    return <div style={{ padding: 24, color: "#64748b" }}>Loading…</div>;
  }

  const previewContent = (
    <>
      <div className="preview-overlay-tl">
        <button
          className={`icon-toggle ${sidebarVisible ? "active" : ""}`}
          onClick={toggleSidebar}
          title={sidebarVisible ? "Hide library" : "Show library"}
        >
          <IconSidebar />
        </button>
      </div>
      <div className="preview-overlay-tr">
        <span className="save-status">{saving ? "Saving…" : "Saved"}</span>
        <ExportButton />
      </div>
      <PreviewPlayer />
    </>
  );

  return (
    <div className="app-shell">
      <div className="app-body">
        {sidebarVisible && (
          <SidebarResize>
            <h2 className="asset-panel-title">Library</h2>
            <AddMediaButton onClick={() => setWizardOpen(true)} />
            <AssetLibrary />
          </SidebarResize>
        )}
        <div className="workspace">
          <WorkspaceSplit
            preview={previewContent}
            timeline={<TimelineEditor />}
          />
        </div>
      </div>
      <QuickAddWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
