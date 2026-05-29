import { Injectable } from "@nestjs/common";
import type { BoardColumn, Todo, TodoList } from "@tickstep/shared-types";
import { WS_EVENTS } from "@tickstep/shared-types";
import { RealtimeGateway } from "./realtime.gateway";

/**
 * Domain-facing emitter. Services call these intent methods; the socket
 * details (rooms, event names) live here and in the gateway, never in the
 * domain code.
 */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  // ── Todo events → list room (active viewers) ──────────────────────────

  todoCreated(listId: string, todo: Todo): void {
    this.gateway.emitToList(listId, WS_EVENTS.TODO_CREATED, { listId, todo });
  }

  todoUpdated(listId: string, todo: Todo): void {
    this.gateway.emitToList(listId, WS_EVENTS.TODO_UPDATED, { listId, todo });
  }

  todoDeleted(listId: string, todoId: string): void {
    this.gateway.emitToList(listId, WS_EVENTS.TODO_DELETED, { listId, todoId });
  }

  /** A list's board columns changed (add/rename/reorder/delete/seed). Carries
   * the full ordered set; cards that moved as a result arrive via todo events
   * or a client-side resync. */
  boardColumnsUpdated(listId: string, columns: BoardColumn[]): void {
    this.gateway.emitToList(listId, WS_EVENTS.BOARD_COLUMNS_UPDATED, {
      listId,
      columns,
    });
  }

  // ── List-level events → participants' user rooms ──────────────────────

  /** Notify all current participants that the list changed (rename, emoji,
   * membership). A newly added member receives this too and adds the list. */
  listUpdated(list: TodoList): void {
    const userIds = list.members.map((m) => m.userId);
    this.gateway.emitToUsers(userIds, WS_EVENTS.LIST_UPDATED, { list });
  }

  /** Notify the given users that the list is gone for them (deletion, or a
   * member being removed). */
  listDeleted(listId: string, userIds: string[]): void {
    this.gateway.emitToUsers(userIds, WS_EVENTS.LIST_DELETED, { listId });
  }

  /** Kick a removed member out of the list room so they stop receiving its
   * todo events. */
  async detachUserFromList(userId: string, listId: string): Promise<void> {
    await this.gateway.removeUserFromList(userId, listId);
  }
}
