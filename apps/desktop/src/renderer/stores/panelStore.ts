import { create } from "zustand";

/**
 * UI layout preferences for resizable surfaces. Persisted to localStorage so the
 * task detail panel keeps the width the user dragged it to across launches.
 */

export const TASK_PANEL_MIN_WIDTH = 300;
export const TASK_PANEL_MAX_WIDTH = 720;
export const TASK_PANEL_DEFAULT_WIDTH = 360;

const STORAGE_KEY = "tickstep-task-panel-width";

export function clampTaskPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return TASK_PANEL_DEFAULT_WIDTH;
  return Math.min(TASK_PANEL_MAX_WIDTH, Math.max(TASK_PANEL_MIN_WIDTH, width));
}

function getStoredWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return clampTaskPanelWidth(parseFloat(stored));
  } catch {
    // ignore
  }
  return TASK_PANEL_DEFAULT_WIDTH;
}

interface PanelState {
  taskPanelWidth: number;
  /** Commit a new width, clamping to bounds and persisting to disk. */
  setTaskPanelWidth: (width: number) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  taskPanelWidth: getStoredWidth(),

  setTaskPanelWidth: (width) => {
    const next = clampTaskPanelWidth(Math.round(width));
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
    set({ taskPanelWidth: next });
  },
}));
