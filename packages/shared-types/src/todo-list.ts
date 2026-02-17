export interface TodoList {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoListDto {
  name: string;
}

export interface UpdateTodoListDto {
  name: string;
}
