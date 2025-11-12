import type { MessageStatus } from '$lib/services/message-state-machine.js';
import type { MessageMetadata } from '$shared/types/attachment.types.js';

export interface Message {
  id: string;
  clientMessageId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  status?: MessageStatus;
  attemptCount?: number;
  metadata?: MessageMetadata;
}

// Runtime helper to create a canonical message
export function createMessage(params: {
  id?: string;
  role?: Message['role'];
  content?: string;
  status?: MessageStatus;
  metadata?: MessageMetadata;
}): Message {
  const now = Date.now();
  return {
    id: params.id ?? `msg_${Math.random().toString(36).slice(2, 9)}`,
    role: params.role ?? 'user',
    content: params.content ?? '',
    createdAt: now,
    status: params.status,
    attemptCount: 0,
    metadata: params.metadata,
  };
}
