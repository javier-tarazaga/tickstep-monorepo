import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma";
import { AuthModule } from "./auth";
import { TodoListsModule } from "./todo-lists/todo-lists.module";
import { TodosModule } from "./todos/todos.module";
import { BoardColumnsModule } from "./board-columns/board-columns.module";
import { LabelsModule } from "./labels/labels.module";
import { SidebarLayoutModule } from "./sidebar-layout/sidebar-layout.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    PrismaModule,
    AuthModule,
    TodoListsModule,
    TodosModule,
    BoardColumnsModule,
    LabelsModule,
    SidebarLayoutModule,
    RealtimeModule,
  ],
})
export class AppModule {}
