import { create } from "zustand";
import type { Label, Todo, UpdateTodoDto } from "@tickstep/shared-types";
import { apiClient } from "../api";
import { useLabelsStore } from "./labelsStore";

interface TodosState {
  /** Todos keyed by listId */
  todosByList: Record<string, Todo[]>;
  isLoading: boolean;
  error: string | null;

  fetchTodos: (listId: string) => Promise<void>;
  addTodo: (listId: string, title: string) => Promise<void>;
  removeTodo: (listId: string, todoId: string) => Promise<void>;
  toggleTodo: (listId: string, todoId: string) => Promise<void>;
  /** Optimistic per-field update (title, description, dueDate, priority, completed). */
  updateTodo: (
    listId: string,
    todoId: string,
    dto: UpdateTodoDto,
  ) => Promise<void>;
  addLabelToTodo: (
    listId: string,
    todoId: string,
    labelId: string,
  ) => Promise<void>;
  removeLabelFromTodo: (
    listId: string,
    todoId: string,
    labelId: string,
  ) => Promise<void>;
  /** Reflect a catalogue label rename/recolor across every loaded todo's
   *  embedded copy (todos carry denormalized label snapshots). */
  applyLabelUpdate: (label: Label) => void;
  /** Strip a deleted catalogue label from every loaded todo. */
  applyLabelRemoval: (labelId: string) => void;
}

/**
 * Per-list request token ("epoch"). A `fetchTodos` records the current token
 * when it dispatches and only commits its result if the token is still current.
 * Every optimistic mutation bumps the token, so a GET that was already in flight
 * when you edited can no longer overwrite your change with stale server data.
 * It also dedupes overlapping fetches — the latest one wins.
 */
const loadToken = new Map<string, number>();

/** Invalidate any in-flight fetch for a list and return the new current token. */
function bumpLoadToken(listId: string): number {
  const next = (loadToken.get(listId) ?? 0) + 1;
  loadToken.set(listId, next);
  return next;
}

