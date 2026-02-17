import type {
  ApiResponse,
  CreateTodoDto,
  PaginatedResponse,
  Todo,
  TodoFilters,
  UpdateTodoDto,
} from "@todo-app/shared-types";

export interface TodoApiClientConfig {
  baseUrl: string;
  getHeaders?: () => Record<string, string>;
}

export class TodoApiClient {
  private baseUrl: string;
  private getHeaders: () => Record<string, string>;

  constructor(config: TodoApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.getHeaders = config.getHeaders ?? (() => ({}));
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new ApiClientError(
        error.message ?? "Request failed",
        response.status,
        error,
      );
    }

    return response.json() as Promise<ApiResponse<T>>;
  }

  async getTodos(
    filters?: TodoFilters,
  ): Promise<ApiResponse<PaginatedResponse<Todo>>> {
    const params = new URLSearchParams();
    if (filters?.completed !== undefined)
      params.set("completed", String(filters.completed));
    if (filters?.search) params.set("search", filters.search);
    if (filters?.page !== undefined) params.set("page", String(filters.page));
    if (filters?.limit !== undefined)
      params.set("limit", String(filters.limit));

    const query = params.toString();
    return this.request(`/todos${query ? `?${query}` : ""}`);
  }

  async getTodoById(id: string): Promise<ApiResponse<Todo>> {
    return this.request(`/todos/${id}`);
  }

  async createTodo(dto: CreateTodoDto): Promise<ApiResponse<Todo>> {
    return this.request("/todos", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  async updateTodo(
    id: string,
    dto: UpdateTodoDto,
  ): Promise<ApiResponse<Todo>> {
    return this.request(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  }

  async deleteTodo(id: string): Promise<ApiResponse<void>> {
    return this.request(`/todos/${id}`, {
      method: "DELETE",
    });
  }

  async toggleTodo(id: string): Promise<ApiResponse<Todo>> {
    return this.request(`/todos/${id}/toggle`, {
      method: "PATCH",
    });
  }
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}
