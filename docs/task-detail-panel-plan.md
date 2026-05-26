# Task Detail Side Panel — Implementation Plan

> Feature: a right-hand side panel (inspired by Superlist) that opens when a user
> clicks a todo, exposing **description**, **due date**, **priority**, and
> **colored labels**, with **auto-save per field**.
>
> Status: **planned, not yet implemented.** This document is the build spec and is
> organized into phases so it can be delivered incrementally.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Persistence | Full stack. Schema + migration prepared here; **the developer runs `prisma migrate`** against Supabase. |
| Assignee | **Skipped** for now (no multi-user/collaboration model yet). |
| Labels | **Predefined, colored, user-owned** `Label` entity + explicit `TodoLabel` join. Managed via dedicated endpoints, **not** via `UpdateTodoDto`. |
| Priority | **Included.** `"low" \| "medium" \| "high"`, null = none. Stored as `VarChar(10)` (no Postgres enum, matching codebase simplicity). |
| Due date | **Date only** in the UI; stored as nullable `Timestamptz`. |
| Save UX | **Auto-save per field** on change/blur (optimistic store updates). |
| Out of scope | Comments ("Leave a message"), the "type `/`" sub-task/content area. |
| Open from | Both `ListView` and `TodayView` rows. |

## Architecture at a glance

```
Hierarchy unchanged: Section (UI) > TodoList (DB) > Todo (DB)
Todo gains: dueDate, priority, labels[] (resolved via join)
New entity:  Label (user-owned) ──< TodoLabel >── Todo   (explicit m-n)

Panel mounts as a 3rd flex column in AppLayout, driven by
navigationStore.selectedTodoId (+ selectedTodoListId).
```

Key conventions to follow (already in the codebase):
- Repositories return raw Prisma rows; **services map** rows → shared-types domain objects (`toTodo`, `toLabel`).
- Snake_case columns via `@map`; explicit `@@map` on every model.
- Manual validation via `@todo-app/shared-utils` functions (no `class-validator`).
- Controllers wrap responses in `ApiResponse<T>` `{ success, data, message }`.
- Every query is **ownership-scoped** (`userId` / `todoListId`).
- Stores: `set((state) => …)` functional updates; api-client called from store actions.
- Animations: `0.15s ease-out`; theme via CSS variables (light/dark) in `global.css`.

---

## Phase 1 — Data model (Prisma schema + migration)

**File:** `apps/api/prisma/schema.prisma`

Extend `Todo`:
```prisma
model Todo {
  id          String    @id @default(uuid()) @db.Uuid
  todoListId  String    @map("todo_list_id") @db.Uuid
  title       String    @db.VarChar(200)
  description String?
  completed   Boolean   @default(false)
  dueDate     DateTime? @map("due_date") @db.Timestamptz(6)   // NEW
  priority    String?   @map("priority") @db.VarChar(10)      // NEW: low|medium|high
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  todoList   TodoList    @relation(fields: [todoListId], references: [id], onDelete: Cascade)
  todoLabels TodoLabel[]                                       // NEW

  @@index([todoListId], map: "idx_todos_todo_list_id")
  @@index([completed], map: "idx_todos_completed")
  @@map("todos")
}
```

Add to `User`:
```prisma
  labels Label[]   // NEW back-relation
```

New models:
```prisma
model Label {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  name      String   @db.VarChar(50)
  color     String   @db.VarChar(20)   // hex string, e.g. "#c2410c"
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  todoLabels TodoLabel[]

  @@unique([userId, name], map: "labels_user_id_name_unique")
  @@index([userId], map: "idx_labels_user_id")
  @@map("labels")
}

model TodoLabel {
  todoId  String @map("todo_id") @db.Uuid
  labelId String @map("label_id") @db.Uuid

  todo  Todo  @relation(fields: [todoId], references: [id], onDelete: Cascade)
  label Label @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@id([todoId, labelId])
  @@index([labelId], map: "idx_todo_labels_label_id")
  @@map("todo_labels")
}
```

