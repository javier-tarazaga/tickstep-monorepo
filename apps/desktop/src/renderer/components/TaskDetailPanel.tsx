import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Label, Todo, TodoPriority } from "@tickstep/shared-types";
import { useNavigationStore } from "../stores/navigationStore";
import { useTodosStore } from "../stores/todosStore";
import { useLabelsStore } from "../stores/labelsStore";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useUiStore } from "../stores/uiStore";
import {
  clampTaskPanelWidth,
  TASK_PANEL_DEFAULT_WIDTH,
  TASK_PANEL_MAX_WIDTH,
  TASK_PANEL_MIN_WIDTH,
  TASK_PANEL_RAIL_WIDTH,
  usePanelStore,
} from "../stores/panelStore";
import {
  CalendarIcon,
  CheckIcon,
  FlagIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from "./icons";
import PriorityBars from "./PriorityBars";
import {
  formatDueDate,
  isOverdue,
  LABEL_SWATCHES,
  PRIORITY_META,
  priorityMeta,
  timeAgo,
} from "../lib/taskDetail";
import { isTypingTarget } from "../lib/keyboardNav";

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "list"
  );
}

/* ── Lightweight popover (mirrors the Sidebar overlay pattern) ── */
function Popover({
  open,
  onClose,
  align = "left",
  children,
}: {
  open: boolean;
  onClose: () => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="task-popover-overlay" onClick={onClose} />
      <div className={`task-popover ${align === "right" ? "align-right" : ""}`}>
        {children}
      </div>
    </>
  );
}

/* ── Drag-to-resize for the panel's left edge ─────────────────── */
function useTaskPanelResize() {
  const persistedWidth = usePanelStore((s) => s.taskPanelWidth);
  const setTaskPanelWidth = usePanelStore((s) => s.setTaskPanelWidth);

  const [dragging, setDragging] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = persistedWidth;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setDragging(true);

    // The panel hugs the right edge, so dragging left (−Δx) widens it.
    const onMove = (ev: PointerEvent) => {
      setLiveWidth(clampTaskPanelWidth(startWidth - (ev.clientX - startX)));
    };
    const onUp = (ev: PointerEvent) => {
      setTaskPanelWidth(clampTaskPanelWidth(startWidth - (ev.clientX - startX)));
      setLiveWidth(null);
      setDragging(false);
      handle.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onDoubleClick = () => setTaskPanelWidth(TASK_PANEL_DEFAULT_WIDTH);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 8;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setTaskPanelWidth(persistedWidth + step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setTaskPanelWidth(persistedWidth - step);
    } else if (e.key === "Home") {
      e.preventDefault();
      setTaskPanelWidth(TASK_PANEL_DEFAULT_WIDTH);
    }
  };

  const width = liveWidth ?? persistedWidth;

  return {
    width,
    dragging,
    handleProps: {
      role: "separator" as const,
      "aria-orientation": "vertical" as const,
      "aria-label": "Resize task panel",
      "aria-valuemin": TASK_PANEL_MIN_WIDTH,
      "aria-valuemax": TASK_PANEL_MAX_WIDTH,
      "aria-valuenow": Math.round(width),
      tabIndex: 0,
      onPointerDown,
      onDoubleClick,
      onKeyDown,
    },
  };
}

/* ════════════════════════════════════════════════════════════════
   Outer pane — always rendered (a fixed terminal column). Shows the
   editing body when a task is selected, an empty state otherwise.
   ════════════════════════════════════════════════════════════════ */
