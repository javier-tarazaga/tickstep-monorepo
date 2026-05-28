import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type {
  ApiResponse,
  CreateLabelDto,
  Label,
  UpdateLabelDto,
} from "@todo-app/shared-types";
import {
  validateCreateLabel,
  validateUpdateLabel,
  type ValidationError,
} from "@todo-app/shared-utils";
import { CurrentUser, type AuthUser } from "../auth";
import { LabelsService } from "./labels.service";

@Controller("labels")
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  private throwValidationErrors(errors: ValidationError[]): never {
    throw new BadRequestException({
      success: false,
      message: "Validation failed",
      errors: errors.reduce(
        (acc, err) => {
          acc[err.field] = [...(acc[err.field] ?? []), err.message];
          return acc;
        },
        {} as Record<string, string[]>,
      ),
    });
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Label[]>> {
    return { success: true, data: await this.labelsService.findAll(user.id) };
  }

  @Post()
  async create(
    @Body() dto: CreateLabelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Label>> {
    const errors = validateCreateLabel(dto);
    if (errors.length > 0) this.throwValidationErrors(errors);

    return {
      success: true,
      data: await this.labelsService.create(user.id, dto),
      message: "Label created successfully",
    };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateLabelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Label>> {
    const errors = validateUpdateLabel(dto);
    if (errors.length > 0) this.throwValidationErrors(errors);

    return {
      success: true,
      data: await this.labelsService.update(id, user.id, dto),
      message: "Label updated successfully",
    };
  }

  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<void>> {
    await this.labelsService.remove(id, user.id);
    return {
      success: true,
      data: undefined as unknown as void,
      message: "Label deleted successfully",
    };
  }
}
