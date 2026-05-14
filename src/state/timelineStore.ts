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
  imageTrackCount: number;
  audioTrackCount: number;
  hiddenImageTracks: number[];
  hiddenAudioTracks: number[];
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
  cutMode: boolean;

  // Actions
  load: () => Promise<void>;

  addAsset: (a: MediaAsset) => void;
  removeAsset: (id: string) => void;

  addImageClip: (assetId: string, startTime: number, trackIndex?: number) => void;
  updateImageClip: (id: string, patch: Partial<ImageClip>) => void;
  removeImageClip: (id: string) => void;
  cutImageClip: (id: string, cutTime: number) => void;

  addAudioClip: (assetId: string, startTime: number, duration: number, trackIndex?: number) => void;
  updateAudioClip: (id: string, patch: Partial<AudioClip>) => void;
  removeAudioClip: (id: string) => void;
  cutAudioClip: (id: string, cutTime: number) => void;

  addImageTrack: () => void;
  addAudioTrack: () => void;
  removeImageTrack: (trackIndex: number) => void;
  removeAudioTrack: (trackIndex: number) => void;
  toggleImageTrackHidden: (trackIndex: number) => void;
  toggleAudioTrackHidden: (trackIndex: number) => void;

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
  toggleCutMode: () => void;
  setCutMode: (enabled: boolean) => void;

  setTitle: (title: string) => Promise<void>;

  scheduleSave: () => void;
  saveNow: () => Promise<void>;
};

