import { create } from "zustand";
import type {
  TodoList,
  SidebarLayout,
  SidebarSection,
  UpdateTodoListDto,
} from "@tickstep/shared-types";
import { apiClient } from "../api";
import { useAuthStore } from "./authStore";

/** A "section" is a named grouping of lists */
export interface ListSection {
  id: string;
  name: string;
  listIds: string[];
  isExpanded: boolean;
}

interface TodoListsState {
  lists: TodoList[];
  sections: ListSection[];
  unsectionedListIds: string[];
  isLoading: boolean;
  error: string | null;

  fetchLists: () => Promise<void>;
  fetchLayout: () => Promise<void>;
  /** Create a list. When sectionId is given, the list is placed inside that section instead of unsectioned. */
  createList: (name: string, sectionId?: string) => Promise<TodoList | null>;
  /** Patch a list's name and/or emoji. Updates optimistically and rolls back on failure. */
  updateList: (id: string, dto: UpdateTodoListDto) => Promise<boolean>;
  deleteList: (id: string) => Promise<void>;

  addSection: (name: string) => void;
  removeSection: (sectionId: string) => void;
  renameSection: (sectionId: string, name: string) => void;
  toggleSection: (sectionId: string) => void;
  addListToSection: (sectionId: string, listId: string) => void;
  removeListFromSection: (sectionId: string, listId: string) => void;

  /** Reorder sections (drag & drop) */
  reorderSections: (fromIndex: number, toIndex: number) => void;
  /** Reorder lists within a section (drag & drop) */
  reorderListsInSection: (
    sectionId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;
  /** Reorder unsectioned lists (drag & drop) */
  reorderUnsectionedLists: (fromIndex: number, toIndex: number) => void;
  /** Move a list from unsectioned to a section */
  moveListToSection: (listId: string, sectionId: string, index: number) => void;
  /** Move a list out of a section to unsectioned */
  moveListToUnsectioned: (listId: string, sectionId: string, index: number) => void;
  /** Move a list between sections */
  moveListBetweenSections: (
    listId: string,
    fromSectionId: string,
    toSectionId: string,
    toIndex: number,
  ) => void;
  /** Set full layout (used during complex DnD operations) */
  setLayout: (sections: ListSection[], unsectionedListIds: string[]) => void;

  /* ── Sharing ─────────────────────────────────────────── */
  /** Invite an existing user by email. Resolves to an error message, or null
   *  on success. */
  addMember: (listId: string, email: string) => Promise<string | null>;
  /** Remove a collaborator from a list you participate in. */
  removeMember: (listId: string, userId: string) => Promise<void>;
  /** Leave a shared list you're a member of. */
  leaveList: (listId: string) => Promise<void>;

  /* ── Realtime appliers (called by the socket layer, not the UI) ───── */
  /** Upsert a list pushed from the server (rename, emoji, membership change,
   *  or a list freshly shared with you). */
  applyRemoteListUpserted: (list: TodoList) => void;
  /** Drop a list that was deleted, or that you were removed from. */
  applyRemoteListDeleted: (listId: string) => void;
}

/** Return a copy of the list with the given member removed and counts fixed. */
function withoutMember(list: TodoList, userId: string): TodoList {
  const members = list.members.filter((m) => m.userId !== userId);
  const memberCount = members.filter((m) => m.role !== "owner").length;
  return { ...list, members, memberCount, isShared: memberCount > 0 };
}

const SECTIONS_STORAGE_KEY = "tickstep-sections";
const UNSECTIONED_STORAGE_KEY = "tickstep-unsectioned-list-ids";

// Pre-rebrand keys. Migrate any existing layout so the rename doesn't wipe it.
const LEGACY_KEY_MIGRATIONS: ReadonlyArray<readonly [legacy: string, current: string]> = [
  ["todo-app-sections", SECTIONS_STORAGE_KEY],
  ["todo-app-unsectioned-list-ids", UNSECTIONED_STORAGE_KEY],
];

function migrateLegacyLayoutKeys() {
  for (const [legacyKey, currentKey] of LEGACY_KEY_MIGRATIONS) {
    try {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;
      if (localStorage.getItem(currentKey) === null) {
        localStorage.setItem(currentKey, legacyValue);
      }
      localStorage.removeItem(legacyKey);
    } catch {
      // Ignore — fall back to defaults if storage is unavailable.
    }
  }
}

migrateLegacyLayoutKeys();

function loadSections(): ListSection[] {
  try {
    const stored = localStorage.getItem(SECTIONS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ListSection[]) : [];
  } catch {
    return [];
  }
}

function loadUnsectionedListIds(): string[] {
  try {
    const stored = localStorage.getItem(UNSECTIONED_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveLayoutLocally(sections: ListSection[], unsectionedListIds: string[]) {
  localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(sections));
  localStorage.setItem(UNSECTIONED_STORAGE_KEY, JSON.stringify(unsectionedListIds));
}

/** Debounced sync to backend to avoid hammering during rapid drags */
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function syncLayoutToBackend(sections: ListSection[], unsectionedListIds: string[]) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const layout: SidebarLayout = {
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name,
          listIds: s.listIds,
          isExpanded: s.isExpanded,
        })),
        unsectionedListIds,
      };
      await apiClient.saveSidebarLayout(layout);
    } catch {
      // Silently fail — local state is source of truth during session
    }
  }, 500);
}

