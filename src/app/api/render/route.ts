import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "@/lib/db";
import { validateForRender } from "@/lib/timelineCalc";
import type { TimelineItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { projectId } = (await req.json()) as { projectId: string };
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const items = await prisma.timelineItem.findMany({
    where: { projectId }, orderBy: { positionIndex: "asc" },
  });
  const assets = await prisma.mediaAsset.findMany({ where: { projectId } });
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const tsItems: TimelineItem[] = items.map((i) => ({
    id: i.id,
    positionIndex: i.positionIndex,
    imageAssetId: i.imageAssetId,
    audioAssetId: i.audioAssetId ?? null,
    duration: i.duration,
    fitMode: i.fitMode as "cover" | "contain",
  }));

  const errs = validateForRender(tsItems);
  for (const it of items) {
    const img = assetMap.get(it.imageAssetId);
    if (!img || !existsSync(img.storagePath)) errs.push(`Missing image for scene ${it.positionIndex + 1}`);
    if (it.audioAssetId) {
      const aud = assetMap.get(it.audioAssetId);
      if (!aud || !existsSync(aud.storagePath)) errs.push(`Missing audio for scene ${it.positionIndex + 1}`);
    }
  }
  if (errs.length) return NextResponse.json({ error: errs.join("; ") }, { status: 400 });

  const job = await prisma.renderJob.create({
    data: { projectId, status: "queued", progress: 0 },
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
