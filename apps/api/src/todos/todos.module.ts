import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { TodoListsModule } from "../todo-lists/todo-lists.module";
import { TodoRepository } from "./todo.repository";
import { TodosController } from "./todos.controller";
import { TodosService } from "./todos.service";

@Module({
  imports: [AuthModule, TodoListsModule],
  controllers: [TodosController],
  providers: [TodosService, TodoRepository],
})
export class TodosModule {}
