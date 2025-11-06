import type { MessageStatus } from "./status.type.ts";


export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  status?: MessageStatus;
  retryCount?: number;
  error?: string;
  clientMessageId?: string;
};