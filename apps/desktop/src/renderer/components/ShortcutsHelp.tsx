import { useEffect, useRef } from "react";
import { useCommandStore } from "../stores/commandStore";
import { CloseIcon } from "./icons";

const isMac =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");
const MOD = isMac ? "⌘" : "Ctrl";

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: [MOD, "K"], description: "Open the command palette" },
  { keys: [MOD, "N"], description: "New task" },
  { keys: [MOD, "T"], description: "Go to Today" },
  { keys: ["↑", "↓"], description: "Move between tasks" },
  { keys: ["Enter"], description: "Open the highlighted task" },
  { keys: ["Esc"], description: "Close panel, palette, or dialog" },
  { keys: ["?"], description: "Show this help" },
];

/** Keyboard shortcut cheat sheet, opened with "?". Esc or a click dismisses it. */
export default function ShortcutsHelp() {
  const { helpOpen, closeHelp } = useCommandStore();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!helpOpen) return;
    // Move focus into the dialog so keyboard users land inside the modal.
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeHelp();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [helpOpen, closeHelp]);

  if (!helpOpen) return null;

  return (
    <div className="confirm-overlay" onClick={closeHelp} role="presentation">
      <div
        className="shortcuts-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-header">
          <h2 id="shortcuts-title" className="shortcuts-title">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            className="shortcuts-close"
            onClick={closeHelp}
            aria-label="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="shortcuts-list">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.description} className="shortcuts-row">
              <span className="shortcuts-desc">{shortcut.description}</span>
              <span className="shortcuts-keys">
                {shortcut.keys.map((key) => (
                  <kbd key={key} className="shortcuts-key">
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
