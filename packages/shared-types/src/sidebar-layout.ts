/** A section is a named group of list IDs with ordering */
export interface SidebarSection {
  id: string;
  name: string;
  listIds: string[];
  isExpanded: boolean;
}

/** The full sidebar layout persisted per-user */
export interface SidebarLayout {
  sections: SidebarSection[];
  unsectionedListIds: string[];
}

/** API response shape for GET /sidebar-layout */
export interface SidebarLayoutResponse {
  layout: SidebarLayout;
  updatedAt: string;
}
