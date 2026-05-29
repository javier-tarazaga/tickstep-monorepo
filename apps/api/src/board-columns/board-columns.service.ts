import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  BoardColumn,
  CreateBoardColumnDto,
  UpdateBoardColumnDto,
} from "@tickstep/shared-types";
import { PrismaService } from "../prisma";
import { RealtimeService } from "../realtime/realtime.service";
import { TodoRepository } from "../todos/todo.repository";
import {
  BoardColumnRepository,
  type BoardColumnRow,
} from "./board-column.repository";

/** Columns auto-created the first time a list is opened as a board. The last
 *  one is the done column (mirrors a task's `completed` flag). */
const DEFAULT_COLUMNS: { name: string; isDone: boolean }[] = [
  { name: "Todo", isDone: false },
  { name: "Doing", isDone: false },
  { name: "Done", isDone: true },
];

/** Arbitrary namespace for the seeding advisory lock, keeping it from colliding
 *  with advisory locks taken elsewhere. */
const SEED_LOCK_NAMESPACE = 0x42c0;

@Injectable()
export class BoardColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly columnRepository: BoardColumnRepository,
    private readonly todoRepository: TodoRepository,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(listId: string): Promise<BoardColumn[]> {
    const rows = await this.columnRepository.findAllByListId(listId);
    return rows.map(this.toBoardColumn);
  }

  async create(
    listId: string,
    dto: CreateBoardColumnDto,
  ): Promise<BoardColumn> {
    const position = await this.columnRepository.countByListId(listId);
    const row = await this.columnRepository.create(listId, {
      name: dto.name.trim(),
      position,
    });
    await this.broadcast(listId);
    return this.toBoardColumn(row);
  }

  /**
   * Idempotently seed Todo / Doing / Done for a list that has no columns yet,
   * placing existing tasks (completed → done column, the rest → first column).
   * Returns the list's columns either way, so the client can call this blindly
   * whenever a board is opened.
   */
  async ensureDefaults(listId: string): Promise<BoardColumn[]> {
    // Seed inside a transaction guarded by a per-list advisory lock. Without it,
    // two boards opening at once both read count === 0 and each insert the three
    // defaults — producing duplicate Todo/Doing/Done columns. The lock serializes
    // concurrent seeders (even across instances): the loser waits, then sees the
    // columns already exist and skips. It's an xact-scoped lock, so it's pinned
    // to this transaction's connection and released on commit — safe under the
    // transaction-pooled Supabase connection.
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEED_LOCK_NAMESPACE}::int, hashtext(${listId}))`;

      if ((await this.columnRepository.countByListId(listId, tx)) > 0) {
        return null; // a racing request already seeded this list
      }

      const cols: BoardColumnRow[] = [];
      for (const [i, def] of DEFAULT_COLUMNS.entries()) {
        cols.push(
          await this.columnRepository.create(
            listId,
            { name: def.name, position: i, isDone: def.isDone },
            tx,
          ),
        );
      }

      const firstColumn = cols.find((c) => !c.isDone);
      const doneColumn = cols.find((c) => c.isDone);
      if (firstColumn && doneColumn) {
        const placements = await this.todoRepository.findPlacementByListId(
          listId,
          tx,
        );
        let firstPos = 0;
        let donePos = 0;
        for (const todo of placements) {
          if (todo.completed) {
            await this.todoRepository.assignColumn(
              todo.id,
              doneColumn.id,
              donePos++,
              undefined,
              tx,
            );
          } else {
            await this.todoRepository.assignColumn(
              todo.id,
              firstColumn.id,
              firstPos++,
              undefined,
              tx,
            );
          }
        }
      }

      return cols;
    });

    if (created === null) {
      return this.findAll(listId);
    }

    await this.broadcast(listId);
    return created.map(this.toBoardColumn);
  }

  async update(
    id: string,
    listId: string,
    dto: UpdateBoardColumnDto,
  ): Promise<BoardColumn> {
    // Only one done column per list — clear it elsewhere before promoting this.
    if (dto.isDone === true) {
      await this.columnRepository.clearDoneFlag(listId, id);
    }
    const row = await this.columnRepository.update(id, listId, {
      name: dto.name?.trim(),
      position: dto.position,
      isDone: dto.isDone,
    });
    if (!row) {
      throw new NotFoundException(`Board column with id "${id}" not found`);
    }
    await this.broadcast(listId);
    return this.toBoardColumn(row);
  }

  async remove(id: string, listId: string): Promise<void> {
    const column = await this.columnRepository.findById(id, listId);
    if (!column) {
      throw new NotFoundException(`Board column with id "${id}" not found`);
    }

    // Don't strand this column's cards: move them to the first surviving column
    // (appended), or detach them if no columns remain. Moving into/out of the
    // done column also flips `completed` so the flag stays consistent.
    const remaining = (
      await this.columnRepository.findAllByListId(listId)
    ).filter((c) => c.id !== id);
    const fallback = remaining[0] ?? null;
    const cardIds = await this.todoRepository.findIdsInColumn(id);
    if (fallback) {
      let pos = await this.todoRepository.nextPositionInColumn(fallback.id);
      for (const cardId of cardIds) {
        await this.todoRepository.assignColumn(
          cardId,
          fallback.id,
          pos++,
          fallback.isDone,
        );
      }
    } else {
      for (const cardId of cardIds) {
        await this.todoRepository.assignColumn(cardId, null, null);
      }
    }

    await this.columnRepository.delete(id, listId);
    await this.broadcast(listId);
  }

  /** Push the list's full, ordered column set to everyone viewing it. */
  private async broadcast(listId: string): Promise<void> {
    const columns = await this.findAll(listId);
    this.realtime.boardColumnsUpdated(listId, columns);
  }

  private toBoardColumn(row: BoardColumnRow): BoardColumn {
    return {
      id: row.id,
      listId: row.listId,
      name: row.name,
      position: row.position,
      isDone: row.isDone,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
