import type { CreateTodoDto, UpdateTodoDto } from "@todo-app/shared-types";

export const TODO_TITLE_MIN_LENGTH = 1;
export const TODO_TITLE_MAX_LENGTH = 200;
export const TODO_DESCRIPTION_MAX_LENGTH = 2000;

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

  if (
    dto.description !== undefined &&
    dto.description !== null &&
    dto.description.length > TODO_DESCRIPTION_MAX_LENGTH
  ) {
    errors.push({
      field: "description",
      message: `Description must be at most ${TODO_DESCRIPTION_MAX_LENGTH} characters`,
    });
  }

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

  if (
    dto.description !== undefined &&
    dto.description !== null &&
    dto.description.length > TODO_DESCRIPTION_MAX_LENGTH
  ) {
    errors.push({
      field: "description",
      message: `Description must be at most ${TODO_DESCRIPTION_MAX_LENGTH} characters`,
    });
  }

  return errors;
}
