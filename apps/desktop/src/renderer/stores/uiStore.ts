import { create } from "zustand";

/** The pane that owns the keyboard: [1] Lists, [2] Tasks, [3] Detail. */
export type Section = 1 | 2 | 3;

interface UiState {
  /** Which pane the keyboard is driving. Switched with 1/2/3 and Tab/⇧Tab. */
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  /** Step the active pane by ±1, wrapping around the three panes. */
  cycleSection: (dir: 1 | -1) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeSection: 2,
  setActiveSection: (section) =>
    set((s) => (s.activeSection === section ? s : { activeSection: section })),
  cycleSection: (dir) =>
    set((s) => ({ activeSection: (((s.activeSection - 1 + dir + 3) % 3) + 1) as Section })),
}));
