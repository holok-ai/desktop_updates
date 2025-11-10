export interface Message {
  id: string;
  clientMessageId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}
