import type { GUID } from './app.type.js';
export type ProjectPrivacyMode = 'default' | 'project_only';

export interface Project {
  id: GUID;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  metadata?: Record<string, unknown>;
  privacyMode: ProjectPrivacyMode;
}

export type ProjectCreateInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export type ProjectUpdateInput = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>;
