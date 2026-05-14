import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.timelineClip.deleteMany({
      where: { projectId: asset.projectId, assetId: asset.id },
    });
    await tx.mediaAsset.delete({ where: { id: asset.id } });
  });

  await Promise.all([
    unlink(asset.storagePath).catch(() => {}),
    unlink(`${asset.storagePath}.waveform.png`).catch(() => {}),
  ]);

  return NextResponse.json({ ok: true });
}
