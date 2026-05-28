import { create } from "zustand";

/** What the command palette is doing when open. */
export type PaletteMode =
  /** Search across actions, lists, and tasks. */
  | "default"
  /** Pick a list to create a task in (used by Cmd+N from the Today view). */
  | "newTask";

interface CommandState {
  /** Whether the Cmd+K command palette is open. */
  paletteOpen: boolean;
  paletteMode: PaletteMode;
  /** Whether the "?" shortcuts cheat sheet is open. */
  helpOpen: boolean;
  /** The todo row highlighted by the keyboard cursor (↑/↓), or null if none. */
  focusedTodoId: string | null;
  /**
   * The list whose "add task" input should be focused, or null. Keyed by listId
   * (not a bare flag) so that only the matching ListView consumes it — this
   * survives the navigate-then-focus race when switching lists from the palette.
   * ListView focuses its own input and clears this, keeping the DOM ref local.
   */
  pendingAddTaskListId: string | null;

  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
  togglePalette: () => void;
  openHelp: () => void;
  closeHelp: () => void;
  setFocusedTodo: (todoId: string | null) => void;
  requestAddTaskFocus: (listId: string) => void;
  clearAddTaskFocus: () => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  paletteOpen: false,
  paletteMode: "default",
  helpOpen: false,
  focusedTodoId: null,
  pendingAddTaskListId: null,

  openPalette: (mode = "default") =>
    set({ paletteOpen: true, paletteMode: mode, helpOpen: false }),
  closePalette: () => set({ paletteOpen: false, paletteMode: "default" }),
  togglePalette: () =>
    set((state) => ({
      paletteOpen: !state.paletteOpen,
      paletteMode: "default",
      helpOpen: false,
    })),
  openHelp: () => set({ helpOpen: true, paletteOpen: false }),
  closeHelp: () => set({ helpOpen: false }),
  setFocusedTodo: (todoId) => set({ focusedTodoId: todoId }),
  requestAddTaskFocus: (listId) => set({ pendingAddTaskListId: listId }),
  clearAddTaskFocus: () => set({ pendingAddTaskListId: null }),
}));
