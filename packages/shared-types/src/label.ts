export interface Label {
  id: string;
  name: string;
  color: string;
}

export type CreateLabelDto = { name: string; color: string };
export type UpdateLabelDto = Partial<{ name: string; color: string }>;
