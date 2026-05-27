export interface TodoList {
  id: string;
  userId: string;
  name: string;
  /** Optional emoji shown as the list's icon (e.g. "📚"). Null/undefined falls back to a default glyph. */
  emoji?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoListDto {
  name: string;
  emoji?: string | null;
}

/** A partial update: send only the fields you want to change (at least one). */
export interface UpdateTodoListDto {
  name?: string;
  emoji?: string | null;
}
