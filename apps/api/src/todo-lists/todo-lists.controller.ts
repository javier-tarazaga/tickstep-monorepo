import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import type { ApiResponse } from "@todo-app/shared-types";
import { AuthGuard, CurrentUser, type AuthUser } from "../auth";
import { TodoListsService, type TodoList } from "./todo-lists.service";

interface CreateTodoListDto {
  name: string;
}

interface UpdateTodoListDto {
  name: string;
}

@Controller("todo-lists")
@UseGuards(AuthGuard)
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
    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException("Name is required");
    }

    const list = await this.todoListsService.update(
      id,
      user.id,
      dto.name.trim(),
    );
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
