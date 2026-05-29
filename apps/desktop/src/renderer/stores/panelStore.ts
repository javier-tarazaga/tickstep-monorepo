import { create } from "zustand";

/**
 * UI layout preferences for resizable surfaces. Persisted to localStorage so the
 * task detail panel and the main sidebar each keep the width the user dragged
 * them to across launches.
 */

export const TASK_PANEL_MIN_WIDTH = 300;
export const TASK_PANEL_MAX_WIDTH = 720;
export const TASK_PANEL_DEFAULT_WIDTH = 360;
/** Width of the collapsed detail pane — a thin rail that holds the expand affordance. */
export const TASK_PANEL_RAIL_WIDTH = 36;

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 440;
export const SIDEBAR_DEFAULT_WIDTH = 260;
/** Width of the collapsed sidebar — a thin rail that holds the expand affordance. */
export const SIDEBAR_RAIL_WIDTH = 36;

const TASK_PANEL_STORAGE_KEY = "tickstep-task-panel-width";
const TASK_PANEL_COLLAPSED_KEY = "tickstep-task-panel-collapsed";
const SIDEBAR_STORAGE_KEY = "tickstep-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "tickstep-sidebar-collapsed";

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

function getStoredFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored === "true";
  } catch {
    // ignore
  }
  return fallback;
}

interface PanelState {
  taskPanelWidth: number;
  /** When true the detail pane is collapsed to a thin rail, freeing the main view. */
  taskPanelCollapsed: boolean;
  sidebarWidth: number;
  /** When true the sidebar is collapsed to a thin rail, freeing the main view. */
  sidebarCollapsed: boolean;
  /** Commit a new task-panel width, clamping to bounds and persisting to disk. */
  setTaskPanelWidth: (width: number) => void;
  /** Collapse or expand the detail pane, persisting the choice to disk. */
  setTaskPanelCollapsed: (collapsed: boolean) => void;
  /** Flip the detail pane between collapsed and expanded. */
  toggleTaskPanelCollapsed: () => void;
  /** Commit a new sidebar width, clamping to bounds and persisting to disk. */
  setSidebarWidth: (width: number) => void;
  /** Collapse or expand the sidebar, persisting the choice to disk. */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Flip the sidebar between collapsed and expanded. */
  toggleSidebarCollapsed: () => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  taskPanelWidth: getStoredWidth(
    TASK_PANEL_STORAGE_KEY,
    clampTaskPanelWidth,
    TASK_PANEL_DEFAULT_WIDTH,
  ),
  taskPanelCollapsed: getStoredFlag(TASK_PANEL_COLLAPSED_KEY, false),
  sidebarWidth: getStoredWidth(
    SIDEBAR_STORAGE_KEY,
    clampSidebarWidth,
    SIDEBAR_DEFAULT_WIDTH,
  ),
  sidebarCollapsed: getStoredFlag(SIDEBAR_COLLAPSED_KEY, false),

  setTaskPanelWidth: (width) => {
    const next = clampTaskPanelWidth(Math.round(width));
    try {
      localStorage.setItem(TASK_PANEL_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
    set({ taskPanelWidth: next });
  },

  setTaskPanelCollapsed: (collapsed) => {
    if (get().taskPanelCollapsed === collapsed) return;
    try {
      localStorage.setItem(TASK_PANEL_COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore
    }
    set({ taskPanelCollapsed: collapsed });
  },

  toggleTaskPanelCollapsed: () => get().setTaskPanelCollapsed(!get().taskPanelCollapsed),

  setSidebarWidth: (width) => {
    const next = clampSidebarWidth(Math.round(width));
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
    set({ sidebarWidth: next });
  },

  setSidebarCollapsed: (collapsed) => {
    if (get().sidebarCollapsed === collapsed) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore
    }
    set({ sidebarCollapsed: collapsed });
  },

  toggleSidebarCollapsed: () => get().setSidebarCollapsed(!get().sidebarCollapsed),
}));
