/**
 * Compress Context Task
 *
 * Summarizes conversation context when total token usage reaches the
 * configurable compact threshold (default 75%) of the model's maximum context window.
 *
 * Token data comes from message.tokens (populated by mapDTOToMessage) and
 * the model max tokens come from the static model-token-limits lookup.
 */

import { get } from 'svelte/store';
import {
  ObserverTaskType,
  type BackgroundChatRequest,
} from '../../../../src-shared/types/observer.types';
import type { ObserverTask, ObserverThread } from '../observer-task.interface';
import type { Message } from '$lib/types/thread.type';
import { observerStore } from '../observer.store';
import { settingsStore } from '$lib/stores/settings.store';
import { getModelMaxTokens } from '$lib/services/model-token-limits';

export const compressContextTask: ObserverTask = {
  taskType: ObserverTaskType.CompressContext,

  shouldRun(_thread: ObserverThread, messages: Message[]): boolean {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant === undefined) {
      return false;
    }

    const modelAccessName = lastAssistant.modelId ?? '';
    if (modelAccessName === '') {
      return false;
    }

    const maxTokens = getModelMaxTokens(modelAccessName);
    const totalTokens = messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0);
    if (totalTokens === 0) {
      return false;
    }

    const thresholdRatio = get(settingsStore).contextCompactThreshold ?? 0.75;
    return totalTokens >= maxTokens * thresholdRatio;
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
