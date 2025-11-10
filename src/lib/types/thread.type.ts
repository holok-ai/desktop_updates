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
