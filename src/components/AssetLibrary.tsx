"use client";
import { useTimeline } from "@/state/timelineStore";

function fmtDuration(d?: number) {
  if (!d) return "";
  const m = Math.floor(d / 60);
  const s = (d - m * 60).toFixed(1);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function AssetLibrary() {
  const assets = useTimeline((s) => s.assets);
  const addScene = useTimeline((s) => s.addScene);

  const images = assets.filter((a) => a.type === "image");
  const audios = assets.filter((a) => a.type === "audio");

  return (
    <div>
      <div className="h2">Images</div>
      {images.length === 0 && <div style={{ color: "#5d6577", fontSize: 12 }}>No images yet.</div>}
      {images.map((a) => (
        <div key={a.id} className="asset">
          <div className="asset-thumb"><img src={a.url} alt="" /></div>
          <div className="asset-meta">
            <div className="asset-name">{a.filename}</div>
            <div className="asset-sub">{a.width}×{a.height}</div>
          </div>
          <button className="btn ghost" title="Add as scene" onClick={() => addScene(a.id)}>+</button>
        </div>
      ))}

      <div className="h2">Audio</div>
      {audios.length === 0 && <div style={{ color: "#5d6577", fontSize: 12 }}>No audio yet.</div>}
      {audios.map((a) => (
        <div key={a.id} className="asset">
          <div className="asset-thumb">♪</div>
          <div className="asset-meta">
            <div className="asset-name">{a.filename}</div>
            <div className="asset-sub">{fmtDuration(a.duration)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
