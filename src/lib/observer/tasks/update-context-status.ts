/**
 * Update Context Status Task
 *
 * A local (no-LLM) observer task that calculates the current thread context
 * window usage and stores it in the observer store for the ContextStatus UI.
 *
 * Runs after every observation when at least one message is present.
 * Performs only arithmetic — no LLM call is made.
 */

import { get } from 'svelte/store';
import { ObserverTaskType } from '../../../../src-shared/types/observer.types';
import type { ObserverTask, ObserverThread } from '../observer-task.interface';
import type { Message } from '$lib/types/thread.type';
import { observerStore } from '../observer.store';
import { settingsStore } from '$lib/stores/settings.store';
import { getModelMaxTokens } from '$lib/services/model-token-limits';

export const updateContextStatusTask: ObserverTask = {
  taskType: ObserverTaskType.UpdateContextStatus,

  shouldRun(_thread: ObserverThread, messages: Message[]): boolean {
    return messages.length > 0;
  },

  execute(thread: ObserverThread, messages: Message[]): void {
    // Find the most recent assistant message to determine the active model
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant === undefined) {
      return; // No responses yet — nothing to calculate
    }

    const modelAccessName = lastAssistant.modelId ?? '';
    if (modelAccessName === '') {
      return;
    }

    // Determine provider for the fallback lookup (may be empty string if unknown)
    const provider = (lastAssistant as unknown as { provider?: string }).provider ?? '';

    const maximumTokenCount = getModelMaxTokens(modelAccessName, provider);

    // Sum token counts across all messages
    const currentTokenCount = messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0);

    // Read configurable compact threshold
    const compactThresholdRatio = get(settingsStore).contextCompactThreshold ?? 0.75;
    const compactThresholdTokenCount = Math.floor(maximumTokenCount * compactThresholdRatio);
    const percentUsed = currentTokenCount / maximumTokenCount;

    // Determine model title: prefer modelId, fall back to access name
    const modelTitle = modelAccessName;

    observerStore.setContextStatus(thread.id, {
      threadId: thread.id,
      modelAccessName,
      modelTitle,
      maximumTokenCount,
      currentTokenCount,
      compactThresholdRatio,
      compactThresholdTokenCount,
      percentUsed,
      updatedAt: Date.now(),
    });
  },
};
