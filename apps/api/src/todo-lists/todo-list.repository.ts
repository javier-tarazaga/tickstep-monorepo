import { Injectable } from "@nestjs/common";
import type { TodoList } from "@prisma/client";
import { PrismaService } from "../prisma";

export type { TodoList } from "@prisma/client";

@Injectable()
export class TodoListRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUserId(userId: string): Promise<TodoList[]> {
    return this.prisma.todoList.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string, userId: string): Promise<TodoList | null> {
    return this.prisma.todoList.findFirst({ where: { id, userId } });
  }

  async create(userId: string, name: string): Promise<TodoList> {
    return this.prisma.todoList.create({ data: { userId, name } });
  }

  async update(
    id: string,
    userId: string,
    name: string,
  ): Promise<TodoList | null> {
    const { count } = await this.prisma.todoList.updateMany({
      where: { id, userId },
      data: { name },
    });
    return count > 0 ? this.findById(id, userId) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.todoList.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  }
}
