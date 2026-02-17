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
} from "@todo-app/shared-types";
import { validateCreateTodo, validateUpdateTodo } from "@todo-app/shared-utils";
import { TodosService } from "./todos.service";

@Controller("todos")
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findAll(
    @Query("completed") completed?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): ApiResponse<PaginatedResponse<Todo>> {
    const filters: TodoFilters = {
      completed: completed !== undefined ? completed === "true" : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    return {
      success: true,
      data: this.todosService.findAll(filters),
    };
  }

  @Get(":id")
  findOne(@Param("id") id: string): ApiResponse<Todo> {
    return {
      success: true,
      data: this.todosService.findOne(id),
    };
  }

  @Post()
  create(@Body() dto: CreateTodoDto): ApiResponse<Todo> {
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
      data: this.todosService.create(dto),
      message: "Todo created successfully",
    };
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTodoDto,
  ): ApiResponse<Todo> {
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
      data: this.todosService.update(id, dto),
      message: "Todo updated successfully",
    };
  }

  @Delete(":id")
  remove(@Param("id") id: string): ApiResponse<void> {
    this.todosService.remove(id);
    return {
      success: true,
      data: undefined as unknown as void,
      message: "Todo deleted successfully",
    };
  }

  @Patch(":id/toggle")
  toggle(@Param("id") id: string): ApiResponse<Todo> {
    return {
      success: true,
      data: this.todosService.toggle(id),
      message: "Todo toggled successfully",
    };
  }
}
