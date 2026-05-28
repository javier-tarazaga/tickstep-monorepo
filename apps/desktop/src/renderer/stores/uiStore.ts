import { create } from "zustand";

/**
 * Cosmetic terminal-mode indicator. Reflects whether the user is editing a text
 * field (INSERT) or not (NORMAL), mirroring a modal editor's status line. Purely
 * visual — it never changes keybindings or behavior. Driven by a focusin/
 * focusout listener mounted once in AppLayout.
 */
export type UiMode = "NORMAL" | "INSERT";

/** The pane that owns the keyboard: [1] Lists, [2] Tasks, [3] Detail. */
export type Section = 1 | 2 | 3;

interface UiState {
  mode: UiMode;
  setMode: (mode: UiMode) => void;
  /** Which pane the keyboard is driving. Switched with 1/2/3 and Tab/⇧Tab. */
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  /** Step the active pane by ±1, wrapping around the three panes. */
  cycleSection: (dir: 1 | -1) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mode: "NORMAL",
  setMode: (mode) => set((s) => (s.mode === mode ? s : { mode })),
  activeSection: 2,
  setActiveSection: (section) =>
    set((s) => (s.activeSection === section ? s : { activeSection: section })),
  cycleSection: (dir) =>
    set((s) => ({ activeSection: (((s.activeSection - 1 + dir + 3) % 3) + 1) as Section })),
}));