**Migration.** Generate with `pnpm --filter @todo-app/api exec prisma migrate dev --name task_detail_fields`
(developer runs this against Supabase; needs `DATABASE_URL`/`DIRECT_URL`). Expected SQL:
```sql
ALTER TABLE "todos" ADD COLUMN "due_date" TIMESTAMPTZ(6);
ALTER TABLE "todos" ADD COLUMN "priority" VARCHAR(10);

CREATE TABLE "labels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "color" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "labels_user_id_name_unique" ON "labels"("user_id","name");
CREATE INDEX "idx_labels_user_id" ON "labels"("user_id");
ALTER TABLE "labels" ADD CONSTRAINT "labels_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

CREATE TABLE "todo_labels" (
  "todo_id" UUID NOT NULL,
  "label_id" UUID NOT NULL,
  CONSTRAINT "todo_labels_pkey" PRIMARY KEY ("todo_id","label_id")
);
CREATE INDEX "idx_todo_labels_label_id" ON "todo_labels"("label_id");
ALTER TABLE "todo_labels" ADD CONSTRAINT "todo_labels_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE;
ALTER TABLE "todo_labels" ADD CONSTRAINT "todo_labels_label_id_fkey"
  FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE;
```
Then `prisma generate` (no DB needed) so `@prisma/client` types pick up the new fields/models. Run after every schema edit.

**Acceptance:** schema compiles (`prisma validate`), client regenerated, API typechecks.

---

## Phase 2 — Shared packages (types, validation, client)

**`packages/shared-types/src/todo.ts`**
```ts
import type { Label } from "./label";

export type TodoPriority = "low" | "medium" | "high";

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;        // ISO 8601
  priority: TodoPriority | null;
  labels: Label[];               // resolved labels on this todo
  createdAt: string;
  updatedAt: string;
}

// labels are managed via dedicated endpoints, so NOT part of these DTOs
export type CreateTodoDto = Pick<Todo, "title"> &
  Partial<Pick<Todo, "description" | "dueDate" | "priority">>;

export type UpdateTodoDto = Partial<
  Pick<Todo, "title" | "description" | "completed" | "dueDate" | "priority">
>;
```

**`packages/shared-types/src/label.ts`** (new) + export from the package index:
```ts
export interface Label {
  id: string;
  name: string;
  color: string;
}
export type CreateLabelDto = { name: string; color: string };
export type UpdateLabelDto = Partial<{ name: string; color: string }>;
```
> Remember to add `export * from "./label";` to `packages/shared-types/src/index.ts`.

**`packages/shared-utils/src/validation.ts`** — add to `validateCreateTodo` & `validateUpdateTodo`:
```ts
const PRIORITIES = ["low", "medium", "high"] as const;

// dueDate: when present and non-null, must be a parseable date string
if (dto.dueDate !== undefined && dto.dueDate !== null) {
  if (Number.isNaN(Date.parse(dto.dueDate))) {
    errors.push({ field: "dueDate", message: "Due date must be a valid date" });
  }
}
// priority: when present and non-null, must be one of the allowed values
if (dto.priority !== undefined && dto.priority !== null) {
  if (!PRIORITIES.includes(dto.priority as (typeof PRIORITIES)[number])) {
    errors.push({ field: "priority", message: "Priority must be low, medium, or high" });
  }
}
```
Add new validators:
```ts
export const LABEL_NAME_MAX_LENGTH = 50;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateCreateLabel(dto: { name?: string; color?: string }): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!dto.name || dto.name.trim().length < 1)
    errors.push({ field: "name", message: "Label name is required" });
  if (dto.name && dto.name.length > LABEL_NAME_MAX_LENGTH)
    errors.push({ field: "name", message: `Label name must be at most ${LABEL_NAME_MAX_LENGTH} characters` });
  if (!dto.color || !HEX_COLOR.test(dto.color))
    errors.push({ field: "color", message: "Color must be a hex value like #c2410c" });
  return errors;
}

export function validateUpdateLabel(dto: { name?: string; color?: string }): ValidationError[] {
  const errors: ValidationError[] = [];
  if (dto.name !== undefined) {
    if (dto.name.trim().length < 1) errors.push({ field: "name", message: "Label name is required" });
    if (dto.name.length > LABEL_NAME_MAX_LENGTH)
      errors.push({ field: "name", message: `Label name must be at most ${LABEL_NAME_MAX_LENGTH} characters` });
  }
  if (dto.color !== undefined && !HEX_COLOR.test(dto.color))
    errors.push({ field: "color", message: "Color must be a hex value like #c2410c" });
  return errors;
}
```

