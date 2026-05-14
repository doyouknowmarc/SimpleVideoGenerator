import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type IncomingImageClip = {
  assetId: string;
  trackIndex?: number;
  startTime: number;
  duration: number;
  fitMode: "cover" | "contain";
};

type IncomingAudioClip = {
  assetId: string;
  trackIndex?: number;
  startTime: number;
  duration: number;
};

type PatchBody = {
  title?: string;
  imageTrackCount?: number;
  audioTrackCount?: number;
  imageClips?: IncomingImageClip[];
  audioClips?: IncomingAudioClip[];
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json()) as PatchBody;
  const projectId = params.id;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const projectUpdate: Record<string, unknown> = {};
    if (body.title !== undefined) projectUpdate.title = body.title;
    if (body.imageTrackCount !== undefined) projectUpdate.imageTrackCount = Math.max(1, body.imageTrackCount);
    if (body.audioTrackCount !== undefined) projectUpdate.audioTrackCount = Math.max(1, body.audioTrackCount);
    if (Object.keys(projectUpdate).length > 0) {
      await tx.project.update({ where: { id: projectId }, data: projectUpdate });
    }

    if (body.imageClips !== undefined || body.audioClips !== undefined) {
      const imageClips = body.imageClips ?? [];
      const audioClips = body.audioClips ?? [];

      await tx.timelineClip.deleteMany({ where: { projectId } });

      const data = [
        ...imageClips.map((c) => ({
          projectId,
          trackType: "image",
          trackIndex: c.trackIndex ?? 0,
          assetId: c.assetId,
          startTime: c.startTime,
          duration: c.duration,
          fitMode: c.fitMode,
        })),
        ...audioClips.map((c) => ({
          projectId,
          trackType: "audio",
          trackIndex: c.trackIndex ?? 0,
          assetId: c.assetId,
          startTime: c.startTime,
          duration: c.duration,
          fitMode: null,
        })),
      ];

      if (data.length > 0) {
        await tx.timelineClip.createMany({ data });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
