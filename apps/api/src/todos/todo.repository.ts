import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma";

/** Always resolve a todo's labels through the join table. */
const TODO_INCLUDE = { todoLabels: { include: { label: true } } } as const;

export type TodoRow = Prisma.TodoGetPayload<{ include: typeof TODO_INCLUDE }>;

/** Either the pooled client or an open transaction — lets default-column
 *  seeding place existing cards inside the same `$transaction`. */
type Db = PrismaService | Prisma.TransactionClient;

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
  completed?: boolean;
  columnId?: string | null;
  position?: number | null;
}

export interface UpdateTodoData {
  title?: string;
  description?: string | null;
  completed?: boolean;
  dueDate?: Date | null;
  priority?: string | null;
  columnId?: string | null;
  position?: number | null;
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
        completed: data.completed ?? false,
        columnId: data.columnId ?? null,
        position: data.position ?? null,
      },
      include: TODO_INCLUDE,
    });
  }

  async update(
    id: string,
    todoListId: string,
    data: UpdateTodoData,
  ): Promise<TodoRow | null> {
    const updateData: Prisma.TodoUncheckedUpdateManyInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.completed !== undefined) updateData.completed = data.completed;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.position !== undefined) updateData.position = data.position;
    // Raw FK assignment; null detaches the task from any column.
    if (data.columnId !== undefined) updateData.columnId = data.columnId;

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

  /** Highest `position` among todos in a column, or null when the column is
   *  empty. */
  async maxPositionInColumn(columnId: string): Promise<number | null> {
    const result = await this.prisma.todo.aggregate({
      where: { columnId },
      _max: { position: true },
    });
    return result._max.position;
  }

  /** The position to append a card at the end of a column. */
  async nextPositionInColumn(columnId: string): Promise<number> {
    const max = await this.maxPositionInColumn(columnId);
    return max === null ? 0 : max + 1;
  }

  /** Lightweight placement snapshot (id + completed) for every todo in a list,
   *  oldest first — used when seeding default columns. */
  async findPlacementByListId(
    todoListId: string,
    db: Db = this.prisma,
  ): Promise<{ id: string; completed: boolean }[]> {
    return db.todo.findMany({
      where: { todoListId },
      select: { id: true, completed: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Direct column + position assignment by id (no list scoping needed — ids
   *  come from the list being seeded/edited). Pass `completed` to also keep the
   *  done flag in sync when the destination column changes that meaning. */
  async assignColumn(
    id: string,
    columnId: string | null,
    position: number | null,
    completed?: boolean,
    db: Db = this.prisma,
  ): Promise<void> {
    await db.todo.update({
      where: { id },
      data: {
        columnId,
        position,
        ...(completed !== undefined ? { completed } : {}),
      },
    });
  }

  /** Every todo currently sitting in a column, oldest first. Used to compact
   *  cards into another column when their column is deleted. */
  async findIdsInColumn(columnId: string): Promise<string[]> {
    const rows = await this.prisma.todo.findMany({
      where: { columnId },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => r.id);
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
