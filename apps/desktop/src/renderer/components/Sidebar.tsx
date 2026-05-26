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
import { useThemeStore, type Theme } from "../stores/themeStore";
import type { ListSection } from "../stores/todoListsStore";

/* ────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────── */

type DragItemType = "section" | "list";

interface DragData {
  type: DragItemType;
  sectionId?: string;
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

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M1.5 8H3M13 8h1.5M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4.5 4.5 0 0 0 6 6z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5l3 3 5-6" />
    </svg>
  );
}

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
  const { theme, setTheme } = useThemeStore();
  const menuRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <SunIcon /> },
    { value: "dark", label: "Dark", icon: <MoonIcon /> },
  ];

  return (
    <>
      <div className="user-menu-overlay" onClick={onClose} />
      <div className="user-menu" ref={menuRef}>
        <div className="user-menu-section">
          <div className="user-menu-label">Theme</div>
          {themes.map((t) => (
            <button
              key={t.value}
              className="user-menu-item"
              onClick={() => {
                setTheme(t.value);
              }}
            >
              <span className="user-menu-item-icon">{t.icon}</span>
              <span className="user-menu-item-label">{t.label}</span>
              {theme === t.value && (
                <span className="user-menu-item-check">
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
        </div>
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
  lists: { id: string; name: string }[];
  selectedListId: string | null;
  onSelectList: (id: string) => void;
  onToggle: () => void;
  onRemove: () => void;
  onAddList: (name: string) => void;
}

function SortableSection({
  section,
  lists,
  selectedListId,
  onSelectList,
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
    .filter(Boolean) as { id: string; name: string }[];

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
                listId={list.id}
                name={list.name}
                isActive={selectedListId === list.id}
                onSelect={() => onSelectList(list.id)}
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

interface SortableListItemProps {
  id: string;
  listId: string;
  name: string;
  isActive: boolean;
  onSelect: () => void;
  sectionId?: string;
}

function SortableListItem({
  id,
  name,
  isActive,
  onSelect,
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

  return (
    <div ref={setNodeRef} style={style} className="nav-item-wrapper">
      <span
        className="drag-handle list-drag-handle"
        {...attributes}
        {...listeners}
      >
        <GripIcon size={10} />
      </span>
      <button
        className={`nav-item ${isActive ? "active" : ""}`}
        onClick={onSelect}
      >
        <span className="nav-icon">&#9776;</span>
        {name}
      </button>
    </div>
  );
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
    addSection,
    removeSection,
    toggleSection,
    reorderSections,
    reorderListsInSection,
    reorderUnsectionedLists,
    moveListToSection,
    moveListToUnsectioned,
    moveListBetweenSections,
  } = useTodoListsStore();
  const { currentView, selectedListId, navigateToToday, navigateToList } =
    useNavigationStore();

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [newName, setNewName] = useState("");
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<DragData | null>(null);

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

  const sectionListIds = new Set(sections.flatMap((s) => s.listIds));

  const orderedUnsectionedLists = useMemo(() => {
    const allUnsectioned = lists.filter((l) => !sectionListIds.has(l.id));
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
  }, [lists, sectionListIds, unsectionedListIds]);

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
          <button className="nav-item active">
            <span className="nav-icon">&#9776;</span>
            {list.name}
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-titlebar" />

      <div className="sidebar-content">
        {/* Today */}
        <button
          className={`nav-item today-btn ${currentView === "today" ? "active" : ""}`}
          onClick={navigateToToday}
        >
          <span className="nav-icon">&#9788;</span>
          Today
        </button>

        {/* Lists header */}
        <div className="nav-section-header">
          <span>Lists</span>
          <div className="add-menu-wrapper" ref={addMenuRef}>
            <button onClick={() => setShowAddMenu(!showAddMenu)}>+</button>
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
                  New List
                </button>
                <button
                  onClick={() => {
                    setAddingSection(true);
                    setAddingList(false);
                    setNewName("");
                    setShowAddMenu(false);
                  }}
                >
                  New Section
                </button>
              </div>
            )}
          </div>
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
                lists={lists}
                selectedListId={selectedListId}
                onSelectList={navigateToList}
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
                  listId={list.id}
                  name={list.name}
                  isActive={selectedListId === list.id}
                  onSelect={() => navigateToList(list.id)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {renderDragOverlay()}
          </DragOverlay>
        </DndContext>
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
    </aside>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function extractListId(sortableId: string): string {
  const parts = sortableId.split(":");
  return parts[parts.length - 1] ?? "";
}
