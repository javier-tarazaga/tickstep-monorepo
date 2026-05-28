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

  useEffect(() => {
    lists.forEach((list) => {
      fetchTodos(list.id);
    });
  }, [lists, fetchTodos]);

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

  const renderRow = (
    todo: (typeof todayTodos)[number],
    completed: boolean,
  ) => (
    <div
      key={todo.id}
      data-todo-id={todo.id}
      className={`todo-item ${selectedTodoId === todo.id ? "selected" : ""} ${
        focusedTodoId === todo.id ? "focused" : ""
      }`}
      onClick={() => openTodo(todo.id, todo.listId)}
    >
      <button
        className={`todo-checkbox ${completed ? "checked" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleTodo(todo.listId, todo.id);
        }}
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
      />
      <div className="todo-item-main">
        <span className={`todo-title ${completed ? "completed" : ""}`}>
          {todo.title}
        </span>
        <TodoLabels todo={todo} />
      </div>
      <TodoMeta todo={todo} showDue={false} />
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
  );

  const hasAny = todayTodos.length > 0 || completedTodos.length > 0;

  return (
    <>
      <div className="pane-head">
        <span className="pane-head__title">
          <span className="pane-head__tag">[2]</span>
          <span className="pane-head__name">☼ today</span>
          <span className="pane-head__meta">
            · <span className="accent">{todayTodos.length}</span> open
          </span>
        </span>
      </div>

      <div className="main-body">
        {!hasAny && (
          <div className="empty-state">
            <div className="empty-icon">▱</div>
            <h3>All clear</h3>
            <p>Create a list and add some tasks to get started.</p>
          </div>
        )}

        {todayTodos.length > 0 && (
          <div className="todo-items">
            {todayTodos.map((todo) => renderRow(todo, false))}
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
              {completedTodos.map((todo) => renderRow(todo, true))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