**`packages/api-client/src/client.ts`** — add imports (`Label`, `CreateLabelDto`, `UpdateLabelDto`) and methods:
```ts
// ─── Labels (user-global) ───
async getLabels(): Promise<ApiResponse<Label[]>> {
  return this.request("/labels");
}
async createLabel(dto: CreateLabelDto): Promise<ApiResponse<Label>> {
  return this.request("/labels", { method: "POST", body: JSON.stringify(dto) });
}
async updateLabel(id: string, dto: UpdateLabelDto): Promise<ApiResponse<Label>> {
  return this.request(`/labels/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
}
async deleteLabel(id: string): Promise<ApiResponse<void>> {
  return this.request(`/labels/${id}`, { method: "DELETE" });
}

// ─── Todo <-> Label assignment (returns the updated todo with resolved labels) ───
async addLabelToTodo(listId: string, todoId: string, labelId: string): Promise<ApiResponse<Todo>> {
  return this.request(`/todo-lists/${listId}/todos/${todoId}/labels`, {
    method: "POST", body: JSON.stringify({ labelId }),
  });
}
async removeLabelFromTodo(listId: string, todoId: string, labelId: string): Promise<ApiResponse<Todo>> {
  return this.request(`/todo-lists/${listId}/todos/${todoId}/labels/${labelId}`, {
    method: "DELETE",
  });
}
```
> `updateTodo(listId, id, dto)` already exists — it now carries `dueDate`/`priority` with no client change.

**Acceptance:** all three packages build (`pnpm --filter @todo-app/shared-types build`, etc.).

---

## Phase 3 — Backend: Todo extensions (dueDate / priority / labels include)

**`apps/api/src/todos/todo.repository.ts`**
- Add a labels `include` constant and apply to `findAllByListId`, `findById`, and the re-fetch after update/toggle/label-change:
```ts
const TODO_INCLUDE = { todoLabels: { include: { label: true } } } as const;
export type TodoRow = Prisma.TodoGetPayload<{ include: typeof TODO_INCLUDE }>;
```
  Update return types from `Todo` to `TodoRow` (and `export type { TodoRow }`). Pass `include: TODO_INCLUDE` to every `findMany`/`findFirst`.
- `create(todoListId, data)` — change signature to take an object:
  `{ title; description: string|null; dueDate: Date|null; priority: string|null }`.
- `update(...)` data type adds `dueDate?: Date | null; priority?: string | null;` with the same
  `if (data.x !== undefined) updateData.x = data.x;` guards.
- New methods:
```ts
async addLabel(todoId: string, labelId: string): Promise<void> {
  await this.prisma.todoLabel.upsert({
    where: { todoId_labelId: { todoId, labelId } },
    create: { todoId, labelId },
    update: {},
  });
}
async removeLabel(todoId: string, labelId: string): Promise<void> {
  await this.prisma.todoLabel.deleteMany({ where: { todoId, labelId } });
}
```

**`apps/api/src/todos/todos.service.ts`**
- `create`: pass `{ title, description: dto.description ?? null, dueDate: dto.dueDate ? new Date(dto.dueDate) : null, priority: dto.priority ?? null }`.
- `update`: forward `dueDate` (`dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null`) and `priority`.
- `toTodo` (the single mapper) now returns:
```ts
return {
  id: row.id,
  title: row.title,
  description: row.description,
  completed: row.completed,
  dueDate: row.dueDate?.toISOString() ?? null,
  priority: (row.priority as TodoPriority | null) ?? null,
  labels: row.todoLabels.map((tl) => ({ id: tl.label.id, name: tl.label.name, color: tl.label.color })),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
};
```
- New service methods `addLabel(id, todoListId, labelId)` / `removeLabel(...)`: call repo then return `this.findOne(id, todoListId)` (so the response includes resolved labels). Label ownership is verified in the controller (Phase 4).

**`apps/api/src/todos/todos.controller.ts`** — add label assignment routes (inject `LabelsService`):
```ts
@Post(":id/labels")
async addLabel(@Param("listId") listId, @Param("id") id,
               @Body() body: { labelId: string }, @CurrentUser() user): Promise<ApiResponse<Todo>> {
  await this.verifyListOwnership(listId, user);
  await this.labelsService.findOne(body.labelId, user.id); // 404 if not owned
  return { success: true, data: await this.todosService.addLabel(id, listId, body.labelId) };
}

