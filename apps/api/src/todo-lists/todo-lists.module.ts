import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { RealtimeModule } from "../realtime/realtime.module";
import { TodoListRepository } from "./todo-list.repository";
import { TodoListMemberRepository } from "./todo-list-member.repository";
import { TodoListsService } from "./todo-lists.service";
import { TodoListMembersService } from "./todo-list-members.service";
import { TodoListsController } from "./todo-lists.controller";
import { TodoListMembersController } from "./todo-list-members.controller";

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [TodoListsController, TodoListMembersController],
  providers: [
    TodoListsService,
    TodoListMembersService,
    TodoListRepository,
    TodoListMemberRepository,
  ],
  exports: [TodoListsService, TodoListRepository],
})
export class TodoListsModule {}
