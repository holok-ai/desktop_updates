import type { MessageStatus } from "./status.type.ts";

export interface MessageVersion {
  content: string;
  editedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  status?: MessageStatus;
  retryCount?: number;
  error?: string;
  clientMessageId?: string;
  editedAt?: number;
  originalMessageId?: string;
  isEdited?: boolean;
};