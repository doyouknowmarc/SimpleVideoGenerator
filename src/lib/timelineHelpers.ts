import type { ImageClip, AudioClip } from "@/types";

export function computeTotalDuration(
  imageClips: { startTime: number; duration: number }[],
  audioClips: { startTime: number; duration: number }[],
): number {
  const ends: number[] = [];
  for (const c of imageClips) ends.push(c.startTime + c.duration);
  for (const c of audioClips) ends.push(c.startTime + c.duration);
  return ends.length > 0 ? Math.max(...ends) : 0;
}

export function validateClipsForRender(
  imageClips: ImageClip[],
  audioClips: AudioClip[],
): string[] {
  const errs: string[] = [];
  if (imageClips.length === 0) {
    errs.push("Add at least one image clip before rendering.");
  }
  for (let i = 0; i < imageClips.length; i++) {
    const c = imageClips[i];
    if (!c.assetId) errs.push(`Image clip ${i + 1} missing asset.`);
    if (c.duration <= 0) errs.push(`Image clip ${i + 1} has invalid duration.`);
    if (c.startTime < 0) errs.push(`Image clip ${i + 1} has negative start time.`);
  }
  for (let i = 0; i < audioClips.length; i++) {
    const c = audioClips[i];
    if (!c.assetId) errs.push(`Audio clip ${i + 1} missing asset.`);
    if (c.duration <= 0) errs.push(`Audio clip ${i + 1} has invalid duration.`);
    if (c.startTime < 0) errs.push(`Audio clip ${i + 1} has negative start time.`);
  }
  const total = computeTotalDuration(imageClips, audioClips);
  if (total > 600) {
    errs.push(`Total duration ${total.toFixed(1)}s exceeds the 10-minute MVP limit.`);
  }
  return errs;
}

export function snapToGrid(seconds: number, grid = 0.1): number {
  return Math.max(0, Math.round(seconds / grid) * grid);
}
