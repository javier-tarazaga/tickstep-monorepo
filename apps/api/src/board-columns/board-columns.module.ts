import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { RealtimeModule } from "../realtime/realtime.module";
import { TodoListsModule } from "../todo-lists/todo-lists.module";
import { TodoRepository } from "../todos/todo.repository";
import { BoardColumnRepository } from "./board-column.repository";
import { BoardColumnsController } from "./board-columns.controller";
import { BoardColumnsService } from "./board-columns.service";

/**
 * TodoRepository is provided directly (a leaf over PrismaService) rather than
 * importing TodosModule, so there's no cycle: TodosModule imports this module
 * for BoardColumnRepository (done-column reconciliation).
 */
@Module({
  imports: [AuthModule, TodoListsModule, RealtimeModule],
  controllers: [BoardColumnsController],
  providers: [BoardColumnsService, BoardColumnRepository, TodoRepository],
  exports: [BoardColumnRepository],
})
export class BoardColumnsModule {}
