import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuthStore } from "../stores/authStore";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useNavigationStore } from "../stores/navigationStore";
import { useTodosStore } from "../stores/todosStore";
import {
  clampSidebarWidth,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  usePanelStore,
} from "../stores/panelStore";
import type { ListSection } from "../stores/todoListsStore";
import { useShareDialogStore } from "../stores/shareDialogStore";
import ConfirmDialog from "./ConfirmDialog";
import ListContextMenu from "./ListContextMenu";
import EmojiPickerPopover from "./EmojiPickerPopover";
import { UsersIcon } from "./icons";

/* ────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────── */

type DragItemType = "section" | "list";

interface DragData {
  type: DragItemType;
  sectionId?: string;
}

/** The minimal shape a list needs to render in the sidebar. */
interface SidebarList {
  id: string;
  name: string;
  emoji?: string | null;
  /** True when the list has collaborators (shows a people badge). */
  isShared?: boolean;
}

/**
 * Shared interaction wiring handed to every list row. Lifting this to the
 * Sidebar lets a single context menu, emoji picker, and rename input drive any
 * row regardless of whether it lives in a section or unsectioned.
 */
interface ListItemController {
  selectedListId: string | null;
  renamingListId: string | null;
  /** The list whose menu or emoji picker is currently open (kept visually active). */
  openListId: string | null;
  /** The list whose emoji just changed — plays a one-shot pop animation. */
  poppedListId: string | null;
  onSelect: (listId: string) => void;
  onContextMenu: (e: React.MouseEvent, listId: string) => void;
  onStartRename: (listId: string) => void;
  onSubmitRename: (listId: string, name: string) => void;
  onCancelRename: () => void;
  onOpenEmoji: (listId: string, anchor: { x: number; y: number }) => void;
}

/** Shared inline-add keyboard handling: Enter submits, Escape cancels. */
function handleInlineAddKeyDown(
  e: React.KeyboardEvent,
  action: () => void,
  cancel: () => void,
) {
  if (e.key === "Enter") action();
  if (e.key === "Escape") cancel();
}

/* ────────────────────────────────────────────────────────
   SVG Icons
   ──────────────────────────────────────────────────────── */

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14H3.33A1.33 1.33 0 0 1 2 12.67V3.33A1.33 1.33 0 0 1 3.33 2H6M10.67 11.33 14 8l-3.33-3.33M14 8H6" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.75 7 5.25l3.5 3.5" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────
   User Menu (dropdown from avatar)
   ──────────────────────────────────────────────────────── */

