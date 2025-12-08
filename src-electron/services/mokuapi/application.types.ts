export interface ApplicationSummary {
  id: string;
  name: string;
  urlSlug: string;
  providerName: string;
  modelNames: Set<string>;
  guards?: Set<string>; // Note: Java returns Set<String> (prompt names)
  evaluators?: Set<string>; // Note: Java returns Set<String> (prompt names)
  systemPromptName: string;
  active: boolean;
  createdAt: string; // ISO 8601 datetime string
  updatedAt: string; // ISO 8601 datetime string
}

export interface ApplicationFilters {
  provider?: string;
  model?: string;
  systemPrompt?: string;
  search?: string;
  status?: string;
  page: number;
  size: number;
  sort?: string;
}

export interface ApplicationDetail {
  // Identity
  id: string;
  name: string;
  urlSlug: string;

  // Provider
  providerId: string;
  providerName: string;

  // Models (with accessModel field!)
  models: ModelReference[];

  // System Prompt
  systemPromptId: string;
  systemPromptName: string;

  // Team
  teamId?: string;
  teamName?: string;
  teamPath?: string; // ← MISSING in current interface!

  // Guards and Evaluators
  guards: PromptReference[];
  evaluators: PromptReference[];

  // Status
  active: boolean;

  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

export interface ModelReference {
  id: string;
  name: string; // Display name: "Claude Opus 4.5"
  accessModel: string; // ← MISSING in current interface! API identifier: "claude-opus-4-5-20251101"
}

export interface PromptReference {
  id: string;
  name: string;
  promptType: string;
}
