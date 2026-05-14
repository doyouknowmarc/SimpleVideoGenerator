"use client";
import { create } from "zustand";
import type { MediaAsset, TimelineItem } from "@/types";

type State = {
  projectId: string | null;
  title: string;
  assets: MediaAsset[];
  items: TimelineItem[];
  loaded: boolean;
  saving: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;

  load: () => Promise<void>;
  addAsset: (a: MediaAsset) => void;
  removeAsset: (id: string) => void;
  addScene: (imageAssetId: string) => void;
  updateScene: (id: string, patch: Partial<TimelineItem>) => void;
  removeScene: (id: string) => void;
  reorderScenes: (oldIndex: number, newIndex: number) => void;
  matchDurationToAudio: (id: string) => void;
  applyAudioDurationToAll: () => void;
  scheduleSave: () => void;
  saveNow: () => Promise<void>;
};

function nextId(): string {
  return "tmp_" + Math.random().toString(36).slice(2, 10);
}

function reindex(items: TimelineItem[]): TimelineItem[] {
  return items.map((it, i) => ({ ...it, positionIndex: i }));
}

export const useTimeline = create<State>((set, get) => ({
  projectId: null,
  title: "",
  assets: [],
  items: [],
  loaded: false,
  saving: false,
  saveTimer: null,

  load: async () => {
    const res = await fetch("/api/projects", { cache: "no-store" });
    const data = await res.json();
    set({
      projectId: data.id,
      title: data.title,
      assets: data.assets,
      items: data.items,
      loaded: true,
    });
  },

  addAsset: (a) => set((s) => ({ assets: [...s.assets, a] })),

  removeAsset: (id) =>
    set((s) => ({
      assets: s.assets.filter((a) => a.id !== id),
      items: reindex(
        s.items
          .filter((i) => i.imageAssetId !== id)
          .map((i) => (i.audioAssetId === id ? { ...i, audioAssetId: null } : i)),
      ),
    })),

  addScene: (imageAssetId) => {
    const items = get().items;
    const newItem: TimelineItem = {
      id: nextId(),
      positionIndex: items.length,
      imageAssetId,
      audioAssetId: null,
      duration: 5,
      fitMode: "contain",
    };
    set({ items: [...items, newItem] });
    get().scheduleSave();
  },

  updateScene: (id, patch) => {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
    get().scheduleSave();
  },

  removeScene: (id) => {
    set((s) => ({ items: reindex(s.items.filter((i) => i.id !== id)) }));
    get().scheduleSave();
  },

  reorderScenes: (oldIndex, newIndex) => {
    set((s) => {
      const arr = [...s.items];
      const [moved] = arr.splice(oldIndex, 1);
      arr.splice(newIndex, 0, moved);
      return { items: reindex(arr) };
    });
    get().scheduleSave();
  },

  matchDurationToAudio: (id) => {
    const { items, assets } = get();
    const item = items.find((i) => i.id === id);
    if (!item || !item.audioAssetId) return;
    const audio = assets.find((a) => a.id === item.audioAssetId);
    if (!audio?.duration) return;
    get().updateScene(id, { duration: Number(audio.duration.toFixed(2)) });
  },

  applyAudioDurationToAll: () => {
    const { items, assets } = get();
    set({
      items: items.map((it) => {
        if (!it.audioAssetId) return it;
        const aud = assets.find((a) => a.id === it.audioAssetId);
        if (!aud?.duration) return it;
        return { ...it, duration: Number(aud.duration.toFixed(2)) };
      }),
    });
    get().scheduleSave();
  },

  scheduleSave: () => {
    const cur = get().saveTimer;
    if (cur) clearTimeout(cur);
    const t = setTimeout(() => { void get().saveNow(); }, 500);
    set({ saveTimer: t });
  },

  saveNow: async () => {
    const { projectId, items } = get();
    if (!projectId) return;
    set({ saving: true });
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            imageAssetId: i.imageAssetId,
            audioAssetId: i.audioAssetId ?? null,
            duration: i.duration,
            fitMode: i.fitMode,
          })),
        }),
      });
    } finally {
      set({ saving: false });
    }
  },
}));
