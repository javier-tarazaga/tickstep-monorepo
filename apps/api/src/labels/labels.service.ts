import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateLabelDto,
  Label,
  UpdateLabelDto,
} from "@todo-app/shared-types";
import { LabelRepository, type Label as LabelRow } from "./label.repository";

@Injectable()
export class LabelsService {
  constructor(private readonly labelRepository: LabelRepository) {}

  async findAll(userId: string): Promise<Label[]> {
    const rows = await this.labelRepository.findAllByUser(userId);
    return rows.map(this.toLabel);
  }

  async findOne(id: string, userId: string): Promise<Label> {
    const row = await this.labelRepository.findById(id, userId);
    if (!row) {
      throw new NotFoundException(`Label with id "${id}" not found`);
    }
    return this.toLabel(row);
  }

  async create(userId: string, dto: CreateLabelDto): Promise<Label> {
    try {
      const row = await this.labelRepository.create(userId, {
        name: dto.name,
        color: dto.color,
      });
      return this.toLabel(row);
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateLabelDto,
  ): Promise<Label> {
    try {
      const row = await this.labelRepository.update(id, userId, {
        name: dto.name,
        color: dto.color,
      });
      if (!row) {
        throw new NotFoundException(`Label with id "${id}" not found`);
      }
      return this.toLabel(row);
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const deleted = await this.labelRepository.delete(id, userId);
    if (!deleted) {
      throw new NotFoundException(`Label with id "${id}" not found`);
    }
  }

  /** Translate the @@unique([userId, name]) violation into a 409. */
  private mapUniqueViolation(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return new ConflictException("Label name already exists");
    }
    return err;
  }

  private toLabel(row: LabelRow): Label {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
    };
  }
}
