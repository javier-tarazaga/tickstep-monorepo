import type {
  ApiResponse,
  AuthResponse,
  AuthTokens,
  CreateTodoDto,
  CreateTodoListDto,
  PaginatedResponse,
  RefreshTokenRequest,
  SignInRequest,
  SignUpRequest,
  Todo,
  TodoFilters,
  TodoList,
  UpdateTodoDto,
  UpdateTodoListDto,
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
      const error = (await response
        .json()
        .catch(() => ({ message: response.statusText }))) as {
        message?: string;
      };
      throw new ApiClientError(
        error.message ?? "Request failed",
        response.status,
        error,
      );
    }

    return response.json() as Promise<ApiResponse<T>>;
  }

  // ─── Auth ──────────────────────────────────────────────

  async signUp(dto: SignUpRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request("/auth/signup", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  async signIn(dto: SignInRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request("/auth/signin", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  async refreshToken(
    dto: RefreshTokenRequest,
  ): Promise<ApiResponse<AuthTokens>> {
    return this.request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  // ─── Todo Lists ────────────────────────────────────────

  async getTodoLists(): Promise<ApiResponse<TodoList[]>> {
    return this.request("/todo-lists");
  }

  async getTodoListById(id: string): Promise<ApiResponse<TodoList>> {
    return this.request(`/todo-lists/${id}`);
  }

  async createTodoList(
    dto: CreateTodoListDto,
  ): Promise<ApiResponse<TodoList>> {
    return this.request("/todo-lists", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  async updateTodoList(
    id: string,
    dto: UpdateTodoListDto,
  ): Promise<ApiResponse<TodoList>> {
    return this.request(`/todo-lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  }

  async deleteTodoList(id: string): Promise<ApiResponse<void>> {
    return this.request(`/todo-lists/${id}`, {
      method: "DELETE",
    });
  }

  // ─── Todos (scoped to a todo list) ─────────────────────

  async getTodos(
    listId: string,
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
    return this.request(
      `/todo-lists/${listId}/todos${query ? `?${query}` : ""}`,
    );
  }

  async getTodoById(
    listId: string,
    id: string,
  ): Promise<ApiResponse<Todo>> {
    return this.request(`/todo-lists/${listId}/todos/${id}`);
  }

  async createTodo(
    listId: string,
    dto: CreateTodoDto,
  ): Promise<ApiResponse<Todo>> {
    return this.request(`/todo-lists/${listId}/todos`, {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  async updateTodo(
    listId: string,
    id: string,
    dto: UpdateTodoDto,
  ): Promise<ApiResponse<Todo>> {
    return this.request(`/todo-lists/${listId}/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  }

  async deleteTodo(
    listId: string,
    id: string,
  ): Promise<ApiResponse<void>> {
    return this.request(`/todo-lists/${listId}/todos/${id}`, {
      method: "DELETE",
    });
  }

  async toggleTodo(
    listId: string,
    id: string,
  ): Promise<ApiResponse<Todo>> {
    return this.request(`/todo-lists/${listId}/todos/${id}/toggle`, {
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