@Delete(":id/labels/:labelId")
async removeLabel(@Param("listId") listId, @Param("id") id,
                  @Param("labelId") labelId, @CurrentUser() user): Promise<ApiResponse<Todo>> {
  await this.verifyListOwnership(listId, user);
  return { success: true, data: await this.todosService.removeLabel(id, listId, labelId) };
}
```
> `TodosModule` must import `LabelsModule` (and `LabelsModule` export `LabelsService`).

**Acceptance:** create/get/update todos returns the new fields; existing todo tests/flows still pass.

---

## Phase 4 — Backend: Labels module

New folder `apps/api/src/labels/` mirroring `todo-lists/`:

- **`label.repository.ts`** — `findAllByUser(userId)`, `findById(id, userId)`, `create(userId, {name,color})`,
  `update(id, userId, data)` (use `updateMany` + re-`findById`, like todos), `delete(id, userId)`.
  All scoped by `userId`. Returns Prisma `Label` rows.
- **`labels.service.ts`** — `toLabel(row) → { id, name, color }`; CRUD; `findOne` throws `NotFoundException`.
  Handle the `@@unique([userId,name])` violation (Prisma `P2002`) → `ConflictException("Label name already exists")`.
- **`labels.controller.ts`** — `@Controller("labels") @UseGuards(AuthGuard)`:
  `GET /` (list), `POST /` (validateCreateLabel), `PATCH /:id` (validateUpdateLabel), `DELETE /:id`.
  Standard `ApiResponse` envelope + validation-error mapping (copy from `todos.controller.ts`).
- **`labels.module.ts`** — provides `LabelsService`, `LabelRepository`; imports `AuthModule`, `PrismaModule`;
  **exports `LabelsService`** (consumed by `TodosModule`).
- Register `LabelsModule` in `apps/api/src/app.module.ts`.

**Acceptance:** full CRUD on `/labels` works and is user-scoped; duplicate name → 409.

---

## Phase 5 — Desktop state (stores)

**`navigationStore.ts`** — add selection (panel is open ⇔ `selectedTodoId !== null`):
```ts
selectedTodoId: string | null;
selectedTodoListId: string | null;
selectTodo: (todoId: string, listId: string) => void;   // set both
closeTodo: () => void;                                    // null both
```
> Set them to null inside `navigateToToday`/`navigateToList` too, so the panel closes on view change.

**`todosStore.ts`** — add:
```ts
updateTodo: (listId, todoId, dto: UpdateTodoDto) => Promise<void>;   // optimistic
addLabelToTodo: (listId, todoId, labelId) => Promise<void>;          // replace todo w/ server resp
removeLabelFromTodo: (listId, todoId, labelId) => Promise<void>;
```
`updateTodo` pattern (optimistic, since fields are low-stakes):
```ts
updateTodo: async (listId, todoId, dto) => {
  // optimistic merge
  set((s) => ({ todosByList: { ...s.todosByList,
    [listId]: (s.todosByList[listId] ?? []).map((t) => t.id === todoId ? { ...t, ...dto } as Todo : t) }}));
  try {
    const res = await apiClient.updateTodo(listId, todoId, dto);
    set((s) => ({ todosByList: { ...s.todosByList,
      [listId]: (s.todosByList[listId] ?? []).map((t) => t.id === todoId ? res.data : t) }}));
  } catch (err) {
    await get().fetchTodos(listId); // rollback by refetch
    set({ error: err instanceof Error ? err.message : "Failed to update todo" });
  }
},
```
(label add/remove: call client, replace the todo with `res.data`; no optimistic needed.)
> Note: add `get` to the `create<TodosState>((set, get) => …)` signature.

**`labelsStore.ts`** (new) — user-global labels:
```ts
labels: Label[]; isLoading; error;
fetchLabels(); createLabel(name, color): Promise<Label | null>; updateLabel(id, dto); deleteLabel(id);
```
Fetch once on app load (e.g., in `Sidebar` effect alongside `fetchLists`, or in the panel on first open).

**Acceptance:** editing a field in devtools store call persists and survives refetch.

---

## Phase 6 — Desktop: open the panel from rows

**`ListView.tsx`** and **`TodayView.tsx`**: make each row clickable.
- Add `onClick` on the `.todo-item` div → `selectTodo(todo.id, listId)`.
- Add `e.stopPropagation()` on the checkbox and delete buttons so they don't open the panel.
- Add `selected` class when `selectedTodoId === todo.id`; add `cursor: pointer` to `.todo-item`.
- `TodayView` rows already know their list via the badge; pass that listId to `selectTodo`.

**Acceptance:** clicking a row (not checkbox/delete) opens the panel for that todo; active row highlighted.

---

## Phase 7 — Desktop: `TaskDetailPanel.tsx` (new component)

Reads the selected todo:
```ts
const { selectedTodoId, selectedTodoListId, closeTodo } = useNavigationStore();
const todo = useTodosStore((s) =>
  selectedTodoListId ? (s.todosByList[selectedTodoListId] ?? []).find((t) => t.id === selectedTodoId) : undefined);
