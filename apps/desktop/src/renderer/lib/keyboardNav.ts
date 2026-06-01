import { useNavigationStore } from "../stores/navigationStore";
import { useTodosStore } from "../stores/todosStore";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useBoardColumnsStore } from "../stores/boardColumnsStore";
import { useViewModeStore } from "../stores/viewModeStore";

/** True when the target is an editable field, where typing should win over
 *  keyboard navigation. Shared by the global shortcut handler and the detail
 *  panel's field cursor so both yield to in-progress text editing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/** A todo reference in the order it appears on screen. */
export interface VisibleTodoRef {
  id: string;
  listId: string;
}

/**
 * The todos currently rendered in the main view, top to bottom.
 *
 * Mirrors the render order of ListView / TodayView (incomplete first, then
 * completed; lists in store order for Today) so the ↑/↓ cursor lines up with
 * what the user sees. Reads stores via getState() so it can be called from a
 * plain event handler without React subscriptions.
 */
export function getVisibleTodoOrder(): VisibleTodoRef[] {
  const { currentView, selectedListId } = useNavigationStore.getState();
  const { todosByList } = useTodosStore.getState();

  if (currentView === "list") {
    if (!selectedListId) return [];
    const todos = todosByList[selectedListId] ?? [];
    return [
      ...todos.filter((t) => !t.completed),
      ...todos.filter((t) => t.completed),
    ].map((t) => ({ id: t.id, listId: selectedListId }));
  }

  // Today view: incomplete across all lists, then completed across all lists.
  const { lists } = useTodoListsStore.getState();
  const collect = (completed: boolean): VisibleTodoRef[] =>
    lists.flatMap((list) =>
      (todosByList[list.id] ?? [])
        .filter((t) => t.completed === completed)
        .map((t) => ({ id: t.id, listId: list.id })),
    );
  return [...collect(false), ...collect(true)];
}

/** True when the selected list is currently shown as a board. */
export function isBoardActive(): boolean {
  const { currentView, selectedListId } = useNavigationStore.getState();
  if (currentView !== "list" || !selectedListId) return false;
  return useViewModeStore.getState().getViewMode(selectedListId) === "board";
}

/**
 * The selected list's board as a 2D grid of todo ids — one inner array per
 * column, left to right, each in card order (position). Used for board cursor
 * navigation. Returns null when no list/board is active.
 */
export function getBoardGrid(): { listId: string; columns: string[][] } | null {
  const { currentView, selectedListId } = useNavigationStore.getState();
  if (currentView !== "list" || !selectedListId) return null;

  const columns =
    useBoardColumnsStore.getState().columnsByList[selectedListId] ?? [];
  const todos = useTodosStore.getState().todosByList[selectedListId] ?? [];
  if (columns.length === 0) return null;

  const ordered = [...columns].sort((a, b) => a.position - b.position);
  const known = new Set(ordered.map((c) => c.id));
  const firstId = ordered[0]?.id;

  const grid = ordered.map(() => [] as string[]);
  const indexById = new Map(ordered.map((c, i) => [c.id, i]));
  const sorted = [...todos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const todo of sorted) {
    const colId =
      todo.columnId && known.has(todo.columnId) ? todo.columnId : firstId;
    if (!colId) continue;
    grid[indexById.get(colId) ?? 0]?.push(todo.id);
  }
  return { listId: selectedListId, columns: grid };
}

/** A selectable row in the Lists sidebar, in render order. */
export interface VisibleListRef {
  /** "today" for the Today row, otherwise the list id. */
  key: string;
  /** The list to open, or null for the Today view. */
  listId: string | null;
}

/**
 * The sidebar rows the keyboard cursor can land on, top to bottom. Mirrors
 * Sidebar's render order: Today, then each expanded section's lists, then
 * unsectioned lists, then lists shared with you. Collapsed sections contribute
 * nothing (their lists aren't on screen). Reads stores via getState() so it can
 * run from a plain event handler.
 */
export function getVisibleListOrder(): VisibleListRef[] {
  const { lists, sections, unsectionedListIds } = useTodoListsStore.getState();

  const owned = lists.filter((l) => l.isOwner !== false);
  const shared = lists.filter((l) => l.isOwner === false);
  const byId = new Map(owned.map((l) => [l.id, l]));
  const sectionedIds = new Set(sections.flatMap((s) => s.listIds));

  const rows: VisibleListRef[] = [{ key: "today", listId: null }];

  for (const section of sections) {
    if (!section.isExpanded) continue;
    for (const id of section.listIds) {
      if (byId.has(id)) rows.push({ key: id, listId: id });
    }
  }

  // Unsectioned owned lists, persisted order first, then any stragglers.
  const seen = new Set<string>();
  for (const id of unsectionedListIds) {
    if (byId.has(id) && !sectionedIds.has(id)) {
      rows.push({ key: id, listId: id });
      seen.add(id);
    }
  }
  for (const l of owned) {
    if (!sectionedIds.has(l.id) && !seen.has(l.id)) {
      rows.push({ key: l.id, listId: l.id });
    }
  }

  for (const l of [...shared].sort((a, b) => a.name.localeCompare(b.name))) {
    rows.push({ key: l.id, listId: l.id });
  }

  return rows;
}
