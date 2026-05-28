import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, type TodoListMember } from "@prisma/client";
import { PrismaService } from "../prisma";

export type { TodoListMember } from "@prisma/client";

@Injectable()
export class TodoListMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMembership(
    listId: string,
    userId: string,
  ): Promise<TodoListMember | null> {
    return this.prisma.todoListMember.findUnique({
      where: { listId_userId: { listId, userId } },
    });
  }

  async create(listId: string, userId: string): Promise<TodoListMember> {
    try {
      return await this.prisma.todoListMember.create({
        data: { listId, userId },
      });
    } catch (err) {
      // Two concurrent invites for the same user race past the in-memory
      // duplicate check and collide on the (listId, userId) primary key.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException("That user is already a member of this list");
      }
      throw err;
    }
  }

  /** Remove a collaborator. Returns false if there was no such membership. */
  async delete(listId: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.todoListMember.deleteMany({
      where: { listId, userId },
    });
    return count > 0;
  }
}
