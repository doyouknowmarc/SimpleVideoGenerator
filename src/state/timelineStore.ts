"use client";
import { create } from "zustand";
import type {
  MediaAsset,
  ImageClip,
  AudioClip,
  TrackType,
  FitMode,
} from "@/types";

function nextId(prefix: string): string {
  return `${prefix}_` + Math.random().toString(36).slice(2, 10);
}

type State = {
  projectId: string | null;
  title: string;
  assets: MediaAsset[];
  imageClips: ImageClip[];
  audioClips: AudioClip[];
  loaded: boolean;
  saving: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;

  // Timeline UI state
  playheadTime: number;
  playing: boolean;
  selectedClipId: string | null;
  selectedTrack: TrackType | null;
  pixelsPerSecond: number;
  snapEnabled: boolean;

  // Actions
  load: () => Promise<void>;

  addAsset: (a: MediaAsset) => void;
  removeAsset: (id: string) => void;

  addImageClip: (assetId: string, startTime: number) => void;
  updateImageClip: (id: string, patch: Partial<ImageClip>) => void;
  removeImageClip: (id: string) => void;

  addAudioClip: (assetId: string, startTime: number, duration: number) => void;
  updateAudioClip: (id: string, patch: Partial<AudioClip>) => void;
  removeAudioClip: (id: string) => void;

  duplicateSelected: () => void;
  deleteSelected: () => void;
  addClipPairs: (
    pairs: Array<{ imageAssetId: string; audioAssetId: string | null; duration: number }>,
    mode: "append" | "replace",
  ) => void;

  setPlayhead: (t: number) => void;
  setPlaying: (p: boolean) => void;
  togglePlay: () => void;
  selectClip: (id: string | null, track: TrackType | null) => void;
  setZoom: (pps: number) => void;
  toggleSnap: () => void;

  setTitle: (title: string) => Promise<void>;

  scheduleSave: () => void;
  saveNow: () => Promise<void>;
};

