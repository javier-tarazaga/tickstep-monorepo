import { Injectable } from "@nestjs/common";
import { Prisma, type SidebarLayout } from "@prisma/client";
import { PrismaService } from "../prisma";

export type { SidebarLayout } from "@prisma/client";

@Injectable()
export class SidebarLayoutRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<SidebarLayout | null> {
    return this.prisma.sidebarLayout.findUnique({ where: { userId } });
  }

  async upsert(userId: string, layout: unknown): Promise<SidebarLayout> {
    const data = layout as Prisma.InputJsonValue;
    return this.prisma.sidebarLayout.upsert({
      where: { userId },
      update: { layout: data },
      create: { userId, layout: data },
    });
  }
}
