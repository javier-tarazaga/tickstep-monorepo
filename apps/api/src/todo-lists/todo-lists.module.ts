import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { TodoListRepository } from "./todo-list.repository";
import { TodoListsService } from "./todo-lists.service";
import { TodoListsController } from "./todo-lists.controller";

@Module({
  imports: [AuthModule],
  controllers: [TodoListsController],
  providers: [TodoListsService, TodoListRepository],
  exports: [TodoListsService],
})
export class TodoListsModule {}
