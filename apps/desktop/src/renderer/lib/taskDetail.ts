import type { CSSProperties } from "react";
import type { TodoPriority } from "@tickstep/shared-types";

/* ────────────────────────────────────────────────────────
   Priority metadata
   ──────────────────────────────────────────────────────── */

export interface PriorityMeta {
  value: TodoPriority;
  label: string;
  /** CSS class applied to .priority-dot for its color. */
  dotClass: string;
}

export const PRIORITY_META: PriorityMeta[] = [
  { value: "low", label: "Low", dotClass: "priority-low" },
  { value: "medium", label: "Medium", dotClass: "priority-medium" },
  { value: "high", label: "High", dotClass: "priority-high" },
];

export function priorityMeta(p: TodoPriority | null): PriorityMeta | null {
  return PRIORITY_META.find((m) => m.value === p) ?? null;
}

/* ────────────────────────────────────────────────────────
   Label swatch palette (theme-agnostic)
   Each is a valid #rrggbb so it passes the backend HEX_COLOR check.
   ──────────────────────────────────────────────────────── */

export const LABEL_SWATCHES = [
  "#2f7287", // steel blue (brand)
  "#dc2626", // red
  "#d97706", // amber
  "#ca8a04", // gold
  "#16a34a", // green
  "#0d9488", // teal
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
  "#57534e", // stone
] as const;

/* ────────────────────────────────────────────────────────
   Contrast: pick readable text color for a colored pill
   ──────────────────────────────────────────────────────── */

/** Returns "#ffffff" or a dark ink depending on the background luminance. */
export function contrastText(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  // Relative luminance (sRGB, linearized).
  const lin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55 ? "#1c1917" : "#ffffff";
}

/** Soft tinted pill style for a label shown on a list row: a low-alpha wash of
 *  the label's own color with a matching hairline border and colored ink.
 *  Reads legibly on both light and dark themes since the palette is mid-tone. */
export function labelChipStyle(hex: string): CSSProperties {
  const c = hex.replace("#", "");
  if (c.length !== 6) return {};
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return {};
  return {
    background: `rgba(${r}, ${g}, ${b}, 0.14)`,
    color: hex,
    boxShadow: `inset 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.3)`,
  };
}

/* ────────────────────────────────────────────────────────
   Dates — no external library
   ──────────────────────────────────────────────────────── */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Parse the YYYY-MM-DD portion of an ISO string into a local Date at noon
 *  (noon avoids timezone roll-over when only the date matters). */
function dateOnly(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today" / "Tomorrow" / "Yesterday" / "May 28" / "May 28, 2027". */
export function formatDueDate(iso: string): string {
  const d = dateOnly(iso);
  const now = new Date();
  const diffDays = Math.round(
    (startOfDay(d) - startOfDay(now)) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear()
    ? base
    : `${base}, ${d.getFullYear()}`;
}

/** True when the due date is strictly before today (for an unfinished task). */
export function isOverdue(iso: string): boolean {
  return startOfDay(dateOnly(iso)) < startOfDay(new Date());
}

/** Relative phrasing for a full timestamp: "just now", "5m ago", "on May 12". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const d = new Date(iso);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear()
    ? `on ${base}`
    : `on ${base}, ${d.getFullYear()}`;
}
