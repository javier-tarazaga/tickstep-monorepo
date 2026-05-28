import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import {
  WS_EVENTS,
  type JoinListPayload,
  type LeaveListPayload,
} from "@tickstep/shared-types";
import { AuthService } from "../auth";
import { TodoListRepository } from "../todo-lists/todo-list.repository";

/** Room helpers keep the naming in one place. */
const userRoom = (userId: string) => `user:${userId}`;
const listRoom = (listId: string) => `list:${listId}`;

/**
 * WebSocket gateway for live collaboration. Authenticates each socket with the
 * same Supabase JWT the HTTP API uses, so all authorization stays in the API
 * layer (no Postgres RLS). Every socket joins its personal user room on
 * connect; clients additionally join a list room while viewing a list.
 */
@WebSocketGateway({ cors: { origin: "*" } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly authService: AuthService,
    // Injected directly (leaf dependency) to avoid a module cycle with
    // TodoListsModule, which depends on the realtime emitter.
    private readonly todoListRepository: TodoListRepository,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const user = await this.authService.validateToken(token);
      client.data.userId = user.id;
      await client.join(userRoom(user.id));
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage(WS_EVENTS.JOIN_LIST)
  async handleJoinList(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinListPayload,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId || !payload?.listId) return;
    // Re-verify access before joining — never trust the client's listId.
    const list = await this.todoListRepository.findById(payload.listId, userId);
    if (!list) return;
    await client.join(listRoom(payload.listId));
  }

  @SubscribeMessage(WS_EVENTS.LEAVE_LIST)
  handleLeaveList(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveListPayload,
  ): void {
    if (payload?.listId) void client.leave(listRoom(payload.listId));
  }

  /** Emit to the given list room (active viewers). */
  emitToList(listId: string, event: string, payload: unknown): void {
    // `server` is wired by the Socket.IO adapter after bootstrap; guard so an
    // early mutation (e.g. from a seed script) can't crash the request.
    if (!this.server) return;
    this.server.to(listRoom(listId)).emit(event, payload);
  }

  /** Emit once to each socket in any of the given user rooms (deduped). */
  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    if (!this.server || userIds.length === 0) return;
    this.server.to(userIds.map(userRoom)).emit(event, payload);
  }

  /** Force a user's sockets out of a list room (e.g. after removal). */
  async removeUserFromList(userId: string, listId: string): Promise<void> {
    if (!this.server) return;
    await this.server.in(userRoom(userId)).socketsLeave(listRoom(listId));
  }

  private extractToken(client: Socket): string | undefined {
    const fromAuth = client.handshake.auth?.["token"];
    if (typeof fromAuth === "string" && fromAuth.length > 0) return fromAuth;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
    return undefined;
  }
}
