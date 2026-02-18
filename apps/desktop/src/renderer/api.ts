import { TodoApiClient } from "@todo-app/api-client";
import { useAuthStore } from "./stores/authStore";
import { TokenRefreshManager } from "./services/tokenRefreshManager";

const API_BASE_URL = "http://localhost:3000";

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
