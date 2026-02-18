import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { SidebarLayoutRepository } from "./sidebar-layout.repository";
import { SidebarLayoutService } from "./sidebar-layout.service";
import { SidebarLayoutController } from "./sidebar-layout.controller";

@Module({
  imports: [AuthModule],
  controllers: [SidebarLayoutController],
  providers: [SidebarLayoutService, SidebarLayoutRepository],
  exports: [SidebarLayoutService],
})
export class SidebarLayoutModule {}
