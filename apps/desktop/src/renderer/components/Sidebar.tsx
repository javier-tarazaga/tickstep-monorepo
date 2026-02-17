import React, { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useNavigationStore } from "../stores/navigationStore";
import type { ListSection } from "../stores/todoListsStore";

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const {
    lists,
    sections,
    fetchLists,
    createList,
    addSection,
    removeSection,
    toggleSection,
  } = useTodoListsStore();
  const { currentView, selectedListId, navigateToToday, navigateToList } =
    useNavigationStore();

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [newName, setNewName] = useState("");
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Close add menu on outside click
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

  // Lists that belong to a section
  const sectionListIds = new Set(sections.flatMap((s) => s.listIds));
  // Unsectioned lists
  const unsectionedLists = lists.filter((l) => !sectionListIds.has(l.id));

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

  const handleKeyDown = (
    e: React.KeyboardEvent,
    action: () => void,
    cancel: () => void,
  ) => {
    if (e.key === "Enter") action();
    if (e.key === "Escape") cancel();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-titlebar" />

      <div className="sidebar-content">
        {/* Today */}
        <button
          className={`nav-item ${currentView === "today" ? "active" : ""}`}
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
                handleKeyDown(
                  e,
                  handleAddList,
                  () => setAddingList(false),
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
                handleKeyDown(
                  e,
                  handleAddSection,
                  () => setAddingSection(false),
                )
              }
            />
            <button onClick={handleAddSection}>Add</button>
          </div>
        )}

        {/* Sections */}
        {sections.map((section) => (
          <SectionGroup
            key={section.id}
            section={section}
            lists={lists}
            selectedListId={selectedListId}
            onSelectList={navigateToList}
            onToggle={() => toggleSection(section.id)}
            onRemove={() => removeSection(section.id)}
          />
        ))}

        {/* Unsectioned lists */}
        {unsectionedLists.map((list) => (
          <button
            key={list.id}
            className={`nav-item ${selectedListId === list.id ? "active" : ""}`}
            onClick={() => navigateToList(list.id)}
          >
            <span className="nav-icon">&#9776;</span>
            {list.name}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-email">{user?.email}</span>
          <button className="btn-logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ── Section Group ────────────────────────────────────── */

interface SectionGroupProps {
  section: ListSection;
  lists: { id: string; name: string }[];
  selectedListId: string | null;
  onSelectList: (id: string) => void;
  onToggle: () => void;
  onRemove: () => void;
}

function SectionGroup({
  section,
  lists,
  selectedListId,
  onSelectList,
  onToggle,
  onRemove,
}: SectionGroupProps) {
  const sectionLists = lists.filter((l) => section.listIds.includes(l.id));

  return (
    <div className="section-group">
      <button className="section-group-header" onClick={onToggle}>
        <span className={`chevron ${section.isExpanded ? "expanded" : ""}`}>
          &#9654;
        </span>
        {section.name}
        <span className="section-actions">
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
      </button>

      {section.isExpanded && (
        <div className="section-group-lists">
          {sectionLists.map((list) => (
            <button
              key={list.id}
              className={`nav-item ${selectedListId === list.id ? "active" : ""}`}
              onClick={() => onSelectList(list.id)}
            >
              <span className="nav-icon">&#9776;</span>
              {list.name}
            </button>
          ))}
          {sectionLists.length === 0 && (
            <div
              style={{
                padding: "6px 12px",
                fontSize: 12,
                color: "var(--color-text-muted)",
              }}
            >
              No lists in this section
            </div>
          )}
        </div>
      )}
    </div>
  );
}
