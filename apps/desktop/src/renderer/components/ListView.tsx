import React, { useEffect, useState } from "react";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useTodosStore } from "../stores/todosStore";
import { useNavigationStore } from "../stores/navigationStore";
import TodoMeta from "./TodoMeta";
import TodoLabels from "./TodoLabels";

interface ListViewProps {
  listId: string;
}

export default function ListView({ listId }: ListViewProps) {
  const { lists, deleteList } = useTodoListsStore();
  const { todosByList, isLoading, fetchTodos, addTodo, removeTodo, toggleTodo } =
    useTodosStore();
  const { navigateToToday, selectTodo, selectedTodoId } = useNavigationStore();

  const [newTitle, setNewTitle] = useState("");

  const list = lists.find((l) => l.id === listId);
  const todos = todosByList[listId] ?? [];
  const incompleteTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  useEffect(() => {
    fetchTodos(listId);
  }, [listId, fetchTodos]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addTodo(listId, newTitle.trim());
    setNewTitle("");
  };

  const handleDeleteList = async () => {
    await deleteList(listId);
    navigateToToday();
  };

  if (!list) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#128269;</div>
        <h3>List not found</h3>
        <p>This list may have been deleted.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="list-header">
        <h2>{list.name}</h2>
        <button className="btn-delete-list" onClick={handleDeleteList}>
          Delete list
        </button>
      </div>

      {/* Add todo form */}
      <form className="add-todo-form" onSubmit={handleAdd}>
        <input
          placeholder="Add a new item..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      {isLoading && todos.length === 0 && (
        <div style={{ padding: "24px 0", textAlign: "center" }}>
          <span className="spinner" />
        </div>
      )}

      {/* Incomplete todos */}
      {incompleteTodos.length > 0 && (
        <div className="todo-items" style={{ marginTop: 16 }}>
          {incompleteTodos.map((todo) => (
            <div
              key={todo.id}
              className={`todo-item ${selectedTodoId === todo.id ? "selected" : ""}`}
              onClick={() => selectTodo(todo.id, listId)}
            >
              <button
                className="todo-checkbox"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTodo(listId, todo.id);
                }}
              />
              <div className="todo-item-main">
                <span className="todo-title">{todo.title}</span>
                <TodoLabels todo={todo} />
              </div>
              <TodoMeta todo={todo} />
              <button
                className="todo-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTodo(listId, todo.id);
                }}
                title="Delete"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed section */}
      {completedTodos.length > 0 && (
        <>
          <div
            className="nav-section-header"
            style={{ paddingLeft: 0, marginTop: 24 }}
          >
            <span>
              Completed ({completedTodos.length})
            </span>
          </div>
          <div className="todo-items">
            {completedTodos.map((todo) => (
              <div
                key={todo.id}
                className={`todo-item ${selectedTodoId === todo.id ? "selected" : ""}`}
                onClick={() => selectTodo(todo.id, listId)}
              >
                <button
                  className="todo-checkbox checked"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTodo(listId, todo.id);
                  }}
                />
                <div className="todo-item-main">
                  <span className="todo-title completed">{todo.title}</span>
                  <TodoLabels todo={todo} />
                </div>
                <TodoMeta todo={todo} />
                <button
                  className="todo-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTodo(listId, todo.id);
                  }}
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && todos.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">&#128221;</div>
          <h3>No items yet</h3>
          <p>Add your first item using the form above.</p>
        </div>
      )}
    </div>
  );
}
