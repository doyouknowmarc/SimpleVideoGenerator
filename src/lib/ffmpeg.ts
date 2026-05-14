import { spawn } from "node:child_process";
import { FFMPEG, FFPROBE } from "./paths";

export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

export function ffprobeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFPROBE, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed: ${err}`));
      const v = parseFloat(out.trim());
      if (!isFinite(v) || v <= 0) return reject(new Error("invalid duration"));
      resolve(v);
    });
  });
}

export type RenderSceneOptions = {
  imagePath: string;
  audioPath?: string | null;
  duration: number;
  fitMode: "cover" | "contain";
  width: number;
  height: number;
  fps: number;
  outPath: string;
};

export async function renderScene(o: RenderSceneOptions): Promise<void> {
  const { imagePath, audioPath, duration, fitMode, width, height, fps, outPath } = o;

  const vf =
    fitMode === "cover"
      ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`
      : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;

  const args: string[] = [
    "-y",
    "-loop", "1",
    "-t", duration.toFixed(3),
    "-i", imagePath,
  ];

  if (audioPath) {
    args.push("-i", audioPath);
  } else {
    args.push("-f", "lavfi", "-t", duration.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  }

  args.push(
    "-vf", vf,
    "-r", String(fps),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-ac", "2",
    "-shortest",
    "-t", duration.toFixed(3),
    outPath,
  );

  await runFfmpeg(args);
}

export async function concatScenes(concatListPath: string, outPath: string): Promise<void> {
  await runFfmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatListPath,
    "-c", "copy",
    outPath,
  ]);
}
