import { create } from "zustand";
import type { AuthUser, AuthTokens } from "@todo-app/shared-types";
import { ApiClientError } from "@todo-app/api-client";

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpired: boolean;
  sessionEmail: string | null;

  setAuth: (user: AuthUser, tokens: AuthTokens) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSessionExpired: (email: string) => void;
  updateTokens: (tokens: AuthTokens) => void;
  hydrate: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionExpired: false,
  sessionEmail: null,

  setAuth: (user, tokens) => {
    set({
      user,
      tokens,
      isAuthenticated: true,
      error: null,
      sessionExpired: false,
      sessionEmail: null,
    });
    // Persist to encrypted storage
    window.electronAPI.auth.save({ user, tokens }).catch(console.error);
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setSessionExpired: (email) =>
    set({
      sessionExpired: true,
      sessionEmail: email,
      tokens: null,
      isAuthenticated: false,
    }),

  updateTokens: (tokens) => {
    const { user } = get();
    set({ tokens });
    // Persist updated tokens to encrypted storage
    if (user) {
      window.electronAPI.auth.save({ user, tokens }).catch(console.error);
    }
  },

  hydrate: async () => {
    set({ isLoading: true });

    try {
      const stored = await window.electronAPI.auth.load();

      if (!stored) {
        set({ isLoading: false });
        return;
      }

      // Attempt to refresh stored tokens to validate the session
      const { apiClient } = await import("../api");

      try {
        const response = await apiClient.refreshToken({
          refreshToken: stored.tokens.refreshToken,
        });

        set({
          user: stored.user,
          tokens: response.data,
          isAuthenticated: true,
          isLoading: false,
        });

        // Persist the refreshed tokens
        await window.electronAPI.auth.save({
          user: stored.user,
          tokens: response.data,
        });
      } catch (err) {
        if (
          err instanceof ApiClientError &&
          (err.statusCode === 401 || err.statusCode === 403)
        ) {
          // Tokens are invalid — clear storage
          await window.electronAPI.auth.clear();
        } else {
          // Network error or server issue — keep stored tokens and allow
          // the user in optimistically. The 401 interceptor will handle
          // re-authentication later if the tokens are actually expired.
          set({
            user: stored.user,
            tokens: stored.tokens,
            isAuthenticated: true,
          });
        }
        set({ isLoading: false });
      }
    } catch (err) {
      console.error("Hydration error:", err);
      set({ isLoading: false });
    }
  },

  logout: () => {
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      error: null,
      sessionExpired: false,
      sessionEmail: null,
    });
    // Clear encrypted storage
    window.electronAPI.auth.clear().catch(console.error);
  },
}));
