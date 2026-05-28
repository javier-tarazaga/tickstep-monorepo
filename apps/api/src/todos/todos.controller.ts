import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
} from "@nestjs/common";
import type {
  ApiResponse,
  CreateTodoDto,
  PaginatedResponse,
  Todo,
  TodoFilters,
  UpdateTodoDto,
} from "@tickstep/shared-types";
import { validateCreateTodo, validateUpdateTodo } from "@tickstep/shared-utils";
import { CurrentUser, type AuthUser } from "../auth";
import { LabelsService } from "../labels/labels.service";
import { TodoListsService } from "../todo-lists/todo-lists.service";
import { TodosService } from "./todos.service";

@Controller("todo-lists/:listId/todos")
export class TodosController {
  constructor(
    private readonly todosService: TodosService,
    private readonly todoListsService: TodoListsService,
    private readonly labelsService: LabelsService,
  ) {}

  /**
   * Verify the todo list belongs to the authenticated user before any operation.
   */
  private async verifyListOwnership(
    listId: string,
    user: AuthUser,
  ): Promise<void> {
    await this.todoListsService.findOne(listId, user.id);
  }

  @Get()
  async findAll(
    @Param("listId") listId: string,
    @CurrentUser() user: AuthUser,
    @Query("completed") completed?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<ApiResponse<PaginatedResponse<Todo>>> {
    await this.verifyListOwnership(listId, user);

    const filters: TodoFilters = {
      completed: completed !== undefined ? completed === "true" : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    return {
      success: true,
      data: await this.todosService.findAll(listId, filters),
    };
  }

  @Get(":id")
  async findOne(
    @Param("listId") listId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Todo>> {
    await this.verifyListOwnership(listId, user);

    return {
      success: true,
      data: await this.todosService.findOne(id, listId),
    };
  }

  @Post()
  async create(
    @Param("listId") listId: string,
    @Body() dto: CreateTodoDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Todo>> {
    await this.verifyListOwnership(listId, user);

    const errors = validateCreateTodo(dto);
    if (errors.length > 0) {
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

    return {
      success: true,
      data: await this.todosService.create(listId, dto),
      message: "Todo created successfully",
    };
  }

  @Patch(":id")
  async update(
    @Param("listId") listId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTodoDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Todo>> {
    await this.verifyListOwnership(listId, user);

    const errors = validateUpdateTodo(dto);
    if (errors.length > 0) {
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

    return {
      success: true,
      data: await this.todosService.update(id, listId, dto),
      message: "Todo updated successfully",
    };
  }

  @Delete(":id")
  async remove(
    @Param("listId") listId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<void>> {
    await this.verifyListOwnership(listId, user);

    await this.todosService.remove(id, listId);
    return {
      success: true,
      data: undefined as unknown as void,
      message: "Todo deleted successfully",
    };
  }

  @Patch(":id/toggle")
  async toggle(
    @Param("listId") listId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Todo>> {
    await this.verifyListOwnership(listId, user);

    return {
      success: true,
      data: await this.todosService.toggle(id, listId),
      message: "Todo toggled successfully",
    };
  }

  @Post(":id/labels")
  async addLabel(
    @Param("listId") listId: string,
    @Param("id") id: string,
    @Body() body: { labelId: string },
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Todo>> {
    await this.verifyListOwnership(listId, user);
    // 404 if the label isn't owned by this user.
    await this.labelsService.findOne(body.labelId, user.id);

    return {
      success: true,
      data: await this.todosService.addLabel(id, listId, body.labelId),
      message: "Label added to todo",
    };
  }

  @Delete(":id/labels/:labelId")
  async removeLabel(
    @Param("listId") listId: string,
    @Param("id") id: string,
    @Param("labelId") labelId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<Todo>> {
    await this.verifyListOwnership(listId, user);

    return {
      success: true,
      data: await this.todosService.removeLabel(id, listId, labelId),
      message: "Label removed from todo",
    };
  }
}
