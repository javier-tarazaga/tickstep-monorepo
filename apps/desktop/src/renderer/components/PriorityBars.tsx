import type { TodoPriority } from "@tickstep/shared-types";

const LEVEL: Record<TodoPriority, number> = { low: 1, medium: 2, high: 3 };

/** Priority shown as three block cells — filled to the priority level, like a
 *  terminal signal-strength meter. Renders nothing when priority is unset. */
export default function PriorityBars({
  priority,
}: {
  priority: TodoPriority | null;
}) {
  if (!priority) return null;
  const on = LEVEL[priority];
  return (
    <span
      className={`prio-bars prio-${priority}`}
      title={`${priority} priority`}
      aria-label={`${priority} priority`}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className={`cell ${i < on ? "on" : ""}`}>
          █
        </span>
      ))}
    </span>
  );
}
