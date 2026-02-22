import type { Attachment } from '../../src-shared/types/attachment.types.js';
import type { RequestOptionsDTO } from '../services/mokuapi/thread.types.js';
export type MessageRole = 'user' | 'assistant' | 'system';
export type UUID = string;

export interface MessageVersion {
  content: string;
  editedAt: number;
}

export type BranchType = 'prompt-variation' | 'model-variation' | null;

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

export interface Message {
  id: UUID;
  threadId: string;
  branchId: string;
  provider: string;
  modelId: string;
  title: string;
  role: MessageRole;
  userId: string;
  content: string;
  createdAt: number;
  rawData?: JsonValue;
  attachments?: Attachment[];
  clientMessageId?: string;
  deletedAt?: number | null;
  editedAt?: number;
  versions?: MessageVersion[];
  isEdited?: boolean;
  isHidden?: boolean; // Hide from chat view (e.g., guard-blocked messages)
  desktopOptions?: RequestOptionsDTO | null;
}

export interface ThreadMetadata {
  applicationSlug?: string;
  agentId: string;
  initialProvider?: string;
  initalModel?: string;
  modelTitle?: string;
  // Allow any additional properties for flexible metadata
  [key: string]: JsonValue | undefined;
}

export interface Thread {
  id: UUID;
  title: string;
  description: string;
  type: string; // personal or project
  projectId: string | null;
  status: string;
  metadata: ThreadMetadata;
  messages: Message[];
  createdUserId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}
