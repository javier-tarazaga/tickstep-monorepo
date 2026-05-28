import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { TodoListRepository } from "../todo-lists/todo-list.repository";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";

/**
 * Realtime module. Provides TodoListRepository directly (rather than importing
 * TodoListsModule) so there is no module cycle: TodoListsModule depends on this
 * module for RealtimeService, and this module must not depend back on it.
 */
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeService, TodoListRepository],
  exports: [RealtimeService],
})
export class RealtimeModule {}
