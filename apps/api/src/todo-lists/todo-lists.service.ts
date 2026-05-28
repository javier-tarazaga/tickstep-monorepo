import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TodoList, TodoListMember } from "@tickstep/shared-types";
import { RealtimeService } from "../realtime/realtime.service";
import {
  TodoListRepository,
  type TodoListWithMembers,
} from "./todo-list.repository";

export type { TodoList } from "@tickstep/shared-types";

/** Fields that can be patched on a list. Omit a field to leave it unchanged. */
export interface UpdateTodoListData {
  name?: string;
  emoji?: string | null;
}

@Injectable()
export class TodoListsService {
  constructor(
    private readonly todoListRepository: TodoListRepository,
    private readonly realtime: RealtimeService,
  ) {}

  /** All lists the user owns or collaborates on. */
  async findAll(userId: string): Promise<TodoList[]> {
    const rows = await this.todoListRepository.findAllByUserId(userId);
    return rows.map((row) => this.toTodoList(row, userId));
  }

  /**
   * A single list the user can access (owner or member). Throws 404 for
   * lists that don't exist or that the user isn't a participant of — the same
   * response either way, so non-members can't probe for list existence.
   */
  async findOne(id: string, userId: string): Promise<TodoList> {
    const row = await this.todoListRepository.findById(id, userId);
    if (!row) {
      throw new NotFoundException(`Todo list with id "${id}" not found`);
    }
    return this.toTodoList(row, userId);
  }

  async create(userId: string, name: string): Promise<TodoList> {
    const row = await this.todoListRepository.create(userId, name);
    return this.toTodoList(row, userId);
  }

  /** Any participant (owner or member) may edit list metadata. */
  async update(
    id: string,
    userId: string,
    data: UpdateTodoListData,
  ): Promise<TodoList> {
    // Access check first — 404 for non-participants.
    await this.findOne(id, userId);
    const row = await this.todoListRepository.update(id, data);
    const list = this.toTodoList(row, userId);
    this.realtime.listUpdated(list);
    return list;
  }

  /** Only the owner may delete the whole list. */
  async remove(id: string, userId: string): Promise<void> {
    const row = await this.todoListRepository.findById(id, userId);
    if (!row) {
      throw new NotFoundException(`Todo list with id "${id}" not found`);
    }
    if (row.userId !== userId) {
      throw new ForbiddenException("Only the list owner can delete it");
    }
    // Capture every participant before the row (and its members) is gone, so
    // we can notify each of them that the list disappeared.
    const participantIds = [row.userId, ...row.members.map((m) => m.userId)];
    await this.todoListRepository.delete(id);
    this.realtime.listDeleted(id, participantIds);
  }

  private toTodoList(row: TodoListWithMembers, requestingUserId: string): TodoList {
    const owner: TodoListMember = {
      userId: row.userId,
      email: row.user.email,
      role: "owner",
      joinedAt: row.createdAt.toISOString(),
    };
    const collaborators: TodoListMember[] = row.members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      role: "member",
      joinedAt: m.createdAt.toISOString(),
    }));

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      emoji: row.emoji,
      isShared: collaborators.length > 0,
      isOwner: row.userId === requestingUserId,
      memberCount: collaborators.length,
      members: [owner, ...collaborators],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
