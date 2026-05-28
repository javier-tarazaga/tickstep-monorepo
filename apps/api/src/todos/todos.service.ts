import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTodoDto,
  PaginatedResponse,
  Todo,
  TodoFilters,
  TodoPriority,
  UpdateTodoDto,
} from "@tickstep/shared-types";
import { RealtimeService } from "../realtime/realtime.service";
import { TodoRepository, type TodoRow } from "./todo.repository";

@Injectable()
export class TodosService {
  constructor(
    private readonly todoRepository: TodoRepository,
    private readonly realtime: RealtimeService,
  ) {}

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
    const row = await this.todoRepository.create(todoListId, {
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      priority: dto.priority ?? null,
    });
    const todo = this.toTodo(row);
    this.realtime.todoCreated(todoListId, todo);
    return todo;
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
      dueDate:
        dto.dueDate === undefined
          ? undefined
          : dto.dueDate
            ? new Date(dto.dueDate)
            : null,
      priority: dto.priority,
    });
    if (!row) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    const todo = this.toTodo(row);
    this.realtime.todoUpdated(todoListId, todo);
    return todo;
  }

  async remove(id: string, todoListId: string): Promise<void> {
    const deleted = await this.todoRepository.delete(id, todoListId);
    if (!deleted) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    this.realtime.todoDeleted(todoListId, id);
  }

  async toggle(id: string, todoListId: string): Promise<Todo> {
    const row = await this.todoRepository.toggle(id, todoListId);
    if (!row) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    const todo = this.toTodo(row);
    this.realtime.todoUpdated(todoListId, todo);
    return todo;
  }

  async addLabel(
    id: string,
    todoListId: string,
    labelId: string,
  ): Promise<Todo> {
    // Ensure the todo exists and is owned by this list before mutating the join.
    await this.findOne(id, todoListId);
    await this.todoRepository.addLabel(id, labelId);
    const todo = await this.findOne(id, todoListId);
    this.realtime.todoUpdated(todoListId, todo);
    return todo;
  }

  async removeLabel(
    id: string,
    todoListId: string,
    labelId: string,
  ): Promise<Todo> {
    await this.findOne(id, todoListId);
    await this.todoRepository.removeLabel(id, labelId);
    const todo = await this.findOne(id, todoListId);
    this.realtime.todoUpdated(todoListId, todo);
    return todo;
  }

  private toTodo(row: TodoRow): Todo {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      completed: row.completed,
      dueDate: row.dueDate?.toISOString() ?? null,
      priority: (row.priority as TodoPriority | null) ?? null,
      labels: row.todoLabels.map((tl) => ({
        id: tl.label.id,
        name: tl.label.name,
        color: tl.label.color,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
