-- CreateTable
CREATE TABLE "todo_list_members" (
    "list_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(32) NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_list_members_pkey" PRIMARY KEY ("list_id","user_id")
);

-- CreateIndex
CREATE INDEX "idx_todo_list_members_user_id" ON "todo_list_members"("user_id");

-- AddForeignKey
ALTER TABLE "todo_list_members" ADD CONSTRAINT "todo_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "todo_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_list_members" ADD CONSTRAINT "todo_list_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
