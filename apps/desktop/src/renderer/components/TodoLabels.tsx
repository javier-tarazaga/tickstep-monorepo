import type { Todo } from "@tickstep/shared-types";
import { labelChipStyle } from "../lib/taskDetail";

/** Label pills shown on a second line beneath a todo's title in list rows.
 *  Renders nothing when the todo has no labels. */
export default function TodoLabels({ todo }: { todo: Todo }) {
  if (todo.labels.length === 0) return null;

  return (
    <span className="todo-label-row">
      {todo.labels.map((label) => (
        <span
          key={label.id}
          className="todo-label"
          style={labelChipStyle(label.color)}
        >
          {label.name}
        </span>
      ))}
    </span>
  );
}
