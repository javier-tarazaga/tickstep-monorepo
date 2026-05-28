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
import { useTodoListsStore } from "../stores/todoListsStore";
import { useTodosStore } from "../stores/todosStore";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { getVisibleTodoOrder } from "../lib/keyboardNav";

const APP_VERSION = "0.1.2";

const isMac =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");
const MOD = isMac ? "⌘" : "^";

/** Lowercase, hyphenated path segment from a free-text name. */
function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "list"
  );
}

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
];

export default function AppLayout() {
  const { currentView, selectedListId } = useNavigationStore();
  const setFocusedTodo = useCommandStore((s) => s.setFocusedTodo);
  const focusedTodoId = useCommandStore((s) => s.focusedTodoId);
  const shareListId = useShareDialogStore((s) => s.listId);
  const closeShareDialog = useShareDialogStore((s) => s.close);
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const activeSection = useUiStore((s) => s.activeSection);
  const lists = useTodoListsStore((s) => s.lists);
  const todosByList = useTodosStore((s) => s.todosByList);

  useGlobalShortcuts();

  // Reset the keyboard cursor whenever the visible view changes.
  useEffect(() => {
    setFocusedTodo(null);
  }, [currentView, selectedListId, setFocusedTodo]);

  // Cosmetic NORMAL/INSERT mode: flip to INSERT while a text field holds focus.
  // Purely visual — never changes keybindings.
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable);
    const onIn = (e: FocusEvent) => setMode(isField(e.target) ? "INSERT" : "NORMAL");
    const onOut = () => setMode("NORMAL");
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, [setMode]);

  /* ── Status-line data ─────────────────────────────────────── */
  const activeList = selectedListId
    ? lists.find((l) => l.id === selectedListId)
    : null;

  const { done, total } =
    currentView === "list" && selectedListId
      ? (() => {
          const todos = todosByList[selectedListId] ?? [];
          return { done: todos.filter((t) => t.completed).length, total: todos.length };
        })()
      : (() => {
          let d = 0;
          let t = 0;
          for (const l of lists) {
            const todos = todosByList[l.id] ?? [];
            d += todos.filter((x) => x.completed).length;
            t += todos.length;
          }
          return { done: d, total: t };
        })();

  const path =
    currentView === "list" && activeList
      ? `~/lists/${slug(activeList.name)}`
      : "~/today";

  const cursorRow =
    focusedTodoId != null
      ? getVisibleTodoOrder().findIndex((t) => t.id === focusedTodoId) + 1
      : 0;

  return (
    <div className="app-shell">
      {/* ── Title bar ───────────────────────────────────────── */}
      <header className="titlebar">
        <span className="titlebar__brand">
          <span className="titlebar__mark">▌</span>
          <span className="titlebar__name">TICKSTEP</span>
          <span className="titlebar__sep">·</span>
          <span className="titlebar__tag">a tui todo</span>
        </span>
        <span className="titlebar__spacer" />
        <span key={mode} className={`mode-badge is-pop ${mode === "INSERT" ? "is-insert" : ""}`}>
          {mode}
        </span>
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

      {/* ── Status bar ──────────────────────────────────────── */}
      <footer className="statusbar">
        <div className="statusbar__keys">
          {KEY_HINTS.map((h) => (
            <span key={h.d} className="key-hint">
              <span className="key-hint__k">{h.k}</span>
              <span className="key-hint__d">{h.d}</span>
            </span>
          ))}
        </div>
        <div className="statusbar__line">
          <span className={`mode-badge ${mode === "INSERT" ? "is-insert" : ""}`}>
            {mode}
          </span>
          <span className="statusbar__seg">
            <span className="path">{path}</span>
          </span>
          {total > 0 && (
            <>
              <span className="statusbar__sep">·</span>
              <span className="statusbar__seg">
                <span className="accent">{done}</span>/{total} done
              </span>
            </>
          )}
          <span className="statusbar__sep">·</span>
          <span className="statusbar__seg">
            cursor <span className="accent">r{cursorRow}</span>
          </span>
          <span className="statusbar__spacer" />
          <span className="statusbar__seg">UTF-8</span>
          <span className="statusbar__sep">·</span>
          <span className="statusbar__seg">LF</span>
          <span className="statusbar__sep">·</span>
          <span className="statusbar__seg">100%</span>
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
