import { create } from "zustand";

/** UI-only state for the share dialog, so any surface (sidebar context menu,
 *  list header) can open it while it's mounted once at the app root. */
interface ShareDialogState {
  /** The list whose share dialog is open, or null when closed. */
  listId: string | null;
  open: (listId: string) => void;
  close: () => void;
}

export const useShareDialogStore = create<ShareDialogState>((set) => ({
  listId: null,
  open: (listId) => set({ listId }),
  close: () => set({ listId: null }),
}));
