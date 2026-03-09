import type { Message } from '$lib/types/thread.type';

export interface CompressionTrace {
  sourceMessageIds: string[];
  content: string;
  policy: string;
}

export interface CompressionContext {
  maxContextTokens: number;
  currentTokenCount: number;
  systemPromptTokens: number;
  historyBudget: number;
  reserveTokens: number;
  targetTokenCount: number;
  summarize: SummarizeFn;
  estimateTokens: (text: string) => number;
  recordTrace: (trace: CompressionTrace) => void;
}

export interface SummarizeOptions {
  policy: string;
  sourceMessageIds: string[];
  modelId?: string;
}

export type SummarizeFn = (prompt: string, options: SummarizeOptions) => Promise<string>;

export interface CompressionPolicy {
  readonly name: string;
  readonly priority: number;
  shouldRun(messages: Message[], context: CompressionContext): boolean;
  apply(messages: Message[], context: CompressionContext): Promise<Message[]>;
}
