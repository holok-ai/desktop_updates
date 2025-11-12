import type { GUID } from "./app.type.js";

export interface Project {
  id: GUID;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export type ProjectCreateInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type ProjectUpdateInput = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>;
