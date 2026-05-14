import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type IncomingImageClip = {
  assetId: string;
  startTime: number;
  duration: number;
  fitMode: "cover" | "contain";
};

type IncomingAudioClip = {
  assetId: string;
  startTime: number;
  duration: number;
};

type PatchBody = {
  title?: string;
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
    if (body.title !== undefined) {
      await tx.project.update({ where: { id: projectId }, data: { title: body.title } });
    }

    if (body.imageClips !== undefined || body.audioClips !== undefined) {
      const imageClips = body.imageClips ?? [];
      const audioClips = body.audioClips ?? [];

      await tx.timelineClip.deleteMany({ where: { projectId } });

      const data = [
        ...imageClips.map((c) => ({
          projectId,
          trackType: "image",
          assetId: c.assetId,
          startTime: c.startTime,
          duration: c.duration,
          fitMode: c.fitMode,
        })),
        ...audioClips.map((c) => ({
          projectId,
          trackType: "audio",
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
