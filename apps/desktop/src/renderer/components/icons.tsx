/* Shared line icons — 16×16, stroke=currentColor, matching the Sidebar set. */

interface IconProps {
  size?: number;
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function CalendarIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
    </svg>
  );
}

export function FlagIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 14V2.5M4 3h7l-1.5 2.5L11 8H4" />
    </svg>
  );
}

export function TagIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M2.5 7.3V3.5A1 1 0 0 1 3.5 2.5h3.8a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 0 1.4l-3.8 3.8a1 1 0 0 1-1.4 0L2.8 8a1 1 0 0 1-.3-.7Z" />
      <circle cx="5.6" cy="5.6" r="0.9" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7.5l3 3 5-6" />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function CircleIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  );
}

export function CircleCheckIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.5 8l1.8 1.8L10.8 6" strokeWidth={1.6} />
    </svg>
  );
}

export function ListIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 4.5h7M6 8h7M6 11.5h7" />
      <circle cx="3.2" cy="4.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="3.2" cy="8" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="3.2" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Stacked text lines — signals a task has a description. */
export function DescriptionIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 4.5h10M3 8h10M3 11.5h6" />
    </svg>
  );
}

/** Pencil — edit a label. */
export function PencilIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M10.2 3.1l2.7 2.7M11.3 2a1.3 1.3 0 0 1 1.8 1.8L5.4 11.5 2.3 12.6l1.1-3.1z" />
    </svg>
  );
}

/** Trash — delete a label. */
export function TrashIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 4.5h10M6.4 4.5V3.1a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v1.4M4.6 4.5l.5 8a1 1 0 0 0 1 .95h3.8a1 1 0 0 0 1-.95l.5-8" />
    </svg>
  );
}

/** Smiley — pick / change an emoji icon. */
export function SmileIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.5 9.5c.6.9 1.5 1.4 2.5 1.4s1.9-.5 2.5-1.4" />
      <path d="M6 6.25h.01M10 6.25h.01" />
    </svg>
  );
}
