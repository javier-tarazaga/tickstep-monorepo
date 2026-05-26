-- AlterTable
ALTER TABLE "todos" ADD COLUMN     "due_date" TIMESTAMPTZ(6),
ADD COLUMN     "priority" VARCHAR(10);

-- CreateTable
CREATE TABLE "labels" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_labels" (
    "todo_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,

    CONSTRAINT "todo_labels_pkey" PRIMARY KEY ("todo_id","label_id")
);

-- CreateIndex
CREATE INDEX "idx_labels_user_id" ON "labels"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_user_id_name_unique" ON "labels"("user_id", "name");

-- CreateIndex
CREATE INDEX "idx_todo_labels_label_id" ON "todo_labels"("label_id");

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_labels" ADD CONSTRAINT "todo_labels_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_labels" ADD CONSTRAINT "todo_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
