import type { Label } from "./label";

export type TodoPriority = "low" | "medium" | "high";

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null; // ISO 8601
  priority: TodoPriority | null;
  /** The board column this task sits in, or null when it isn't placed on a
   * board (lists with no columns, or tasks not yet assigned). */
  columnId: string | null;
  /** Order within its column, ascending. Null when not placed on a board. */
  position: number | null;
  labels: Label[]; // resolved labels on this todo
  createdAt: string;
  updatedAt: string;
}

// labels are managed via dedicated endpoints, so NOT part of these DTOs
export type CreateTodoDto = Pick<Todo, "title"> &
  Partial<Pick<Todo, "description" | "dueDate" | "priority" | "columnId">>;

export type UpdateTodoDto = Partial<
  Pick<
    Todo,
    | "title"
    | "description"
    | "completed"
    | "dueDate"
    | "priority"
    | "columnId"
    | "position"
  >
>;

export interface TodoFilters {
  completed?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
