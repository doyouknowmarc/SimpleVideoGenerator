import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultProject, assetUrl } from "@/lib/project";
import type { FitMode } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const project = await getOrCreateDefaultProject();
  const [assets, clips] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.timelineClip.findMany({
      where: { projectId: project.id },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const imageClips = clips
    .filter((c) => c.trackType === "image")
    .map((c) => ({
      id: c.id,
      assetId: c.assetId,
      startTime: c.startTime,
      duration: c.duration,
      fitMode: (c.fitMode ?? "contain") as FitMode,
    }));

  const audioClips = clips
    .filter((c) => c.trackType === "audio")
    .map((c) => ({
      id: c.id,
      assetId: c.assetId,
      startTime: c.startTime,
      duration: c.duration,
    }));

  return NextResponse.json({
    id: project.id,
    title: project.title,
    assets: assets.map((a) => ({
      id: a.id,
      projectId: a.projectId,
      type: a.type,
      filename: a.filename,
      url: assetUrl(a.id),
      mimeType: a.mimeType,
      duration: a.duration ?? undefined,
      width: a.width ?? undefined,
      height: a.height ?? undefined,
    })),
    imageClips,
    audioClips,
  });
}
