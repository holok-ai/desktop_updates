import type { MessageMetadata } from '$shared/types/attachment.types.js';
import type { MessageStatus, ThreadStatus } from './status.type.ts';

export interface MessageVersion {
  content: string;
  editedAt: number;
}

export type BranchType = 'prompt-variation' | 'model-variation' | null;

export interface Message {
  id: string;
  clientMessageId?: string;

  thread_id: string; 
  branchId: string;
  modelId?: string | null;

  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  status?: MessageStatus;
  retryCount?: number;
  error?: string;
  editedAt?: number;
  originalMessageId?: string;
  isEdited?: boolean;
  versions?: MessageVersion[];
  metadata?: MessageMetadata;
  attachments?: Array<{ mimeType: string; data?: string; filename: string; size: number }>;

  isHidden?: boolean; 
  isLocal?:  boolean;
}

export interface Thread {
  messages: Message[];
  id: string;
  title: string;
  description: string;
  status: ThreadStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  currentBranchId: string;
}

export interface ModelDetails {
  id: string;
  title: string;
  accessName: string;
  provider: string;
  slug: string;
  url: string;
}

export interface ApplicationSummary {
  id: string;
  title: string;
  models?: ModelDetails[];
  provider: string;
  url: string;
}
