import { create } from "zustand";

/**
 * UI layout preferences for resizable surfaces. Persisted to localStorage so the
 * task detail panel and the main sidebar each keep the width the user dragged
 * them to across launches.
 */

export const TASK_PANEL_MIN_WIDTH = 300;
export const TASK_PANEL_MAX_WIDTH = 720;
export const TASK_PANEL_DEFAULT_WIDTH = 360;

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 440;
export const SIDEBAR_DEFAULT_WIDTH = 260;

const TASK_PANEL_STORAGE_KEY = "tickstep-task-panel-width";
const SIDEBAR_STORAGE_KEY = "tickstep-sidebar-width";

export function clampTaskPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return TASK_PANEL_DEFAULT_WIDTH;
  return Math.min(TASK_PANEL_MAX_WIDTH, Math.max(TASK_PANEL_MIN_WIDTH, width));
}

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

function getStoredWidth(
  key: string,
  clamp: (n: number) => number,
  fallback: number,
): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return clamp(parseFloat(stored));
  } catch {
    // ignore
  }
  return fallback;
}

interface PanelState {
  taskPanelWidth: number;
  sidebarWidth: number;
  /** Commit a new task-panel width, clamping to bounds and persisting to disk. */
  setTaskPanelWidth: (width: number) => void;
  /** Commit a new sidebar width, clamping to bounds and persisting to disk. */
  setSidebarWidth: (width: number) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  taskPanelWidth: getStoredWidth(
    TASK_PANEL_STORAGE_KEY,
    clampTaskPanelWidth,
    TASK_PANEL_DEFAULT_WIDTH,
  ),
  sidebarWidth: getStoredWidth(
    SIDEBAR_STORAGE_KEY,
    clampSidebarWidth,
    SIDEBAR_DEFAULT_WIDTH,
  ),

  setTaskPanelWidth: (width) => {
    const next = clampTaskPanelWidth(Math.round(width));
    try {
      localStorage.setItem(TASK_PANEL_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
    set({ taskPanelWidth: next });
  },

  setSidebarWidth: (width) => {
    const next = clampSidebarWidth(Math.round(width));
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
    set({ sidebarWidth: next });
  },
}));
