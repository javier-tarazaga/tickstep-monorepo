import { useEffect } from "react";
import { useNavigationStore } from "../stores/navigationStore";
import { useCommandStore } from "../stores/commandStore";
import { useTodosStore } from "../stores/todosStore";
import { useUiStore, type Section } from "../stores/uiStore";
import { useViewModeStore } from "../stores/viewModeStore";
import {
  getBoardGrid,
  getVisibleListOrder,
  getVisibleTodoOrder,
  isBoardActive,
} from "../lib/keyboardNav";

/** True when the event targets an editable field, where typing should win. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/** Release a focused text field so the keyboard returns to pane navigation. */
function blurActiveTypingTarget() {
  const el = document.activeElement;
  if (isTypingTarget(el)) (el as HTMLElement).blur();
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

/** Toggle the completed state of the currently focused row, if any. */
function toggleFocusedTodo() {
  const { focusedTodoId } = useCommandStore.getState();
  if (!focusedTodoId) return;
  const ref = getVisibleTodoOrder().find((t) => t.id === focusedTodoId);
  if (ref) useTodosStore.getState().toggleTodo(ref.listId, ref.id);
}

/**
 * Move the board cursor across columns (dCol) and within a column (dRow),
 * skipping empty columns when moving sideways and clamping the row to the
 * destination column's length. Reuses `focusedTodoId` as the single cursor.
 */
function moveBoardCursor(dCol: number, dRow: number) {
  const board = getBoardGrid();
  if (!board) return;
  const { focusedTodoId, setFocusedTodo } = useCommandStore.getState();

  let col = -1;
  let row = -1;
  board.columns.forEach((ids, ci) => {
    const ri = focusedTodoId ? ids.indexOf(focusedTodoId) : -1;
    if (ri !== -1) {
      col = ci;
      row = ri;
    }
  });

  if (col === -1) {
    // Nothing focused yet — land on the first card of the first non-empty column.
    col = board.columns.findIndex((ids) => ids.length > 0);
    if (col === -1) return;
    row = 0;
  } else {
    if (dCol !== 0) {
      let nc = col + dCol;
      while (nc >= 0 && nc < board.columns.length) {
        if (board.columns[nc]!.length > 0) break;
        nc += dCol;
      }
      if (nc >= 0 && nc < board.columns.length && board.columns[nc]!.length > 0) {
        col = nc;
        row = Math.min(row, board.columns[col]!.length - 1);
      }
    }
    if (dRow !== 0) {
      const len = board.columns[col]!.length;
      row = Math.min(Math.max(row + dRow, 0), Math.max(len - 1, 0));
    }
  }

  const next = board.columns[col]?.[row];
  if (!next) return;
  setFocusedTodo(next);
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-todo-id="${next}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

/** v: flip the selected list between list and board view. */
function toggleViewMode() {
  const { currentView, selectedListId } = useNavigationStore.getState();
  if (currentView === "list" && selectedListId) {
    useViewModeStore.getState().toggleViewMode(selectedListId);
  }
}

/* ── Pane [1] Lists: move the sidebar cursor and open lists ───────── */

/** Move the Lists cursor by `delta` rows and scroll the new row into view. */
function moveListCursor(delta: number) {
  const order = getVisibleListOrder();
  if (order.length === 0) return;

  const { focusedListKey, setFocusedListKey } = useCommandStore.getState();
  const current = order.findIndex((r) => r.key === focusedListKey);
  const nextIndex =
    current === -1
      ? delta > 0
        ? 0
        : order.length - 1
      : Math.min(Math.max(current + delta, 0), order.length - 1);

  const next = order[nextIndex];
  if (!next) return;
  setFocusedListKey(next.key);
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-list-key="${next.key}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
}

/** Open the list under the Lists cursor, then hand the keyboard to pane [2]. */
function openFocusedList() {
  const { focusedListKey } = useCommandStore.getState();
  if (!focusedListKey) return;
  const nav = useNavigationStore.getState();
  if (focusedListKey === "today") nav.navigateToToday();
  else nav.navigateToList(focusedListKey);
  useUiStore.getState().setActiveSection(2);
}

/* ── Pane [3] Detail: arrows scroll the detail body ───────────────── */

function scrollActiveDetail(delta: number) {
  const el = document.querySelector(".task-panel-content");
  if (el instanceof HTMLElement) el.scrollBy({ top: delta });
}

/**
 * Switch the keyboard-active pane. When landing on Lists [1], seed its cursor
 * from the current selection so ↑/↓ has somewhere to start.
 */
function activateSection(section: Section) {
  useUiStore.getState().setActiveSection(section);
  if (section !== 1) return;
  const command = useCommandStore.getState();
  if (command.focusedListKey) return;
  const nav = useNavigationStore.getState();
  const seed =
    nav.currentView === "today"
      ? "today"
      : nav.selectedListId ?? getVisibleListOrder()[0]?.key ?? null;
  command.setFocusedListKey(seed);
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

      // Tab/⇧Tab cycle panes from anywhere — including while a field is focused
      // — so the keyboard is never trapped inside an input. Blur the field first
      // so the destination pane fully owns the keyboard.
      if (!mod && e.key === "Tab") {
        e.preventDefault();
        blurActiveTypingTarget();
        const dir = e.shiftKey ? -1 : 1;
        useUiStore.getState().cycleSection(dir);
        activateSection(useUiStore.getState().activeSection);
        return;
      }

      // Plain keys must not hijack typing.
      if (isTypingTarget(e.target)) return;

      // Jump to a pane by number. Bare keys only, so OS chords like ⌘1 keep
      // their meaning and digits stay typeable inside fields above.
      if (!mod && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        activateSection(Number(e.key) as Section);
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        command.openHelp();
        return;
      }

      // v: toggle the active list between list and board view.
      if (!mod && e.key.toLowerCase() === "v") {
        const { currentView, selectedListId } = useNavigationStore.getState();
        if (currentView === "list" && selectedListId) {
          e.preventDefault();
          toggleViewMode();
          return;
        }
      }

      const section = useUiStore.getState().activeSection;

      // Board view in pane [2] uses 2D arrow/h-j-k-l navigation.
      if (
        section === 2 &&
        isBoardActive() &&
        (e.key === "ArrowDown" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight")
      ) {
        e.preventDefault();
        if (e.key === "ArrowDown") moveBoardCursor(0, 1);
        else if (e.key === "ArrowUp") moveBoardCursor(0, -1);
        else if (e.key === "ArrowRight") moveBoardCursor(1, 0);
        else moveBoardCursor(-1, 0);
        return;
      }

      // ↑/↓ drive whichever pane is active.
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        if (section === 1) moveListCursor(delta);
        else if (section === 3) scrollActiveDetail(delta * 64);
        else moveCursor(delta);
        return;
      }

      if (e.key === "Enter") {
        if (section === 1 && command.focusedListKey) {
          e.preventDefault();
          openFocusedList();
        } else if (section === 2 && command.focusedTodoId) {
          // Only claim Enter when a row cursor is active, so it can't
          // double-fire with whatever element actually holds DOM focus.
          e.preventDefault();
          openFocusedTodo();
        }
        return;
      }

      if (e.key === " " && section === 2 && command.focusedTodoId) {
        // Space toggles the highlighted row's completed state, mirroring its
        // checkbox. Gated to a live cursor so it can't steal Space (and the
        // default page scroll only matters once a row is highlighted anyway).
        e.preventDefault();
        toggleFocusedTodo();
        return;
      }

      if (e.key === "Escape") {
        // Clear the active pane's keyboard cursor so the user can return to
        // "nothing highlighted". Defer to the detail panel's own Escape when
        // it's open (that one closes the panel); a later Escape then clears.
        if (section === 1 && command.focusedListKey) {
          e.preventDefault();
          command.setFocusedListKey(null);
        } else if (section === 2 && command.focusedTodoId) {
          if (useNavigationStore.getState().selectedTodoId) return;
          e.preventDefault();
          command.setFocusedTodo(null);
        }
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
