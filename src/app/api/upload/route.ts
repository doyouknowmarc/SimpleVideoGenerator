import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { UPLOADS_DIR } from "@/lib/paths";
import { ffprobeDuration } from "@/lib/ffmpeg";
import { assetUrl } from "@/lib/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_MIME = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
  "audio/aac", "audio/mp4", "audio/x-m4a", "audio/m4a",
]);

function extFor(mime: string, filename: string): string {
  const m: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/aac": ".aac",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/m4a": ".m4a",
  };
  return m[mime] || path.extname(filename) || "";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const projectId = form.get("projectId");
  const file = form.get("file");

  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const isImage = IMAGE_MIME.has(file.type);
  const isAudio = AUDIO_MIME.has(file.type);
  if (!isImage && !isAudio) {
    return NextResponse.json({ error: `unsupported type: ${file.type}` }, { status: 400 });
  }

  await mkdir(UPLOADS_DIR, { recursive: true });

  const buf = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID().replace(/-/g, "");
  const ext = extFor(file.type, file.name);
  const storagePath = path.join(UPLOADS_DIR, id + ext);
  await writeFile(storagePath, buf);

  let duration: number | undefined;
  let width: number | undefined;
  let height: number | undefined;

  try {
    if (isImage) {
      const meta = await sharp(storagePath).metadata();
      width = meta.width;
      height = meta.height;
    } else {
      duration = await ffprobeDuration(storagePath);
    }
  } catch (e) {
    return NextResponse.json(
      { error: `failed to read metadata: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      projectId,
      type: isImage ? "image" : "audio",
      filename: file.name,
      storagePath,
      mimeType: file.type,
      duration: duration ?? null,
      width: width ?? null,
      height: height ?? null,
    },
  });

  return NextResponse.json({
    id: asset.id,
    projectId: asset.projectId,
    type: asset.type,
    filename: asset.filename,
    url: assetUrl(asset.id),
    mimeType: asset.mimeType,
    duration: asset.duration ?? undefined,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
  });
}
