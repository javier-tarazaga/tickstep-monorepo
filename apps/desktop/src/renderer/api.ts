import { TodoApiClient } from "@tickstep/api-client";
import { useAuthStore } from "./stores/authStore";
import { TokenRefreshManager } from "./services/tokenRefreshManager";

// Baked in at build time. Pass VITE_API_BASE_URL when packaging the app to
// point it at the deployed API; falls back to the local dev server.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const apiClient = new TodoApiClient({
  baseUrl: API_BASE_URL,
  getHeaders: (): Record<string, string> => {
    const { tokens } = useAuthStore.getState();
    if (tokens?.accessToken) {
      return { Authorization: `Bearer ${tokens.accessToken}` };
    }
    return {};
  },
  onTokenExpired: async () => {
    await refreshManager.handleTokenExpired();
  },
});

const refreshManager = new TokenRefreshManager(apiClient);
