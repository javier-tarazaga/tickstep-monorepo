import { useEffect } from "react";
import { useNavigationStore } from "../stores/navigationStore";
import { useCommandStore } from "../stores/commandStore";
import { getVisibleTodoOrder } from "../lib/keyboardNav";

/** True when the event targets an editable field, where typing should win. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/** Move the keyboard cursor by `delta` rows and scroll the new row into view. */
function moveCursor(delta: number) {
  const order = getVisibleTodoOrder();
  if (order.length === 0) return;

  const { focusedTodoId, setFocusedTodo } = useCommandStore.getState();
  const current = order.findIndex((t) => t.id === focusedTodoId);
  // From "nothing focused": ↓ lands on the first row, ↑ on the last.
  const nextIndex =
    current === -1
      ? delta > 0
        ? 0
        : order.length - 1
      : Math.min(Math.max(current + delta, 0), order.length - 1);

  const next = order[nextIndex];
  if (!next) return;
  setFocusedTodo(next.id);
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-todo-id="${next.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
}

/** Open the detail panel for the currently focused row, if any. */
function openFocusedTodo() {
  const { focusedTodoId } = useCommandStore.getState();
  if (!focusedTodoId) return;
  const ref = getVisibleTodoOrder().find((t) => t.id === focusedTodoId);
  if (ref) useNavigationStore.getState().selectTodo(ref.id, ref.listId);
}

/** Cmd+N: focus the add-task input, or pick a list first when on Today. */
function startNewTask() {
  const { currentView, selectedListId } = useNavigationStore.getState();
  const command = useCommandStore.getState();
  if (currentView === "list" && selectedListId) {
    command.requestAddTaskFocus(selectedListId);
  } else {
    command.openPalette("newTask");
  }
}

/** A blocking overlay (confirm dialog / context menu) owns the keyboard. */
function modalOverlayOpen(): boolean {
  return Boolean(
    document.querySelector(".confirm-overlay, .list-context-overlay"),
  );
}

/**
 * App-wide keyboard shortcuts. Mounted once from AppLayout. Uses a single
 * capture-phase listener (matching ConfirmDialog/ListContextMenu) and reads
 * stores via getState() to stay free of stale closures.
 *
 * Blocking overlays — confirm dialogs, context menus, and the help sheet (all
 * rendered on a backdrop) — short-circuit this handler so it never stacks on
 * top of them. The palette stays open under Cmd+K (to toggle closed) but owns
 * its own arrow/enter/escape handling while open.
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const command = useCommandStore.getState();

      // A blocking modal owns the keyboard — don't stack shortcuts on top of it.
      if (modalOverlayOpen()) return;

      // Cmd+K toggles the palette from anywhere else.
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        command.togglePalette();
        return;
      }

      // While the palette/help is open it handles its own navigation/dismissal.
      if (command.paletteOpen || command.helpOpen) return;

      // Mod-key actions fire regardless of focus (there's no menu bar to claim them).
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        startNewTask();
        return;
      }
      if (mod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        useNavigationStore.getState().navigateToToday();
        return;
      }

      // Plain keys must not hijack typing.
      if (isTypingTarget(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        command.openHelp();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveCursor(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveCursor(-1);
      } else if (e.key === "Enter" && command.focusedTodoId) {
        // Only claim Enter when a row cursor is active, so it can't double-fire
        // with whatever element actually holds DOM focus.
        e.preventDefault();
        openFocusedTodo();
      } else if (e.key === "Escape" && command.focusedTodoId) {
        // Clear the keyboard cursor so the user can return to "nothing
        // highlighted". Defer to the detail panel's own Escape when it's open
        // (that one closes the panel); a later Escape then clears the cursor.
        if (useNavigationStore.getState().selectedTodoId) return;
        e.preventDefault();
        command.setFocusedTodo(null);
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
