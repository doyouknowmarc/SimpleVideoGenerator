#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const RENDERS_DIR = path.join(process.cwd(), "storage", "renders");
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 16000) stderr = stderr.slice(-16000);
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function renderScene({ imagePath, audioPath, duration, fitMode, outPath }) {
  const vf =
    fitMode === "cover"
      ? `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1`
      : `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  const d = duration.toFixed(3);
  const args = ["-y", "-loop", "1", "-t", d, "-i", imagePath];
  if (audioPath) args.push("-i", audioPath);
  else args.push("-f", "lavfi", "-t", d, "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  args.push(
    "-vf", vf,
    "-r", String(FPS),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-ac", "2",
    "-shortest",
    "-t", d,
    outPath,
  );
  await runFfmpeg(args);
}

async function concatScenes(listPath, outPath) {
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);
}

async function main() {
  const jobId = process.argv[2];
  if (!jobId) { console.error("jobId required"); process.exit(2); }

  try {
    await prisma.renderJob.update({ where: { id: jobId }, data: { status: "running", progress: 0 } });
    const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
    const items = await prisma.timelineItem.findMany({
      where: { projectId: job.projectId },
      orderBy: { positionIndex: "asc" },
    });
    const assets = await prisma.mediaAsset.findMany({ where: { projectId: job.projectId } });
    const assetMap = new Map(assets.map((a) => [a.id, a]));

    const jobDir = path.join(RENDERS_DIR, jobId);
    await mkdir(jobDir, { recursive: true });

    const sceneFiles = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const img = assetMap.get(it.imageAssetId);
      const aud = it.audioAssetId ? assetMap.get(it.audioAssetId) : null;
      const out = path.join(jobDir, `scene-${String(i).padStart(3, "0")}.mp4`);
      await renderScene({
        imagePath: img.storagePath,
        audioPath: aud ? aud.storagePath : null,
        duration: it.duration,
        fitMode: it.fitMode,
        outPath: out,
      });
      sceneFiles.push(out);
      await prisma.renderJob.update({
        where: { id: jobId },
        data: { progress: ((i + 1) / items.length) * 0.9 },
      });
    }

    const listPath = path.join(jobDir, "concat.txt");
    await writeFile(
      listPath,
      sceneFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n",
    );
    const finalPath = path.join(jobDir, "final.mp4");
    await concatScenes(listPath, finalPath);

    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        progress: 1,
        outputPath: finalPath,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("render failed", e);
    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: String(e && e.message ? e.message : e).slice(0, 4000),
        completedAt: new Date(),
      },
    }).catch(() => {});
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