function UserMenu({
  isOpen,
  onClose,
  onLogout,
}: {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  return (
    <>
      <div className="user-menu-overlay" onClick={onClose} />
      <div className="user-menu" ref={menuRef}>
        <div className="user-menu-section">
          <button
            className="user-menu-item danger"
            onClick={() => {
              onClose();
              onLogout();
            }}
          >
            <span className="user-menu-item-icon">
              <LogOutIcon />
            </span>
            <span className="user-menu-item-label">Sign out</span>
          </button>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────
   Drag Handle Icon
   ──────────────────────────────────────────────────────── */

function GripIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
      <circle cx="3.5" cy="2" r="1.2" />
      <circle cx="8.5" cy="2" r="1.2" />
      <circle cx="3.5" cy="6" r="1.2" />
      <circle cx="8.5" cy="6" r="1.2" />
      <circle cx="3.5" cy="10" r="1.2" />
      <circle cx="8.5" cy="10" r="1.2" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────
   Sortable Section (the whole collapsible group)
   ──────────────────────────────────────────────────────── */

interface SortableSectionProps {
  section: ListSection;
  lists: SidebarList[];
  controller: ListItemController;
  onToggle: () => void;
  onRemove: () => void;
  onAddList: (name: string) => void;
}

function SortableSection({
  section,
  lists,
  controller,
  onToggle,
  onRemove,
  onAddList,
}: SortableSectionProps) {
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `section:${section.id}`,
    data: { type: "section" } satisfies DragData,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const sectionLists = lists.filter((l) => section.listIds.includes(l.id));
  const orderedLists = section.listIds
    .map((id) => sectionLists.find((l) => l.id === id))
    .filter(Boolean) as SidebarList[];

  const sortableListIds = orderedLists.map((l) => `list:${section.id}:${l.id}`);

  const handleSubmitList = () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    onAddList(trimmed);
    setNewListName("");
    setAddingList(false);
  };

  const cancelAddList = () => {
    setNewListName("");
    setAddingList(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="section-group">
      <div className="section-group-header">
        <span
          className="drag-handle section-drag-handle"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </span>
        <button className="section-toggle-btn" onClick={onToggle}>
          <span className={`chevron ${section.isExpanded ? "expanded" : ""}`}>
            &#9654;
          </span>
          {section.name}
        </button>
        <span className="section-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!section.isExpanded) onToggle();
              setAddingList(true);
            }}
            title="Add list to section"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove section"
          >
            &times;
          </button>
        </span>
      </div>

      {section.isExpanded && (
        <SortableContext
          items={sortableListIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="section-group-lists" data-section-id={section.id}>
            {orderedLists.map((list) => (
              <SortableListItem
                key={list.id}
                id={`list:${section.id}:${list.id}`}
                list={list}
                controller={controller}
                sectionId={section.id}
              />
            ))}
            {orderedLists.length === 0 && !addingList && (
              <div className="section-empty-drop-zone" data-section-id={section.id}>
                <span>Drop lists here</span>
              </div>
            )}
            {addingList && (
              <div className="inline-add">
                <input
                  autoFocus
                  placeholder="List name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) =>
                    handleInlineAddKeyDown(e, handleSubmitList, cancelAddList)
                  }
                  onBlur={cancelAddList}
                />
                <button onMouseDown={(e) => e.preventDefault()} onClick={handleSubmitList}>
                  Add
                </button>
              </div>
            )}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Sortable List Item
   ──────────────────────────────────────────────────────── */

/** The list's icon: its chosen emoji, or a neutral default glyph when unset. */
function ListIconGlyph({
  emoji,
  popped,
}: {
  emoji?: string | null;
  popped?: boolean;
}) {
  if (emoji) {
    // `key` remounts the span when the emoji changes so the pop replays.
    return (
      <span
        key={emoji}
        className={`nav-emoji ${popped ? "nav-emoji-pop" : ""}`}
      >
        {emoji}
      </span>
    );
  }
  return <span className="nav-icon-default">&#9776;</span>;
}

interface SortableListItemProps {
  id: string;
  list: SidebarList;
  controller: ListItemController;
  sectionId?: string;
}

function SortableListItem({
  id,
  list,
  controller,
  sectionId,
}: SortableListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: "list", sectionId } satisfies DragData,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isActive = controller.selectedListId === list.id;
  const isRenaming = controller.renamingListId === list.id;
  const isOpen = controller.openListId === list.id;
  const isPopped = controller.poppedListId === list.id;
  const openCount = useTodosStore((s) => {
    const t = s.todosByList[list.id];
    return t ? t.filter((x) => !x.completed).length : null;
  });

  const iconRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(list.name);
  // Set when Escape is pressed so the trailing blur discards instead of saving.
  const cancelled = useRef(false);

  useEffect(() => {
    if (!isRenaming) return;
    setDraft(list.name);
    cancelled.current = false;
    // Focus + select on the next frame, once the input is mounted.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isRenaming, list.name]);

  const submitRename = () => {
    if (cancelled.current) {
      cancelled.current = false;
      controller.onCancelRename();
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== list.name) {
      controller.onSubmitRename(list.id, trimmed);
    } else {
      controller.onCancelRename();
    }
  };

  const openEmoji = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) controller.onOpenEmoji(list.id, { x: rect.left, y: rect.bottom + 4 });
  };

  const iconButton = (
    <button
      ref={iconRef}
      type="button"
      className="nav-icon-btn"
      onClick={openEmoji}
      title="Change icon"
      aria-label="Change list icon"
    >
      <ListIconGlyph emoji={list.emoji} popped={isPopped} />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className="nav-item-wrapper">
      <span
        className="drag-handle list-drag-handle"
        {...attributes}
        {...listeners}
      >
        <GripIcon size={10} />
      </span>

      {isRenaming ? (
        <div className="nav-item nav-item-editing">
          {iconButton}
          <input
            ref={inputRef}
            className="nav-rename-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                cancelled.current = true;
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      ) : (
        <div
          className={`nav-item ${isActive ? "active" : ""} ${isOpen ? "is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => controller.onSelect(list.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              controller.onSelect(list.id);
            }
          }}
          onContextMenu={(e) => controller.onContextMenu(e, list.id)}
        >
          {iconButton}
          <span
            className="nav-item-label"
            onDoubleClick={(e) => {
              e.stopPropagation();
              controller.onStartRename(list.id);
            }}
          >
            {list.name}
          </span>
          {list.isShared && (
            <span className="nav-item-shared" title="Shared with others">
              <UsersIcon size={12} />
            </span>
          )}
          {openCount != null && openCount > 0 && (
            <span className="nav-count">{openCount}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Shared-with-me list row (static — not part of personal DnD)
   ──────────────────────────────────────────────────────── */

function SharedListRow({
  list,
  isActive,
  isOpen,
  onSelect,
  onContextMenu,
}: {
  list: SidebarList;
  isActive: boolean;
  isOpen: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const openCount = useTodosStore((s) => {
    const t = s.todosByList[list.id];
    return t ? t.filter((x) => !x.completed).length : null;
  });
  return (
    <div className="nav-item-wrapper shared-row">
      <div
        className={`nav-item ${isActive ? "active" : ""} ${isOpen ? "is-open" : ""}`}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        onContextMenu={onContextMenu}
      >
        <span className="nav-icon-btn" aria-hidden="true">
          <ListIconGlyph emoji={list.emoji} />
        </span>
        <span className="nav-item-label">{list.name}</span>
        <span className="nav-item-shared" title="Shared with you">
          <UsersIcon size={12} />
        </span>
        {openCount != null && openCount > 0 && (
          <span className="nav-count">{openCount}</span>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Drag-to-resize for the sidebar's right edge
   ──────────────────────────────────────────────────────── */

/**
 * Mirror of the task panel's resize behaviour, flipped to the opposite edge.
 * The sidebar hugs the left of the window, so dragging its right edge right
 * (+Δx) widens it. Live width is tracked locally during the drag for smooth
 * frames, then committed to the persisted store on release.
 */
function useSidebarResize() {
  const persistedWidth = usePanelStore((s) => s.sidebarWidth);
  const setSidebarWidth = usePanelStore((s) => s.setSidebarWidth);

  const [dragging, setDragging] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only the primary button initiates a drag; ignore right/middle clicks.
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = persistedWidth;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setDragging(true);

    const onMove = (ev: PointerEvent) => {
      setLiveWidth(clampSidebarWidth(startWidth + (ev.clientX - startX)));
    };
    const onUp = (ev: PointerEvent) => {
      setSidebarWidth(clampSidebarWidth(startWidth + (ev.clientX - startX)));
      setLiveWidth(null);
      setDragging(false);
      handle.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Double-click the handle to snap back to the default width.
  const onDoubleClick = () => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);

  // Keyboard a11y: focus the handle and nudge the edge with arrow keys.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 8;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSidebarWidth(persistedWidth + step);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSidebarWidth(persistedWidth - step);
    } else if (e.key === "Home") {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    }
  };

  const width = liveWidth ?? persistedWidth;

  return {
    width,
    dragging,
    handleProps: {
      role: "separator" as const,
      "aria-orientation": "vertical" as const,
      "aria-label": "Resize sidebar",
      "aria-valuemin": SIDEBAR_MIN_WIDTH,
      "aria-valuemax": SIDEBAR_MAX_WIDTH,
      "aria-valuenow": Math.round(width),
      tabIndex: 0,
      onPointerDown,
      onDoubleClick,
      onKeyDown,
    },
  };
}

/* ────────────────────────────────────────────────────────
   Main Sidebar
   ──────────────────────────────────────────────────────── */

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const {
    lists,
    sections,
    unsectionedListIds,
    fetchLists,
    fetchLayout,
    createList,
    updateList,
    deleteList,
    addSection,
    removeSection,
    toggleSection,
    reorderSections,
    reorderListsInSection,
    reorderUnsectionedLists,
    moveListToSection,
    moveListToUnsectioned,
    moveListBetweenSections,
    leaveList,
  } = useTodoListsStore();
  const { currentView, selectedListId, navigateToToday, navigateToList } =
    useNavigationStore();
  const openShareDialog = useShareDialogStore((s) => s.open);

  /* Per-list interaction state (one at a time, lifted out of the rows). */
  const [menu, setMenu] = useState<{
    listId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [emoji, setEmoji] = useState<{
    listId: string;
    x: number;
    y: number;
  } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [poppedListId, setPoppedListId] = useState<string | null>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [newName, setNewName] = useState("");
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<DragData | null>(null);

  const {
    width: sidebarWidth,
    dragging: resizing,
    handleProps: resizeHandleProps,
  } = useSidebarResize();

  useEffect(() => {
    fetchLists();
    fetchLayout();
  }, [fetchLists, fetchLayout]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(e.target as Node)
      ) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // The personal layout (sections + unsectioned + DnD) only covers lists you
  // own. Lists shared with you live in their own non-draggable group. The
  // owned filter treats an unset isOwner as owned so a list can never vanish
  // from both groups or appear in both during a brief load window.
  const ownedLists = useMemo(
    () => lists.filter((l) => l.isOwner !== false),
    [lists],
  );
  const sharedLists = useMemo(
    () => lists.filter((l) => l.isOwner === false),
    [lists],
  );

  const sectionListIds = new Set(sections.flatMap((s) => s.listIds));

  const orderedUnsectionedLists = useMemo(() => {
    const allUnsectioned = ownedLists.filter((l) => !sectionListIds.has(l.id));
    const ordered: typeof allUnsectioned = [];
    const remaining = new Map(allUnsectioned.map((l) => [l.id, l]));

    for (const id of unsectionedListIds) {
      const list = remaining.get(id);
      if (list) {
        ordered.push(list);
        remaining.delete(id);
      }
    }
    for (const list of remaining.values()) {
      ordered.push(list);
    }
    return ordered;
  }, [ownedLists, sectionListIds, unsectionedListIds]);

  const orderedSharedLists = useMemo(
    () => [...sharedLists].sort((a, b) => a.name.localeCompare(b.name)),
    [sharedLists],
  );

  const sectionSortableIds = sections.map((s) => `section:${s.id}`);
  const unsectionedSortableIds = orderedUnsectionedLists.map(
    (l) => `list:unsectioned:${l.id}`,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleAddList = async () => {
    if (!newName.trim()) return;
    const created = await createList(newName.trim());
    if (created) {
      navigateToList(created.id);
    }
    setNewName("");
    setAddingList(false);
  };

  const handleAddSection = () => {
    if (!newName.trim()) return;
    addSection(newName.trim());
    setNewName("");
    setAddingSection(false);
  };

  /* ── List row interactions (rename / emoji / delete) ───── */

  const startRename = (listId: string) => {
    setMenu(null);
    setEmoji(null);
    setRenamingListId(listId);
  };

  const openEmojiAt = (listId: string, anchor: { x: number; y: number }) => {
    setMenu(null);
    setRenamingListId(null);
    setEmoji({ listId, x: anchor.x, y: anchor.y });
  };

  /** Briefly flag a list so its icon plays a one-shot pop after an emoji change. */
  const triggerPop = (listId: string) => {
    setPoppedListId(listId);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPoppedListId(null), 420);
  };

  useEffect(() => {
    return () => {
      if (popTimer.current) clearTimeout(popTimer.current);
    };
  }, []);

  const handleSelectEmoji = (native: string) => {
    if (!emoji) return;
    const listId = emoji.listId;
    updateList(listId, { emoji: native });
    triggerPop(listId);
    setEmoji(null);
  };

  const handleRemoveEmoji = () => {
    if (!emoji) return;
    // null clears the icon back to the default glyph (matches the stored value).
    updateList(emoji.listId, { emoji: null });
    setEmoji(null);
  };

  const requestDeleteFromMenu = () => {
    if (!menu) return;
    const target = lists.find((l) => l.id === menu.listId);
    setMenu(null);
    if (target) setDeleting({ id: target.id, name: target.name });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    await deleteList(id);
    // If we're still viewing the list we just deleted, fall back to Today.
    // Read the live selection rather than the value closed over at open time.
    if (useNavigationStore.getState().selectedListId === id) navigateToToday();
  };

  const openShareFromMenu = () => {
    if (!menu) return;
    const id = menu.listId;
    setMenu(null);
    openShareDialog(id);
  };

  const handleLeaveFromMenu = async () => {
    if (!menu) return;
    const id = menu.listId;
    setMenu(null);
    await leaveList(id);
    if (useNavigationStore.getState().selectedListId === id) navigateToToday();
  };

  const menuList = menu
    ? lists.find((l) => l.id === menu.listId) ?? null
    : null;

  const listController: ListItemController = {
    selectedListId,
    renamingListId,
    openListId: menu?.listId ?? emoji?.listId ?? null,
    poppedListId,
    onSelect: navigateToList,
    onContextMenu: (e, listId) => {
      e.preventDefault();
      e.stopPropagation();
      setRenamingListId(null);
      setEmoji(null);
      setMenu({ listId, x: e.clientX, y: e.clientY });
    },
    onStartRename: startRename,
    onSubmitRename: (listId, name) => {
      updateList(listId, { name });
      setRenamingListId(null);
    },
    onCancelRename: () => setRenamingListId(null),
    onOpenEmoji: openEmojiAt,
  };

  /* ── Drag handlers ─────────────────────────────────── */

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    setActiveData(event.active.data.current as DragData);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setActiveData(null);

    if (!over || active.id === over.id) return;

    const activeStr = active.id as string;
    const overStr = over.id as string;
    const activeMeta = active.data.current as DragData;
    const overMeta = over.data.current as DragData;

    // ── Section reorder ──
    if (activeMeta.type === "section" && overMeta.type === "section") {
      const fromIndex = sections.findIndex(
        (s) => `section:${s.id}` === activeStr,
      );
      const toIndex = sections.findIndex(
        (s) => `section:${s.id}` === overStr,
      );
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderSections(fromIndex, toIndex);
      }
      return;
    }

    // ── List reorder / move ──
    if (activeMeta.type === "list") {
      const activeListId = extractListId(activeStr);
      const activeSectionId = activeMeta.sectionId;

      if (overMeta.type === "list") {
        const overListId = extractListId(overStr);
        const overSectionId = overMeta.sectionId;

        if (activeSectionId === overSectionId) {
          if (!activeSectionId) {
            const fromIdx = orderedUnsectionedLists.findIndex(
              (l) => l.id === activeListId,
            );
            const toIdx = orderedUnsectionedLists.findIndex(
              (l) => l.id === overListId,
            );
            if (fromIdx !== -1 && toIdx !== -1) {
              reorderUnsectionedLists(fromIdx, toIdx);
            }
          } else {
            const section = sections.find((s) => s.id === activeSectionId);
            if (section) {
              const fromIdx = section.listIds.indexOf(activeListId);
              const toIdx = section.listIds.indexOf(overListId);
              if (fromIdx !== -1 && toIdx !== -1) {
                reorderListsInSection(activeSectionId, fromIdx, toIdx);
              }
            }
          }
        } else {
          if (!activeSectionId && overSectionId) {
            const section = sections.find((s) => s.id === overSectionId);
            const toIdx = section ? section.listIds.indexOf(overListId) : 0;
            moveListToSection(
              activeListId,
              overSectionId,
              toIdx >= 0 ? toIdx : 0,
            );
          } else if (activeSectionId && !overSectionId) {
            const toIdx = orderedUnsectionedLists.findIndex(
              (l) => l.id === overListId,
            );
            moveListToUnsectioned(
              activeListId,
              activeSectionId,
              toIdx >= 0 ? toIdx : orderedUnsectionedLists.length,
            );
          } else if (activeSectionId && overSectionId) {
            const section = sections.find((s) => s.id === overSectionId);
            const toIdx = section ? section.listIds.indexOf(overListId) : 0;
            moveListBetweenSections(
              activeListId,
              activeSectionId,
              overSectionId,
              toIdx >= 0 ? toIdx : 0,
            );
          }
        }
      } else if (overMeta.type === "section") {
        const targetSectionId = overStr.replace("section:", "");
        if (activeSectionId) {
          moveListBetweenSections(
            activeListId,
            activeSectionId,
            targetSectionId,
            0,
          );
        } else {
          moveListToSection(activeListId, targetSectionId, 0);
        }
      }
    }
  }

  function handleDragOver(_event: DragOverEvent) {
    // Handled in dragEnd
  }

  /* ── Overlay content for the dragged item ──────── */

  function renderDragOverlay() {
    if (!activeId || !activeData) return null;

    if (activeData.type === "section") {
      const sectionId = activeId.replace("section:", "");
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return null;
      return (
        <div className="drag-overlay-ghost section-group">
          <div className="section-group-header">
            <span className="drag-handle section-drag-handle">
              <GripIcon />
            </span>
            <button className="section-toggle-btn">
              <span className={`chevron ${section.isExpanded ? "expanded" : ""}`}>
                &#9654;
              </span>
              {section.name}
            </button>
          </div>
        </div>
      );
    }

    if (activeData.type === "list") {
      const listId = extractListId(activeId);
      const list = lists.find((l) => l.id === listId);
      if (!list) return null;
      return (
        <div className="drag-overlay-ghost nav-item-wrapper">
          <span className="drag-handle list-drag-handle">
            <GripIcon size={10} />
          </span>
          <div className="nav-item active">
            <span className="nav-icon-btn">
              <ListIconGlyph emoji={list.emoji} />
            </span>
            <span className="nav-item-label">{list.name}</span>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <aside
      className={`sidebar tui-pane ${resizing ? "is-resizing" : ""}`}
      style={{ width: sidebarWidth }}
    >
      {/* Right-edge resize handle (drag, double-click to reset, arrows) */}
      <div className="sidebar-resizer" {...resizeHandleProps}>
        <span className="sidebar-resizer-grip" aria-hidden="true" />
      </div>

      <div className="pane-head">
        <span className="pane-head__lead">─</span>
        <span className="pane-head__tag">[1]</span>
        <span className="pane-head__name">lists</span>
        <span className="pane-head__rule" />
        <div className="add-menu-wrapper" ref={addMenuRef}>
          <button
            className="pane-head-add"
            onClick={() => setShowAddMenu(!showAddMenu)}
            title="New list or section"
          >
            +
          </button>
          {showAddMenu && (
            <div className="add-menu">
              <button
                onClick={() => {
                  setAddingList(true);
                  setAddingSection(false);
                  setNewName("");
                  setShowAddMenu(false);
                }}
              >
                new list
              </button>
              <button
                onClick={() => {
                  setAddingSection(true);
                  setAddingList(false);
                  setNewName("");
                  setShowAddMenu(false);
                }}
              >
                new section
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-content">
        {/* Today */}
        <div className="views-box">
          <button
            className={`nav-item today-btn ${currentView === "today" ? "active" : ""}`}
            onClick={navigateToToday}
          >
            <span className="nav-icon">☼</span>
            today
          </button>
        </div>

        {/* Inline add list */}
        {addingList && (
          <div className="inline-add">
            <input
              autoFocus
              placeholder="List name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) =>
                handleInlineAddKeyDown(e, handleAddList, () =>
                  setAddingList(false),
                )
              }
            />
            <button onClick={handleAddList}>Add</button>
          </div>
        )}

        {/* Inline add section */}
        {addingSection && (
          <div className="inline-add">
            <input
              autoFocus
              placeholder="Section name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) =>
                handleInlineAddKeyDown(e, handleAddSection, () =>
                  setAddingSection(false),
                )
              }
            />
            <button onClick={handleAddSection}>Add</button>
          </div>
        )}

        {/* DnD Context */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sectionSortableIds}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                lists={ownedLists}
                controller={listController}
                onToggle={() => toggleSection(section.id)}
                onRemove={() => removeSection(section.id)}
                onAddList={async (name) => {
                  const created = await createList(name, section.id);
                  if (created) navigateToList(created.id);
                }}
              />
            ))}
          </SortableContext>

          <SortableContext
            items={unsectionedSortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="unsectioned-lists">
              {orderedUnsectionedLists.map((list) => (
                <SortableListItem
                  key={list.id}
                  id={`list:unsectioned:${list.id}`}
                  list={list}
                  controller={listController}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {renderDragOverlay()}
          </DragOverlay>
        </DndContext>

        {/* Shared with me — lists other people gave you access to */}
        {orderedSharedLists.length > 0 && (
          <>
            <div className="nav-section-header shared-section-header">
              <span>Shared with me</span>
            </div>
            <div className="shared-lists">
              {orderedSharedLists.map((list) => (
                <SharedListRow
                  key={list.id}
                  list={list}
                  isActive={selectedListId === list.id}
                  isOpen={menu?.listId === list.id}
                  onSelect={() => navigateToList(list.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenu({ listId: list.id, x: e.clientX, y: e.clientY });
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <UserMenu
          isOpen={showUserMenu}
          onClose={() => setShowUserMenu(false)}
          onLogout={logout}
        />
        <button
          className="user-account-btn"
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <span className="user-avatar">
            {user?.email ? user.email.slice(0, 2) : "?"}
          </span>
          <span className="user-account-details">
            <span className="user-account-name">
              {user?.email?.split("@")[0] ?? "User"}
            </span>
            <span className="user-account-email">{user?.email}</span>
          </span>
          <span className={`user-account-chevron ${showUserMenu ? "open" : ""}`}>
            <ChevronUpIcon />
          </span>
        </button>
      </div>

      {/* Right-click menu for a list row. Owned lists get full controls;
          lists shared with you get Share + Leave. */}
      {menu && menuList && (
        <ListContextMenu
          x={menu.x}
          y={menu.y}
          onShare={openShareFromMenu}
          onClose={() => setMenu(null)}
          {...(menuList.isOwner
            ? {
                onRename: () => startRename(menu.listId),
                onChangeEmoji: () =>
                  openEmojiAt(menu.listId, { x: menu.x, y: menu.y }),
                onDelete: requestDeleteFromMenu,
              }
            : { onLeave: handleLeaveFromMenu })}
        />
      )}

      {/* Emoji picker for the list icon */}
      {emoji && (
        <EmojiPickerPopover
          anchor={{ x: emoji.x, y: emoji.y }}
          hasEmoji={!!lists.find((l) => l.id === emoji.listId)?.emoji}
          onSelect={handleSelectEmoji}
          onRemove={handleRemoveEmoji}
          onClose={() => setEmoji(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete list?"
        message={
          deleting ? (
            <>
              <strong>{deleting.name}</strong> and all of its tasks will be
              permanently deleted. This can&rsquo;t be undone.
            </>
          ) : null
        }
        confirmLabel="Delete list"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </aside>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function extractListId(sortableId: string): string {
  const parts = sortableId.split(":");
  return parts[parts.length - 1] ?? "";
}
