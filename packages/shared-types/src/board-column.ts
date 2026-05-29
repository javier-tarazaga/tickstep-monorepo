/**
 * A column in a list's Kanban board (e.g. "Todo", "Doing", "Done"). Columns
 * are defined per list — each list has its own set. A task's placement on the
 * board is its `columnId` + `position` (see Todo).
 */
export interface BoardColumn {
  id: string;
  listId: string;
  name: string;
  /** Order of the column within its list, ascending (0 = leftmost). */
  position: number;
  /** The designated "done" column. Moving a task here marks it completed (and
   * vice versa). At most one column per list has this set. */
  isDone: boolean;
  createdAt: string; // ISO 8601
}

export interface CreateBoardColumnDto {
  name: string;
}

/** A partial update: send only the fields you want to change (at least one). */
export interface UpdateBoardColumnDto {
  name?: string;
  position?: number;
  isDone?: boolean;
}
