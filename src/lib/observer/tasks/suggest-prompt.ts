/**
 * Suggest Prompt Task
 *
 * Suggests a clearer rephrasing of the user's last message when
 * there have been 2+ exchanges and the last user message is lengthy.
 */

import {
  ObserverTaskType,
  type BackgroundChatRequest,
} from '../../../../src-shared/types/observer.types';
import type { ObserverTask, ObserverThread } from '../observer-task.interface';
import type { Message } from '$lib/types/thread.type';
import { observerStore } from '../observer.store';

export const suggestPromptTask: ObserverTask = {
  taskType: ObserverTaskType.SuggestPrompt,

  shouldRun(_thread: ObserverThread, messages: Message[]): boolean {
    const exchangeCount = messages.filter((m) => m.role === 'assistant').length;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    return exchangeCount >= 2 && lastUserMsg !== undefined && lastUserMsg.content.length > 200;
  },

  buildRequest(thread: ObserverThread, messages: Message[]): BackgroundChatRequest {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    return {
      taskType: ObserverTaskType.SuggestPrompt,
      threadId: thread.id,
      system:
        "Suggest a clearer, more specific version of the user's last message. " +
        'Return ONLY the rephrased text.',
      messages: [
        ...messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        {
          role: 'user',
          content: `Rephrase this more clearly: "${lastUserMsg?.content ?? ''}"`,
        },
      ],
      maxTokens: 300,
      temperature: 0.5,
    };
  },

  onResult(thread: ObserverThread, response: string): void {
    observerStore.setSuggestion(thread.id, ObserverTaskType.SuggestPrompt, response.trim());
  },
};