export const useTimeline = create<State>((set, get) => ({
  projectId: null,
  title: "",
  assets: [],
  imageClips: [],
  audioClips: [],
  loaded: false,
  saving: false,
  saveTimer: null,

  playheadTime: 0,
  playing: false,
  selectedClipId: null,
  selectedTrack: null,
  pixelsPerSecond: 100,
  snapEnabled: true,

  load: async () => {
    const res = await fetch("/api/projects", { cache: "no-store" });
    const data = await res.json();
    set({
      projectId: data.id,
      title: data.title,
      assets: data.assets,
      imageClips: data.imageClips,
      audioClips: data.audioClips,
      loaded: true,
    });
  },

  addAsset: (a) => set((s) => ({ assets: [...s.assets, a] })),

  removeAsset: (id) => {
    set((s) => ({
      assets: s.assets.filter((a) => a.id !== id),
      imageClips: s.imageClips.filter((c) => c.assetId !== id),
      audioClips: s.audioClips.filter((c) => c.assetId !== id),
    }));
    get().scheduleSave();
  },

  addImageClip: (assetId, startTime) => {
    const newClip: ImageClip = {
      id: nextId("img"),
      assetId,
      startTime: Math.max(0, startTime),
      duration: 5,
      fitMode: "contain" as FitMode,
    };
    set((s) => ({
      imageClips: [...s.imageClips, newClip],
      selectedClipId: newClip.id,
      selectedTrack: "image",
    }));
    get().scheduleSave();
  },

  updateImageClip: (id, patch) => {
    set((s) => ({
      imageClips: s.imageClips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  removeImageClip: (id) => {
    set((s) => ({
      imageClips: s.imageClips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      selectedTrack: s.selectedClipId === id ? null : s.selectedTrack,
    }));
    get().scheduleSave();
  },

  addAudioClip: (assetId, startTime, duration) => {
    const newClip: AudioClip = {
      id: nextId("aud"),
      assetId,
      startTime: Math.max(0, startTime),
      duration: Math.max(0.1, duration),
    };
    set((s) => ({
      audioClips: [...s.audioClips, newClip],
      selectedClipId: newClip.id,
      selectedTrack: "audio",
    }));
    get().scheduleSave();
  },

  updateAudioClip: (id, patch) => {
    set((s) => ({
      audioClips: s.audioClips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  removeAudioClip: (id) => {
    set((s) => ({
      audioClips: s.audioClips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      selectedTrack: s.selectedClipId === id ? null : s.selectedTrack,
    }));
    get().scheduleSave();
  },

  duplicateSelected: () => {
    const { selectedClipId, selectedTrack, imageClips, audioClips } = get();
    if (!selectedClipId || !selectedTrack) return;
    if (selectedTrack === "image") {
      const src = imageClips.find((c) => c.id === selectedClipId);
      if (!src) return;
      const newClip: ImageClip = {
        ...src,
        id: nextId("img"),
        startTime: src.startTime + src.duration,
      };
      set((s) => ({
        imageClips: [...s.imageClips, newClip],
        selectedClipId: newClip.id,
        selectedTrack: "image",
      }));
    } else {
      const src = audioClips.find((c) => c.id === selectedClipId);
      if (!src) return;
      const newClip: AudioClip = {
        ...src,
        id: nextId("aud"),
        startTime: src.startTime + src.duration,
      };
      set((s) => ({
        audioClips: [...s.audioClips, newClip],
        selectedClipId: newClip.id,
        selectedTrack: "audio",
      }));
    }
    get().scheduleSave();
  },

  deleteSelected: () => {
    const { selectedClipId, selectedTrack } = get();
    if (!selectedClipId || !selectedTrack) return;
    if (selectedTrack === "image") get().removeImageClip(selectedClipId);
    else get().removeAudioClip(selectedClipId);
  },

  addClipPairs: (pairs, mode) => {
    const state = get();
    let cursor = 0;
    let imageClips: ImageClip[];
    let audioClips: AudioClip[];

    if (mode === "replace") {
      imageClips = [];
      audioClips = [];
      cursor = 0;
    } else {
      imageClips = [...state.imageClips];
      audioClips = [...state.audioClips];
      const ends: number[] = [];
      for (const c of imageClips) ends.push(c.startTime + c.duration);
      for (const c of audioClips) ends.push(c.startTime + c.duration);
      cursor = ends.length > 0 ? Math.max(...ends) : 0;
    }

    for (const p of pairs) {
      const duration = Math.max(0.1, p.duration);
      imageClips.push({
        id: nextId("img"),
        assetId: p.imageAssetId,
        startTime: cursor,
        duration,
        fitMode: "contain",
      });
      if (p.audioAssetId) {
        audioClips.push({
          id: nextId("aud"),
          assetId: p.audioAssetId,
          startTime: cursor,
          duration,
        });
      }
      cursor += duration;
    }

    set({ imageClips, audioClips, selectedClipId: null, selectedTrack: null });
    get().scheduleSave();
  },

  setPlayhead: (t) => set({ playheadTime: Math.max(0, t) }),
  setPlaying: (p) => set({ playing: p }),
  togglePlay: () => {
    const s = get();
    const ends: number[] = [];
    for (const c of s.imageClips) ends.push(c.startTime + c.duration);
    for (const c of s.audioClips) ends.push(c.startTime + c.duration);
    const total = ends.length > 0 ? Math.max(...ends) : 0;
    if (total <= 0) return;
    if (s.playheadTime >= total) set({ playheadTime: 0 });
    set({ playing: !s.playing });
  },

  selectClip: (id, track) => set({ selectedClipId: id, selectedTrack: track }),

  setZoom: (pps) => set({ pixelsPerSecond: Math.max(2, Math.min(400, pps)) }),

  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  setTitle: async (title) => {
    const projectId = get().projectId;
    if (!projectId) return;
    const trimmed = title.trim() || "Untitled Project";
    set({ title: trimmed, saving: true });
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
    } finally {
      set({ saving: false });
    }
  },

  scheduleSave: () => {
    const cur = get().saveTimer;
    if (cur) clearTimeout(cur);
    const t = setTimeout(() => { void get().saveNow(); }, 500);
    set({ saveTimer: t });
  },

  saveNow: async () => {
    const { projectId, imageClips, audioClips } = get();
    if (!projectId) return;
    set({ saving: true });
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageClips: imageClips.map((c) => ({
            assetId: c.assetId,
            startTime: c.startTime,
            duration: c.duration,
            fitMode: c.fitMode,
          })),
          audioClips: audioClips.map((c) => ({
            assetId: c.assetId,
            startTime: c.startTime,
            duration: c.duration,
          })),
        }),
      });
    } finally {
      set({ saving: false });
    }
  },
}));
