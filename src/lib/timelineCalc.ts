import type { TimelineItem } from "@/types";

export function withStartTimes<T extends { duration: number }>(items: T[]): (T & { startTime: number })[] {
  let acc = 0;
  return items.map((i) => {
    const startTime = acc;
    acc += i.duration;
    return { ...i, startTime };
  });
}

export function totalDuration(items: { duration: number }[]): number {
  return items.reduce((s, i) => s + (i.duration || 0), 0);
}

export type ValidationError = string;

export function validateForRender(items: TimelineItem[]): ValidationError[] {
  const errs: ValidationError[] = [];
  if (items.length === 0) errs.push("Add at least one scene before rendering.");
  items.forEach((it, idx) => {
    if (!it.imageAssetId) errs.push(`Scene ${idx + 1} is missing an image.`);
    if (!it.duration || it.duration <= 0) errs.push(`Scene ${idx + 1} has invalid duration.`);
  });
  const total = totalDuration(items);
  if (total > 600) errs.push(`Total duration ${total.toFixed(1)}s exceeds the 10-minute MVP limit.`);
  return errs;
}
