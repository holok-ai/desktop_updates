/**
 * Update Context Status Task
 *
 * A local (no-LLM) observer task that calculates the current thread context
 * window usage and stores it in the observer store for the ContextStatus UI.
 *
 * initialize() — runs once when a thread is loaded with existing messages.
 * execute()    — runs after every LLM response via the normal observe() path.
 *
 * Performs only arithmetic — no LLM call is made.
 */

import { get } from 'svelte/store';
import { ObserverTaskType } from '../../../../src-shared/types/observer.types';
import type { ObserverTask, ObserverThread } from '../observer-task.interface';
import type { Message } from '$lib/types/thread.type';
import { observerStore } from '../observer.store';
import { settingsStore } from '$lib/stores/settings.store';
import { getModelMaxTokens } from '$lib/services/model-token-limits';

/**
 * Shared computation: calculates token usage for the thread and writes to the store.
 * Returns without storing if there are no assistant messages to derive a model from.
 */
function computeContextStatus(thread: ObserverThread, messages: Message[]): void {
  // Find the most recent assistant message to determine the active model
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (lastAssistant === undefined) {
    return; // No responses yet — nothing to calculate
  }

  // Determine provider for the fallback lookup (may be empty string if unknown)
  const provider = (lastAssistant as unknown as { provider?: string }).provider ?? '';

  // Use modelId when available; fall back to empty string (getModelMaxTokens handles it)
  const modelAccessName = lastAssistant.modelId ?? '';

  const maximumTokenCount = getModelMaxTokens(modelAccessName, provider);

  // Sum token counts across all messages.
  // Use m.tokens when available; fall back to content.length / 4 for messages
  // created in the renderer (streamed responses) that haven't been persisted yet.
  const currentTokenCount = messages.reduce(
    (sum, m) => sum + (m.tokens ?? Math.ceil(m.content.length / 4)),
    0,
  );

  // Read configurable compact threshold
  const compactThresholdRatio = get(settingsStore).contextCompactThreshold ?? 0.75;
  const compactThresholdTokenCount = Math.floor(maximumTokenCount * compactThresholdRatio);
  const percentUsed = currentTokenCount / maximumTokenCount;

  observerStore.setContextStatus(thread.id, {
    threadId: thread.id,
    modelAccessName,
    modelTitle: modelAccessName,
    maximumTokenCount,
    currentTokenCount,
    compactThresholdRatio,
    compactThresholdTokenCount,
    percentUsed,
    updatedAt: Date.now(),
  });
}

export const updateContextStatusTask: ObserverTask = {
  taskType: ObserverTaskType.UpdateContextStatus,

  shouldRun(_thread: ObserverThread, messages: Message[]): boolean {
    return messages.length > 0;
  },

  /**
   * Called once when a thread is loaded with existing messages.
   * Populates the context status immediately so the thermometer is correct
   * before the user sends any new prompts.
   * Returns without storing if there are no messages (new thread).
   */
  initialize(thread: ObserverThread, messages: Message[]): void {
    if (messages.length === 0) {
      return;
    }
    computeContextStatus(thread, messages);
  },

  /**
   * Called after each LLM response via the normal observe() path.
   */
  execute(thread: ObserverThread, messages: Message[]): void {
    computeContextStatus(thread, messages);
  },
};
