import type { Label } from "./label";

export type TodoPriority = "low" | "medium" | "high";

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null; // ISO 8601
  priority: TodoPriority | null;
  labels: Label[]; // resolved labels on this todo
  createdAt: string;
  updatedAt: string;
}

// labels are managed via dedicated endpoints, so NOT part of these DTOs
export type CreateTodoDto = Pick<Todo, "title"> &
  Partial<Pick<Todo, "description" | "dueDate" | "priority">>;

export type UpdateTodoDto = Partial<
  Pick<Todo, "title" | "description" | "completed" | "dueDate" | "priority">
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