export const useTodosStore = create<TodosState>((set, get) => ({
  todosByList: {},
  isLoading: false,
  error: null,

  fetchTodos: async (listId: string) => {
    set({ isLoading: true, error: null });
    const token = bumpLoadToken(listId);
    try {
      const response = await apiClient.getTodos(listId);
      // A newer fetch or an optimistic mutation superseded this response while
      // it was in flight — drop it rather than clobber the current state.
      if (loadToken.get(listId) !== token) {
        set({ isLoading: false });
        return;
      }
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
    // Invalidate any in-flight fetch so it can't wipe this optimistic insert.
    bumpLoadToken(listId);
    // Optimistic: insert a placeholder with a temp id so the row appears on
    // submit, then swap in the server's todo (real id) once it returns.
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const placeholder: Todo = {
      id: tempId,
      title,
      description: null,
      completed: false,
      dueDate: null,
      priority: null,
      labels: [],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      error: null,
      todosByList: {
        ...state.todosByList,
        [listId]: [...(state.todosByList[listId] ?? []), placeholder],
      },
    }));

    try {
      const response = await apiClient.createTodo(listId, { title });
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).map((t) =>
            t.id === tempId ? response.data : t,
          ),
        },
      }));
    } catch (err) {
      // Drop the placeholder; the create never landed.
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).filter(
            (t) => t.id !== tempId,
          ),
        },
        error: err instanceof Error ? err.message : "Failed to add todo",
      }));
    }
  },

  removeTodo: async (listId: string, todoId: string) => {
    // Invalidate any in-flight fetch so it can't resurrect the removed row.
    bumpLoadToken(listId);
    // Optimistic: drop the row immediately, keeping a snapshot to roll back to.
    const previous = get().todosByList[listId];

    set((state) => ({
      error: null,
      todosByList: {
        ...state.todosByList,
        [listId]: (state.todosByList[listId] ?? []).filter(
          (t) => t.id !== todoId,
        ),
      },
    }));

    try {
      await apiClient.deleteTodo(listId, todoId);
    } catch (err) {
      if (previous) {
        set((state) => ({
          todosByList: { ...state.todosByList, [listId]: previous },
        }));
      }
      set({
        error: err instanceof Error ? err.message : "Failed to remove todo",
      });
    }
  },

  toggleTodo: async (listId: string, todoId: string) => {
    // Invalidate any in-flight fetch so a stale GET can't revert this toggle.
    bumpLoadToken(listId);
    // Optimistic: flip `completed` immediately so the checkbox responds
    // instantly, keeping a snapshot to roll back to. Toggling only ever
    // changes `completed` server-side, so the local flip is exact.
    const previous = get().todosByList[listId];

    set((state) => ({
      error: null,
      todosByList: {
        ...state.todosByList,
        [listId]: (state.todosByList[listId] ?? []).map((t) =>
          t.id === todoId ? { ...t, completed: !t.completed } : t,
        ),
      },
    }));

    try {
      const response = await apiClient.toggleTodo(listId, todoId);
      // Reconcile only `completed` from the server so a concurrent edit to
      // another field (title, labels, …) isn't clobbered by a stale snapshot.
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).map((t) =>
            t.id === todoId ? { ...t, completed: response.data.completed } : t,
          ),
        },
      }));
    } catch (err) {
      if (previous) {
        set((state) => ({
          todosByList: { ...state.todosByList, [listId]: previous },
        }));
      }
      set({
        error: err instanceof Error ? err.message : "Failed to toggle todo",
      });
    }
  },

  updateTodo: async (listId, todoId, dto) => {
    // Invalidate any in-flight fetch so it can't overwrite this optimistic edit.
    bumpLoadToken(listId);
    // Optimistic merge — these fields are low-stakes.
    set((state) => ({
      todosByList: {
        ...state.todosByList,
        [listId]: (state.todosByList[listId] ?? []).map((t) =>
          t.id === todoId ? ({ ...t, ...dto } as Todo) : t,
        ),
      },
    }));
    try {
      const res = await apiClient.updateTodo(listId, todoId, dto);
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).map((t) =>
            t.id === todoId ? res.data : t,
          ),
        },
      }));
    } catch (err) {
      // Roll back by refetching the authoritative list.
      await get().fetchTodos(listId);
      set({
        error: err instanceof Error ? err.message : "Failed to update todo",
      });
    }
  },

  addLabelToTodo: async (listId, todoId, labelId) => {
    // Invalidate any in-flight fetch so it can't drop this optimistic label.
    bumpLoadToken(listId);
    // Optimistic: attach the label immediately so chips appear on click.
    const label = useLabelsStore
      .getState()
      .labels.find((l) => l.id === labelId);
    const previous = get().todosByList[listId];

    if (label) {
      set((state) => ({
        error: null,
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).map((t) =>
            t.id === todoId && !t.labels.some((l) => l.id === labelId)
              ? { ...t, labels: [...t.labels, label] }
              : t,
          ),
        },
      }));
    }

    try {
      const res = await apiClient.addLabelToTodo(listId, todoId, labelId);
      // Reconcile with the server's canonical todo (ordering, etc.).
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).map((t) =>
            t.id === todoId ? res.data : t,
          ),
        },
      }));
    } catch (err) {
      if (previous) {
        set((state) => ({
          todosByList: { ...state.todosByList, [listId]: previous },
        }));
      }
      set({
        error: err instanceof Error ? err.message : "Failed to add label",
      });
    }
  },

  removeLabelFromTodo: async (listId, todoId, labelId) => {
    // Invalidate any in-flight fetch so it can't restore the removed label.
    bumpLoadToken(listId);
    // Optimistic: drop the chip immediately, keeping a snapshot to roll back to.
    const previous = get().todosByList[listId];

    set((state) => ({
      error: null,
      todosByList: {
        ...state.todosByList,
        [listId]: (state.todosByList[listId] ?? []).map((t) =>
          t.id === todoId
            ? { ...t, labels: t.labels.filter((l) => l.id !== labelId) }
            : t,
        ),
      },
    }));

    try {
      const res = await apiClient.removeLabelFromTodo(listId, todoId, labelId);
      set((state) => ({
        todosByList: {
          ...state.todosByList,
          [listId]: (state.todosByList[listId] ?? []).map((t) =>
            t.id === todoId ? res.data : t,
          ),
        },
      }));
    } catch (err) {
      if (previous) {
        set((state) => ({
          todosByList: { ...state.todosByList, [listId]: previous },
        }));
      }
      set({
        error: err instanceof Error ? err.message : "Failed to remove label",
      });
    }
  },

  applyLabelUpdate: (label) =>
    set((state) => ({
      todosByList: Object.fromEntries(
        Object.entries(state.todosByList).map(([listId, todos]) => [
          listId,
          todos.map((t) =>
            t.labels.some((l) => l.id === label.id)
              ? {
                  ...t,
                  labels: t.labels.map((l) => (l.id === label.id ? label : l)),
                }
              : t,
          ),
        ]),
      ),
    })),

  applyLabelRemoval: (labelId) =>
    set((state) => ({
      todosByList: Object.fromEntries(
        Object.entries(state.todosByList).map(([listId, todos]) => [
          listId,
          todos.map((t) =>
            t.labels.some((l) => l.id === labelId)
              ? { ...t, labels: t.labels.filter((l) => l.id !== labelId) }
              : t,
          ),
        ]),
      ),
    })),
}));
