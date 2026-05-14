"use client";
import { IconPlay, IconPause, IconSkipBack, IconSkipForward } from "./icons";

function fmtTimecode(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const totalSec = Math.floor(t);
  const ms = t - totalSec;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const frames = Math.floor(ms * 30); // 30fps reference
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(frames)}`;
}

type Props = {
  playing: boolean;
  currentTime: number;
  totalDuration: number;
  onPlayToggle: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  disabled: boolean;
};

export function TransportControls({
  playing,
  currentTime,
  totalDuration,
  onPlayToggle,
  onStepBack,
  onStepForward,
  disabled,
}: Props) {
  return (
    <div className="transport">
      <div className="transport-buttons">
        <button className="transport-btn" onClick={onStepBack} disabled={disabled} title="Jump to start">
          <IconSkipBack size={14} />
        </button>
        <button
          className="transport-btn primary"
          onClick={onPlayToggle}
          disabled={disabled}
          title={playing ? "Pause (Space)" : "Play (Space)"}
        >
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </button>
        <button className="transport-btn" onClick={onStepForward} disabled={disabled} title="Jump to end">
          <IconSkipForward size={14} />
        </button>
      </div>
      <div className="timecode">{fmtTimecode(currentTime)} / {fmtTimecode(totalDuration)}</div>
    </div>
  );
}
