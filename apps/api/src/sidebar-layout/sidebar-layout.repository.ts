import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../database";

export interface SidebarLayoutRow {
  id: string;
  user_id: string;
  layout: string; // JSONB comes as string from pg
  updated_at: string;
}

@Injectable()
export class SidebarLayoutRepository extends BaseRepository {
  async findByUserId(userId: string): Promise<SidebarLayoutRow | null> {
    return this.queryOne<SidebarLayoutRow>(
      "SELECT * FROM sidebar_layouts WHERE user_id = $1",
      [userId],
    );
  }

  async upsert(userId: string, layout: unknown): Promise<SidebarLayoutRow> {
    const result = await this.queryOne<SidebarLayoutRow>(
      `INSERT INTO sidebar_layouts (user_id, layout, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET layout = $2, updated_at = NOW()
       RETURNING *`,
      [userId, JSON.stringify(layout)],
    );
    return result!;
  }
}
