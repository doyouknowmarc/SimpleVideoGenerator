import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type IncomingImageClip = {
  assetId: string;
  name?: string;
  trackIndex?: number;
  startTime: number;
  duration: number;
  fitMode: "cover" | "contain";
};

type IncomingAudioClip = {
  assetId: string;
  name?: string;
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateTrackCount(value: unknown, label: string): string | null {
  if (value === undefined) return null;
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 1) {
    return `${label} must be a positive integer.`;
  }
  return null;
}

function validateImageClip(c: IncomingImageClip, index: number): string | null {
  if (typeof c.assetId !== "string" || !c.assetId) return `Image clip ${index + 1} missing asset.`;
  if (c.name !== undefined && typeof c.name !== "string") return `Image clip ${index + 1} has invalid name.`;
  if (!isFiniteNumber(c.startTime) || c.startTime < 0) return `Image clip ${index + 1} has invalid start time.`;
  if (!isFiniteNumber(c.duration) || c.duration <= 0) return `Image clip ${index + 1} has invalid duration.`;
  if (c.trackIndex !== undefined && (!isFiniteNumber(c.trackIndex) || !Number.isInteger(c.trackIndex) || c.trackIndex < 0)) {
    return `Image clip ${index + 1} has invalid track.`;
  }
  if (c.fitMode !== "cover" && c.fitMode !== "contain") return `Image clip ${index + 1} has invalid fit mode.`;
  return null;
}

function validateAudioClip(c: IncomingAudioClip, index: number): string | null {
  if (typeof c.assetId !== "string" || !c.assetId) return `Audio clip ${index + 1} missing asset.`;
  if (c.name !== undefined && typeof c.name !== "string") return `Audio clip ${index + 1} has invalid name.`;
  if (!isFiniteNumber(c.startTime) || c.startTime < 0) return `Audio clip ${index + 1} has invalid start time.`;
  if (!isFiniteNumber(c.duration) || c.duration <= 0) return `Audio clip ${index + 1} has invalid duration.`;
  if (c.trackIndex !== undefined && (!isFiniteNumber(c.trackIndex) || !Number.isInteger(c.trackIndex) || c.trackIndex < 0)) {
    return `Audio clip ${index + 1} has invalid track.`;
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json()) as PatchBody;
  const projectId = params.id;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const errors: string[] = [];
  if (body.title !== undefined && typeof body.title !== "string") errors.push("title must be a string.");
  const imageTrackError = validateTrackCount(body.imageTrackCount, "imageTrackCount");
  const audioTrackError = validateTrackCount(body.audioTrackCount, "audioTrackCount");
  if (imageTrackError) errors.push(imageTrackError);
  if (audioTrackError) errors.push(audioTrackError);
  if (body.imageClips !== undefined) {
    if (!Array.isArray(body.imageClips)) errors.push("imageClips must be an array.");
    else body.imageClips.forEach((c, i) => {
      const error = validateImageClip(c, i);
      if (error) errors.push(error);
    });
  }
  if (body.audioClips !== undefined) {
    if (!Array.isArray(body.audioClips)) errors.push("audioClips must be an array.");
    else body.audioClips.forEach((c, i) => {
      const error = validateAudioClip(c, i);
      if (error) errors.push(error);
    });
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  if (body.imageClips !== undefined || body.audioClips !== undefined) {
    const referenced = [
      ...(body.imageClips ?? []).map((c) => ({ id: c.assetId, type: "image" })),
      ...(body.audioClips ?? []).map((c) => ({ id: c.assetId, type: "audio" })),
    ];
    if (referenced.length > 0) {
      const assets = await prisma.mediaAsset.findMany({
        where: { projectId, id: { in: [...new Set(referenced.map((a) => a.id))] } },
        select: { id: true, type: true },
      });
      const assetMap = new Map(assets.map((a) => [a.id, a.type]));
      for (const asset of referenced) {
        if (assetMap.get(asset.id) !== asset.type) {
          return NextResponse.json({ error: `Invalid ${asset.type} asset: ${asset.id}` }, { status: 400 });
        }
      }
    }
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

      if (body.imageClips !== undefined && body.audioClips !== undefined) {
        await tx.timelineClip.deleteMany({ where: { projectId } });
      } else if (body.imageClips !== undefined) {
        await tx.timelineClip.deleteMany({ where: { projectId, trackType: "image" } });
      } else {
        await tx.timelineClip.deleteMany({ where: { projectId, trackType: "audio" } });
      }

      const data = [
        ...imageClips.map((c) => ({
          projectId,
          trackType: "image",
          trackIndex: c.trackIndex ?? 0,
          assetId: c.assetId,
          name: c.name?.trim() || null,
          startTime: c.startTime,
          duration: c.duration,
          fitMode: c.fitMode,
        })),
        ...audioClips.map((c) => ({
          projectId,
          trackType: "audio",
          trackIndex: c.trackIndex ?? 0,
          assetId: c.assetId,
          name: c.name?.trim() || null,
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
