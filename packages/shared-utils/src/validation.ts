import type { CreateTodoDto, UpdateTodoDto } from "@tickstep/shared-types";

export const TODO_TITLE_MIN_LENGTH = 1;
export const TODO_TITLE_MAX_LENGTH = 200;
export const LABEL_NAME_MAX_LENGTH = 50;
export const BOARD_COLUMN_NAME_MIN_LENGTH = 1;
export const BOARD_COLUMN_NAME_MAX_LENGTH = 100;

const PRIORITIES = ["low", "medium", "high"] as const;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateCreateTodo(
  dto: CreateTodoDto,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!dto.title || dto.title.trim().length < TODO_TITLE_MIN_LENGTH) {
    errors.push({
      field: "title",
      message: `Title must be at least ${TODO_TITLE_MIN_LENGTH} character(s)`,
    });
  }

  if (dto.title && dto.title.length > TODO_TITLE_MAX_LENGTH) {
    errors.push({
      field: "title",
      message: `Title must be at most ${TODO_TITLE_MAX_LENGTH} characters`,
    });
  }

  // Description length is unbounded — the DB column is TEXT.

  validateTodoDetailFields(dto, errors);

  return errors;
}

export function validateUpdateTodo(
  dto: UpdateTodoDto,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (dto.title !== undefined) {
    if (dto.title.trim().length < TODO_TITLE_MIN_LENGTH) {
      errors.push({
        field: "title",
        message: `Title must be at least ${TODO_TITLE_MIN_LENGTH} character(s)`,
      });
    }

    if (dto.title.length > TODO_TITLE_MAX_LENGTH) {
      errors.push({
        field: "title",
        message: `Title must be at most ${TODO_TITLE_MAX_LENGTH} characters`,
      });
    }
  }

  // Description length is unbounded — the DB column is TEXT.

  validateTodoDetailFields(dto, errors);

  return errors;
}

/** Shared dueDate/priority checks for both create and update DTOs. */
function validateTodoDetailFields(
  dto: { dueDate?: string | null; priority?: string | null },
  errors: ValidationError[],
): void {
  // dueDate: when present and non-null, must be a parseable date string
  if (dto.dueDate !== undefined && dto.dueDate !== null) {
    if (Number.isNaN(Date.parse(dto.dueDate))) {
      errors.push({ field: "dueDate", message: "Due date must be a valid date" });
    }
  }

  // priority: when present and non-null, must be one of the allowed values
  if (dto.priority !== undefined && dto.priority !== null) {
    if (!PRIORITIES.includes(dto.priority as (typeof PRIORITIES)[number])) {
      errors.push({
        field: "priority",
        message: "Priority must be low, medium, or high",
      });
    }
  }

  // position: when present and non-null, must be a non-negative integer
  const position = (dto as { position?: number | null }).position;
  if (position !== undefined && position !== null) {
    if (!Number.isInteger(position) || position < 0) {
      errors.push({
        field: "position",
        message: "Position must be a non-negative integer",
      });
    }
  }
}

export function validateCreateBoardColumn(dto: {
  name?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  validateBoardColumnName(dto.name, errors, true);
  return errors;
}

export function validateUpdateBoardColumn(dto: {
  name?: string;
  position?: number;
  isDone?: boolean;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  if (
    dto.name === undefined &&
    dto.position === undefined &&
    dto.isDone === undefined
  ) {
    return [{ field: "_", message: "Nothing to update" }];
  }
  if (dto.name !== undefined) validateBoardColumnName(dto.name, errors, false);
  if (
    dto.position !== undefined &&
    (!Number.isInteger(dto.position) || dto.position < 0)
  ) {
    errors.push({
      field: "position",
      message: "Position must be a non-negative integer",
    });
  }
  return errors;
}

function validateBoardColumnName(
  name: string | undefined,
  errors: ValidationError[],
  required: boolean,
): void {
  if (name === undefined) {
    if (required)
      errors.push({ field: "name", message: "Column name is required" });
    return;
  }
  if (name.trim().length < BOARD_COLUMN_NAME_MIN_LENGTH) {
    errors.push({ field: "name", message: "Column name is required" });
  }
  if (name.length > BOARD_COLUMN_NAME_MAX_LENGTH) {
    errors.push({
      field: "name",
      message: `Column name must be at most ${BOARD_COLUMN_NAME_MAX_LENGTH} characters`,
    });
  }
}

export function validateCreateLabel(dto: {
  name?: string;
  color?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!dto.name || dto.name.trim().length < 1)
    errors.push({ field: "name", message: "Label name is required" });
  if (dto.name && dto.name.length > LABEL_NAME_MAX_LENGTH)
    errors.push({
      field: "name",
      message: `Label name must be at most ${LABEL_NAME_MAX_LENGTH} characters`,
    });
  if (!dto.color || !HEX_COLOR.test(dto.color))
    errors.push({
      field: "color",
      message: "Color must be a hex value like #c2410c",
    });
  return errors;
}

export function validateUpdateLabel(dto: {
  name?: string;
  color?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  if (dto.name !== undefined) {
    if (dto.name.trim().length < 1)
      errors.push({ field: "name", message: "Label name is required" });
    if (dto.name.length > LABEL_NAME_MAX_LENGTH)
      errors.push({
        field: "name",
        message: `Label name must be at most ${LABEL_NAME_MAX_LENGTH} characters`,
      });
  }
  if (dto.color !== undefined && !HEX_COLOR.test(dto.color))
    errors.push({
      field: "color",
      message: "Color must be a hex value like #c2410c",
    });
  return errors;
}
