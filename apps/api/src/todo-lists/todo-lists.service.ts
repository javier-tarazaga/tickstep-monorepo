import { Injectable, NotFoundException } from "@nestjs/common";
import { TodoListRepository } from "./todo-list.repository";

export interface TodoList {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TodoListsService {
  constructor(private readonly todoListRepository: TodoListRepository) {}

  async findAll(userId: string): Promise<TodoList[]> {
    const rows = await this.todoListRepository.findAllByUserId(userId);
    return rows.map(this.toTodoList);
  }

  async findOne(id: string, userId: string): Promise<TodoList> {
    const row = await this.todoListRepository.findById(id, userId);
    if (!row) {
      throw new NotFoundException(`Todo list with id "${id}" not found`);
    }
    return this.toTodoList(row);
  }

  async create(userId: string, name: string): Promise<TodoList> {
    const row = await this.todoListRepository.create(userId, name);
    return this.toTodoList(row);
  }

  async update(id: string, userId: string, name: string): Promise<TodoList> {
    const row = await this.todoListRepository.update(id, userId, name);
    if (!row) {
      throw new NotFoundException(`Todo list with id "${id}" not found`);
    }
    return this.toTodoList(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const deleted = await this.todoListRepository.delete(id, userId);
    if (!deleted) {
      throw new NotFoundException(`Todo list with id "${id}" not found`);
    }
  }

  private toTodoList(row: {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    updated_at: string;
  }): TodoList {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
