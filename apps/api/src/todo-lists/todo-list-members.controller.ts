import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import type {
  AddMemberDto,
  ApiResponse,
  TodoList,
  TodoListMember,
} from "@tickstep/shared-types";
import { CurrentUser, type AuthUser } from "../auth";
import { TodoListMembersService } from "./todo-list-members.service";

@Controller("todo-lists/:listId/members")
export class TodoListMembersController {
  constructor(private readonly membersService: TodoListMembersService) {}

  @Get()
  async findAll(
    @Param("listId") listId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<TodoListMember[]>> {
    const members = await this.membersService.listMembers(listId, user.id);
    return { success: true, data: members };
  }

  @Post()
  async add(
    @Param("listId") listId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<TodoList>> {
    if (!dto.email || dto.email.trim().length === 0) {
      throw new BadRequestException("Email is required");
    }

    const list = await this.membersService.addMember(listId, user.id, dto.email);
    return { success: true, data: list, message: "Member added" };
  }

  /**
   * Remove a member. Pass "me" (or your own id) to leave the list yourself.
   */
  @Delete(":userId")
  async remove(
    @Param("listId") listId: string,
    @Param("userId") userId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<void>> {
    const targetUserId = userId === "me" ? user.id : userId;
    await this.membersService.removeMember(listId, user.id, targetUserId);
    return {
      success: true,
      data: undefined as unknown as void,
      message: "Member removed",
    };
  }
}
