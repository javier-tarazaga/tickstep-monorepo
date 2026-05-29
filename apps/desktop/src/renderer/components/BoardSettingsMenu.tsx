import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBoardColumnsStore } from "../stores/boardColumnsStore";
import { CheckIcon, DotsVerticalIcon } from "./icons";

/**
 * Board view settings, opened from a ⋮ button next to the view toggle in the
 * list pane header. Today it holds a single setting — picking which column the
 * board treats as "done" — but it's the home for any future per-view options
 * (grouping, ordering, display props…), so it renders as a small settings panel
 * rather than a flat action menu.
 *
 * The done column was previously chosen via a per-column hover button; moving it
 * here keeps the columns themselves uncluttered and gives the setting one
 * predictable place.
 */
export default function BoardSettingsMenu({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <span className="board-settings">
      <button
        ref={btnRef}
        className={`board-settings__btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Board settings"
        aria-label="Board settings"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <DotsVerticalIcon size={14} />
      </button>
      {open && (
        <BoardSettingsPanel
          listId={listId}
          anchor={btnRef.current}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function BoardSettingsPanel({
  listId,
  anchor,
  onClose,
}: {
  listId: string;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const columns = useBoardColumnsStore((s) => s.columnsByList[listId]) ?? [];
  const setDoneColumn = useBoardColumnsStore((s) => s.setDoneColumn);

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // Anchor under the button, right-aligned, then clamp inside the viewport.
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const pad = 8;
    const left = Math.max(
      pad,
      Math.min(a.right - width, window.innerWidth - width - pad),
    );
    let top = a.bottom + 6;
    if (top + height > window.innerHeight - pad) {
      top = Math.max(pad, a.top - height - 6);
    }
    setPos({ left, top });
  }, [anchor]);

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

  // Portalled to <body> so the fixed-position panel escapes the transformed
  // pane-head ancestor (a CSS transform creates a containing block, which would
  // otherwise reposition the panel relative to that element, not the viewport).
  return createPortal(
    <>
      <div className="board-settings-overlay" onClick={onClose} />
      <div
        ref={ref}
        className="board-settings-panel"
        style={{ left: pos.left, top: pos.top }}
        role="menu"
        onClick={stop}
      >
        <div className="board-settings__section">
          <span className="board-settings__label">done column</span>
          {columns.length === 0 ? (
            <span className="board-settings__hint">no columns yet</span>
          ) : (
            columns.map((col) => (
              <button
                key={col.id}
                className={`board-settings__item ${col.isDone ? "is-active" : ""}`}
                role="menuitemradio"
                aria-checked={col.isDone}
                onClick={() => setDoneColumn(listId, col.id)}
              >
                <span className="board-settings__item-name">{col.name}</span>
                <span className="board-settings__check">
                  {col.isDone && <CheckIcon size={13} />}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
