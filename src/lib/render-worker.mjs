#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile, rename } from "node:fs/promises";
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

async function renderImageSegment({ imagePath, duration, fitMode, outPath }) {
  const vf =
    fitMode === "cover"
      ? `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1`
      : `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  const d = duration.toFixed(3);
  await runFfmpeg([
    "-y",
    "-loop", "1",
    "-t", d,
    "-i", imagePath,
    "-f", "lavfi",
    "-t", d,
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
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
  ]);
}

async function renderBlackSegment({ duration, outPath }) {
  const d = duration.toFixed(3);
  await runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", `color=c=black:s=${WIDTH}x${HEIGHT}:r=${FPS}`,
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t", d,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-ac", "2",
    "-shortest",
    "-t", d,
    outPath,
  ]);
}

async function concatSegments(listPath, outPath) {
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);
}

async function mixAudio({ audioClips, assetMap, totalDuration, outPath }) {
  const args = ["-y"];
  for (const clip of audioClips) {
    args.push("-i", assetMap.get(clip.assetId).storagePath);
  }
  const delayFilters = audioClips.map((clip, i) => {
    const ms = Math.max(0, Math.round(clip.startTime * 1000));
    // atrim limits the source to the clip's duration; adelay shifts it.
    return `[${i}:a]atrim=0:${clip.duration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${ms}|${ms}[a${i}]`;
  });
  const mixInputs = audioClips.map((_, i) => `[a${i}]`).join("");
  const filterComplex = [
    ...delayFilters,
    `${mixInputs}amix=inputs=${audioClips.length}:duration=longest:normalize=0[aout]`,
  ].join(";");

  args.push(
    "-filter_complex", filterComplex,
    "-map", "[aout]",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-ac", "2",
    "-t", totalDuration.toFixed(3),
    outPath,
  );
  await runFfmpeg(args);
}

async function combineVideoAndAudio({ videoPath, audioPath, totalDuration, outPath }) {
  await runFfmpeg([
    "-y",
    "-i", videoPath,
    "-i", audioPath,
    "-map", "0:v",
    "-map", "1:a",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-t", totalDuration.toFixed(3),
    outPath,
  ]);
}

async function setProgress(jobId, p) {
  await prisma.renderJob.update({ where: { id: jobId }, data: { progress: p } });
}

async function main() {
  const jobId = process.argv[2];
  if (!jobId) { console.error("jobId required"); process.exit(2); }

  try {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: "running", progress: 0 },
    });
    const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`Render job not found: ${jobId}`);

    const project = await prisma.project.findUnique({
      where: { id: job.projectId },
      select: { id: true },
    });
    if (!project) throw new Error(`Project not found for render job: ${job.projectId}`);

    const clips = await prisma.timelineClip.findMany({
      where: { projectId: job.projectId },
      orderBy: { startTime: "asc" },
    });
    const assets = await prisma.mediaAsset.findMany({ where: { projectId: job.projectId } });
    const assetMap = new Map(assets.map((a) => [a.id, a]));

    const imageClips = clips.filter((c) => c.trackType === "image");
    const audioClips = clips.filter((c) => c.trackType === "audio");

    for (const c of imageClips) {
      const asset = assetMap.get(c.assetId);
      if (!asset || asset.type !== "image" || !existsSync(asset.storagePath)) {
        throw new Error(`Missing image asset for clip at ${c.startTime}s`);
      }
    }
    for (const c of audioClips) {
      const asset = assetMap.get(c.assetId);
      if (!asset || asset.type !== "audio" || !existsSync(asset.storagePath)) {
        throw new Error(`Missing audio asset for clip at ${c.startTime}s`);
      }
    }

    const allEnds = [...imageClips, ...audioClips].map((c) => c.startTime + c.duration);
    const totalDuration = allEnds.length > 0 ? Math.max(...allEnds) : 0;
    if (totalDuration <= 0) throw new Error("Empty timeline");

    const jobDir = path.join(RENDERS_DIR, jobId);
    await mkdir(jobDir, { recursive: true });

    // ---------- Stage 1: build video track ----------
    // Multi-track: at each instant the topmost trackIndex with an active
    // clip wins. We sweep through all transition points (clip starts +
    // ends) and emit a segment for each interval where the active clip
    // stays constant.
    const epsilon = 0.001;
    const pointSet = new Set([0, totalDuration]);
    for (const c of imageClips) {
      pointSet.add(c.startTime);
      pointSet.add(c.startTime + c.duration);
    }
    const points = [...pointSet]
      .filter((p) => p >= -epsilon && p <= totalDuration + epsilon)
      .sort((a, b) => a - b);

    const rawSegments = [];
    for (let i = 0; i < points.length - 1; i++) {
      const segStart = points[i];
      const segEnd = points[i + 1];
      const segDur = segEnd - segStart;
      if (segDur < epsilon) continue;
      const mid = (segStart + segEnd) / 2;
      let active = null;
      for (const c of imageClips) {
        if (mid >= c.startTime - epsilon && mid < c.startTime + c.duration + epsilon) {
          if (active == null || c.trackIndex > active.trackIndex) active = c;
        }
      }
      if (active) {
        rawSegments.push({
          type: "image",
          duration: segDur,
          imagePath: assetMap.get(active.assetId).storagePath,
          fitMode: active.fitMode ?? "contain",
        });
      } else {
        rawSegments.push({ type: "black", duration: segDur });
      }
    }

    // Merge adjacent segments with the same image (avoids re-encoding the
    // same still across micro-intervals from overlapping start/end points)
    const segments = [];
    for (const s of rawSegments) {
      const last = segments[segments.length - 1];
      if (
        last &&
        ((last.type === "black" && s.type === "black") ||
          (last.type === "image" && s.type === "image" && last.imagePath === s.imagePath && last.fitMode === s.fitMode))
      ) {
        last.duration += s.duration;
      } else {
        segments.push({ ...s });
      }
    }

    const segmentFiles = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const out = path.join(jobDir, `segment-${String(i).padStart(3, "0")}.mp4`);
      if (seg.type === "image") {
        await renderImageSegment({
          imagePath: seg.imagePath,
          duration: seg.duration,
          fitMode: seg.fitMode,
          outPath: out,
        });
      } else {
        await renderBlackSegment({ duration: seg.duration, outPath: out });
      }
      segmentFiles.push(out);
      await setProgress(jobId, ((i + 1) / segments.length) * 0.6);
    }

    const concatList = path.join(jobDir, "concat.txt");
    await writeFile(
      concatList,
      segmentFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n",
    );
    const videoOnly = path.join(jobDir, "video_only.mp4");
    await concatSegments(concatList, videoOnly);
    await setProgress(jobId, 0.65);

    // ---------- Stage 2: audio mix ----------
    const finalPath = path.join(jobDir, "final.mp4");
    if (audioClips.length === 0) {
      // No audio clips — the silent track in video_only is fine. Just rename.
      await rename(videoOnly, finalPath);
      await setProgress(jobId, 0.95);
    } else {
      const audioMix = path.join(jobDir, "audio_mix.aac");
      await mixAudio({ audioClips, assetMap, totalDuration, outPath: audioMix });
      await setProgress(jobId, 0.85);

      // ---------- Stage 3: combine ----------
      await combineVideoAndAudio({
        videoPath: videoOnly,
        audioPath: audioMix,
        totalDuration,
        outPath: finalPath,
      });
      await setProgress(jobId, 0.95);
    }

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
