/** Role of a participant on a list. Only "owner" and "member" exist today;
 * the union is the single place to extend when richer roles are added. */
export type ListMemberRole = "owner" | "member";

/** A participant on a list — the owner (role "owner") or a collaborator
 * (role "member"). Identified by email since accounts are email-based. */
export interface TodoListMember {
  userId: string;
  email: string;
  role: ListMemberRole;
  /** ISO 8601. For the owner this is the list's creation time. */
  joinedAt: string;
}

export interface TodoList {
  id: string;
  /** The owner's user id. Unchanged by sharing — the owner is immutable. */
  userId: string;
  name: string;
  /** Optional emoji shown as the list's icon (e.g. "📚"). Null/undefined falls back to a default glyph. */
  emoji?: string | null;
  /** True when the list has at least one collaborator besides the owner. */
  isShared: boolean;
  /** True when the requesting user is the list's owner. */
  isOwner: boolean;
  /** Number of collaborators (excludes the owner). */
  memberCount: number;
  /** All participants including the owner, owner first. */
  members: TodoListMember[];
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

/** Invite an existing user to a list by their account email. */
export interface AddMemberDto {
  email: string;
}
