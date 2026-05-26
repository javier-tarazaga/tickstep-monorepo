import { create } from "zustand";
import type { Label, UpdateLabelDto } from "@todo-app/shared-types";
import { apiClient } from "../api";
import { useTodosStore } from "./todosStore";

interface LabelsState {
  labels: Label[];
  isLoading: boolean;
  error: string | null;

  fetchLabels: () => Promise<void>;
  createLabel: (name: string, color: string) => Promise<Label | null>;
  updateLabel: (id: string, dto: UpdateLabelDto) => Promise<boolean>;
  deleteLabel: (id: string) => Promise<boolean>;
}

export const useLabelsStore = create<LabelsState>((set) => ({
  labels: [],
  isLoading: false,
  error: null,

  fetchLabels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getLabels();
      set({ labels: response.data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch labels",
        isLoading: false,
      });
    }
  },

  createLabel: async (name: string, color: string) => {
    set({ error: null });
    try {
      const response = await apiClient.createLabel({ name, color });
      const label = response.data;
      set((state) => ({ labels: [...state.labels, label] }));
      return label;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to create label",
      });
      return null;
    }
  },

  updateLabel: async (id: string, dto: UpdateLabelDto) => {
    set({ error: null });
    try {
      const response = await apiClient.updateLabel(id, dto);
      set((state) => ({
        labels: state.labels.map((l) => (l.id === id ? response.data : l)),
      }));
      // Keep the denormalized copies embedded in loaded todos in sync.
      useTodosStore.getState().applyLabelUpdate(response.data);
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to update label",
      });
      return false;
    }
  },

  deleteLabel: async (id: string) => {
    set({ error: null });
    try {
      await apiClient.deleteLabel(id);
      set((state) => ({ labels: state.labels.filter((l) => l.id !== id) }));
      // The backend cascades the join rows; mirror that in loaded todos.
      useTodosStore.getState().applyLabelRemoval(id);
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to delete label",
      });
      return false;
    }
  },
}));
