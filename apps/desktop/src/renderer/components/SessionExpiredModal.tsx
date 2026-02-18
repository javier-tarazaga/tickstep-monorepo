import React, { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { apiClient } from "../api";

export default function SessionExpiredModal() {
  const { sessionExpired, sessionEmail, isLoading, error, setAuth, setLoading, setError } =
    useAuthStore();
  const [password, setPassword] = useState("");

  if (!sessionExpired) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.signIn({
        email: sessionEmail ?? "",
        password,
      });
      setAuth(response.data.user, response.data.tokens);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password",
      );
    }
  };

  return (
    <div className="session-modal-overlay">
      <div className="session-modal-card">
        <h2>Session expired</h2>
        <p>Your session has expired. Please sign in again to continue.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="session-email">Email</label>
            <input
              id="session-email"
              type="email"
              value={sessionEmail ?? ""}
              disabled
              className="input-disabled"
            />
          </div>

          <div className="form-group">
            <label htmlFor="session-password">Password</label>
            <input
              id="session-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoFocus
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
