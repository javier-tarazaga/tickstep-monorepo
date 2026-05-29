import { io, type Socket } from "socket.io-client";
import {
  WS_EVENTS,
  type BoardColumnsUpdatedPayload,
  type ListDeletedPayload,
  type ListUpdatedPayload,
  type TodoCreatedPayload,
  type TodoDeletedPayload,
  type TodoUpdatedPayload,
} from "@tickstep/shared-types";
import { API_BASE_URL } from "./api";
import { useTodosStore } from "./stores/todosStore";
import { useTodoListsStore } from "./stores/todoListsStore";
import { useBoardColumnsStore } from "./stores/boardColumnsStore";
import { useNavigationStore } from "./stores/navigationStore";

/**
 * Single live-collaboration socket for the app session. It authenticates with
 * the current access token and fans server events out to the Zustand stores.
 * React components never touch the socket directly — they call `joinList` /
 * `leaveList` (see ListView) and read the stores as usual.
 */
class RealtimeClient {
  private socket: Socket | null = null;
  private joinedLists = new Set<string>();

  /** (Re)connect with the given access token. Safe to call repeatedly; an
   * existing socket is torn down first (e.g. after a token refresh). */
  connect(accessToken: string): void {
    this.disconnect();

    const socket = io(API_BASE_URL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });
    this.socket = socket;

    // Re-join any rooms we were in after a reconnect.
    socket.on("connect", () => {
      for (const listId of this.joinedLists) {
        socket.emit(WS_EVENTS.JOIN_LIST, { listId });
      }
    });

    socket.on(WS_EVENTS.TODO_CREATED, (p: TodoCreatedPayload) => {
      useTodosStore.getState().applyRemoteTodoCreated(p.listId, p.todo);
    });
    socket.on(WS_EVENTS.TODO_UPDATED, (p: TodoUpdatedPayload) => {
      useTodosStore.getState().applyRemoteTodoUpdated(p.listId, p.todo);
    });
    socket.on(WS_EVENTS.TODO_DELETED, (p: TodoDeletedPayload) => {
      useTodosStore.getState().applyRemoteTodoDeleted(p.listId, p.todoId);
    });
    socket.on(WS_EVENTS.BOARD_COLUMNS_UPDATED, (p: BoardColumnsUpdatedPayload) => {
      useBoardColumnsStore.getState().applyRemoteColumns(p.listId, p.columns);
      // A structural change (add/delete/reorder) may have shifted card
      // placements server-side; resync this list's todos so cards land right.
      if (useTodosStore.getState().todosByList[p.listId]) {
        void useTodosStore.getState().fetchTodos(p.listId);
      }
    });
    socket.on(WS_EVENTS.LIST_UPDATED, (p: ListUpdatedPayload) => {
      useTodoListsStore.getState().applyRemoteListUpserted(p.list);
    });
    socket.on(WS_EVENTS.LIST_DELETED, (p: ListDeletedPayload) => {
      useTodoListsStore.getState().applyRemoteListDeleted(p.listId);
      // If we're currently viewing the list that vanished, fall back to Today.
      if (useNavigationStore.getState().selectedListId === p.listId) {
        useNavigationStore.getState().navigateToToday();
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    // Drop room memberships so a later connect (e.g. logging in as a different
    // user) doesn't re-join the previous session's lists.
    this.joinedLists.clear();
  }

  /** Subscribe to live todo events for a list while it's open. */
  joinList(listId: string): void {
    this.joinedLists.add(listId);
    this.socket?.emit(WS_EVENTS.JOIN_LIST, { listId });
  }

  leaveList(listId: string): void {
    this.joinedLists.delete(listId);
    this.socket?.emit(WS_EVENTS.LEAVE_LIST, { listId });
  }
}

export const realtimeClient = new RealtimeClient();
