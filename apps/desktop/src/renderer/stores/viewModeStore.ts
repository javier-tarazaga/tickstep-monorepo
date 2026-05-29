import { create } from "zustand";

/**
 * Whether each list renders as a flat list or a Kanban board. This is a local
 * view preference (not shared with collaborators), keyed by listId and persisted
 * to localStorage so a list reopens in the mode you left it in.
 */
export type ViewMode = "list" | "board";

const STORAGE_KEY = "tickstep-view-modes";

function load(): Record<string, ViewMode> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, ViewMode>;
  } catch {
    // ignore
  }
  return {};
}

function persist(modes: Record<string, ViewMode>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
  } catch {
    // ignore
  }
}

interface ViewModeState {
  modes: Record<string, ViewMode>;
  /** The mode for a list, defaulting to "list". */
  getViewMode: (listId: string) => ViewMode;
  setViewMode: (listId: string, mode: ViewMode) => void;
  toggleViewMode: (listId: string) => void;
}

export const useViewModeStore = create<ViewModeState>((set, get) => ({
  modes: load(),

  getViewMode: (listId) => get().modes[listId] ?? "list",

  setViewMode: (listId, mode) =>
    set((state) => {
      const modes = { ...state.modes, [listId]: mode };
      persist(modes);
      return { modes };
    }),

  toggleViewMode: (listId) =>
    set((state) => {
      const next: ViewMode =
        (state.modes[listId] ?? "list") === "list" ? "board" : "list";
      const modes = { ...state.modes, [listId]: next };
      persist(modes);
      return { modes };
    }),
}));
