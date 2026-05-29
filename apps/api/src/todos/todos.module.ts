import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { BoardColumnsModule } from "../board-columns/board-columns.module";
import { LabelsModule } from "../labels/labels.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TodoListsModule } from "../todo-lists/todo-lists.module";
import { TodoRepository } from "./todo.repository";
import { TodosController } from "./todos.controller";
import { TodosService } from "./todos.service";

@Module({
  imports: [
    AuthModule,
    TodoListsModule,
    LabelsModule,
    RealtimeModule,
    BoardColumnsModule,
  ],
  controllers: [TodosController],
  providers: [TodosService, TodoRepository],
})
export class TodosModule {}
