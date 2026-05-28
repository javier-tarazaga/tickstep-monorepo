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

const PROGRESS_CELLS = 16;

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
  const { width, dragging, handleProps } = useTaskPanelResize();

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const active = todo && selectedTodoListId;

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
        {active && (
          <span className="pane-head__actions">
            <button
              className="task-panel-close"
              onClick={closeTodo}
              title="Close (Esc)"
              aria-label="Close panel"
            >
              esc
            </button>
          </span>
        )}
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

function PanelBody({ todo, listId }: { todo: Todo; listId: string }) {
  const closeTodo = useNavigationStore((s) => s.closeTodo);
  const { updateTodo, toggleTodo, addLabelToTodo, removeLabelFromTodo } =
    useTodosStore();
  const listTodos = useTodosStore((s) => s.todosByList[listId] ?? []);
  const labels = useLabelsStore((s) => s.labels);
  const createLabel = useLabelsStore((s) => s.createLabel);
  const updateLabel = useLabelsStore((s) => s.updateLabel);
  const deleteLabel = useLabelsStore((s) => s.deleteLabel);
  const listName = useTodoListsStore(
    (s) => s.lists.find((l) => l.id === listId)?.name,
  );

  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");
  const [open, setOpen] = useState<OpenPopover>(null);

  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<string>(LABEL_SWATCHES[0]);

  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelName, setEditLabelName] = useState("");
  const [editLabelColor, setEditLabelColor] = useState<string>(LABEL_SWATCHES[0]);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);

  const descRef = useRef<HTMLTextAreaElement>(null);

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

  /* Esc closes the open popover first, then the panel. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen((cur) => {
        if (cur) return null;
        closeTodo();
        return null;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTodo]);

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

  const done = listTodos.filter((t) => t.completed).length;
  const total = listTodos.length;
  const filled = total ? Math.round((done / total) * PROGRESS_CELLS) : 0;

  const listPath = listName
    ? `~/lists/${slug(listName)}`
    : "~/lists/—";

  return (
    <>
      <div className="task-panel-content">
        {/* ITEM */}
        <div className="detail-item">
          <div className="detail-label">item</div>
          <div className="task-title-row">
            <button
              className={`task-checkbox ${todo.completed ? "checked" : ""}`}
              onClick={() => toggleTodo(listId, todo.id)}
              aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
            />
            <input
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
          {/* status */}
          <div className="field-row">
            <span className="field-key">status</span>
            <span className="field-val">
              <button
                className="status-toggle"
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
          <div className="field-row">
            <span className="field-key">prio</span>
            <span className="field-val">
              <div className="task-chip-wrap">
                <button
                  className={`task-chip ${pri ? "is-set" : ""}`}
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
          <div className="field-row">
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
          <div className="field-row">
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
                                onClick={cancelEditLabel}
                              >
                                Cancel
                              </button>
                              <button
                                className="label-create-submit"
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
                                onClick={() => setDeletingLabelId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                className="label-delete-confirm-btn"
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
                          onClick={submitNewLabel}
                          disabled={!newLabelName.trim()}
                        >
                          Create &amp; add
                        </button>
                      </div>
                    ) : (
                      <button
                        className="task-menu-item task-menu-create"
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
        <div className="detail-section">
          <div className="detail-label">note</div>
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

        {/* LIST PROGRESS */}
        <div className="detail-section">
          <div className="detail-label">list progress</div>
          <div className="progress-bar">
            <span className="progress-cells">
              {Array.from({ length: PROGRESS_CELLS }).map((_, i) => (
                <span key={i} className={i < filled ? "on" : ""}>
                  {i < filled ? "▰" : "▱"}
                </span>
              ))}
            </span>
            <span className="progress-count">
              <span className="accent">{done}</span>/{total}
            </span>
          </div>
        </div>
      </div>

      <div className="task-panel-footer">Created {timeAgo(todo.createdAt)}</div>
    </>
  );
}
