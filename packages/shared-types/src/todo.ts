export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateTodoDto = Pick<Todo, "title"> &
  Partial<Pick<Todo, "description">>;

export type UpdateTodoDto = Partial<
  Pick<Todo, "title" | "description" | "completed">
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
