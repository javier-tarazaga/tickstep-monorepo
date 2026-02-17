import { create } from "zustand";
import type { AuthUser, AuthTokens } from "@todo-app/shared-types";

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setAuth: (user: AuthUser, tokens: AuthTokens) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = "todo-app-auth";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setAuth: (user, tokens) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens }));
    set({ user, tokens, isAuthenticated: true, error: null });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      error: null,
    });
  },

  hydrate: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { user, tokens } = JSON.parse(stored) as {
          user: AuthUser;
          tokens: AuthTokens;
        };
        set({ user, tokens, isAuthenticated: true });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
}));
