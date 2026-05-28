import { useNavigationStore } from "../stores/navigationStore";
import { useTodosStore } from "../stores/todosStore";
import { useTodoListsStore } from "../stores/todoListsStore";

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
