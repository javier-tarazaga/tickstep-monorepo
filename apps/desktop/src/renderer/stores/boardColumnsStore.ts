import { create } from "zustand";
import type { BoardColumn } from "@tickstep/shared-types";
import { apiClient } from "../api";

/**
 * Board columns keyed by listId. Columns are fetched when a list is opened as a
 * board; mutations are optimistic and reconciled from the server (or rolled back
 * by refetch). Live structural changes from collaborators arrive via
 * `applyRemoteColumns` (see realtime.ts).
 */
interface BoardColumnsState {
  columnsByList: Record<string, BoardColumn[]>;
  isLoading: boolean;
  error: string | null;

  /** Idempotently seed Todo/Doing/Done (placing existing tasks) and load them. */
  ensureDefaults: (listId: string) => Promise<void>;
  createColumn: (listId: string, name: string) => Promise<void>;
  renameColumn: (listId: string, id: string, name: string) => Promise<void>;
  /** Make `id` the list's done column (clears the flag on the others). */
  setDoneColumn: (listId: string, id: string) => Promise<void>;
  deleteColumn: (listId: string, id: string) => Promise<void>;

  applyRemoteColumns: (listId: string, columns: BoardColumn[]) => void;
}

const byPosition = (a: BoardColumn, b: BoardColumn) =>
  a.position - b.position || a.createdAt.localeCompare(b.createdAt);

export const useBoardColumnsStore = create<BoardColumnsState>((set, get) => ({
  columnsByList: {},
  isLoading: false,
  error: null,

  ensureDefaults: async (listId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.ensureDefaultColumns(listId);
      set((state) => ({
        columnsByList: {
          ...state.columnsByList,
          [listId]: [...res.data].sort(byPosition),
        },
        isLoading: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to set up board",
        isLoading: false,
      });
    }
  },

  createColumn: async (listId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await apiClient.createBoardColumn(listId, { name: trimmed });
      set((state) => {
        const current = state.columnsByList[listId] ?? [];
        if (current.some((c) => c.id === res.data.id)) return state;
        return {
          columnsByList: {
            ...state.columnsByList,
            [listId]: [...current, res.data].sort(byPosition),
          },
        };
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to add column",
      });
    }
  },

  renameColumn: async (listId, id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const previous = get().columnsByList[listId];
    set((state) => ({
      columnsByList: {
        ...state.columnsByList,
        [listId]: (state.columnsByList[listId] ?? []).map((c) =>
          c.id === id ? { ...c, name: trimmed } : c,
        ),
      },
    }));
    try {
      await apiClient.updateBoardColumn(listId, id, { name: trimmed });
    } catch (err) {
      if (previous)
        set((state) => ({
          columnsByList: { ...state.columnsByList, [listId]: previous },
        }));
      set({
        error: err instanceof Error ? err.message : "Failed to rename column",
      });
    }
  },

  setDoneColumn: async (listId, id) => {
    const previous = get().columnsByList[listId];
    // Only one done column — flip the flag locally before the server confirms.
    set((state) => ({
      columnsByList: {
        ...state.columnsByList,
        [listId]: (state.columnsByList[listId] ?? []).map((c) => ({
          ...c,
          isDone: c.id === id,
        })),
      },
    }));
    try {
      await apiClient.updateBoardColumn(listId, id, { isDone: true });
    } catch (err) {
      if (previous)
        set((state) => ({
          columnsByList: { ...state.columnsByList, [listId]: previous },
        }));
      set({
        error: err instanceof Error ? err.message : "Failed to set done column",
      });
    }
  },

  deleteColumn: async (listId, id) => {
    const previous = get().columnsByList[listId];
    set((state) => ({
      columnsByList: {
        ...state.columnsByList,
        [listId]: (state.columnsByList[listId] ?? []).filter((c) => c.id !== id),
      },
    }));
    try {
      await apiClient.deleteBoardColumn(listId, id);
    } catch (err) {
      if (previous)
        set((state) => ({
          columnsByList: { ...state.columnsByList, [listId]: previous },
        }));
      set({
        error: err instanceof Error ? err.message : "Failed to delete column",
      });
    }
  },

  applyRemoteColumns: (listId, columns) =>
    set((state) => ({
      columnsByList: {
        ...state.columnsByList,
        [listId]: [...columns].sort(byPosition),
      },
    })),
}));
