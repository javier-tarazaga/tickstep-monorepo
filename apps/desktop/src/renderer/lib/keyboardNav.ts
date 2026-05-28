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
