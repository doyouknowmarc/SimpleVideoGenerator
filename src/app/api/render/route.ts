import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "@/lib/db";
import { validateClipsForRender } from "@/lib/timelineHelpers";
import type { ImageClip, AudioClip, FitMode } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFilename(input: string | undefined): string | null {
  if (!input) return null;
  const cleaned = input
    .replace(/\.mp4$/i, "")
    .replace(/[^a-zA-Z0-9 _\-.()]/g, "")
    .trim()
    .slice(0, 80);
  return cleaned || null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { projectId: string; filename?: string };
  const { projectId } = body;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const clips = await prisma.timelineClip.findMany({
    where: { projectId },
    orderBy: { startTime: "asc" },
  });
  const assets = await prisma.mediaAsset.findMany({ where: { projectId } });
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const imageClips: ImageClip[] = clips
    .filter((c) => c.trackType === "image")
    .map((c) => ({
      id: c.id,
      assetId: c.assetId,
      trackIndex: c.trackIndex,
      startTime: c.startTime,
      duration: c.duration,
      fitMode: (c.fitMode ?? "contain") as FitMode,
    }));
  const audioClips: AudioClip[] = clips
    .filter((c) => c.trackType === "audio")
    .map((c) => ({
      id: c.id,
      assetId: c.assetId,
      trackIndex: c.trackIndex,
      startTime: c.startTime,
      duration: c.duration,
    }));

  const errs = validateClipsForRender(imageClips, audioClips);
  for (const c of imageClips) {
    const a = assetMap.get(c.assetId);
    if (!a || a.type !== "image" || !existsSync(a.storagePath)) errs.push(`Missing image asset for clip at ${c.startTime}s`);
  }
  for (const c of audioClips) {
    const a = assetMap.get(c.assetId);
    if (!a || a.type !== "audio" || !existsSync(a.storagePath)) errs.push(`Missing audio asset for clip at ${c.startTime}s`);
  }
  if (errs.length) return NextResponse.json({ error: errs.join("; ") }, { status: 400 });

  const filename = sanitizeFilename(body.filename);

  const job = await prisma.renderJob.create({
    data: { projectId, status: "queued", progress: 0, filename },
  });

  const workerScript = path.join(process.cwd(), "src", "lib", "render-worker.mjs");
  const child = spawn(process.execPath, [workerScript, job.id], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  return NextResponse.json({ jobId: job.id, status: "queued" });
}
