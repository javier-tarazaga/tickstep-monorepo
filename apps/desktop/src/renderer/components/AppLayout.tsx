import Sidebar from "./Sidebar";
import TodayView from "./TodayView";
import ListView from "./ListView";
import TaskDetailPanel from "./TaskDetailPanel";
import SessionExpiredModal from "./SessionExpiredModal";
import { useNavigationStore } from "../stores/navigationStore";

export default function AppLayout() {
  const { currentView, selectedListId } = useNavigationStore();

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
      <SessionExpiredModal />
    </div>
  );
}
