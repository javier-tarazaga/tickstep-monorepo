import type { Todo } from "./todo";
import type { TodoList } from "./todo-list";

/**
 * Socket.IO event names shared by the API gateway and clients.
 *
 * Delivery model:
 * - Todo events go to the list "room" (clients actively viewing that list).
 * - List-level events go to each participant's personal "user room", so they
 *   are delivered regardless of which list the user is currently viewing.
 */
export const WS_EVENTS = {
  // client -> server
  JOIN_LIST: "list:join",
  LEAVE_LIST: "list:leave",
  // server -> client (todo room)
  TODO_CREATED: "todo:created",
  TODO_UPDATED: "todo:updated",
  TODO_DELETED: "todo:deleted",
  // server -> client (user room)
  LIST_UPDATED: "list:updated",
  LIST_DELETED: "list:deleted",
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export interface JoinListPayload {
  listId: string;
}

export interface LeaveListPayload {
  listId: string;
}

export interface TodoCreatedPayload {
  listId: string;
  todo: Todo;
}

export interface TodoUpdatedPayload {
  listId: string;
  todo: Todo;
}

export interface TodoDeletedPayload {
  listId: string;
  todoId: string;
}

/** Sent when a list is created, renamed, re-emojied, or its membership
 * changes. Clients upsert it (and add it to the sidebar if unknown — this is
 * how a newly added collaborator sees a shared list appear live). The
 * recipient should recompute `isOwner` locally as `list.userId === myUserId`. */
export interface ListUpdatedPayload {
  list: TodoList;
}

/** Sent when a list is deleted, or to a member who was removed from it.
 * Clients drop the list and navigate away if it was open. */
export interface ListDeletedPayload {
  listId: string;
}
