import { create } from "zustand";

export type View = "today" | "list";

interface NavigationState {
  currentView: View;
  selectedListId: string | null;

  navigateToToday: () => void;
  navigateToList: (listId: string) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentView: "today",
  selectedListId: null,

  navigateToToday: () =>
    set({ currentView: "today", selectedListId: null }),

  navigateToList: (listId: string) =>
    set({ currentView: "list", selectedListId: listId }),
}));
