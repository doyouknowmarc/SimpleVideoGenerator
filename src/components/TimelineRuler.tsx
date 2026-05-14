"use client";

type Props = {
  totalSeconds: number;
  pixelsPerSecond: number;
  width: number;
};

function pickMajorInterval(pps: number): number {
  // Aim for ~80px between major ticks
  const target = 80 / pps;
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  for (const c of candidates) {
    if (c >= target) return c;
  }
  return 600;
}

function fmtTime(t: number, major: number): string {
  if (major < 1) {
    return t.toFixed(1) + "s";
  }
  const m = Math.floor(t / 60);
  const s = Math.round(t - m * 60);
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TimelineRuler({ totalSeconds, pixelsPerSecond, width }: Props) {
  const major = pickMajorInterval(pixelsPerSecond);
  const minor = major / 5;

  const ticks: { t: number; isMajor: boolean }[] = [];
  const end = totalSeconds + major;
  for (let i = 0; i * minor <= end; i++) {
    const t = i * minor;
    const isMajor = Math.abs((t / major) - Math.round(t / major)) < 0.001;
    ticks.push({ t, isMajor });
  }

  return (
    <div className="timeline-ruler" style={{ width }}>
      {ticks.map((tick, i) => (
        <div
          key={i}
          className={`ruler-tick ${tick.isMajor ? "major" : "minor"}`}
          style={{ left: tick.t * pixelsPerSecond }}
        />
      ))}
      {ticks.filter((t) => t.isMajor).map((tick, i) => (
        <div
          key={`l${i}`}
          className="ruler-label"
          style={{ left: tick.t * pixelsPerSecond }}
        >
          {fmtTime(tick.t, major)}
        </div>
      ))}
    </div>
  );
}
