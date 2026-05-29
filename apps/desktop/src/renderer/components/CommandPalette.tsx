import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCommandStore } from "../stores/commandStore";
import { useNavigationStore } from "../stores/navigationStore";
import { useTodoListsStore } from "../stores/todoListsStore";
import { useTodosStore } from "../stores/todosStore";
import { useViewModeStore } from "../stores/viewModeStore";
import {
  CalendarIcon,
  ListIcon,
  PlusIcon,
  CircleIcon,
} from "./icons";

interface CommandItem {
  id: string;
  label: string;
  /** Secondary text shown on the right (e.g. the parent list). */
  hint?: string;
  /** Extra text matched against the query but not displayed. */
  keywords?: string;
  icon: React.ReactNode;
  run: () => void;
}

interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export default function CommandPalette() {
  const { paletteOpen, paletteMode, closePalette, openHelp, requestAddTaskFocus } =
    useCommandStore();
  const { lists, sections } = useTodoListsStore();
  const { todosByList } = useTodosStore();
  const { navigateToToday, navigateToList, selectTodo, currentView, selectedListId } =
    useNavigationStore();
  const setViewMode = useViewModeStore((s) => s.setViewMode);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset and focus each time the palette opens.
  useEffect(() => {
    if (!paletteOpen) return;
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }, [paletteOpen, paletteMode]);

  // Focus the add-task input of the list a "newTask" selection navigates to.
  // Keyed by listId so the freshly-mounted ListView consumes it, not the old one.
  const goToListAndAddTask = (listId: string) => {
    navigateToList(listId);
    requestAddTaskFocus(listId);
  };

  // Map each list to the name of the section it lives in, so lists with
  // duplicate names (e.g. two "ToDo" lists) can be told apart in the palette.
  const sectionNameByListId = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of sections) {
      for (const listId of section.listIds) {
        map.set(listId, section.name);
      }
    }
    return map;
  }, [sections]);

  const groups = useMemo<CommandGroup[]>(() => {
    if (paletteMode === "newTask") {
      return [
        {
          heading: "New task in…",
          items: lists.map((list) => ({
            id: `new-${list.id}`,
            label: list.name,
            keywords: "new task add create",
            icon: <PlusIcon size={15} />,
            run: () => goToListAndAddTask(list.id),
          })),
        },
      ];
    }

    const actions: CommandItem[] = [
      {
        id: "action-today",
        label: "Go to Today",
        keywords: "home overview",
        icon: <CalendarIcon size={15} />,
        run: navigateToToday,
      },
      {
        id: "action-help",
        label: "Show keyboard shortcuts",
        keywords: "help cheat sheet keys",
        icon: <CircleIcon size={15} />,
        run: openHelp,
      },
    ];

    if (currentView === "list" && selectedListId) {
      actions.push(
        {
          id: "action-board-view",
          label: "Switch to board view",
          keywords: "board kanban columns view",
          icon: <ListIcon size={15} />,
          run: () => setViewMode(selectedListId, "board"),
        },
        {
          id: "action-list-view",
          label: "Switch to list view",
          keywords: "list view",
          icon: <ListIcon size={15} />,
          run: () => setViewMode(selectedListId, "list"),
        },
      );
    }

    const listItems: CommandItem[] = lists.map((list) => {
      const sectionName = sectionNameByListId.get(list.id);
      return {
        id: `list-${list.id}`,
        label: list.name,
        hint: sectionName,
        keywords: `open list navigate ${sectionName ?? ""}`,
        icon: <ListIcon size={15} />,
        run: () => navigateToList(list.id),
      };
    });

    const taskItems: CommandItem[] = lists.flatMap((list) =>
      (todosByList[list.id] ?? [])
        .filter((t) => !t.completed)
        .map((todo) => ({
          id: `task-${todo.id}`,
          label: todo.title,
          hint: list.name,
          keywords: "task todo open",
          icon: <CircleIcon size={15} />,
          run: () => selectTodo(todo.id, list.id),
        })),
    );

    return [
      { heading: "Actions", items: actions },
      { heading: "Lists", items: listItems },
      { heading: "Tasks", items: taskItems },
    ];
    // navigate*/select* are stable Zustand actions; lists/todos drive the content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteMode, lists, sectionNameByListId, todosByList, currentView, selectedListId]);

  // Filter by case-insensitive substring across label, hint, and keywords.
  const filteredGroups = useMemo<CommandGroup[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`
            .toLowerCase()
            .includes(q),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  // Flatten for arrow-key indexing across group boundaries.
  const flatItems = useMemo(
    () => filteredGroups.flatMap((g) => g.items),
    [filteredGroups],
  );

  // Keep the active index in range as the filtered set shrinks/grows.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(flatItems.length - 1, 0)));
  }, [flatItems.length]);

  const execute = (item: CommandItem | undefined) => {
    if (!item) return;
    item.run();
    closePalette();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      execute(flatItems[activeIndex]);
    }
  };

  // Scroll the active row into view as the cursor moves.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-cmd-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!paletteOpen) return null;

  const activeItemId =
    flatItems[activeIndex] && `command-item-${activeIndex}`;

  return (
    <div className="command-overlay" onClick={closePalette} role="presentation">
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="command-input"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={activeItemId || undefined}
          placeholder={
            paletteMode === "newTask"
              ? "Choose a list for the new task…"
              : "Search tasks, lists, and actions…"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <div
          className="command-results"
          id="command-results"
          role="listbox"
          ref={listRef}
        >
          {flatItems.length === 0 && (
            <div className="command-empty">No results</div>
          )}
          {filteredGroups.map((group) => (
            <div key={group.heading} className="command-group">
              <div className="command-group-heading">{group.heading}</div>
              {group.items.map((item) => {
                const index = flatItems.indexOf(item);
                const active = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    id={`command-item-${index}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-cmd-index={index}
                    className={`command-item ${active ? "active" : ""}`}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => execute(item)}
                  >
                    <span className="command-item-icon">{item.icon}</span>
                    <span className="command-item-label">{item.label}</span>
                    {item.hint && (
                      <span className="command-item-hint">{item.hint}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
