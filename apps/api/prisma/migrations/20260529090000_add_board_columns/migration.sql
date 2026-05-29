-- CreateTable
CREATE TABLE "board_columns" (
    "id" UUID NOT NULL,
    "list_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_board_columns_list_id" ON "board_columns"("list_id");

-- AlterTable
ALTER TABLE "todos" ADD COLUMN "column_id" UUID;
ALTER TABLE "todos" ADD COLUMN "position" INTEGER;

-- CreateIndex
CREATE INDEX "idx_todos_column_id" ON "todos"("column_id");

-- AddForeignKey
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "todo_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "board_columns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
