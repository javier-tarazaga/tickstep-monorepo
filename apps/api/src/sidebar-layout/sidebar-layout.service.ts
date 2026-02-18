import { Injectable } from "@nestjs/common";
import type { SidebarLayout, SidebarLayoutResponse } from "@todo-app/shared-types";
import { SidebarLayoutRepository } from "./sidebar-layout.repository";

const DEFAULT_LAYOUT: SidebarLayout = {
  sections: [],
  unsectionedListIds: [],
};

@Injectable()
export class SidebarLayoutService {
  constructor(
    private readonly sidebarLayoutRepository: SidebarLayoutRepository,
  ) {}

  async getLayout(userId: string): Promise<SidebarLayoutResponse> {
    const row = await this.sidebarLayoutRepository.findByUserId(userId);

    if (!row) {
      return {
        layout: DEFAULT_LAYOUT,
        updatedAt: new Date().toISOString(),
      };
    }

    const layout =
      typeof row.layout === "string"
        ? (JSON.parse(row.layout) as SidebarLayout)
        : (row.layout as unknown as SidebarLayout);

    return {
      layout,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async saveLayout(
    userId: string,
    layout: SidebarLayout,
  ): Promise<SidebarLayoutResponse> {
    const row = await this.sidebarLayoutRepository.upsert(userId, layout);

    const savedLayout =
      typeof row.layout === "string"
        ? (JSON.parse(row.layout) as SidebarLayout)
        : (row.layout as unknown as SidebarLayout);

    return {
      layout: savedLayout,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
