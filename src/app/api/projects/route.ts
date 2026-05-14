import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultProject, assetUrl } from "@/lib/project";

export const dynamic = "force-dynamic";

export async function GET() {
  const project = await getOrCreateDefaultProject();
  const [assets, items] = await Promise.all([
    prisma.mediaAsset.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } }),
    prisma.timelineItem.findMany({ where: { projectId: project.id }, orderBy: { positionIndex: "asc" } }),
  ]);
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
    items: items.map((i) => ({
      id: i.id,
      positionIndex: i.positionIndex,
      imageAssetId: i.imageAssetId,
      audioAssetId: i.audioAssetId,
      duration: i.duration,
      fitMode: i.fitMode,
    })),
  });
}
