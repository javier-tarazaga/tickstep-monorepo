import { useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import LoginPage from "./components/LoginPage";
import AppLayout from "./components/AppLayout";

export default function App() {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
