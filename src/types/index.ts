export type AssetType = "image" | "audio";

export type MediaAsset = {
  id: string;
  projectId: string;
  type: AssetType;
  filename: string;
  url: string;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
};

export type FitMode = "cover" | "contain";

export type TimelineItem = {
  id: string;
  positionIndex: number;
  imageAssetId: string;
  audioAssetId?: string | null;
  duration: number;
  fitMode: FitMode;
};

export type RenderJobStatus = "queued" | "running" | "completed" | "failed";

export type RenderJob = {
  id: string;
  projectId: string;
  status: RenderJobStatus;
  progress: number;
  videoUrl?: string;
  errorMessage?: string;
};

export type ProjectPayload = {
  id: string;
  title: string;
  assets: MediaAsset[];
  items: TimelineItem[];
};
