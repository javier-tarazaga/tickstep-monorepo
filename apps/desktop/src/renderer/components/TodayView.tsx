import { useEffect } from "react";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useTodosStore } from "../stores/todosStore";
import { useNavigationStore } from "../stores/navigationStore";

export default function TodayView() {
  const { lists } = useTodoListsStore();
  const { todosByList, fetchTodos, toggleTodo } = useTodosStore();

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

  const { navigateToList } = useNavigationStore();

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
            <div key={todo.id} className="todo-item">
              <button
                className="todo-checkbox"
                onClick={() => toggleTodo(todo.listId, todo.id)}
              />
              <span className="todo-title">{todo.title}</span>
              <span
                className="todo-list-badge"
                style={{ cursor: "pointer" }}
                onClick={() => navigateToList(todo.listId)}
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
              <div key={todo.id} className="todo-item">
                <button
                  className="todo-checkbox checked"
                  onClick={() => toggleTodo(todo.listId, todo.id)}
                />
                <span className="todo-title completed">{todo.title}</span>
                <span
                  className="todo-list-badge"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigateToList(todo.listId)}
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
