import { useEffect } from "react";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useTodosStore } from "../stores/todosStore";
import { useNavigationStore } from "../stores/navigationStore";
import { useCommandStore } from "../stores/commandStore";
import TodoMeta from "./TodoMeta";
import TodoLabels from "./TodoLabels";

export default function TodayView() {
  const { lists } = useTodoListsStore();
  const { todosByList, fetchTodos, toggleTodo } = useTodosStore();
  const { navigateToList, selectTodo, selectedTodoId } = useNavigationStore();
  const { focusedTodoId, setFocusedTodo } = useCommandStore();

  const openTodo = (todoId: string, listId: string) => {
    setFocusedTodo(todoId);
    selectTodo(todoId, listId);
  };

  // Fetch todos for all lists on mount
  useEffect(() => {
    lists.forEach((list) => {
      fetchTodos(list.id);
    });
  }, [lists, fetchTodos]);

  // Collect all incomplete todos across all lists
  const todayTodos = lists.flatMap((list) => {
    const todos = todosByList[list.id] ?? [];
    return todos
      .filter((t) => !t.completed)
      .map((t) => ({ ...t, listId: list.id, listName: list.name }));
  });

  const completedTodos = lists.flatMap((list) => {
    const todos = todosByList[list.id] ?? [];
    return todos
      .filter((t) => t.completed)
      .map((t) => ({ ...t, listId: list.id, listName: list.name }));
  });

  return (
    <div>
      <div className="page-header">
        <h2>Today</h2>
        <div className="page-subtitle">
          {todayTodos.length} task{todayTodos.length !== 1 ? "s" : ""} remaining
        </div>
      </div>

      {todayTodos.length === 0 && completedTodos.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">&#127793;</div>
          <h3>All clear!</h3>
          <p>Create a list and add some tasks to get started.</p>
        </div>
      )}

      {todayTodos.length > 0 && (
        <div className="todo-items">
          {todayTodos.map((todo) => (
            <div
              key={todo.id}
              data-todo-id={todo.id}
              className={`todo-item ${selectedTodoId === todo.id ? "selected" : ""} ${
                focusedTodoId === todo.id ? "focused" : ""
              }`}
              onClick={() => openTodo(todo.id, todo.listId)}
            >
              <button
                className="todo-checkbox"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTodo(todo.listId, todo.id);
                }}
              />
              <div className="todo-item-main">
                <span className="todo-title">{todo.title}</span>
                <TodoLabels todo={todo} />
              </div>
              <TodoMeta todo={todo} />
              <span
                className="todo-list-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToList(todo.listId);
                }}
              >
                {todo.listName}
              </span>
            </div>
          ))}
        </div>
      )}

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
                data-todo-id={todo.id}
                className={`todo-item ${selectedTodoId === todo.id ? "selected" : ""} ${
                  focusedTodoId === todo.id ? "focused" : ""
                }`}
                onClick={() => openTodo(todo.id, todo.listId)}
              >
                <button
                  className="todo-checkbox checked"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTodo(todo.listId, todo.id);
                  }}
                />
                <div className="todo-item-main">
                  <span className="todo-title completed">{todo.title}</span>
                  <TodoLabels todo={todo} />
                </div>
                <TodoMeta todo={todo} />
                <span
                  className="todo-list-badge"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToList(todo.listId);
                  }}
                >
                  {todo.listName}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
