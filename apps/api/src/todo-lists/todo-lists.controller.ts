import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  BadRequestException,
} from "@nestjs/common";
import type {
  ApiResponse,
  CreateTodoListDto,
  UpdateTodoListDto,
} from "@tickstep/shared-types";
import { CurrentUser, type AuthUser } from "../auth";
import { TodoListsService, type TodoList } from "./todo-lists.service";

@Controller("todo-lists")
export class TodoListsController {
  constructor(private readonly todoListsService: TodoListsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<TodoList[]>> {
    const lists = await this.todoListsService.findAll(user.id);
    return { success: true, data: lists };
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<TodoList>> {
    const list = await this.todoListsService.findOne(id, user.id);
    return { success: true, data: list };
  }

  @Post()
  async create(
    @Body() dto: CreateTodoListDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<TodoList>> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException("Name is required");
    }

    const list = await this.todoListsService.create(user.id, dto.name.trim());
    return {
      success: true,
      data: list,
      message: "Todo list created successfully",
    };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTodoListDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<TodoList>> {
    const hasName = dto.name !== undefined;
    const hasEmoji = dto.emoji !== undefined;

    if (!hasName && !hasEmoji) {
      throw new BadRequestException("Nothing to update");
    }
    if (hasName && (!dto.name || dto.name.trim().length === 0)) {
      throw new BadRequestException("Name is required");
    }

    const list = await this.todoListsService.update(id, user.id, {
      ...(hasName ? { name: dto.name!.trim() } : {}),
      // An empty string clears the emoji back to no icon.
      ...(hasEmoji ? { emoji: dto.emoji ? dto.emoji : null } : {}),
    });
    return {
      success: true,
      data: list,
      message: "Todo list updated successfully",
    };
  }

  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<void>> {
    await this.todoListsService.remove(id, user.id);
    return {
      success: true,
      data: undefined as unknown as void,
      message: "Todo list deleted successfully",
    };
  }
}
