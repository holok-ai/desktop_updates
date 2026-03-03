import type { MessageMetadata } from '$shared/types/attachment.types.js';
import type { MessageStatus } from './status.type.ts';
import type { RequestOptionsDTO } from '../../../src-electron/preload.js';
import type { MessageContext } from './context.type.js';

export interface MessageVersion {
  content: string;
  editedAt: number;
}

export type BranchType = 'prompt-variation' | 'model-variation' | null;

export interface Message {
  id: string;
  clientMessageId?: string;

  threadId: string;
  branchId: string;
  rawBranchId?: string;
  normalizedBranchId?: string;
  modelId?: string | null;

  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  userId?: string;
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
  guardExecution: 'none' | 'pass' | 'fail';
  guardMessageId: string | null;
  guardError: string;
  isLocal?: boolean;
  desktopOptions?: RequestOptionsDTO | null;
  /** Token count for this message (input tokens for user, output tokens for assistant) */
  tokens?: number;
  toolUses?: Array<{ name: string; status: 'complete' }>;
  /** Context metadata for turn tracking and future compression */
  context?: MessageContext;
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