export const useTimeline = create<State>((set, get) => ({
  projectId: null,
  title: "",
  imageTrackCount: 1,
  audioTrackCount: 1,
  hiddenImageTracks: [],
  hiddenAudioTracks: [],
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
  cutMode: false,

  load: async () => {
    const res = await fetch("/api/projects", { cache: "no-store" });
    const data = await res.json();
    set({
      projectId: data.id,
      title: data.title,
      imageTrackCount: data.imageTrackCount ?? 1,
      audioTrackCount: data.audioTrackCount ?? 1,
      hiddenImageTracks: [],
      hiddenAudioTracks: [],
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

  addImageClip: (assetId, startTime, trackIndex = 0) => {
    const newClip: ImageClip = {
      id: nextId("img"),
      assetId,
      trackIndex,
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

  cutImageClip: (id, cutTime) => {
    let didCut = false;
    set((s) => {
      const src = s.imageClips.find((c) => c.id === id);
      if (!src) return {};
      const local = cutTime - src.startTime;
      if (local <= 0.1 || src.duration - local <= 0.1) return {};
      didCut = true;
      const left: ImageClip = { ...src, duration: local };
      const right: ImageClip = {
        ...src,
        id: nextId("img"),
        startTime: cutTime,
        duration: src.duration - local,
      };
      return {
        imageClips: s.imageClips.flatMap((c) => (c.id === id ? [left, right] : [c])),
        selectedClipId: right.id,
        selectedTrack: "image",
      };
    });
    if (didCut) get().scheduleSave();
  },

  addAudioClip: (assetId, startTime, duration, trackIndex = 0) => {
    const newClip: AudioClip = {
      id: nextId("aud"),
      assetId,
      trackIndex,
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

  addImageTrack: () => {
    set((s) => ({ imageTrackCount: s.imageTrackCount + 1 }));
    get().scheduleSave();
  },
  addAudioTrack: () => {
    set((s) => ({ audioTrackCount: s.audioTrackCount + 1 }));
    get().scheduleSave();
  },

  removeImageTrack: (trackIndex) => {
    const state = get();
    if (state.imageTrackCount <= 1 || trackIndex < 0 || trackIndex >= state.imageTrackCount) return;
    set((s) => ({
      imageTrackCount: s.imageTrackCount - 1,
      hiddenImageTracks: s.hiddenImageTracks
        .filter((idx) => idx !== trackIndex)
        .map((idx) => (idx > trackIndex ? idx - 1 : idx)),
      imageClips: s.imageClips
        .filter((c) => c.trackIndex !== trackIndex)
        .map((c) => (c.trackIndex > trackIndex ? { ...c, trackIndex: c.trackIndex - 1 } : c)),
      selectedClipId: s.selectedTrack === "image" && s.imageClips.some((c) => c.id === s.selectedClipId && c.trackIndex === trackIndex)
        ? null
        : s.selectedClipId,
      selectedTrack: s.selectedTrack === "image" && s.imageClips.some((c) => c.id === s.selectedClipId && c.trackIndex === trackIndex)
        ? null
        : s.selectedTrack,
    }));
    get().scheduleSave();
  },

  removeAudioTrack: (trackIndex) => {
    const state = get();
    if (state.audioTrackCount <= 1 || trackIndex < 0 || trackIndex >= state.audioTrackCount) return;
    set((s) => ({
      audioTrackCount: s.audioTrackCount - 1,
      hiddenAudioTracks: s.hiddenAudioTracks
        .filter((idx) => idx !== trackIndex)
        .map((idx) => (idx > trackIndex ? idx - 1 : idx)),
      audioClips: s.audioClips
        .filter((c) => c.trackIndex !== trackIndex)
        .map((c) => (c.trackIndex > trackIndex ? { ...c, trackIndex: c.trackIndex - 1 } : c)),
      selectedClipId: s.selectedTrack === "audio" && s.audioClips.some((c) => c.id === s.selectedClipId && c.trackIndex === trackIndex)
        ? null
        : s.selectedClipId,
      selectedTrack: s.selectedTrack === "audio" && s.audioClips.some((c) => c.id === s.selectedClipId && c.trackIndex === trackIndex)
        ? null
        : s.selectedTrack,
    }));
    get().scheduleSave();
  },

  toggleImageTrackHidden: (trackIndex) => {
    set((s) => ({
      hiddenImageTracks: s.hiddenImageTracks.includes(trackIndex)
        ? s.hiddenImageTracks.filter((idx) => idx !== trackIndex)
        : [...s.hiddenImageTracks, trackIndex],
    }));
  },

  toggleAudioTrackHidden: (trackIndex) => {
    set((s) => ({
      hiddenAudioTracks: s.hiddenAudioTracks.includes(trackIndex)
        ? s.hiddenAudioTracks.filter((idx) => idx !== trackIndex)
        : [...s.hiddenAudioTracks, trackIndex],
    }));
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

  cutAudioClip: (id, cutTime) => {
    let didCut = false;
    set((s) => {
      const src = s.audioClips.find((c) => c.id === id);
      if (!src) return {};
      const local = cutTime - src.startTime;
      if (local <= 0.1 || src.duration - local <= 0.1) return {};
      didCut = true;
      const left: AudioClip = { ...src, duration: local };
      const right: AudioClip = {
        ...src,
        id: nextId("aud"),
        startTime: cutTime,
        duration: src.duration - local,
      };
      return {
        audioClips: s.audioClips.flatMap((c) => (c.id === id ? [left, right] : [c])),
        selectedClipId: right.id,
        selectedTrack: "audio",
      };
    });
    if (didCut) get().scheduleSave();
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
        trackIndex: 0,
        startTime: cursor,
        duration,
        fitMode: "contain",
      });
      if (p.audioAssetId) {
        audioClips.push({
          id: nextId("aud"),
          assetId: p.audioAssetId,
          trackIndex: 0,
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

  setZoom: (pps) => set({ pixelsPerSecond: Math.max(0.5, Math.min(800, pps)) }),

  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  toggleCutMode: () => set((s) => ({ cutMode: !s.cutMode })),
  setCutMode: (enabled) => set({ cutMode: enabled }),

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
    const { projectId, imageClips, audioClips, imageTrackCount, audioTrackCount } = get();
    if (!projectId) return;
    set({ saving: true });
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageTrackCount,
          audioTrackCount,
          imageClips: imageClips.map((c) => ({
            assetId: c.assetId,
            name: c.name,
            trackIndex: c.trackIndex,
            startTime: c.startTime,
            duration: c.duration,
            fitMode: c.fitMode,
          })),
          audioClips: audioClips.map((c) => ({
            assetId: c.assetId,
            name: c.name,
            trackIndex: c.trackIndex,
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
