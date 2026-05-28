import { create } from "zustand";

/**
 * Cosmetic terminal-mode indicator. Reflects whether the user is editing a text
 * field (INSERT) or not (NORMAL), mirroring a modal editor's status line. Purely
 * visual — it never changes keybindings or behavior. Driven by a focusin/
 * focusout listener mounted once in AppLayout.
 */
export type UiMode = "NORMAL" | "INSERT";

interface UiState {
  mode: UiMode;
  setMode: (mode: UiMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mode: "NORMAL",
  setMode: (mode) => set((s) => (s.mode === mode ? s : { mode })),
}));
