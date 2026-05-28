import React, { useEffect, useRef, useState } from "react";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useTodosStore } from "../stores/todosStore";
import { useNavigationStore } from "../stores/navigationStore";
import { useCommandStore } from "../stores/commandStore";
import { useShareDialogStore } from "../stores/shareDialogStore";
import { realtimeClient } from "../realtime";
import TodoMeta from "./TodoMeta";
import TodoLabels from "./TodoLabels";

interface ListViewProps {
  listId: string;
}

function TodoRow({
  todo,
  selected,
  focused,
  completed,
  onOpen,
  onToggle,
  onDelete,
}: {
  todo: import("@tickstep/shared-types").Todo;
  selected: boolean;
  focused: boolean;
  completed: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-todo-id={todo.id}
      className={`todo-item ${selected ? "selected" : ""} ${focused ? "focused" : ""}`}
      onClick={onOpen}
    >
      <button
        className={`todo-checkbox ${completed ? "checked" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
      />
      <div className="todo-item-main">
        <span className={`todo-title ${completed ? "completed" : ""}`}>
          {todo.title}
        </span>
        <TodoLabels todo={todo} />
      </div>
      <TodoMeta todo={todo} />
      <button
        className="todo-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete"
        aria-label="Delete task"
      >
        ✕
      </button>
    </div>
  );
}

export default function ListView({ listId }: ListViewProps) {
  const { lists, sections } = useTodoListsStore();
  const { todosByList, isLoading, fetchTodos, addTodo, removeTodo, toggleTodo } =
    useTodosStore();
  const { selectTodo, selectedTodoId } = useNavigationStore();
  const openShareDialog = useShareDialogStore((s) => s.open);
  const { focusedTodoId, setFocusedTodo, pendingAddTaskListId, clearAddTaskFocus } =
    useCommandStore();

  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const list = lists.find((l) => l.id === listId);
  const todos = todosByList[listId] ?? [];
  const incompleteTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  // Breadcrumb: the section this list lives in, if any.
  const section = sections.find((s) => s.listIds.includes(listId));

  const openTodo = (todoId: string) => {
    setFocusedTodo(todoId);
    selectTodo(todoId, listId);
  };

  useEffect(() => {
    fetchTodos(listId);
  }, [listId, fetchTodos]);

  useEffect(() => {
    realtimeClient.joinList(listId);
    return () => realtimeClient.leaveList(listId);
  }, [listId]);

  useEffect(() => {
    if (pendingAddTaskListId === listId) {
      inputRef.current?.focus();
      clearAddTaskFocus();
    }
  }, [pendingAddTaskListId, listId, clearAddTaskFocus]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addTodo(listId, newTitle.trim());
    setNewTitle("");
  };

  if (!list) {
    return (
      <>
        <div className="pane-head">
          <span className="pane-head__title">
            <span className="pane-head__tag">[2]</span>
            <span className="pane-head__name">not found</span>
          </span>
        </div>
        <div className="main-body">
          <div className="empty-state">
            <div className="empty-icon">⚠</div>
            <h3>List not found</h3>
            <p>This list may have been deleted.</p>
          </div>
        </div>
      </>
    );
  }

  const done = completedTodos.length;
  const total = todos.length;

  return (
    <>
      <div className="pane-head">
        <span className="pane-head__title">
          <span className="pane-head__tag">[2]</span>
          <span className="pane-head__name">
            {section ? `${section.name} / ` : ""}
            {list.emoji ? `${list.emoji} ` : ""}
            {list.name}
          </span>
          {total > 0 && (
            <span className="pane-head__meta">
              · <span className="accent">{done}</span>/{total} done
            </span>
          )}
        </span>
        <span className="pane-head__actions">
          <button
            className={`list-share-btn ${list.isShared ? "is-shared" : ""}`}
            onClick={() => openShareDialog(listId)}
            title={list.isShared ? "Manage sharing" : "Share list"}
          >
            {list.isShared ? `shared·${list.members.length}` : "share"}
          </button>
        </span>
      </div>

      <div className="main-body">
        <form className="add-todo-form" onSubmit={handleAdd}>
          <input
            ref={inputRef}
            placeholder="add a new item…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit">add</button>
        </form>

        {isLoading && todos.length === 0 && (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <span className="spinner" />
          </div>
        )}

        {todos.length > 0 && (
          <div className="col-head">
            <span />
            <span className="col-title">title · tags</span>
            <span className="col-prio">prio</span>
            <span className="col-due">due</span>
          </div>
        )}

        {incompleteTodos.length > 0 && (
          <div className="todo-items">
            {incompleteTodos.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                selected={selectedTodoId === todo.id}
                focused={focusedTodoId === todo.id}
                completed={false}
                onOpen={() => openTodo(todo.id)}
                onToggle={() => toggleTodo(listId, todo.id)}
                onDelete={() => removeTodo(listId, todo.id)}
              />
            ))}
          </div>
        )}

        {todos.length > 0 && (
          <div className="list-end">
            ─ end of list · press <span className="accent">a</span> to add ─
          </div>
        )}

        {completedTodos.length > 0 && (
          <>
            <div
              className="nav-section-header"
              style={{ paddingLeft: 16, paddingRight: 16, marginTop: 16 }}
            >
              <span>done ({completedTodos.length})</span>
            </div>
            <div className="todo-items">
              {completedTodos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  selected={selectedTodoId === todo.id}
                  focused={focusedTodoId === todo.id}
                  completed
                  onOpen={() => openTodo(todo.id)}
                  onToggle={() => toggleTodo(listId, todo.id)}
                  onDelete={() => removeTodo(listId, todo.id)}
                />
              ))}
            </div>
          </>
        )}

        {!isLoading && todos.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">▱</div>
            <h3>No items yet</h3>
            <p>
              Type above and hit <span className="accent">↵</span> to add your
              first item.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
