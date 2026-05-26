import { create } from "zustand";

export type View = "today" | "list";

interface NavigationState {
  currentView: View;
  selectedListId: string | null;
  /** The todo whose detail panel is open. Panel is open ⇔ selectedTodoId !== null. */
  selectedTodoId: string | null;
  selectedTodoListId: string | null;

  navigateToToday: () => void;
  navigateToList: (listId: string) => void;
  selectTodo: (todoId: string, listId: string) => void;
  closeTodo: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentView: "today",
  selectedListId: null,
  selectedTodoId: null,
  selectedTodoListId: null,

  navigateToToday: () =>
    set({
      currentView: "today",
      selectedListId: null,
      selectedTodoId: null,
      selectedTodoListId: null,
    }),

  navigateToList: (listId: string) =>
    set({
      currentView: "list",
      selectedListId: listId,
      selectedTodoId: null,
      selectedTodoListId: null,
    }),

  selectTodo: (todoId: string, listId: string) =>
    set({ selectedTodoId: todoId, selectedTodoListId: listId }),

  closeTodo: () => set({ selectedTodoId: null, selectedTodoListId: null }),
}));
