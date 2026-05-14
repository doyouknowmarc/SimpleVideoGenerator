"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaAsset, TimelineItem } from "@/types";
import { useTimeline } from "@/state/timelineStore";

type Props = { item: TimelineItem; assets: MediaAsset[] };

export function SceneCard({ item, assets }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const updateScene = useTimeline((s) => s.updateScene);
  const removeScene = useTimeline((s) => s.removeScene);
  const matchAudio = useTimeline((s) => s.matchDurationToAudio);

  const image = assets.find((a) => a.id === item.imageAssetId);
  const audios = assets.filter((a) => a.type === "audio");
  const audio = item.audioAssetId ? assets.find((a) => a.id === item.audioAssetId) : null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="scene">
      <div className="scene-drag" {...attributes} {...listeners}>⋮⋮</div>
      <div className="scene-thumb">{image && <img src={image.url} alt="" />}</div>
      <div className="scene-controls">
        <div className="scene-row">
          <label>Audio</label>
          <select
            value={item.audioAssetId ?? ""}
            onChange={(e) => updateScene(item.id, { audioAssetId: e.target.value || null })}
          >
            <option value="">— none —</option>
            {audios.map((a) => (
              <option key={a.id} value={a.id}>{a.filename}</option>
            ))}
          </select>
        </div>
        <div className="scene-row">
          <label>Duration</label>
          <input
            type="number"
            step={0.1}
            min={0.1}
            value={item.duration}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (isFinite(v) && v > 0) updateScene(item.id, { duration: v });
            }}
            style={{ width: 80 }}
          />
          <span style={{ color: "#8a93a3", fontSize: 12 }}>sec</span>
          {audio?.duration && (
            <button className="btn ghost" onClick={() => matchAudio(item.id)} title={`Match audio (${audio.duration.toFixed(2)}s)`}>
              ↳ match audio
            </button>
          )}
        </div>
        <div className="scene-row">
          <label>Fit</label>
          <select value={item.fitMode} onChange={(e) => updateScene(item.id, { fitMode: e.target.value as "cover" | "contain" })}>
            <option value="contain">Contain (letterbox)</option>
            <option value="cover">Cover (crop)</option>
          </select>
        </div>
      </div>
      <div className="scene-actions">
        <button className="btn danger" onClick={() => removeScene(item.id)}>Remove</button>
      </div>
    </div>
  );
}
