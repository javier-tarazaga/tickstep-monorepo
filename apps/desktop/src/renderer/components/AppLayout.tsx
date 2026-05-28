import { useEffect } from "react";
import Sidebar from "./Sidebar";
import TodayView from "./TodayView";
import ListView from "./ListView";
import TaskDetailPanel from "./TaskDetailPanel";
import SessionExpiredModal from "./SessionExpiredModal";
import CommandPalette from "./CommandPalette";
import ShortcutsHelp from "./ShortcutsHelp";
import { useNavigationStore } from "../stores/navigationStore";
import { useCommandStore } from "../stores/commandStore";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";

export default function AppLayout() {
  const { currentView, selectedListId } = useNavigationStore();
  const setFocusedTodo = useCommandStore((s) => s.setFocusedTodo);

  useGlobalShortcuts();

  // Reset the keyboard cursor whenever the visible view changes.
  useEffect(() => {
    setFocusedTodo(null);
  }, [currentView, selectedListId, setFocusedTodo]);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="main-titlebar" />
        <div className="main-body">
          {currentView === "today" && <TodayView />}
          {currentView === "list" && selectedListId && (
            <ListView listId={selectedListId} />
          )}
        </div>
      </div>
      <TaskDetailPanel />
      <CommandPalette />
      <ShortcutsHelp />
      <SessionExpiredModal />
    </div>
  );
}
