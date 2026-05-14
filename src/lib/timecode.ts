export function formatTimecode(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const totalSec = Math.floor(t);
  const ms = t - totalSec;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const frames = Math.floor(ms * 30);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(frames)}`;
}

/**
 * Parse a user-typed time string back to seconds.
 * Accepts:
 *   "90"            -> 90 seconds
 *   "1:30"          -> 1 min 30 sec = 90
 *   "1:30.15"       -> 1 min 30.5 sec (frames @30fps)
 *   "00:01:30"      -> 1 min 30 sec
 *   "00:01:30.15"   -> 1 min 30.5 sec
 *   "1m 30s"        -> 90 (free-form)
 * Returns null if unparseable.
 */
export function parseTimecode(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;

  // Free-form: "1m 30s" or "90s"
  const free = raw.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?$/i);
  if (free && (free[1] || free[2] || free[3])) {
    const h = parseFloat(free[1] ?? "0");
    const m = parseFloat(free[2] ?? "0");
    const s = parseFloat(free[3] ?? "0");
    return h * 3600 + m * 60 + s;
  }

  // Colon form: HH:MM:SS[.FF], MM:SS[.FF], or plain seconds
  const colon = raw.split(":");
  if (colon.length === 1) {
    const v = parseFloat(colon[0]);
    return isFinite(v) ? v : null;
  }
  if (colon.length === 2 || colon.length === 3) {
    let h = 0, m = 0;
    let secStr = "";
    if (colon.length === 3) {
      h = parseInt(colon[0], 10);
      m = parseInt(colon[1], 10);
      secStr = colon[2];
    } else {
      m = parseInt(colon[0], 10);
      secStr = colon[1];
    }
    // Seconds part may be "12" or "12.34" (decimal) or "12.05" treated as 12s + 5/30 frames
    // We accept both: prefer plain decimal interpretation.
    const dot = secStr.split(".");
    let s = parseInt(dot[0], 10);
    let frac = 0;
    if (dot.length === 2) {
      // Frames: 2 digits, assume 30fps
      const ff = parseInt(dot[1], 10);
      if (!isNaN(ff)) frac = ff / 30;
    }
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
    return h * 3600 + m * 60 + s + frac;
  }
  return null;
}
