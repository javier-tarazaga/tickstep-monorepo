import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../database";

export interface UserRow {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class UserRepository extends BaseRepository {
  async findById(id: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
  }

  async upsert(id: string, email: string): Promise<UserRow> {
    const result = await this.queryOne<UserRow>(
      `INSERT INTO users (id, email)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET email = $2, updated_at = NOW()
       RETURNING *`,
      [id, email],
    );
    return result!;
  }
}
