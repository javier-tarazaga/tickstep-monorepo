import { create } from "zustand";
import type { Todo } from "@todo-app/shared-types";
import { apiClient } from "../api";

interface TodosState {
  /** Todos keyed by listId */
  todosByList: Record<string, Todo[]>;
  isLoading: boolean;
  error: string | null;

  fetchTodos: (listId: string) => Promise<void>;
  addTodo: (listId: string, title: string) => Promise<void>;
  removeTodo: (listId: string, todoId: string) => Promise<void>;
  toggleTodo: (listId: string, todoId: string) => Promise<void>;
}

export const useTodosStore = create<TodosState>((set) => ({
  todosByList: {},
  isLoading: false,
  error: null,

  fetchTodos: async (listId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getTodos(listId);
      set((state) => ({
        todosByList: { ...state.todosByList, [listId]: response.data.data },
        isLoading: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch todos",
        isLoading: false,
      });
    }
  },

  addTodo: async (listId: string, title: string) => {
    set({ error: null });
    try {
      const response = await apiClient.createTodo(listId, { title });
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: [...(state.todosByList[listId] ?? []), response.data],
        },
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to add todo",
      });
    }
  },

  removeTodo: async (listId: string, todoId: string) => {
    set({ error: null });
    try {
      await apiClient.deleteTodo(listId, todoId);
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).filter(
            (t) => t.id !== todoId,
          ),
        },
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to remove todo",
      });
    }
  },

  toggleTodo: async (listId: string, todoId: string) => {
    set({ error: null });
    try {
      const response = await apiClient.toggleTodo(listId, todoId);
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).map((t) =>
            t.id === todoId ? response.data : t,
          ),
        },
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to toggle todo",
      });
    }
  },
}));
