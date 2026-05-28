import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LeaveIcon, PencilIcon, SmileIcon, TrashIcon, UsersIcon } from "./icons";

interface ListContextMenuProps {
  /** Viewport coordinates of the right-click. */
  x: number;
  y: number;
  /** Owner-only actions. Omit for lists the user only collaborates on. */
  onRename?: () => void;
  onChangeEmoji?: () => void;
  onDelete?: () => void;
  /** Available to any participant. */
  onShare?: () => void;
  /** Member-only: leave a list shared with you. */
  onLeave?: () => void;
  onClose: () => void;
}

/**
 * A floating menu anchored at the cursor. Items render based on which handlers
 * are supplied, so the same component serves owned lists (rename / emoji /
 * share / delete) and shared lists (share / leave). It clamps itself inside the
 * viewport after mount and closes on Escape, outside click, or a fresh
 * right-click.
 */
export default function ListContextMenu({
  x,
  y,
  onRename,
  onChangeEmoji,
  onDelete,
  onShare,
  onLeave,
  onClose,
}: ListContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    const nx = Math.min(x, window.innerWidth - width - pad);
    const ny = Math.min(y, window.innerHeight - height - pad);
    setPos({ x: Math.max(pad, nx), y: Math.max(pad, ny) });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const hasEditItems = onRename || onChangeEmoji;
  const hasDestructive = onDelete || onLeave;

  return (
    <>
      <div
        className="list-context-overlay"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={ref}
        className="list-context-menu"
        style={{ left: pos.x, top: pos.y }}
        role="menu"
        onClick={stop}
      >
        {onRename && (
          <button className="list-context-item" role="menuitem" onClick={onRename}>
            <span className="list-context-icon">
              <PencilIcon size={14} />
            </span>
            Rename
          </button>
        )}
        {onChangeEmoji && (
          <button
            className="list-context-item"
            role="menuitem"
            onClick={onChangeEmoji}
          >
            <span className="list-context-icon">
              <SmileIcon size={14} />
            </span>
            Change emoji
          </button>
        )}
        {onShare && (
          <>
            {hasEditItems && <div className="list-context-divider" />}
            <button
              className="list-context-item"
              role="menuitem"
              onClick={onShare}
            >
              <span className="list-context-icon">
                <UsersIcon size={14} />
              </span>
              Share…
            </button>
          </>
        )}
        {hasDestructive && <div className="list-context-divider" />}
        {onLeave && (
          <button
            className="list-context-item danger"
            role="menuitem"
            onClick={onLeave}
          >
            <span className="list-context-icon">
              <LeaveIcon size={14} />
            </span>
            Leave list
          </button>
        )}
        {onDelete && (
          <button
            className="list-context-item danger"
            role="menuitem"
            onClick={onDelete}
          >
            <span className="list-context-icon">
              <TrashIcon size={14} />
            </span>
            Delete list
          </button>
        )}
      </div>
    </>
  );
}
