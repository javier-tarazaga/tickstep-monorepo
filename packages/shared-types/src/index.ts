export type {
  TodoPriority,
  Todo,
  CreateTodoDto,
  UpdateTodoDto,
  TodoFilters,
  PaginatedResponse,
} from "./todo";

export type { Label, CreateLabelDto, UpdateLabelDto } from "./label";

export type {
  BoardColumn,
  CreateBoardColumnDto,
  UpdateBoardColumnDto,
} from "./board-column";

export type {
  ListMemberRole,
  TodoListMember,
  TodoList,
  CreateTodoListDto,
  UpdateTodoListDto,
  AddMemberDto,
} from "./todo-list";

export type { ApiResponse, ApiError, ApiResult } from "./api";

export type {
  AuthUser,
  AuthTokens,
  SignUpRequest,
  SignInRequest,
  RefreshTokenRequest,
  AuthResponse,
} from "./auth";

export type {
  SidebarSection,
  SidebarLayout,
  SidebarLayoutResponse,
} from "./sidebar-layout";

// WS_EVENTS is the only runtime value in this package. Re-export it (and its
// types) explicitly rather than via `export *`: the wildcard compiles to a CJS
// `__exportStar` helper that bundlers like Rollup can't statically trace for
// named values, which breaks `import { WS_EVENTS }` in the renderer build.
export { WS_EVENTS } from "./ws-events";
export type {
  WsEvent,
  JoinListPayload,
  LeaveListPayload,
  TodoCreatedPayload,
  TodoUpdatedPayload,
  TodoDeletedPayload,
  BoardColumnsUpdatedPayload,
  ListUpdatedPayload,
  ListDeletedPayload,
} from "./ws-events";
