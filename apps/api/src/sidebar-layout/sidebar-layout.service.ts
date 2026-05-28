import { Injectable } from "@nestjs/common";
import type { SidebarLayout, SidebarLayoutResponse } from "@tickstep/shared-types";
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

    return {
      layout: row.layout as unknown as SidebarLayout,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async saveLayout(
    userId: string,
    layout: SidebarLayout,
  ): Promise<SidebarLayoutResponse> {
    const row = await this.sidebarLayoutRepository.upsert(userId, layout);

    return {
      layout: row.layout as unknown as SidebarLayout,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