```
Render when `todo` exists. Structure (mirrors the Superlist screenshot, in TickStep styling):

1. **Titlebar strip** (`-webkit-app-region: drag`, height = `--titlebar-height`) with a **close ×** button (`no-drag`). Esc also calls `closeTodo()` (add a `keydown` `useEffect`).
2. **Title row:** round checkbox (`toggleTodo`) + editable title (`<input>` or `contentEditable`), auto-save on blur via `updateTodo(listId, id, { title })`.
3. **Chip row** — four chips, each opening a small popover (reuse the dropdown/overlay pattern from `Sidebar` UserMenu):
   - **Status** — TODO ⇄ Done (calls `toggleTodo`).
   - **Due date** — native `<input type="date">` in a popover; value `todo.dueDate?.slice(0,10)`; on change `updateTodo(..., { dueDate: value ? new Date(value).toISOString() : null })`. Chip shows formatted date or "Due date".
   - **Priority** — menu of None/Low/Medium/High; `updateTodo(..., { priority })`. Chip shows colored dot + label.
   - **Label** — popover listing `labelsStore.labels` with checkmark for assigned; clicking toggles `addLabelToTodo`/`removeLabelFromTodo`. Inline "create label": name input + a row of color swatches → `labelsStore.createLabel` then assign.
4. **Assigned label chips** row (colored pills, click × to remove).
5. **Description** — auto-grow `<textarea>`, placeholder "Add a description…", auto-save on blur via `updateTodo(..., { description })`.
6. **Footer** — "Created " + relative time from `todo.createdAt` (small `timeAgo` helper; no date lib).

Keep popovers lightweight (absolute-positioned, transparent overlay to close — copy the UserMenu/add-menu pattern). No new dependencies; use native `<input type="date">`.

**Acceptance:** every field edits + persists with no Save button; panel closes via × or Esc.

---

## Phase 8 — CSS (`global.css`)

Add, using existing tokens only (no hard-coded colors):
- `.task-panel` — fixed-width column (~360px), `background: var(--color-surface)`, `border-left: 1px solid var(--color-border)`, `box-shadow: var(--color-menu-shadow)`, `display:flex; flex-direction:column`.
- Slide-in keyframe mirroring `userMenuSlideUp`:
  ```css
  @keyframes taskPanelSlideIn { from { opacity:0; transform: translateX(12px); } to { opacity:1; transform: translateX(0); } }
  .task-panel { animation: taskPanelSlideIn 0.15s ease-out; }
  ```
- `.task-panel-titlebar` (drag region, 38px) + `.task-panel-close` (`no-drag`).
- `.task-chip` — pill: `border:1px solid var(--color-border)`, `border-radius: var(--radius-sm)`, hover `var(--color-sidebar-hover)`; icon + label; muted when empty.
- `.task-popover` — `var(--color-menu-bg)`, `var(--color-menu-border)`, `var(--radius-md)`, `var(--color-menu-shadow)`.
- `.label-chip` — colored pill; text color chosen for contrast (compute from hex or use white on saturated colors).
- `.priority-dot` — small dot colored by priority (low=muted, medium=`--color-primary`, high=`--color-danger`).
- `.todo-item.selected` — `background: var(--color-sidebar-active)`.
- A swatch palette for label creation (≈8 fixed hex values).

**Acceptance:** panel looks cohesive in both light and dark themes.

---

## Phase 9 — Wiring (`AppLayout.tsx`)

```tsx
<div className="app-layout">
  <Sidebar />
  <div className="main-content"> … </div>
  <TaskDetailPanel />   {/* renders null when no todo selected */}
  <SessionExpiredModal />
