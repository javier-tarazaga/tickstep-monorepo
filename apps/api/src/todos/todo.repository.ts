import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma";

/** Always resolve a todo's labels through the join table. */
const TODO_INCLUDE = { todoLabels: { include: { label: true } } } as const;

export type TodoRow = Prisma.TodoGetPayload<{ include: typeof TODO_INCLUDE }>;

export interface TodoFilterParams {
  completed?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateTodoData {
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: string | null;
}

export interface UpdateTodoData {
  title?: string;
  description?: string | null;
  completed?: boolean;
  dueDate?: Date | null;
  priority?: string | null;
}

@Injectable()
export class TodoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByListId(
    todoListId: string,
    filters: TodoFilterParams,
  ): Promise<{ rows: TodoRow[]; total: number }> {
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
        include: TODO_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return { rows, total };
  }

  async findById(id: string, todoListId: string): Promise<TodoRow | null> {
    return this.prisma.todo.findFirst({
      where: { id, todoListId },
      include: TODO_INCLUDE,
    });
  }

  async create(
    todoListId: string,
    data: CreateTodoData,
  ): Promise<TodoRow> {
    return this.prisma.todo.create({
      data: {
        todoListId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        priority: data.priority,
      },
      include: TODO_INCLUDE,
    });
  }

  async update(
    id: string,
    todoListId: string,
    data: UpdateTodoData,
  ): Promise<TodoRow | null> {
    const updateData: Prisma.TodoUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.completed !== undefined) updateData.completed = data.completed;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.priority !== undefined) updateData.priority = data.priority;

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

  async toggle(id: string, todoListId: string): Promise<TodoRow | null> {
    const existing = await this.findById(id, todoListId);
    if (!existing) {
      return null;
    }
    return this.prisma.todo.update({
      where: { id },
      data: { completed: !existing.completed },
      include: TODO_INCLUDE,
    });
  }

  async addLabel(todoId: string, labelId: string): Promise<void> {
    await this.prisma.todoLabel.upsert({
      where: { todoId_labelId: { todoId, labelId } },
      create: { todoId, labelId },
      update: {},
    });
  }

  async removeLabel(todoId: string, labelId: string): Promise<void> {
    await this.prisma.todoLabel.deleteMany({ where: { todoId, labelId } });
  }
}
