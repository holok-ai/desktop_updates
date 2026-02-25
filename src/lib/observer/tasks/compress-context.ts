/**
 * Compress Context Task
 *
 * Summarizes conversation context when total token usage reaches 75%
 * of the model's maximum context window.
 *
 * Relies on two properties that will be added in a future PR:
 * - thread.maxModelTokens?: number — max token limit for the current model
 * - message.tokens?: number — token count for each message
 *
 * Until these properties are populated, shouldRun() returns false (graceful no-op).
 */

import {
  ObserverTaskType,
  type BackgroundChatRequest,
} from '../../../../src-shared/types/observer.types';
import type { ObserverTask, ObserverThread } from '../observer-task.interface';
import type { Message } from '$lib/types/thread.type';
import { observerStore } from '../observer.store';

const TOKEN_THRESHOLD_RATIO = 0.75;

export const compressContextTask: ObserverTask = {
  taskType: ObserverTaskType.CompressContext,

  shouldRun(thread: ObserverThread, messages: Message[]): boolean {
    // Requires token data on thread and messages — not yet available
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const maxTokens = (thread as any).maxModelTokens as number | undefined;
    if (maxTokens === undefined || maxTokens === null) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const totalTokens = messages.reduce((sum, m) => sum + (((m as any).tokens as number) ?? 0), 0);
    if (totalTokens === 0) {
      return false; // No token data populated yet
    }

    return totalTokens >= maxTokens * TOKEN_THRESHOLD_RATIO;
  },

  buildRequest(thread: ObserverThread, messages: Message[]): BackgroundChatRequest {
    return {
      taskType: ObserverTaskType.CompressContext,
      threadId: thread.id,
      system:
        'Summarize this conversation concisely. ' +
        'Return JSON: { "summary": string, "keyTopics": string[] }.',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 500,
      temperature: 0.3,
      responseFormat: { type: 'json_object' },
    };
  },

  onResult(thread: ObserverThread, response: string): void {
    try {
      const parsed: unknown = JSON.parse(response);
      observerStore.setContextSummary(thread.id, parsed);
    } catch {
      // Ignore parse errors — result is not valid JSON
    }
  },
};
