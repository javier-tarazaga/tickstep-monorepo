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
  BoardColumn,
  CreateBoardColumnDto,
  UpdateBoardColumnDto,
} from "@tickstep/shared-types";
import {
  validateCreateBoardColumn,
  validateUpdateBoardColumn,
  type ValidationError,
} from "@tickstep/shared-utils";
import { CurrentUser, type AuthUser } from "../auth";
import { TodoListsService } from "../todo-lists/todo-lists.service";
import { BoardColumnsService } from "./board-columns.service";

@Controller("todo-lists/:listId/columns")
export class BoardColumnsController {
  constructor(
    private readonly boardColumnsService: BoardColumnsService,
    private readonly todoListsService: TodoListsService,
  ) {}

  /** 404 unless the caller owns or collaborates on the list. */
  private async verifyAccess(listId: string, user: AuthUser): Promise<void> {
    await this.todoListsService.findOne(listId, user.id);
  }

  private rejectIfInvalid(errors: ValidationError[]): void {
    if (errors.length === 0) return;
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
    @Param("listId") listId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<BoardColumn[]>> {
    await this.verifyAccess(listId, user);
    return { success: true, data: await this.boardColumnsService.findAll(listId) };
  }

  /** Idempotently create the Todo/Doing/Done starter columns (and place
   *  existing tasks). Safe to call every time a board is opened. */
  @Post("defaults")
  async ensureDefaults(
    @Param("listId") listId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<BoardColumn[]>> {
    await this.verifyAccess(listId, user);
    return {
      success: true,
      data: await this.boardColumnsService.ensureDefaults(listId),
    };
  }

  @Post()
  async create(
    @Param("listId") listId: string,
    @Body() dto: CreateBoardColumnDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<BoardColumn>> {
    await this.verifyAccess(listId, user);
    this.rejectIfInvalid(validateCreateBoardColumn(dto));
    return {
      success: true,
      data: await this.boardColumnsService.create(listId, dto),
      message: "Column created successfully",
    };
  }

  @Patch(":id")
  async update(
    @Param("listId") listId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBoardColumnDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<BoardColumn>> {
    await this.verifyAccess(listId, user);
    this.rejectIfInvalid(validateUpdateBoardColumn(dto));
    return {
      success: true,
      data: await this.boardColumnsService.update(id, listId, dto),
      message: "Column updated successfully",
    };
  }

  @Delete(":id")
  async remove(
    @Param("listId") listId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<void>> {
    await this.verifyAccess(listId, user);
    await this.boardColumnsService.remove(id, listId);
    return {
      success: true,
      data: undefined as unknown as void,
      message: "Column deleted successfully",
    };
  }
}
