import { create } from "zustand";
import type { TodoList } from "@todo-app/shared-types";
import { apiClient } from "../api";

/** A "section" is a local UI grouping of lists */
export interface ListSection {
  id: string;
  name: string;
  listIds: string[];
  isExpanded: boolean;
}

interface TodoListsState {
  lists: TodoList[];
  sections: ListSection[];
  isLoading: boolean;
  error: string | null;

  fetchLists: () => Promise<void>;
  createList: (name: string) => Promise<TodoList | null>;
  deleteList: (id: string) => Promise<void>;

  addSection: (name: string) => void;
  removeSection: (sectionId: string) => void;
  renameSection: (sectionId: string, name: string) => void;
  toggleSection: (sectionId: string) => void;
  addListToSection: (sectionId: string, listId: string) => void;
  removeListFromSection: (sectionId: string, listId: string) => void;
}

const SECTIONS_STORAGE_KEY = "todo-app-sections";

function loadSections(): ListSection[] {
  try {
    const stored = localStorage.getItem(SECTIONS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ListSection[]) : [];
  } catch {
    return [];
  }
}

function saveSections(sections: ListSection[]) {
  localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(sections));
}

export const useTodoListsStore = create<TodoListsState>((set, get) => ({
  lists: [],
  sections: loadSections(),
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

  createList: async (name: string) => {
    set({ error: null });
    try {
      const response = await apiClient.createTodoList({ name });
      set((state) => ({ lists: [...state.lists, response.data] }));
      return response.data;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to create list",
      });
      return null;
    }
  },

  deleteList: async (id: string) => {
    set({ error: null });
    try {
      await apiClient.deleteTodoList(id);
      set((state) => ({
        lists: state.lists.filter((l) => l.id !== id),
        sections: state.sections.map((s) => ({
          ...s,
          listIds: s.listIds.filter((lid) => lid !== id),
        })),
      }));
      // Persist sections after removing list references
      saveSections(get().sections);
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
      saveSections(sections);
      return { sections };
    });
  },

  removeSection: (sectionId: string) => {
    set((state) => {
      const sections = state.sections.filter((s) => s.id !== sectionId);
      saveSections(sections);
      return { sections };
    });
  },

  renameSection: (sectionId: string, name: string) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, name } : s,
      );
      saveSections(sections);
      return { sections };
    });
  },

  toggleSection: (sectionId: string) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s,
      );
      saveSections(sections);
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
      saveSections(sections);
      return { sections };
    });
  },

  removeListFromSection: (sectionId: string, listId: string) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId
          ? { ...s, listIds: s.listIds.filter((lid) => lid !== listId) }
          : s,
      );
      saveSections(sections);
      return { sections };
    });
  },
}));
