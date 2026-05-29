import { Injectable } from "@nestjs/common";
import type { BoardColumn as BoardColumnRow } from "@prisma/client";
import { PrismaService } from "../prisma";

export type { BoardColumnRow };

export interface CreateBoardColumnData {
  name: string;
  position: number;
  isDone?: boolean;
}

export interface UpdateBoardColumnData {
  name?: string;
  position?: number;
  isDone?: boolean;
}

@Injectable()
export class BoardColumnRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** All columns for a list, left-to-right (then by age for stable ties). */
  async findAllByListId(listId: string): Promise<BoardColumnRow[]> {
    return this.prisma.boardColumn.findMany({
      where: { listId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async findById(id: string, listId: string): Promise<BoardColumnRow | null> {
    return this.prisma.boardColumn.findFirst({ where: { id, listId } });
  }

  async countByListId(listId: string): Promise<number> {
    return this.prisma.boardColumn.count({ where: { listId } });
  }

  async create(
    listId: string,
    data: CreateBoardColumnData,
  ): Promise<BoardColumnRow> {
    return this.prisma.boardColumn.create({
      data: {
        listId,
        name: data.name,
        position: data.position,
        isDone: data.isDone ?? false,
      },
    });
  }

  async update(
    id: string,
    listId: string,
    data: UpdateBoardColumnData,
  ): Promise<BoardColumnRow | null> {
    const { count } = await this.prisma.boardColumn.updateMany({
      where: { id, listId },
      data,
    });
    return count > 0 ? this.findById(id, listId) : null;
  }

  async delete(id: string, listId: string): Promise<boolean> {
    const { count } = await this.prisma.boardColumn.deleteMany({
      where: { id, listId },
    });
    return count > 0;
  }

  /** Clear `isDone` on every column of a list except (optionally) one — keeps
   *  the "at most one done column" invariant. */
  async clearDoneFlag(listId: string, exceptId?: string): Promise<void> {
    await this.prisma.boardColumn.updateMany({
      where: { listId, isDone: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      data: { isDone: false },
    });
  }
}
