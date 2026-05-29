import React, { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardColumn, Todo, UpdateTodoDto } from "@tickstep/shared-types";
import { useBoardColumnsStore } from "../stores/boardColumnsStore";
import { useTodosStore } from "../stores/todosStore";
import { useNavigationStore } from "../stores/navigationStore";
import { useCommandStore } from "../stores/commandStore";
import TodoMeta from "./TodoMeta";
import TodoLabels from "./TodoLabels";

/** columnId → ordered todo ids. The board's working order during drag. */
type Items = Record<string, string[]>;

const COLUMN_PREFIX = "column:";

/** Group todos into their columns, sorted by position. Cards whose column is
 *  unknown (e.g. created before the board existed) fall into the first column so
 *  they never vanish. */
function buildItems(columns: BoardColumn[], todos: Todo[]): Items {
  const items: Items = {};
  for (const col of columns) items[col.id] = [];
  const known = new Set(columns.map((c) => c.id));
  const firstColumnId = columns[0]?.id;

  const sorted = [...todos].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  for (const todo of sorted) {
    const target =
      todo.columnId && known.has(todo.columnId)
        ? todo.columnId
        : firstColumnId;
    if (target) items[target]?.push(todo.id);
  }
  return items;
}

export default function BoardView({ listId }: { listId: string }) {
  const columns = useBoardColumnsStore((s) => s.columnsByList[listId]);
  const ensureDefaults = useBoardColumnsStore((s) => s.ensureDefaults);
  const createColumn = useBoardColumnsStore((s) => s.createColumn);

  const todos = useTodosStore((s) => s.todosByList[listId]) ?? [];
  const updateTodo = useTodosStore((s) => s.updateTodo);

  const selectTodo = useNavigationStore((s) => s.selectTodo);
  const selectedTodoId = useNavigationStore((s) => s.selectedTodoId);
  const { focusedTodoId, setFocusedTodo } = useCommandStore();

  const [items, setItems] = useState<Items>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // First board open for a list: idempotently seed Todo/Doing/Done (and place
  // existing tasks). No-op once columns exist.
  useEffect(() => {
    const loaded = useBoardColumnsStore.getState().columnsByList[listId];
    if (!loaded || loaded.length === 0) ensureDefaults(listId);
  }, [listId, ensureDefaults]);

  // Mirror store order into local working state, except mid-drag (so a live
  // preview isn't clobbered by an incoming store update).
  useEffect(() => {
    if (activeId) return;
    setItems(buildItems(columns ?? [], todos));
  }, [columns, todos, activeId]);

  const cols = columns ?? [];
  const todoById = new Map(todos.map((t) => [t.id, t]));
  const activeTodo = activeId ? todoById.get(activeId) : undefined;

  const openTodo = (todoId: string) => {
    setFocusedTodo(todoId);
    selectTodo(todoId, listId);
  };

  const findContainer = (id: string): string | null => {
    if (id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length);
    return (
      Object.keys(items).find((colId) => items[colId]?.includes(id)) ?? null
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  // Live cross-column preview: when the dragged card hovers a different column,
  // move it there in the working state.
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);
    const from = findContainer(draggedId);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;

    setItems((prev) => {
      const fromIds = [...(prev[from] ?? [])];
      const toIds = [...(prev[to] ?? [])];
      const fromIndex = fromIds.indexOf(draggedId);
      if (fromIndex === -1) return prev;
      fromIds.splice(fromIndex, 1);
      const overIndex = toIds.indexOf(overId);
      const insertAt = overIndex === -1 ? toIds.length : overIndex;
      toIds.splice(insertAt, 0, draggedId);
      return { ...prev, [from]: fromIds, [to]: toIds };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const movedId = String(active.id);
    const overId = String(over.id);
    const from = findContainer(movedId);
    const to = findContainer(overId);
    if (!from || !to) return;

    const next: Items = { ...items };
    const target = [...(next[to] ?? [])];
    if (from === to) {
      const oldIndex = target.indexOf(movedId);
      const overIndex =
        overId === `${COLUMN_PREFIX}${to}`
          ? target.length - 1
          : target.indexOf(overId);
      if (oldIndex === -1 || overIndex === -1 || oldIndex === overIndex) {
        commit(next);
        return;
      }
      target.splice(oldIndex, 1);
      target.splice(overIndex, 0, movedId);
      next[to] = target;
    }
    // Cross-column moves were already applied to `items` by handleDragOver.
    commit(next);
  };

  /** Persist only the cards whose column or position actually changed. A card
   *  entering the done column also flips completed (the server reconciles this,
   *  but we set it optimistically so the strike-through is instant). */
  const commit = (next: Items) => {
    const colById = new Map(cols.map((c) => [c.id, c]));
    for (const [colId, ids] of Object.entries(next)) {
      const col = colById.get(colId);
      ids.forEach((todoId, index) => {
        const todo = todoById.get(todoId);
        if (!todo) return;
        const dto: UpdateTodoDto = {};
        if (todo.columnId !== colId) {
          dto.columnId = colId;
          if (col) dto.completed = col.isDone;
        }
        if (todo.position !== index) dto.position = index;
        if (Object.keys(dto).length > 0) updateTodo(listId, todoId, dto);
      });
    }
  };

  const submitNewColumn = () => {
    const name = newColumnName.trim();
    if (name) createColumn(listId, name);
    setNewColumnName("");
    setAddingColumn(false);
  };

  if (cols.length === 0) {
    return (
      <div className="board board--empty">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board">
        {cols.map((col) => (
          <BoardColumnView
            key={col.id}
            listId={listId}
            column={col}
            todoIds={items[col.id] ?? []}
            todoById={todoById}
            selectedTodoId={selectedTodoId}
            focusedTodoId={focusedTodoId}
            onOpen={openTodo}
          />
        ))}

        <div className="board-add-col">
          {addingColumn ? (
            <input
              autoFocus
              className="board-add-col__input"
              placeholder="column name…"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onBlur={submitNewColumn}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewColumn();
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setNewColumnName("");
                  setAddingColumn(false);
                }
              }}
            />
          ) : (
            <button
              className="board-add-col__btn"
              onClick={() => setAddingColumn(true)}
              title="Add column"
            >
              + column
            </button>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTodo ? <BoardCardFace todo={activeTodo} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Column ───────────────────────────────────────────────────────── */

function BoardColumnView({
  listId,
  column,
  todoIds,
  todoById,
  selectedTodoId,
  focusedTodoId,
  onOpen,
}: {
  listId: string;
  column: BoardColumn;
  todoIds: string[];
  todoById: Map<string, Todo>;
  selectedTodoId: string | null;
  focusedTodoId: string | null;
  onOpen: (todoId: string) => void;
}) {
  const renameColumn = useBoardColumnsStore((s) => s.renameColumn);
  const deleteColumn = useBoardColumnsStore((s) => s.deleteColumn);
  const addTodo = useTodosStore((s) => s.addTodo);

  const { setNodeRef } = useDroppable({ id: `${COLUMN_PREFIX}${column.id}` });

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const submitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) renameColumn(listId, column.id, trimmed);
    else setName(column.name);
    setRenaming(false);
  };

  const submitAdd = () => {
    const title = newTitle.trim();
    if (title) addTodo(listId, title, column.id);
    setNewTitle("");
    setAdding(false);
  };

  return (
    <section
      className={`board-col ${column.isDone ? "board-col--done" : ""}`}
      data-column-id={column.id}
    >
      <header className="board-col__head">
        {renaming ? (
          <input
            autoFocus
            className="board-col__rename"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                e.stopPropagation();
                setName(column.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <span
            className="board-col__name"
            onDoubleClick={() => {
              setName(column.name);
              setRenaming(true);
            }}
            title="Double-click to rename"
          >
            {column.name}
          </span>
        )}
        <span className="board-col__count">{todoIds.length}</span>
        <span className="board-col__actions">
          <button
            className="board-col__del"
            onClick={() => deleteColumn(listId, column.id)}
            title="Delete column (cards move to the first column)"
            aria-label="Delete column"
          >
            ✕
          </button>
        </span>
      </header>

      <div className="board-col__body" ref={setNodeRef}>
        <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
          {todoIds.map((todoId) => {
            const todo = todoById.get(todoId);
            if (!todo) return null;
            return (
              <BoardCard
                key={todoId}
                todo={todo}
                selected={selectedTodoId === todoId}
                focused={focusedTodoId === todoId}
                onOpen={() => onOpen(todoId)}
              />
            );
          })}
        </SortableContext>

        {todoIds.length === 0 && (
          <div className="board-col__empty">drop here</div>
        )}
      </div>

      <footer className="board-col__foot">
        {adding ? (
          <input
            autoFocus
            className="board-col__add-input"
            placeholder="new card…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={submitAdd}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") {
                e.stopPropagation();
                setNewTitle("");
                setAdding(false);
              }
            }}
          />
        ) : (
          <button className="board-col__add" onClick={() => setAdding(true)}>
            + card
          </button>
        )}
      </footer>
    </section>
  );
}

/* ── Card ─────────────────────────────────────────────────────────── */

function BoardCard({
  todo,
  selected,
  focused,
  onOpen,
}: {
  todo: Todo;
  selected: boolean;
  focused: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id, data: { type: "card" } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-todo-id={todo.id}
      className={`board-card ${selected ? "selected" : ""} ${focused ? "focused" : ""}`}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <BoardCardFace todo={todo} />
    </div>
  );
}

/** The visual contents of a card, shared by the live card and the drag ghost. */
function BoardCardFace({
  todo,
  dragging = false,
}: {
  todo: Todo;
  dragging?: boolean;
}) {
  return (
    <div className={`board-card__face ${dragging ? "is-ghost" : ""}`}>
      <span className={`board-card__title ${todo.completed ? "completed" : ""}`}>
        {todo.title}
      </span>
      <TodoLabels todo={todo} />
      {(todo.priority || todo.dueDate) && (
        <span className="board-card__meta">
          <TodoMeta todo={todo} />
        </span>
      )}
    </div>
  );
}
