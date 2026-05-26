import { Injectable } from "@nestjs/common";
import type { Label } from "@prisma/client";
import { PrismaService } from "../prisma";

export type { Label } from "@prisma/client";

@Injectable()
export class LabelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(userId: string): Promise<Label[]> {
    return this.prisma.label.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findById(id: string, userId: string): Promise<Label | null> {
    return this.prisma.label.findFirst({ where: { id, userId } });
  }

  async create(
    userId: string,
    data: { name: string; color: string },
  ): Promise<Label> {
    return this.prisma.label.create({
      data: { userId, name: data.name, color: data.color },
    });
  }

  async update(
    id: string,
    userId: string,
    data: { name?: string; color?: string },
  ): Promise<Label | null> {
    const { count } = await this.prisma.label.updateMany({
      where: { id, userId },
      data,
    });
    return count > 0 ? this.findById(id, userId) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.label.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  }
}
