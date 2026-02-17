import { TodoApiClient } from "@todo-app/api-client";
import { useAuthStore } from "./stores/authStore";

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
});
