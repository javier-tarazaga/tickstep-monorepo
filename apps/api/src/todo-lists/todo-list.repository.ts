import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../database";

export interface TodoListRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class TodoListRepository extends BaseRepository {
  async findAllByUserId(userId: string): Promise<TodoListRow[]> {
    return this.queryMany<TodoListRow>(
      "SELECT * FROM todo_lists WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
  }

  async findById(id: string, userId: string): Promise<TodoListRow | null> {
    return this.queryOne<TodoListRow>(
      "SELECT * FROM todo_lists WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
  }

  async create(userId: string, name: string): Promise<TodoListRow> {
    const result = await this.queryOne<TodoListRow>(
      `INSERT INTO todo_lists (user_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, name],
    );
    return result!;
  }

  async update(
    id: string,
    userId: string,
    name: string,
  ): Promise<TodoListRow | null> {
    return this.queryOne<TodoListRow>(
      `UPDATE todo_lists SET name = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [name, id, userId],
    );
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.query(
      "DELETE FROM todo_lists WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
