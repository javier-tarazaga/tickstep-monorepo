import React, { useEffect, useRef, useState } from "react";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useAuthStore } from "../stores/authStore";
import { useNavigationStore } from "../stores/navigationStore";
import { CloseIcon, LeaveIcon } from "./icons";

interface ShareListDialogProps {
  listId: string;
  onClose: () => void;
}

/**
 * Manage who can access a list. Any participant can invite existing users by
 * email and remove other members (flat model); only the owner is protected.
 * Reads the list live from the store so realtime membership changes appear
 * without a refetch.
 */
export default function ShareListDialog({
  listId,
  onClose,
}: ShareListDialogProps) {
  const list = useTodoListsStore((s) => s.lists.find((l) => l.id === listId));
  const addMember = useTodoListsStore((s) => s.addMember);
  const removeMember = useTodoListsStore((s) => s.removeMember);
  const leaveList = useTodoListsStore((s) => s.leaveList);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // The list vanished (deleted, or we were removed) while the dialog was open.
  useEffect(() => {
    if (!list) onClose();
  }, [list, onClose]);

  if (!list) return null;

  const isOwner = list.userId === currentUserId;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const err = await addMember(listId, trimmed);
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      setEmail("");
    }
  };

  const handleLeave = async () => {
    await leaveList(listId);
    // On success the list is gone from the store; navigate away if we were
    // viewing it. The `!list` effect above closes the dialog. On failure the
    // list is still present, so we leave the dialog open with the error.
    const stillThere = useTodoListsStore
      .getState()
      .lists.some((l) => l.id === listId);
    if (stillThere) {
      setError("Couldn't leave the list. Please try again.");
    } else if (useNavigationStore.getState().selectedListId === listId) {
      useNavigationStore.getState().navigateToToday();
    }
  };

  return (
    <div className="confirm-overlay" onClick={onClose} role="presentation">
      <div
        className="confirm-card share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="share-close" onClick={onClose} aria-label="Close">
          <CloseIcon size={16} />
        </button>

        <h2 id="share-dialog-title" className="confirm-title">
          Share {list.emoji ? `${list.emoji} ` : ""}
          {list.name}
        </h2>

        <form className="share-invite" onSubmit={handleInvite}>
          <input
            ref={inputRef}
            type="email"
            placeholder="Add people by email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
          />
          <button type="submit" disabled={busy || !email.trim()}>
            {busy ? "Adding…" : "Add"}
          </button>
        </form>
        {error && <div className="share-error">{error}</div>}

        <div className="share-member-label">
          People with access ({list.members.length})
        </div>
        <ul className="share-member-list">
          {list.members.map((m) => {
            const isYou = m.userId === currentUserId;
            const canRemove = m.role !== "owner" && !isYou;
            return (
              <li key={m.userId} className="share-member">
                <span className="share-avatar">{m.email.slice(0, 2)}</span>
                <span className="share-member-email">
                  {m.email}
                  {isYou && <span className="share-you"> (you)</span>}
                </span>
                <span className="share-role">
                  {m.role === "owner" ? "Owner" : "Member"}
                </span>
                {canRemove && (
                  <button
                    className="share-remove"
                    onClick={() => removeMember(listId, m.userId)}
                    title="Remove"
                    aria-label={`Remove ${m.email}`}
                  >
                    <CloseIcon size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="share-footer">
          {!isOwner && (
            <button className="share-leave" onClick={handleLeave}>
              <LeaveIcon size={14} />
              Leave list
            </button>
          )}
          <button className="confirm-btn confirm-primary share-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
