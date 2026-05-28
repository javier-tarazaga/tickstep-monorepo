import { useEffect } from "react";
import Sidebar from "./Sidebar";
import TodayView from "./TodayView";
import ListView from "./ListView";
import TaskDetailPanel from "./TaskDetailPanel";
import SessionExpiredModal from "./SessionExpiredModal";
import CommandPalette from "./CommandPalette";
import ShortcutsHelp from "./ShortcutsHelp";
import ShareListDialog from "./ShareListDialog";
import { useNavigationStore } from "../stores/navigationStore";
import { useCommandStore } from "../stores/commandStore";
import { useShareDialogStore } from "../stores/shareDialogStore";
import { useUiStore } from "../stores/uiStore";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";

const APP_VERSION = "0.1.2";

const isMac =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");
const MOD = isMac ? "⌘" : "^";

/* The keybind hints shown along the bottom — the shortcuts that actually work. */
const KEY_HINTS: { k: string; d: string }[] = [
  { k: "1·2·3", d: "pane" },
  { k: "tab", d: "cycle" },
  { k: "↑↓", d: "move" },
  { k: "space", d: "toggle" },
  { k: "↵", d: "open" },
  { k: `${MOD}K`, d: "cmd" },
  { k: `${MOD}N`, d: "add" },
  { k: "?", d: "help" },
  { k: "esc", d: "back" },
];

export default function AppLayout() {
  const { currentView, selectedListId } = useNavigationStore();
  const setFocusedTodo = useCommandStore((s) => s.setFocusedTodo);
  const shareListId = useShareDialogStore((s) => s.listId);
  const closeShareDialog = useShareDialogStore((s) => s.close);
  const activeSection = useUiStore((s) => s.activeSection);

  useGlobalShortcuts();

  // Reset the keyboard cursor whenever the visible view changes.
  useEffect(() => {
    setFocusedTodo(null);
  }, [currentView, selectedListId, setFocusedTodo]);

  return (
    <div className="app-shell">
      {/* ── Title bar ───────────────────────────────────────── */}
      <header className="titlebar">
        <span className="titlebar__brand">
          <span className="titlebar__name">TICKSTEP</span>
        </span>
        <span className="titlebar__spacer" />
        <span className="titlebar__status">
          <span className="status-dot" aria-hidden="true" />
          live
        </span>
        <span className="titlebar__ver">v{APP_VERSION}</span>
      </header>

      {/* ── Workspace: three tiled panes ────────────────────── */}
      <div className="workspace">
        <Sidebar />
        <main
          className={`main-content tui-pane pane--mid ${activeSection === 2 ? "is-active" : ""}`}
        >
          {currentView === "today" && <TodayView />}
          {currentView === "list" && selectedListId && (
            <ListView listId={selectedListId} />
          )}
        </main>
        <TaskDetailPanel />
      </div>

      {/* ── Status bar — global keybind hints ───────────────── */}
      <footer className="statusbar">
        <span className="statusbar__mark" aria-hidden="true">
          ▌
        </span>
        <div className="statusbar__keys">
          {KEY_HINTS.map((h) => (
            <span key={h.d} className="key-hint">
              <span className="key-hint__k">{h.k}</span>
              <span className="key-hint__d">{h.d}</span>
            </span>
          ))}
        </div>
      </footer>

      <div className="crt-overlay" aria-hidden="true" />

      <CommandPalette />
      <ShortcutsHelp />
      <SessionExpiredModal />
      {shareListId && (
        <ShareListDialog listId={shareListId} onClose={closeShareDialog} />
      )}
    </div>
  );
}
