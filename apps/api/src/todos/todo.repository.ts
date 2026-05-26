import { Injectable } from "@nestjs/common";
import type { Prisma, Todo } from "@prisma/client";
import { PrismaService } from "../prisma";

export type { Todo } from "@prisma/client";

export interface TodoFilterParams {
  completed?: boolean;
  search?: string;
  page: number;
  limit: number;
}

@Injectable()
export class TodoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByListId(
    todoListId: string,
    filters: TodoFilterParams,
  ): Promise<{ rows: Todo[]; total: number }> {
    const where: Prisma.TodoWhereInput = { todoListId };

    if (filters.completed !== undefined) {
      where.completed = filters.completed;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.todo.count({ where }),
      this.prisma.todo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return { rows, total };
  }

  async findById(id: string, todoListId: string): Promise<Todo | null> {
    return this.prisma.todo.findFirst({ where: { id, todoListId } });
  }

  async create(
    todoListId: string,
    title: string,
    description: string | null,
  ): Promise<Todo> {
    return this.prisma.todo.create({
      data: { todoListId, title, description },
    });
  }

  async update(
    id: string,
    todoListId: string,
    data: { title?: string; description?: string | null; completed?: boolean },
  ): Promise<Todo | null> {
    const updateData: Prisma.TodoUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.completed !== undefined) updateData.completed = data.completed;

    if (Object.keys(updateData).length === 0) {
      return this.findById(id, todoListId);
    }

    const { count } = await this.prisma.todo.updateMany({
      where: { id, todoListId },
      data: updateData,
    });

    return count > 0 ? this.findById(id, todoListId) : null;
  }

  async delete(id: string, todoListId: string): Promise<boolean> {
    const { count } = await this.prisma.todo.deleteMany({
      where: { id, todoListId },
    });
    return count > 0;
  }

  async toggle(id: string, todoListId: string): Promise<Todo | null> {
    const existing = await this.findById(id, todoListId);
    if (!existing) {
      return null;
    }
    return this.prisma.todo.update({
      where: { id },
      data: { completed: !existing.completed },
    });
  }
}
