"use client";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTimeline } from "@/state/timelineStore";
import { SceneCard } from "./SceneCard";

export function Timeline() {
  const items = useTimeline((s) => s.items);
  const assets = useTimeline((s) => s.assets);
  const reorder = useTimeline((s) => s.reorderScenes);
  const applyAll = useTimeline((s) => s.applyAudioDurationToAll);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx >= 0 && newIdx >= 0) reorder(oldIdx, newIdx);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h2" style={{ margin: 0 }}>Scenes ({items.length})</h2>
        {items.length > 0 && (
          <button className="btn secondary" onClick={applyAll}>Match all to audio</button>
        )}
      </div>
      {items.length === 0 && (
        <div style={{ color: "#5d6577", fontSize: 13, padding: "12px 0" }}>
          Add an image from the sidebar to create the first scene.
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="scenes">
            {items.map((it) => (
              <SceneCard key={it.id} item={it} assets={assets} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
