import { useEffect, useLayoutEffect, useRef, useState } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useThemeStore } from "../stores/themeStore";

/** Emoji-mart's own popover dimensions (px) — used for viewport clamping. */
const PICKER_WIDTH = 352;
const PICKER_HEIGHT = 435;

interface EmojiPickerPopoverProps {
  /** Viewport anchor — typically the bottom-left of the icon that opened it. */
  anchor: { x: number; y: number };
  /** Whether the list currently has an emoji (controls the "Remove" affordance). */
  hasEmoji: boolean;
  onSelect: (emoji: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Floating emoji picker. We position it next to the anchor and flip/clamp so the
 * whole picker stays on screen — important because the sidebar is narrower than
 * the picker itself.
 */
export default function EmojiPickerPopover({
  anchor,
  hasEmoji,
  onSelect,
  onRemove,
  onClose,
}: EmojiPickerPopoverProps) {
  const theme = useThemeStore((s) => s.theme);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: anchor.x, y: anchor.y, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    const pad = 10;
    const width = el?.offsetWidth || PICKER_WIDTH;
    const height = el?.offsetHeight || PICKER_HEIGHT;

    // Prefer opening to the right of the anchor; clamp into the viewport.
    let x = anchor.x;
    if (x + width + pad > window.innerWidth) {
      x = window.innerWidth - width - pad;
    }
    let y = anchor.y;
    if (y + height + pad > window.innerHeight) {
      // Not enough room below — open above the anchor instead.
      y = Math.max(pad, anchor.y - height - 8);
    }
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y), ready: true });
  }, [anchor.x, anchor.y]);

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

  return (
    <>
      <div className="emoji-popover-overlay" onClick={onClose} />
      <div
        ref={ref}
        className="emoji-popover"
        style={{
          left: pos.x,
          top: pos.y,
          // Avoid a one-frame flash at the anchor before clamping is measured.
          visibility: pos.ready ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {hasEmoji && (
          <button className="emoji-popover-remove" onClick={onRemove}>
            Remove icon
          </button>
        )}
        <Picker
          data={data}
          theme={theme}
          previewPosition="none"
          skinTonePosition="search"
          perLine={8}
          maxFrequentRows={2}
          autoFocus
          onEmojiSelect={(emoji: { native?: string }) => {
            if (emoji.native) onSelect(emoji.native);
          }}
        />
      </div>
    </>
  );
}
