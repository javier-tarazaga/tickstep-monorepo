import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTodoDto,
  PaginatedResponse,
  Todo,
  TodoFilters,
  UpdateTodoDto,
} from "@todo-app/shared-types";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class TodosService {
  private todos: Todo[] = [];

  findAll(filters?: TodoFilters): PaginatedResponse<Todo> {
    let result = [...this.todos];

    if (filters?.completed !== undefined) {
      result = result.filter((todo) => todo.completed === filters.completed);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        (todo) =>
          todo.title.toLowerCase().includes(search) ||
          todo.description?.toLowerCase().includes(search),
      );
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const total = result.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = result.slice(start, start + limit);

    return { data, total, page, limit, totalPages };
  }

  findOne(id: string): Todo {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    return todo;
  }

  create(dto: CreateTodoDto): Todo {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: uuidv4(),
      title: dto.title,
      description: dto.description ?? null,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.todos.unshift(todo);
    return todo;
  }

  update(id: string, dto: UpdateTodoDto): Todo {
    const todo = this.findOne(id);
    const now = new Date().toISOString();

    if (dto.title !== undefined) todo.title = dto.title;
    if (dto.description !== undefined) todo.description = dto.description;
    if (dto.completed !== undefined) todo.completed = dto.completed;
    todo.updatedAt = now;

    return todo;
  }

  remove(id: string): void {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    this.todos.splice(index, 1);
  }

  toggle(id: string): Todo {
    const todo = this.findOne(id);
    todo.completed = !todo.completed;
    todo.updatedAt = new Date().toISOString();
    return todo;
  }
}
