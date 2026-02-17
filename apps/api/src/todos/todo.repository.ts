import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../database";

export interface TodoRow {
  id: string;
  todo_list_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TodoFilterParams {
  completed?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface CountResult {
  count: string;
}

@Injectable()
export class TodoRepository extends BaseRepository {
  async findAllByListId(
    todoListId: string,
    filters: TodoFilterParams,
  ): Promise<{ rows: TodoRow[]; total: number }> {
    const conditions: string[] = ["todo_list_id = $1"];
    const params: unknown[] = [todoListId];
    let paramIndex = 2;

    if (filters.completed !== undefined) {
      conditions.push(`completed = $${paramIndex}`);
      params.push(filters.completed);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(
        `(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`,
      );
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Get total count
    const countResult = await this.queryOne<CountResult>(
      `SELECT COUNT(*)::text as count FROM todos WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult?.count ?? "0", 10);

    // Get paginated results
    const offset = (filters.page - 1) * filters.limit;
    const rows = await this.queryMany<TodoRow>(
      `SELECT * FROM todos WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, filters.limit, offset],
    );

    return { rows, total };
  }

  async findById(id: string, todoListId: string): Promise<TodoRow | null> {
    return this.queryOne<TodoRow>(
      "SELECT * FROM todos WHERE id = $1 AND todo_list_id = $2",
      [id, todoListId],
    );
  }

  async create(
    todoListId: string,
    title: string,
    description: string | null,
  ): Promise<TodoRow> {
    const result = await this.queryOne<TodoRow>(
      `INSERT INTO todos (todo_list_id, title, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [todoListId, title, description],
    );
    return result!;
  }

  async update(
    id: string,
    todoListId: string,
    data: { title?: string; description?: string | null; completed?: boolean },
  ): Promise<TodoRow | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      setClauses.push(`title = $${paramIndex}`);
      params.push(data.title);
      paramIndex++;
    }

    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }

    if (data.completed !== undefined) {
      setClauses.push(`completed = $${paramIndex}`);
      params.push(data.completed);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.findById(id, todoListId);
    }

    setClauses.push("updated_at = NOW()");

    params.push(id);
    params.push(todoListId);

    return this.queryOne<TodoRow>(
      `UPDATE todos SET ${setClauses.join(", ")}
       WHERE id = $${paramIndex} AND todo_list_id = $${paramIndex + 1}
       RETURNING *`,
      params,
    );
  }

  async delete(id: string, todoListId: string): Promise<boolean> {
    const result = await this.query(
      "DELETE FROM todos WHERE id = $1 AND todo_list_id = $2",
      [id, todoListId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async toggle(id: string, todoListId: string): Promise<TodoRow | null> {
    return this.queryOne<TodoRow>(
      `UPDATE todos SET completed = NOT completed, updated_at = NOW()
       WHERE id = $1 AND todo_list_id = $2
       RETURNING *`,
      [id, todoListId],
    );
  }
}
