import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma";

export type { TodoList } from "@prisma/client";

/** Eager-load the owner's email and every collaborator (with email) so the
 * service can build the full member list in one round-trip. */
const TODO_LIST_INCLUDE = {
  user: { select: { email: true } },
  members: {
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TodoListInclude;

export type TodoListWithMembers = Prisma.TodoListGetPayload<{
  include: typeof TODO_LIST_INCLUDE;
}>;

/** Predicate matching lists the user can access: owner OR collaborator. */
function accessibleBy(userId: string): Prisma.TodoListWhereInput {
  return {
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

@Injectable()
export class TodoListRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists the user owns or is a member of, newest first. */
  async findAllByUserId(userId: string): Promise<TodoListWithMembers[]> {
    return this.prisma.todoList.findMany({
      where: accessibleBy(userId),
      orderBy: { createdAt: "desc" },
      include: TODO_LIST_INCLUDE,
    });
  }

  /** A single list the user can access (owner or member), or null. */
  async findById(
    id: string,
    userId: string,
  ): Promise<TodoListWithMembers | null> {
    return this.prisma.todoList.findFirst({
      where: { id, ...accessibleBy(userId) },
      include: TODO_LIST_INCLUDE,
    });
  }

  async create(userId: string, name: string): Promise<TodoListWithMembers> {
    return this.prisma.todoList.create({
      data: { userId, name },
      include: TODO_LIST_INCLUDE,
    });
  }

  /** Update by id. The caller must verify access first. */
  async update(
    id: string,
    data: { name?: string; emoji?: string | null },
  ): Promise<TodoListWithMembers> {
    return this.prisma.todoList.update({
      where: { id },
      data,
      include: TODO_LIST_INCLUDE,
    });
  }

  /** Delete by id. The caller must verify ownership first. */
  async delete(id: string): Promise<void> {
    await this.prisma.todoList.delete({ where: { id } });
  }
}
