import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTodoDto,
  PaginatedResponse,
  Todo,
  TodoFilters,
  UpdateTodoDto,
} from "@todo-app/shared-types";
import { TodoRepository, type Todo as TodoRow } from "./todo.repository";

@Injectable()
export class TodosService {
  constructor(private readonly todoRepository: TodoRepository) {}

  async findAll(
    todoListId: string,
    filters?: TodoFilters,
  ): Promise<PaginatedResponse<Todo>> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const { rows, total } = await this.todoRepository.findAllByListId(
      todoListId,
      {
        completed: filters?.completed,
        search: filters?.search,
        page,
        limit,
      },
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map(this.toTodo),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string, todoListId: string): Promise<Todo> {
    const row = await this.todoRepository.findById(id, todoListId);
    if (!row) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    return this.toTodo(row);
  }

  async create(todoListId: string, dto: CreateTodoDto): Promise<Todo> {
    const row = await this.todoRepository.create(
      todoListId,
      dto.title,
      dto.description ?? null,
    );
    return this.toTodo(row);
  }

  async update(
    id: string,
    todoListId: string,
    dto: UpdateTodoDto,
  ): Promise<Todo> {
    const row = await this.todoRepository.update(id, todoListId, {
      title: dto.title,
      description: dto.description,
      completed: dto.completed,
    });
    if (!row) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    return this.toTodo(row);
  }

  async remove(id: string, todoListId: string): Promise<void> {
    const deleted = await this.todoRepository.delete(id, todoListId);
    if (!deleted) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
  }

  async toggle(id: string, todoListId: string): Promise<Todo> {
    const row = await this.todoRepository.toggle(id, todoListId);
    if (!row) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    return this.toTodo(row);
  }

  private toTodo(row: TodoRow): Todo {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      completed: row.completed,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
