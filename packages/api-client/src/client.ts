import type {
  ApiResponse,
  AuthResponse,
  AuthTokens,
  CreateLabelDto,
  CreateTodoDto,
  CreateTodoListDto,
  Label,
  PaginatedResponse,
  RefreshTokenRequest,
  SidebarLayout,
  SidebarLayoutResponse,
  SignInRequest,
  SignUpRequest,
  Todo,
  TodoFilters,
  TodoList,
  UpdateLabelDto,
  UpdateTodoDto,
  UpdateTodoListDto,
} from "@todo-app/shared-types";

export interface TodoApiClientConfig {
  baseUrl: string;
  getHeaders?: () => Record<string, string>;
  onTokenExpired?: () => Promise<void>;
}

export class TodoApiClient {
  private baseUrl: string;
  private getHeaders: () => Record<string, string>;
  private onTokenExpired?: () => Promise<void>;

  constructor(config: TodoApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.getHeaders = config.getHeaders ?? (() => ({}));
    this.onTokenExpired = config.onTokenExpired;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    try {
      return await this.executeRequest<T>(endpoint, options);
    } catch (error) {
      // On 401, attempt token refresh and retry once
      if (
        error instanceof ApiClientError &&
        error.statusCode === 401 &&
        this.onTokenExpired &&
        !endpoint.startsWith("/auth/")
      ) {
        await this.onTokenExpired();
        return this.executeRequest<T>(endpoint, options);
      }
      throw error;
    }
  }

  private async executeRequest<T>(
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

  // ─── Sidebar Layout ──────────────────────────────────

  async getSidebarLayout(): Promise<ApiResponse<SidebarLayoutResponse>> {
    return this.request("/sidebar-layout");
  }

  async saveSidebarLayout(
    layout: SidebarLayout,
  ): Promise<ApiResponse<SidebarLayoutResponse>> {
    return this.request("/sidebar-layout", {
      method: "PUT",
      body: JSON.stringify({ layout }),
    });
  }

  // ─── Labels (user-global) ────────────────────────────

  async getLabels(): Promise<ApiResponse<Label[]>> {
    return this.request("/labels");
  }

  async createLabel(dto: CreateLabelDto): Promise<ApiResponse<Label>> {
    return this.request("/labels", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  async updateLabel(
    id: string,
    dto: UpdateLabelDto,
  ): Promise<ApiResponse<Label>> {
    return this.request(`/labels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  }

  async deleteLabel(id: string): Promise<ApiResponse<void>> {
    return this.request(`/labels/${id}`, {
      method: "DELETE",
    });
  }

  // ─── Todo <-> Label assignment (returns the updated todo) ───

  async addLabelToTodo(
    listId: string,
    todoId: string,
    labelId: string,
  ): Promise<ApiResponse<Todo>> {
    return this.request(`/todo-lists/${listId}/todos/${todoId}/labels`, {
      method: "POST",
      body: JSON.stringify({ labelId }),
    });
  }

  async removeLabelFromTodo(
    listId: string,
    todoId: string,
    labelId: string,
  ): Promise<ApiResponse<Todo>> {
    return this.request(
      `/todo-lists/${listId}/todos/${todoId}/labels/${labelId}`,
      {
        method: "DELETE",
      },
    );
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
