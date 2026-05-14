import path from "node:path";

export const ROOT = process.cwd();
export const UPLOADS_DIR = path.join(ROOT, "storage", "uploads");
export const RENDERS_DIR = path.join(ROOT, "storage", "renders");

export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
