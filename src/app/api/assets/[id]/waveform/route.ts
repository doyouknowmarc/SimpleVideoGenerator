import { NextRequest } from "next/server";
import { existsSync, statSync, createReadStream } from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { FFMPEG } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 80;
const COLOR = "#15803d"; // emerald-700, readable on our light audio-clip bg

function generate(src: string, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, [
      "-y",
      "-i", src,
      "-filter_complex",
      `aformat=channel_layouts=mono,compand=gain=2,showwavespic=s=${WIDTH}x${HEIGHT}:colors=${COLOR}`,
      "-frames:v", "1",
      out,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset || asset.type !== "audio") return new Response("not found", { status: 404 });
  if (!existsSync(asset.storagePath)) return new Response("file missing", { status: 410 });

  const waveformPath = `${asset.storagePath}.waveform.png`;

  if (!existsSync(waveformPath)) {
    const tmpPath = `${waveformPath}.${randomUUID()}.tmp`;
    try {
      await generate(asset.storagePath, tmpPath);
      await rename(tmpPath, waveformPath);
    } catch (e) {
      await unlink(tmpPath).catch(() => {});
      console.error("waveform generation failed", e);
      return new Response("waveform unavailable", { status: 500 });
    }
  }

  let size: number;
  try { size = statSync(waveformPath).size; }
  catch { return new Response("file missing", { status: 410 }); }

  const nodeStream = createReadStream(waveformPath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