export default function TaskDetailPanel() {
  const selectedTodoId = useNavigationStore((s) => s.selectedTodoId);
  const selectedTodoListId = useNavigationStore((s) => s.selectedTodoListId);
  const closeTodo = useNavigationStore((s) => s.closeTodo);

  const todo = useTodosStore((s) =>
    selectedTodoListId
      ? (s.todosByList[selectedTodoListId] ?? []).find(
          (t) => t.id === selectedTodoId,
        )
      : undefined,
  );

  const fetchLabels = useLabelsStore((s) => s.fetchLabels);
  const activeSection = useUiStore((s) => s.activeSection);
  const collapsed = usePanelStore((s) => s.taskPanelCollapsed);
  const setCollapsed = usePanelStore((s) => s.setTaskPanelCollapsed);
  const { width, dragging, handleProps } = useTaskPanelResize();

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  // Opening a task is a "show me the details" gesture, so reveal the pane if the
  // user had it tucked away. Runs only when the selection changes — collapsing
  // while a task stays open does not re-trigger this.
  useEffect(() => {
    if (selectedTodoId) setCollapsed(false);
  }, [selectedTodoId, setCollapsed]);

  const active = todo && selectedTodoListId;

  if (collapsed) {
    return (
      <aside
        className={`task-panel tui-pane pane--right is-collapsed ${activeSection === 3 ? "is-active" : ""}`}
        style={{ width: TASK_PANEL_RAIL_WIDTH }}
      >
        <button
          className="task-panel-rail"
          onClick={() => setCollapsed(false)}
          title="Expand details ( ] )"
          aria-label="Expand detail panel"
          aria-expanded={false}
        >
          <span className="task-panel-rail__glyph" aria-hidden="true">
            ‹
          </span>
          <span className="task-panel-rail__label">detail</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`task-panel tui-pane pane--right ${dragging ? "is-resizing" : ""} ${activeSection === 3 ? "is-active" : ""}`}
      style={{ width }}
    >
      <div className="task-panel-resizer" {...handleProps}>
        <span className="task-panel-resizer-grip" aria-hidden="true" />
      </div>

      <div className="pane-head">
        <span className="pane-head__title">
          <span className="pane-head__tag">[3]</span>
          <span className="pane-head__name">detail</span>
        </span>
        <span className="pane-head__actions">
          {active && (
            <button
              className="task-panel-close"
              onClick={closeTodo}
              title="Close (Esc)"
              aria-label="Close panel"
            >
              esc
            </button>
          )}
          <button
            className="task-panel-collapse"
            onClick={() => setCollapsed(true)}
            title="Collapse panel ( ] )"
            aria-label="Collapse detail panel"
            aria-expanded={true}
          >
            ›|
          </button>
        </span>
      </div>

      {active ? (
        // key remounts on todo change → local edits reset + entrance replays.
        <PanelBody key={todo!.id} todo={todo!} listId={selectedTodoListId!} />
      ) : (
        <div className="detail-empty">
          <div className="glyph">▢</div>
          <div>no item selected</div>
          <div className="hint">
            select a task or press <span className="accent">↵</span> on a row to
            inspect
          </div>
        </div>
      )}
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════════
   Panel body — the editing surface
   ════════════════════════════════════════════════════════════════ */
type OpenPopover = "date" | "priority" | "label" | null;
const MAX_DESCRIPTION_HEIGHT = 420;

/* The fields the pane-[3] keyboard cursor steps through, top to bottom. `list`
   is read-only so it's not a stop. Enter on a field activates it: toggling
   status, opening a picker, or entering a textarea to edit. */
const FIELD_KEYS = ["title", "status", "prio", "due", "tags", "note"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function PanelBody({ todo, listId }: { todo: Todo; listId: string }) {
  const closeTodo = useNavigationStore((s) => s.closeTodo);
  const { updateTodo, toggleTodo, addLabelToTodo, removeLabelFromTodo } =
    useTodosStore();
  const labels = useLabelsStore((s) => s.labels);
  const createLabel = useLabelsStore((s) => s.createLabel);
  const updateLabel = useLabelsStore((s) => s.updateLabel);
  const deleteLabel = useLabelsStore((s) => s.deleteLabel);
  const listName = useTodoListsStore(
    (s) => s.lists.find((l) => l.id === listId)?.name,
  );
  const activeSection = useUiStore((s) => s.activeSection);

  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");
  const [open, setOpen] = useState<OpenPopover>(null);
  /* The field highlighted by the pane-[3] keyboard cursor (↑/↓). */
  const [focusedFieldKey, setFocusedFieldKey] = useState<FieldKey | null>(null);

  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<string>(LABEL_SWATCHES[0]);

  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelName, setEditLabelName] = useState("");
  const [editLabelColor, setEditLabelColor] = useState<string>(LABEL_SWATCHES[0]);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);

  const descRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Mirror the mutable values the window keydown handler reads so it can
  // subscribe once (stable deps) without closing over stale state.
  const openRef = useRef(open);
  openRef.current = open;
  const fieldRef = useRef(focusedFieldKey);
  fieldRef.current = focusedFieldKey;
  // True while an inline label sub-form (create / rename / delete-confirm) is
  // open in the tags picker — Esc dismisses that form before the picker itself.
  const labelFormOpen =
    creatingLabel || editingLabelId !== null || deletingLabelId !== null;
  const labelFormOpenRef = useRef(labelFormOpen);
  labelFormOpenRef.current = labelFormOpen;

  useEffect(() => setTitle(todo.title), [todo.title]);
  useEffect(() => setDescription(todo.description ?? ""), [todo.description]);

  const grow = () => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_DESCRIPTION_HEIGHT)}px`;
    el.style.overflowY =
      el.scrollHeight > MAX_DESCRIPTION_HEIGHT ? "auto" : "hidden";
  };
  useLayoutEffect(grow, [description]);

  // The title wraps instead of clipping: a one-row textarea that auto-grows to
  // fit its content, so long titles stay fully visible without scrolling.
  const growTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(growTitle, [title]);

  // Both fields size themselves from scrollHeight, which depends on the pane's
  // width. The pane animates its width (transition: width 0.16s) on the
  // collapsed→expanded entrance, so the layout-effect measurements above run
  // while it's still narrow — a short title wraps into many lines and the box
  // is left inflated until the body remounts. Re-measure on every width change
  // (entrance transition, drag-resize, window resize). Observing the content
  // container rather than the textareas avoids a measure→resize→measure loop.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      growTitle();
      grow();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Pane-[3] keyboard control ────────────────────────────────────────────
     The detail panel is the keyboard's third pane. When it's active, ↑/↓ move a
     field cursor and Enter activates the focused field (toggle status, open a
     picker, or enter a textarea to edit). When a picker is open, ↑/↓ rove focus
     through its items while Enter/Space act on the focused control natively. Esc
     closes the open picker first, then the panel. Mirrors the cursor model the
     Lists/Tasks panes use and yields to text editing via isTypingTarget. The
     listener stays on the bubble phase so the title/note textareas can
     stopPropagation their own Esc (revert + blur) before it reaches here. */
  useEffect(() => {
    const moveField = (delta: number) => {
      setFocusedFieldKey((cur) => {
        const i = cur
          ? FIELD_KEYS.indexOf(cur)
          : delta > 0
            ? -1
            : FIELD_KEYS.length;
        // idx is clamped within bounds, so the lookup is always defined.
        const idx = Math.min(Math.max(i + delta, 0), FIELD_KEYS.length - 1);
        const next = FIELD_KEYS[idx]!;
        requestAnimationFrame(() => {
          contentRef.current
            ?.querySelector(`[data-field="${next}"]`)
            ?.scrollIntoView({ block: "nearest" });
        });
        return next;
      });
    };

    const pickerItems = () =>
      Array.from(
        contentRef.current?.querySelectorAll<HTMLElement>(
          ".task-popover [data-pop-item]",
        ) ?? [],
      );

    // ↑/↓ move between picker items (priority options, label rows, the New-label
    // button, form controls). When focus sits on a label row's inline action,
    // the containing-item fallback keeps ↑/↓ stepping row-to-row.
    const movePickerFocus = (delta: number) => {
      const items = pickerItems();
      if (items.length === 0) return;
      const active = document.activeElement;
      let i = active instanceof HTMLElement ? items.indexOf(active) : -1;
      if (i === -1) i = items.findIndex((el) => el.contains(active));
      if (i === -1) i = delta > 0 ? -1 : items.length;
      items[Math.min(Math.max(i + delta, 0), items.length - 1)]?.focus();
    };

    // →/← step onto a label row's inline actions (rename / delete) and back to
    // the row. Only label rows expose [data-pop-action] children, so this is a
    // no-op for priority options, the New-label button, and form controls.
    const moveRowAction = (delta: number) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      const row = active.closest("[data-pop-item]");
      if (!row) return;
      const actions = Array.from(
        row.querySelectorAll<HTMLElement>("[data-pop-action]"),
      );
      if (actions.length === 0) return;
      const cur = actions.indexOf(active);
      if (delta > 0) actions[Math.min(cur + 1, actions.length - 1)]?.focus();
      else if (cur <= 0) (row as HTMLElement).focus();
      else actions[cur - 1]?.focus();
    };

    const focusEnd = (el: HTMLTextAreaElement | null) => {
      if (!el) return;
      el.focus();
      const n = el.value.length;
      el.setSelectionRange(n, n);
    };

    const activateField = (key: FieldKey) => {
      switch (key) {
        case "title":
          focusEnd(titleRef.current);
          break;
        case "note":
          focusEnd(descRef.current);
          break;
        case "status":
          toggleTodo(listId, todo.id);
          break;
        case "prio":
          setOpen("priority");
          break;
        case "due":
          setOpen("date");
          break;
        case "tags":
          setOpen("label");
          break;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      // Esc works from any pane while a task is open: close the picker, else the
      // panel. The title/note textareas stopPropagation their own Esc, so those
      // revert-and-blur before this runs.
      if (e.key === "Escape") {
        if (openRef.current) {
          if (labelFormOpenRef.current) {
            // Dismiss the inline label form but keep the tags picker open.
            setCreatingLabel(false);
            setEditingLabelId(null);
            setDeletingLabelId(null);
          } else {
            setOpen(null);
          }
        } else {
          closeTodo();
        }
        return;
      }

      // Field/picker navigation only when the detail pane owns the keyboard.
      if (useUiStore.getState().activeSection !== 3) return;

      const typing = isTypingTarget(document.activeElement);

      if (openRef.current) {
        // Inside a picker: rove focus with ↑/↓; Enter/Space act on the focused
        // control natively. While typing in a label/date input, let the keys
        // edit text instead.
        if (typing) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          movePickerFocus(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          movePickerFocus(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveRowAction(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveRowAction(-1);
        }
        return;
      }

      // Editing the title/note: arrows move the caret, so don't steal them.
      if (typing) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveField(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveField(-1);
      } else if (e.key === "Enter") {
        if (!fieldRef.current) return;
        e.preventDefault();
        activateField(fieldRef.current);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTodo, toggleTodo, listId, todo.id]);

  /* Entering the detail pane seeds the cursor on the first field so there's an
     immediate "you are here" anchor; once set it persists across pane switches. */
  useEffect(() => {
    if (activeSection === 3) setFocusedFieldKey((cur) => cur ?? FIELD_KEYS[0]);
  }, [activeSection]);

  /* When a picker opens, move focus into it (its current value if marked, else
     the first item) so ↑/↓ and Enter operate on it right away. */
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const root = contentRef.current?.querySelector(".task-popover");
      if (!root) return;
      const target =
        root.querySelector<HTMLElement>("[data-pop-item][data-current]") ??
        root.querySelector<HTMLElement>("[data-pop-item]");
      target?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  /* ── Field savers ──────────────────────────────────── */
  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(todo.title);
      return;
    }
    if (trimmed !== todo.title) updateTodo(listId, todo.id, { title: trimmed });
  };

  const saveDescription = () => {
    const next = description.trim() ? description : "";
    if (next !== (todo.description ?? "")) {
      updateTodo(listId, todo.id, { description: next || null });
    }
  };

  const setDue = (date: Date | null) => {
    updateTodo(listId, todo.id, { dueDate: date ? date.toISOString() : null });
    setOpen(null);
  };

  const setPriority = (p: TodoPriority | null) => {
    updateTodo(listId, todo.id, { priority: p });
    setOpen(null);
  };

  const assignedIds = new Set(todo.labels.map((l) => l.id));

  const toggleLabel = (labelId: string) => {
    if (assignedIds.has(labelId)) removeLabelFromTodo(listId, todo.id, labelId);
    else addLabelToTodo(listId, todo.id, labelId);
  };

  const submitNewLabel = async () => {
    const name = newLabelName.trim();
    if (!name) return;
    const created = await createLabel(name, newLabelColor);
    if (created) addLabelToTodo(listId, todo.id, created.id);
    setNewLabelName("");
    setNewLabelColor(LABEL_SWATCHES[0]);
    setCreatingLabel(false);
  };

  const startEditLabel = (label: Label) => {
    setDeletingLabelId(null);
    setCreatingLabel(false);
    setEditingLabelId(label.id);
    setEditLabelName(label.name);
    setEditLabelColor(label.color);
  };

  const cancelEditLabel = () => {
    setEditingLabelId(null);
    setEditLabelName("");
  };

  const submitEditLabel = async () => {
    const name = editLabelName.trim();
    if (!name || !editingLabelId) return;
    const ok = await updateLabel(editingLabelId, {
      name,
      color: editLabelColor,
    });
    if (ok) cancelEditLabel();
  };

  const confirmDeleteLabel = async (id: string) => {
    const ok = await deleteLabel(id);
    if (ok) setDeletingLabelId(null);
  };

  const closeLabelPopover = () => {
    setOpen(null);
    setCreatingLabel(false);
    setEditingLabelId(null);
    setDeletingLabelId(null);
  };

  const pri = priorityMeta(todo.priority);
  const dueOverdue =
    todo.dueDate != null && !todo.completed && isOverdue(todo.dueDate);

  const listPath = listName
    ? `~/lists/${slug(listName)}`
    : "~/lists/—";

  // Highlight ring for the keyboard field cursor, shown only while pane [3] is
  // the active pane (matching how the sidebar gates its own cursor visual).
  const fieldCls = (key: FieldKey) =>
    activeSection === 3 && focusedFieldKey === key ? " is-kbd-focus" : "";

  return (
    <>
      <div className="task-panel-content" ref={contentRef}>
        {/* ITEM */}
        <div className="detail-item">
          <div className="detail-label detail-label--ruled">item</div>
          <div className={`task-title-row${fieldCls("title")}`} data-field="title">
            <button
              className={`task-checkbox ${todo.completed ? "checked" : ""}`}
              onClick={() => toggleTodo(listId, todo.id)}
              aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
            />
            <textarea
              ref={titleRef}
              rows={1}
              className={`task-title-input ${todo.completed ? "completed" : ""}`}
              value={title}
              placeholder="Untitled task"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setTitle(todo.title);
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
        </div>

        {/* FIELDS */}
        <div className="detail-fields">
          <div className="detail-label detail-label--ruled">meta</div>
          {/* status */}
          <div className={`field-row${fieldCls("status")}`} data-field="status">
            <span className="field-key">status</span>
            <span className="field-val">
              <button
                className={`status-toggle ${todo.completed ? "is-done" : ""}`}
                onClick={() => toggleTodo(listId, todo.id)}
              >
                <span
                  className={`status-glyph ${todo.completed ? "done" : ""}`}
                >
                  {todo.completed ? "●" : "○"}
                </span>
                {todo.completed ? "done" : "pending"}
              </button>
            </span>
          </div>

          {/* priority */}
          <div className={`field-row${fieldCls("prio")}`} data-field="prio">
            <span className="field-key">prio</span>
            <span className="field-val">
              <div className="task-chip-wrap">
                <button
                  className={`task-chip prio-chip prio-${todo.priority ?? "none"} ${pri ? "is-set" : ""}`}
                  onClick={() => setOpen(open === "priority" ? null : "priority")}
                >
                  {pri ? (
                    <>
                      <PriorityBars priority={todo.priority} />
                      {pri.label}
                    </>
                  ) : (
                    <>
                      <FlagIcon size={14} />
                      set
                    </>
                  )}
                </button>
                <Popover open={open === "priority"} onClose={() => setOpen(null)}>
                  <div className="task-popover-menu">
                    <button
                      className="task-menu-item"
                      data-pop-item
                      data-current={!pri ? true : undefined}
                      onClick={() => setPriority(null)}
                    >
                      <span className="priority-dot priority-none" />
                      <span className="task-menu-label">None</span>
                      {!pri && (
                        <span className="task-menu-check">
                          <CheckIcon size={13} />
                        </span>
                      )}
                    </button>
                    {PRIORITY_META.map((m) => (
                      <button
                        key={m.value}
                        className="task-menu-item"
                        data-pop-item
                        data-current={todo.priority === m.value ? true : undefined}
                        onClick={() => setPriority(m.value)}
                      >
                        <span className={`priority-dot ${m.dotClass}`} />
                        <span className="task-menu-label">{m.label}</span>
                        {todo.priority === m.value && (
                          <span className="task-menu-check">
                            <CheckIcon size={13} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </Popover>
              </div>
            </span>
          </div>

          {/* due */}
          <div className={`field-row${fieldCls("due")}`} data-field="due">
            <span className="field-key">due</span>
            <span className="field-val">
              <div className="task-chip-wrap">
                <button
                  className={`task-chip ${todo.dueDate ? "is-set" : ""} ${dueOverdue ? "is-overdue" : ""}`}
                  onClick={() => setOpen(open === "date" ? null : "date")}
                >
                  <CalendarIcon size={14} />
                  {todo.dueDate ? formatDueDate(todo.dueDate) : "set"}
                </button>
                <Popover open={open === "date"} onClose={() => setOpen(null)}>
                  <div className="task-popover-pad">
                    <input
                      type="date"
                      className="task-date-input"
                      data-pop-item
                      value={todo.dueDate ? todo.dueDate.slice(0, 10) : ""}
                      onChange={(e) =>
                        setDue(
                          e.target.value
                            ? new Date(`${e.target.value}T00:00:00`)
                            : null,
                        )
                      }
                      autoFocus
                    />
                    {todo.dueDate && (
                      <button
                        className="task-popover-clear"
                        data-pop-item
                        onClick={() => setDue(null)}
                      >
                        Clear due date
                      </button>
                    )}
                  </div>
                </Popover>
              </div>
            </span>
          </div>

          {/* tags */}
          <div className={`field-row${fieldCls("tags")}`} data-field="tags">
            <span className="field-key">tags</span>
            <span className="field-val">
              {todo.labels.map((label) => (
                <span
                  key={label.id}
                  className="tag"
                  style={{ color: label.color }}
                >
                  {label.name}
                </span>
              ))}
              <div className="task-chip-wrap">
                <button
                  className="task-chip"
                  onClick={() => setOpen(open === "label" ? null : "label")}
                >
                  <TagIcon size={14} />
                  {todo.labels.length ? "edit" : "add"}
                </button>
                <Popover open={open === "label"} onClose={closeLabelPopover}>
                  <div className="task-popover-menu">
                    {labels.length === 0 && !creatingLabel && (
                      <div className="task-popover-empty">No labels yet</div>
                    )}
                    {labels.map((label) => {
                      if (editingLabelId === label.id) {
                        return (
                          <div key={label.id} className="label-create">
                            <input
                              className="label-create-input"
                              placeholder="Label name"
                              maxLength={50}
                              value={editLabelName}
                              autoFocus
                              onChange={(e) => setEditLabelName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submitEditLabel();
                                if (e.key === "Escape") {
                                  e.stopPropagation();
                                  cancelEditLabel();
                                }
                              }}
                            />
                            <div className="label-swatches">
                              {LABEL_SWATCHES.map((c) => (
                                <button
                                  key={c}
                                  className={`label-swatch ${editLabelColor === c ? "selected" : ""}`}
                                  style={{ background: c }}
                                  onClick={() => setEditLabelColor(c)}
                                  aria-label={`Color ${c}`}
                                />
                              ))}
                            </div>
                            <div className="label-row-form-actions">
                              <button
                                className="label-form-cancel"
                                data-pop-item
                                onClick={cancelEditLabel}
                              >
                                Cancel
                              </button>
                              <button
                                className="label-create-submit"
                                data-pop-item
                                onClick={submitEditLabel}
                                disabled={!editLabelName.trim()}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (deletingLabelId === label.id) {
                        return (
                          <div key={label.id} className="label-delete-confirm">
                            <span className="label-delete-text">
                              Delete <strong>{label.name}</strong>? It will be
                              removed from all tasks.
                            </span>
                            <div className="label-row-form-actions">
                              <button
                                className="label-form-cancel"
                                data-pop-item
                                autoFocus
                                onClick={() => setDeletingLabelId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                className="label-delete-confirm-btn"
                                data-pop-item
                                onClick={() => confirmDeleteLabel(label.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const assigned = assignedIds.has(label.id);
                      return (
                        <div
                          key={label.id}
                          className="task-menu-item label-menu-row"
                          role="button"
                          tabIndex={0}
                          data-pop-item
                          onClick={() => toggleLabel(label.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleLabel(label.id);
                            }
                          }}
                        >
                          <span
                            className="label-swatch-dot"
                            style={{ background: label.color }}
                          />
                          <span className="task-menu-label">{label.name}</span>
                          {assigned && (
                            <span className="task-menu-check label-row-check">
                              <CheckIcon size={13} />
                            </span>
                          )}
                          <span className="label-row-actions">
                            <button
                              className="label-row-btn"
                              title="Rename / recolor"
                              aria-label={`Edit ${label.name}`}
                              data-pop-action
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditLabel(label);
                              }}
                            >
                              <PencilIcon size={13} />
                            </button>
                            <button
                              className="label-row-btn label-row-btn-danger"
                              title="Delete label"
                              aria-label={`Delete ${label.name}`}
                              data-pop-action
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLabelId(null);
                                setDeletingLabelId(label.id);
                              }}
                            >
                              <TrashIcon size={13} />
                            </button>
                          </span>
                        </div>
                      );
                    })}

                    <div className="task-popover-divider" />

                    {creatingLabel ? (
                      <div className="label-create">
                        <input
                          className="label-create-input"
                          placeholder="Label name"
                          maxLength={50}
                          value={newLabelName}
                          autoFocus
                          onChange={(e) => setNewLabelName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitNewLabel();
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              setCreatingLabel(false);
                            }
                          }}
                        />
                        <div className="label-swatches">
                          {LABEL_SWATCHES.map((c) => (
                            <button
                              key={c}
                              className={`label-swatch ${newLabelColor === c ? "selected" : ""}`}
                              style={{ background: c }}
                              onClick={() => setNewLabelColor(c)}
                              aria-label={`Color ${c}`}
                            />
                          ))}
                        </div>
                        <button
                          className="label-create-submit"
                          data-pop-item
                          onClick={submitNewLabel}
                          disabled={!newLabelName.trim()}
                        >
                          Create &amp; add
                        </button>
                      </div>
                    ) : (
                      <button
                        className="task-menu-item task-menu-create"
                        data-pop-item
                        onClick={() => setCreatingLabel(true)}
                      >
                        <span className="task-menu-create-icon">
                          <PlusIcon size={14} />
                        </span>
                        <span className="task-menu-label">New label</span>
                      </button>
                    )}
                  </div>
                </Popover>
              </div>
            </span>
          </div>

          {/* list */}
          <div className="field-row">
            <span className="field-key">list</span>
            <span className="field-val">
              <span className="path">{listPath}</span>
            </span>
          </div>
        </div>

        {/* NOTE */}
        <div className={`detail-section${fieldCls("note")}`} data-field="note">
          <div className="detail-label detail-label--ruled">note</div>
          <textarea
            ref={descRef}
            className="task-description-input"
            placeholder="Add a description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setDescription(todo.description ?? "");
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>

      <div className="task-panel-footer">Created {timeAgo(todo.createdAt)}</div>
    </>
  );
}
