import type { Todo } from "@todo-app/shared-types";
import { CalendarIcon, DescriptionIcon } from "./icons";
import { formatDueDate, isOverdue, priorityMeta } from "../lib/taskDetail";

/** Compact, read-only metadata shown on the right of a todo row: priority dot,
 *  due date, and a description indicator. Labels render separately beneath the
 *  title (see TodoLabels). Renders nothing when there's no metadata. */
export default function TodoMeta({ todo }: { todo: Todo }) {
  const pri = priorityMeta(todo.priority);
  const overdue =
    todo.dueDate != null && !todo.completed && isOverdue(todo.dueDate);
  const hasDescription = (todo.description ?? "").trim().length > 0;

  if (!pri && !todo.dueDate && !hasDescription) return null;

  return (
    <span className="todo-meta">
      {hasDescription && (
        <span className="todo-meta-description" title="Has a description">
          <DescriptionIcon size={13} />
        </span>
      )}

      {pri && (
        <span
          className={`priority-dot ${pri.dotClass}`}
          title={`${pri.label} priority`}
        />
      )}

      {todo.dueDate && (
        <span className={`todo-meta-due ${overdue ? "overdue" : ""}`}>
          <CalendarIcon size={12} />
          {formatDueDate(todo.dueDate)}
        </span>
      )}
    </span>
  );
}
