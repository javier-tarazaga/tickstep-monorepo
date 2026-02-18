import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from "@nestjs/common";
import type { ApiResponse, SidebarLayout, SidebarLayoutResponse } from "@todo-app/shared-types";
import { AuthGuard, CurrentUser, type AuthUser } from "../auth";
import { SidebarLayoutService } from "./sidebar-layout.service";

@Controller("sidebar-layout")
@UseGuards(AuthGuard)
export class SidebarLayoutController {
  constructor(private readonly sidebarLayoutService: SidebarLayoutService) {}

  @Get()
  async getLayout(
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<SidebarLayoutResponse>> {
    const result = await this.sidebarLayoutService.getLayout(user.id);
    return { success: true, data: result };
  }

  @Put()
  async saveLayout(
    @Body() body: { layout: SidebarLayout },
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<SidebarLayoutResponse>> {
    const result = await this.sidebarLayoutService.saveLayout(
      user.id,
      body.layout,
    );
    return {
      success: true,
      data: result,
      message: "Sidebar layout saved successfully",
    };
  }
}
