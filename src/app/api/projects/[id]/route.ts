import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PatchBody = {
  title?: string;
  items?: Array<{
    id?: string;
    imageAssetId: string;
    audioAssetId?: string | null;
    duration: number;
    fitMode: "cover" | "contain";
  }>;
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json()) as PatchBody;
  const projectId = params.id;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (body.title !== undefined) {
      await tx.project.update({ where: { id: projectId }, data: { title: body.title } });
    }
    if (body.items) {
      await tx.timelineItem.deleteMany({ where: { projectId } });
      if (body.items.length > 0) {
        await tx.timelineItem.createMany({
          data: body.items.map((it, idx) => ({
            projectId,
            positionIndex: idx,
            imageAssetId: it.imageAssetId,
            audioAssetId: it.audioAssetId ?? null,
            duration: it.duration,
            fitMode: it.fitMode,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
