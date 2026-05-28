import { useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import { realtimeClient } from "./realtime";
import LoginPage from "./components/LoginPage";
import AppLayout from "./components/AppLayout";

export default function App() {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Keep one live-collaboration socket tied to the current session. Reconnects
  // automatically when the access token rotates (the dependency changes) and
  // tears down on logout / session expiry.
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    realtimeClient.connect(accessToken);
    return () => realtimeClient.disconnect();
  }, [isAuthenticated, accessToken]);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AppLayout />;
}
