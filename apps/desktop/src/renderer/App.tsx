import { useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import LoginPage from "./components/LoginPage";
import AppLayout from "./components/AppLayout";

export default function App() {
  const { isAuthenticated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AppLayout />;
}
