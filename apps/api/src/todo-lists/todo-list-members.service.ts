import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TodoList, TodoListMember } from "@tickstep/shared-types";
import { UserRepository } from "../auth/user.repository";
import { RealtimeService } from "../realtime/realtime.service";
import { TodoListMemberRepository } from "./todo-list-member.repository";
import { TodoListsService } from "./todo-lists.service";

@Injectable()
export class TodoListMembersService {
  constructor(
    private readonly todoListsService: TodoListsService,
    private readonly memberRepository: TodoListMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly realtime: RealtimeService,
  ) {}

  /** All participants of a list (owner first). Throws 404 for non-participants. */
  async listMembers(
    listId: string,
    requestingUserId: string,
  ): Promise<TodoListMember[]> {
    const list = await this.todoListsService.findOne(listId, requestingUserId);
    return list.members;
  }

  /**
   * Invite an existing user by email. Any participant may add members (flat
   * model). Returns the updated list so callers get the new member roster.
   */
  async addMember(
    listId: string,
    requestingUserId: string,
    email: string,
  ): Promise<TodoList> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException("Email is required");
    }

    // 404 if the requester isn't a participant of this list.
    const list = await this.todoListsService.findOne(listId, requestingUserId);

    const invitee = await this.userRepository.findByEmail(normalizedEmail);
    if (!invitee) {
      throw new NotFoundException(
        `No Tickstep account found for "${normalizedEmail}"`,
      );
    }

    if (invitee.id === list.userId) {
      throw new ConflictException("That user already owns this list");
    }
    if (list.members.some((m) => m.userId === invitee.id)) {
      throw new ConflictException("That user is already a member of this list");
    }

    await this.memberRepository.create(listId, invitee.id);
    const updated = await this.todoListsService.findOne(listId, requestingUserId);
    // Notifies every participant — including the new member, whose sidebar
    // gains the list live.
    this.realtime.listUpdated(updated);
    return updated;
  }

  /**
   * Remove a collaborator. Any participant may remove any member (flat model),
   * and removing yourself is how you leave a shared list. The owner can never
   * be removed.
   */
  async removeMember(
    listId: string,
    requestingUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const list = await this.todoListsService.findOne(listId, requestingUserId);

    if (targetUserId === list.userId) {
      throw new ForbiddenException("The list owner cannot be removed");
    }

    const removed = await this.memberRepository.delete(listId, targetUserId);
    if (!removed) {
      throw new NotFoundException("That user is not a member of this list");
    }

    // Tell the removed user the list is gone for them, and drop them from the
    // list room so they stop receiving its todo events.
    await this.realtime.detachUserFromList(targetUserId, listId);
    this.realtime.listDeleted(listId, [targetUserId]);

    // Refresh the roster for everyone who still has access. Fetched from the
    // owner's perspective so it works even when a member removes themselves
    // (leaves) and can no longer read the list.
    const updated = await this.todoListsService.findOne(listId, list.userId);
    this.realtime.listUpdated(updated);
  }
}