</div>
```
`.app-layout` is already `display:flex` (row), so the panel slots in as a 3rd column; `.main-content` keeps `flex:1` and shrinks when the panel mounts. (Alternative: position the panel `absolute`/overlay on the right if we prefer it to float over content rather than push it — decide during build.)

**Acceptance:** opening/closing the panel doesn't break the titlebar drag regions or the sidebar.

---

## Phase 10 — Verification checklist

- [ ] `prisma validate` + `prisma generate`; developer ran `prisma migrate dev` on Supabase.
- [ ] `pnpm typecheck` green across api, shared-*, api-client, desktop.
- [ ] Create label, rename, recolor, delete (duplicate name → 409).
- [ ] Assign/unassign labels to a todo; chips update; persists after refetch.
- [ ] Set/clear due date and priority; chips reflect state; persists.
- [ ] Edit title + description with auto-save; reopen panel shows saved values.
- [ ] Panel opens from both ListView and TodayView; checkbox/delete don't open it.
- [ ] Esc and × close the panel; switching list/Today closes it.
- [ ] Light + dark themes both look correct.
- [ ] Deleting a todo/list cascades and removes `todo_labels` rows (FK ON DELETE CASCADE).

## Suggested phase sequencing for incremental delivery

1. **Backend foundation:** Phases 1–3 (schema, shared packages, todo dueDate/priority + labels include) — *due date + priority become usable immediately.*
2. **Labels backend:** Phase 4.
3. **Panel MVP:** Phases 5–9 with description + due date + priority only.
4. **Labels in UI:** label store + label picker/chips (the rest of Phases 5/7/8).

Each numbered group is independently shippable and leaves the app in a working state.
</content>
</invoke>
