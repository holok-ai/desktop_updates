import type { MessageMetadata } from "$shared/types/attachment.types.js";
import type { MessageStatus } from "./status.type.ts";

export interface MessageVersion {
  content: string;
  editedAt: number;
}

export interface Message {
  id: string;
  clientMessageId?: string;
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
  editedAt?: number;
  originalMessageId?: string;
  isEdited?: boolean;
  versions?: MessageVersion[];
};
