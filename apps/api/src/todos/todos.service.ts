import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTodoDto,
  PaginatedResponse,
  Todo,
  TodoFilters,
  TodoPriority,
  UpdateTodoDto,
} from "@tickstep/shared-types";
import { BoardColumnRepository } from "../board-columns/board-column.repository";
import { RealtimeService } from "../realtime/realtime.service";
import {
  TodoRepository,
  type TodoRow,
  type UpdateTodoData,
} from "./todo.repository";

@Injectable()
export class TodosService {
  constructor(
    private readonly todoRepository: TodoRepository,
    private readonly columnRepository: BoardColumnRepository,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(
    todoListId: string,
    filters?: TodoFilters,
  ): Promise<PaginatedResponse<Todo>> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const { rows, total } = await this.todoRepository.findAllByListId(
      todoListId,
      {
        completed: filters?.completed,
        search: filters?.search,
        page,
        limit,
      },
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map(this.toTodo),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string, todoListId: string): Promise<Todo> {
    const row = await this.todoRepository.findById(id, todoListId);
    if (!row) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    return this.toTodo(row);
  }

  async create(todoListId: string, dto: CreateTodoDto): Promise<Todo> {
    // When the list has a board, every new task needs a home column so it shows
    // up on the board (not just in list view). Honor the column the caller
    // targeted (e.g. the column whose "+ card" was clicked), else default to the
    // first non-done column. `completed` follows the target column's done flag.
    const columns = await this.columnRepository.findAllByListId(todoListId);
    const requested = dto.columnId
      ? columns.find((c) => c.id === dto.columnId)
      : undefined;
    const target = requested ?? columns.find((c) => !c.isDone) ?? columns[0];
    const columnId = target?.id ?? null;
    const completed = target?.isDone ?? false;

    const row = await this.todoRepository.create(todoListId, {
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      priority: dto.priority ?? null,
      completed,
      columnId,
      position: columnId
        ? await this.todoRepository.nextPositionInColumn(columnId)
        : null,
    });
    const todo = this.toTodo(row);
    this.realtime.todoCreated(todoListId, todo);
    return todo;
  }

  async update(
    id: string,
    todoListId: string,
    dto: UpdateTodoDto,
  ): Promise<Todo> {
    const patch: UpdateTodoData = {
      title: dto.title,
      description: dto.description,
      completed: dto.completed,
      dueDate:
        dto.dueDate === undefined
          ? undefined
          : dto.dueDate
            ? new Date(dto.dueDate)
            : null,
      priority: dto.priority,
      columnId: dto.columnId,
      position: dto.position,
    };
    await this.reconcileBoardPlacement(id, todoListId, patch);

    const row = await this.todoRepository.update(id, todoListId, patch);
    if (!row) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    const todo = this.toTodo(row);
    this.realtime.todoUpdated(todoListId, todo);
    return todo;
  }

  async remove(id: string, todoListId: string): Promise<void> {
    const deleted = await this.todoRepository.delete(id, todoListId);
    if (!deleted) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    this.realtime.todoDeleted(todoListId, id);
  }

  async toggle(id: string, todoListId: string): Promise<Todo> {
    const current = await this.todoRepository.findById(id, todoListId);
    if (!current) {
      throw new NotFoundException(`Todo with id "${id}" not found`);
    }
    // Route through update() so the done-column reconciliation runs (a toggle
    // is just a completion change, which may move the card to/from the done
    // column on a board).
    return this.update(id, todoListId, { completed: !current.completed });
  }

  async addLabel(
    id: string,
    todoListId: string,
    labelId: string,
  ): Promise<Todo> {
    // Ensure the todo exists and is owned by this list before mutating the join.
    await this.findOne(id, todoListId);
    await this.todoRepository.addLabel(id, labelId);
    const todo = await this.findOne(id, todoListId);
    this.realtime.todoUpdated(todoListId, todo);
    return todo;
  }

  async removeLabel(
    id: string,
    todoListId: string,
    labelId: string,
  ): Promise<Todo> {
    await this.findOne(id, todoListId);
    await this.todoRepository.removeLabel(id, labelId);
    const todo = await this.findOne(id, todoListId);
    this.realtime.todoUpdated(todoListId, todo);
    return todo;
  }

  /**
   * Keep a task's `completed` flag and its board column in agreement before the
   * write. Two directions:
   *  - an explicit column move (board drag) makes the target column drive
   *    `completed` (true iff the column is the done column);
   *  - a completion change with no explicit column move pulls the card into the
   *    done column (when completed) or the first non-done column (when not),
   *    provided the list actually has a board.
   * Also assigns an end-of-column position when a move doesn't specify one.
   * No-op for lists without columns.
   */
  private async reconcileBoardPlacement(
    id: string,
    todoListId: string,
    patch: UpdateTodoData,
  ): Promise<void> {
    const columns = await this.columnRepository.findAllByListId(todoListId);
    if (columns.length === 0) return;

    // Direction 1 — explicit column move.
    if (patch.columnId !== undefined) {
      const targetColumnId = patch.columnId;
      if (targetColumnId !== null) {
        const target = columns.find((c) => c.id === targetColumnId);
        if (target) patch.completed = target.isDone;
        if (patch.position === undefined || patch.position === null) {
          patch.position =
            await this.todoRepository.nextPositionInColumn(targetColumnId);
        }
      }
      return;
    }

    // Direction 2 — completion change with no explicit move.
    if (patch.completed !== undefined) {
      const doneColumn = columns.find((c) => c.isDone);
      if (!doneColumn) return; // nothing to mirror to
      const firstColumn = columns.find((c) => !c.isDone) ?? doneColumn;
      const targetId = patch.completed ? doneColumn.id : firstColumn.id;
      const current = await this.todoRepository.findById(id, todoListId);
      if (current && current.columnId !== targetId) {
        patch.columnId = targetId;
        patch.position =
          await this.todoRepository.nextPositionInColumn(targetId);
      }
    }
  }

  private toTodo(row: TodoRow): Todo {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      completed: row.completed,
      dueDate: row.dueDate?.toISOString() ?? null,
      priority: (row.priority as TodoPriority | null) ?? null,
      columnId: row.columnId,
      position: row.position,
      labels: row.todoLabels.map((tl) => ({
        id: tl.label.id,
        name: tl.label.name,
        color: tl.label.color,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
