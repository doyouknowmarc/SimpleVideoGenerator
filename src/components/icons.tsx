type IconProps = { size?: number; strokeWidth?: number; className?: string };

function svgProps(size: number, sw: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
}

export function IconPlay({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSkipBack({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
      <line x1="5" y1="5" x2="5" y2="19" />
    </svg>
  );
}

export function IconSkipForward({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

export function IconZoom({ size = 14, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

export function IconScissors({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

export function IconDuplicate({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconTrash({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconEye({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.1 5.4A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-2.4 3.4" />
      <path d="M6.4 6.9C3.6 8.8 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.1-.9" />
    </svg>
  );
}

export function IconFilm({ size = 14, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  );
}

export function IconVolume({ size = 14, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function IconClose({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconSidebar({ size = 16, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

export function IconChevron({ size = 14, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconLink({ size = 12, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, className)}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
    </svg>
  );
}
