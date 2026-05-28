import type { TodoApiClient } from "@tickstep/api-client";
import { useAuthStore } from "../stores/authStore";

/**
 * Manages token refresh with concurrent request handling.
 *
 * When multiple API requests fail with 401 simultaneously, only one
 * refresh is performed. All waiting callers share the same result.
 */
export class TokenRefreshManager {
  private refreshPromise: Promise<void> | null = null;

  constructor(private apiClient: TodoApiClient) {}

  /**
   * Called by the API client when a 401 is received.
   * Coordinates a single refresh attempt for concurrent failures.
   */
  async handleTokenExpired(): Promise<void> {
    // If a refresh is already in flight, piggyback on it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<void> {
    const { tokens, user, updateTokens, setSessionExpired } =
      useAuthStore.getState();

    if (!tokens?.refreshToken || !user) {
      setSessionExpired(user?.email ?? "");
      throw new Error("No refresh token available");
    }

    try {
      const response = await this.apiClient.refreshToken({
        refreshToken: tokens.refreshToken,
      });

      const newTokens = response.data;

      // Update in-memory state + persist to encrypted storage
      updateTokens(newTokens);
    } catch {
      // Refresh failed — session is unrecoverable, prompt re-login
      setSessionExpired(user.email);
      await window.electronAPI.auth.clear();
      throw new Error("Token refresh failed");
    }
  }
}
