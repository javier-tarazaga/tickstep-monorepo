import { Inject } from "@nestjs/common";
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { DATABASE_POOL } from "./database.module";

export abstract class BaseRepository {
  constructor(@Inject(DATABASE_POOL) protected readonly pool: Pool) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  protected async queryOne<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null> {
    const result = await this.pool.query<T>(text, params);
    return result.rows[0] ?? null;
  }

  protected async queryMany<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }
}
