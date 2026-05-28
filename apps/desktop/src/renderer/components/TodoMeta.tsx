import type { Todo } from "@tickstep/shared-types";
import { formatDueDate, isOverdue } from "../lib/taskDetail";
import PriorityBars from "./PriorityBars";

/** The right-hand grid cells of a todo row: a priority meter (col 3) and the
 *  due date (col 4). Emitted as a fragment so each lands in its own table
 *  column. Pass `showDue={false}` where the due slot is used for something else
 *  (e.g. the source-list badge on the Today view). */
export default function TodoMeta({
  todo,
  showDue = true,
}: {
  todo: Todo;
  showDue?: boolean;
}) {
  const overdue =
    todo.dueDate != null && !todo.completed && isOverdue(todo.dueDate);

  return (
    <>
      <PriorityBars priority={todo.priority} />
      {showDue && todo.dueDate && (
        <span className={`todo-meta-due ${overdue ? "overdue" : ""}`}>
          {formatDueDate(todo.dueDate)}
        </span>
      )}
    </>
  );
}