function persistLayout(sections: ListSection[], unsectionedListIds: string[]) {
  saveLayoutLocally(sections, unsectionedListIds);
  syncLayoutToBackend(sections, unsectionedListIds);
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [removed] = result.splice(from, 1);
  if (removed !== undefined) {
    result.splice(to, 0, removed);
  }
  return result;
}

export const useTodoListsStore = create<TodoListsState>((set, get) => ({
  lists: [],
  sections: loadSections(),
  unsectionedListIds: loadUnsectionedListIds(),
  isLoading: false,
  error: null,

  fetchLists: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getTodoLists();
      set({ lists: response.data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch lists",
        isLoading: false,
      });
    }
  },

  fetchLayout: async () => {
    try {
      const response = await apiClient.getSidebarLayout();
      const { layout } = response.data;

      if (layout.sections.length > 0 || layout.unsectionedListIds.length > 0) {
        const sections: ListSection[] = layout.sections.map((s: SidebarSection) => ({
          id: s.id,
          name: s.name,
          listIds: s.listIds,
          isExpanded: s.isExpanded,
        }));
        set({ sections, unsectionedListIds: layout.unsectionedListIds });
        saveLayoutLocally(sections, layout.unsectionedListIds);
      }
    } catch {
      // Use local layout as fallback — already loaded from localStorage
    }
  },

  createList: async (name: string, sectionId?: string) => {
    set({ error: null });
    try {
      const response = await apiClient.createTodoList({ name });
      const newList = response.data;
      set((state) => {
        const lists = [...state.lists, newList];
        if (sectionId) {
          // Place the new list inside the target section (expanded so it's visible).
          const sections = state.sections.map((s) =>
            s.id === sectionId
              ? { ...s, listIds: [...s.listIds, newList.id], isExpanded: true }
              : s,
          );
          persistLayout(sections, state.unsectionedListIds);
          return { lists, sections };
        }
        const unsectionedListIds = [...state.unsectionedListIds, newList.id];
        persistLayout(state.sections, unsectionedListIds);
        return { lists, unsectionedListIds };
      });
      return newList;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to create list",
      });
      return null;
    }
  },

  updateList: async (id: string, dto: UpdateTodoListDto) => {
    // Snapshot inside set() so the rollback value is atomic even if another
    // updateList for the same list is already in flight.
    let target: TodoList | undefined;
    set((state) => {
      target = state.lists.find((l) => l.id === id);
      if (!target) return state;
      // Optimistically apply the patch so rename/emoji feel instant.
      return {
        error: null,
        lists: state.lists.map((l) => (l.id === id ? { ...l, ...dto } : l)),
      };
    });
    if (!target) return false;
    const rollback = target;

    try {
      const response = await apiClient.updateTodoList(id, dto);
      const updated = response.data;
      // Merge (not replace) so a slow response for one field doesn't clobber a
      // newer optimistic edit to another field on the same list.
      set((state) => ({
        lists: state.lists.map((l) => (l.id === id ? { ...l, ...updated } : l)),
      }));
      return true;
    } catch (err) {
      // Roll back to the value before this edit.
      set((state) => ({
        lists: state.lists.map((l) => (l.id === id ? rollback : l)),
        error: err instanceof Error ? err.message : "Failed to update list",
      }));
      return false;
    }
  },

  deleteList: async (id: string) => {
    set({ error: null });
    try {
      await apiClient.deleteTodoList(id);
      set((state) => {
        const lists = state.lists.filter((l) => l.id !== id);
        const sections = state.sections.map((s) => ({
          ...s,
          listIds: s.listIds.filter((lid) => lid !== id),
        }));
        const unsectionedListIds = state.unsectionedListIds.filter(
          (lid) => lid !== id,
        );
        persistLayout(sections, unsectionedListIds);
        return { lists, sections, unsectionedListIds };
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to delete list",
      });
    }
  },

  addSection: (name: string) => {
    const section: ListSection = {
      id: crypto.randomUUID(),
      name,
      listIds: [],
      isExpanded: true,
    };
    set((state) => {
      const sections = [...state.sections, section];
      persistLayout(sections, state.unsectionedListIds);
      return { sections };
    });
  },

  removeSection: (sectionId: string) => {
    set((state) => {
      const removedSection = state.sections.find((s) => s.id === sectionId);
      const sections = state.sections.filter((s) => s.id !== sectionId);
      // Move orphaned lists back to unsectioned
      const unsectionedListIds = [
        ...state.unsectionedListIds,
        ...(removedSection?.listIds ?? []),
      ];
      persistLayout(sections, unsectionedListIds);
      return { sections, unsectionedListIds };
    });
  },

  renameSection: (sectionId: string, name: string) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, name } : s,
      );
      persistLayout(sections, state.unsectionedListIds);
      return { sections };
    });
  },

  toggleSection: (sectionId: string) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s,
      );
      persistLayout(sections, state.unsectionedListIds);
      return { sections };
    });
  },

  addListToSection: (sectionId: string, listId: string) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId && !s.listIds.includes(listId)
          ? { ...s, listIds: [...s.listIds, listId] }
          : s,
      );
      // Remove from unsectioned
      const unsectionedListIds = state.unsectionedListIds.filter(
        (lid) => lid !== listId,
      );
      persistLayout(sections, unsectionedListIds);
      return { sections, unsectionedListIds };
    });
  },

  removeListFromSection: (sectionId: string, listId: string) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId
          ? { ...s, listIds: s.listIds.filter((lid) => lid !== listId) }
          : s,
      );
      const unsectionedListIds = [...state.unsectionedListIds, listId];
      persistLayout(sections, unsectionedListIds);
      return { sections, unsectionedListIds };
    });
  },

  reorderSections: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const sections = arrayMove(state.sections, fromIndex, toIndex);
      persistLayout(sections, state.unsectionedListIds);
      return { sections };
    });
  },

  reorderListsInSection: (
    sectionId: string,
    fromIndex: number,
    toIndex: number,
  ) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId
          ? { ...s, listIds: arrayMove(s.listIds, fromIndex, toIndex) }
          : s,
      );
      persistLayout(sections, state.unsectionedListIds);
      return { sections };
    });
  },

  reorderUnsectionedLists: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const unsectionedListIds = arrayMove(
        state.unsectionedListIds,
        fromIndex,
        toIndex,
      );
      persistLayout(state.sections, unsectionedListIds);
      return { unsectionedListIds };
    });
  },

  moveListToSection: (listId: string, sectionId: string, index: number) => {
    set((state) => {
      const unsectionedListIds = state.unsectionedListIds.filter(
        (lid) => lid !== listId,
      );
      const sections = state.sections.map((s) => {
        if (s.id === sectionId) {
          const newListIds = s.listIds.filter((lid) => lid !== listId);
          newListIds.splice(index, 0, listId);
          return { ...s, listIds: newListIds, isExpanded: true };
        }
        return { ...s, listIds: s.listIds.filter((lid) => lid !== listId) };
      });
      persistLayout(sections, unsectionedListIds);
      return { sections, unsectionedListIds };
    });
  },

  moveListToUnsectioned: (listId: string, _sectionId: string, index: number) => {
    set((state) => {
      const sections = state.sections.map((s) => ({
        ...s,
        listIds: s.listIds.filter((lid) => lid !== listId),
      }));
      const unsectionedListIds = state.unsectionedListIds.filter(
        (lid) => lid !== listId,
      );
      unsectionedListIds.splice(index, 0, listId);
      persistLayout(sections, unsectionedListIds);
      return { sections, unsectionedListIds };
    });
  },

  moveListBetweenSections: (
    listId: string,
    _fromSectionId: string,
    toSectionId: string,
    toIndex: number,
  ) => {
    set((state) => {
      const sections = state.sections.map((s) => {
        if (s.id === toSectionId) {
          const newListIds = s.listIds.filter((lid) => lid !== listId);
          newListIds.splice(toIndex, 0, listId);
          return { ...s, listIds: newListIds, isExpanded: true };
        }
        return { ...s, listIds: s.listIds.filter((lid) => lid !== listId) };
      });
      persistLayout(sections, state.unsectionedListIds);
      return { sections };
    });
  },

  setLayout: (sections: ListSection[], unsectionedListIds: string[]) => {
    persistLayout(sections, unsectionedListIds);
    set({ sections, unsectionedListIds });
  },

  addMember: async (listId: string, email: string) => {
    try {
      const response = await apiClient.addListMember(listId, { email });
      const updated = response.data;
      set((state) => ({
        lists: state.lists.map((l) => (l.id === listId ? updated : l)),
      }));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to add member";
    }
  },

  removeMember: async (listId: string, userId: string) => {
    const previous = get().lists;
    // Optimistic: drop the member immediately, roll back on failure.
    set((state) => ({
      error: null,
      lists: state.lists.map((l) =>
        l.id === listId ? withoutMember(l, userId) : l,
      ),
    }));
    try {
      await apiClient.removeListMember(listId, userId);
    } catch (err) {
      set({
        lists: previous,
        error: err instanceof Error ? err.message : "Failed to remove member",
      });
    }
  },

  leaveList: async (listId: string) => {
    set({ error: null });
    try {
      await apiClient.leaveList(listId);
      set((state) => {
        const lists = state.lists.filter((l) => l.id !== listId);
        const sections = state.sections.map((s) => ({
          ...s,
          listIds: s.listIds.filter((lid) => lid !== listId),
        }));
        const unsectionedListIds = state.unsectionedListIds.filter(
          (lid) => lid !== listId,
        );
        persistLayout(sections, unsectionedListIds);
        return { lists, sections, unsectionedListIds };
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to leave list",
      });
    }
  },

  applyRemoteListUpserted: (incoming: TodoList) => {
    // `isOwner` is per-viewer; the server can't know ours, so derive it here.
    const myId = useAuthStore.getState().user?.id;
    const list: TodoList = { ...incoming, isOwner: incoming.userId === myId };
    set((state) => {
      const exists = state.lists.some((l) => l.id === list.id);
      const lists = exists
        ? state.lists.map((l) => (l.id === list.id ? list : l))
        : [...state.lists, list];

      // A brand-new list you OWN (rare via socket) needs a sidebar slot.
      // Shared-with-you lists render in their own group, so no layout entry.
      const known =
        state.unsectionedListIds.includes(list.id) ||
        state.sections.some((s) => s.listIds.includes(list.id));
      if (!exists && list.isOwner && !known) {
        const unsectionedListIds = [...state.unsectionedListIds, list.id];
        persistLayout(state.sections, unsectionedListIds);
        return { lists, unsectionedListIds };
      }
      return { lists };
    });
  },

  applyRemoteListDeleted: (listId: string) => {
    set((state) => {
      const lists = state.lists.filter((l) => l.id !== listId);
      const sections = state.sections.map((s) => ({
        ...s,
        listIds: s.listIds.filter((lid) => lid !== listId),
      }));
      const unsectionedListIds = state.unsectionedListIds.filter(
        (lid) => lid !== listId,
      );
      persistLayout(sections, unsectionedListIds);
      return { lists, sections, unsectionedListIds };
    });
  },
}));
