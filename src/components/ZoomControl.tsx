"use client";
import { useEffect, useRef, useState } from "react";
import { IconZoom } from "./icons";

const SLIDER_MIN = 0.5;
const SLIDER_MAX = 100;
const HARD_MIN = 0.5;
const HARD_MAX = 800;

type Props = {
  value: number;
  onChange: (v: number) => void;
};

function clampHard(v: number) {
  if (!isFinite(v)) return SLIDER_MIN;
  return Math.max(HARD_MIN, Math.min(HARD_MAX, v));
}

export function ZoomControl({ value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [draft, setDraft] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (isFinite(parsed)) onChange(clampHard(parsed));
  }

  // Bound the value used for the slider thumb (so the slider still works
  // even when the typed value is above its max).
  const sliderValue = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value));
  const pct = ((sliderValue - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
  const overSlider = value > SLIDER_MAX;
  const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString();

  return (
    <div className="zoom-control">
      <IconZoom />
      <div
        className="zoom-slider-wrap"
        onPointerEnter={() => setShowValue(true)}
        onPointerLeave={() => { if (!editing) setShowValue(false); }}
        onFocusCapture={() => setShowValue(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShowValue(false);
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            min={HARD_MIN}
            max={HARD_MAX}
            step={0.5}
            className="zoom-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") { setEditing(false); setDraft(value.toString()); setShowValue(false); }
              e.stopPropagation();
            }}
          />
        ) : (
          <button
            type="button"
            className={`zoom-value ${showValue ? "visible" : ""} ${overSlider ? "over" : ""}`}
            style={{ left: `${pct}%` }}
            tabIndex={showValue ? 0 : -1}
            onClick={() => { setDraft(value < 10 ? value.toFixed(1) : Math.round(value).toString()); setEditing(true); }}
            title="Click to type a custom zoom (up to 800 px/s)"
          >
            {formatted}
          </button>
        )}
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={0.5}
          value={sliderValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          title="Zoom"
        />
      </div>
    </div>
  );
}
