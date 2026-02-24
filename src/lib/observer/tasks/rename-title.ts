/**
 * Rename Title Task
 *
 * Generates a short, descriptive title for untitled threads
 * after the first assistant response.
 */

import {
  ObserverTaskType,
  type BackgroundChatRequest,
} from '../../../../src-shared/types/observer.types';
import type { ObserverTask, ObserverThread } from '../observer-task.interface';
import type { Message } from '$lib/types/thread.type';
import { observerStore } from '../observer.store';

export const renameTitleTask: ObserverTask = {
  taskType: ObserverTaskType.RenameTitle,
  settingKey: 'autoTitleEnabled',

  shouldRun(thread: ObserverThread, messages: Message[]): boolean {
    return messages.some((m) => m.role === 'assistant') && thread.title.trim() === '';
  },

  buildRequest(thread: ObserverThread, messages: Message[]): BackgroundChatRequest {
    return {
      taskType: ObserverTaskType.RenameTitle,
      threadId: thread.id,
      system:
        'Generate a short, descriptive title (3-8 words) for this conversation. ' +
        'Return ONLY the title text, nothing else. No quotes, no punctuation at the end.',
      messages: messages.slice(0, 4).map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 60,
      temperature: 0.7,
    };
  },

  onResult(thread: ObserverThread, response: string): void {
    const title = response.trim().replace(/^["']|["']$/g, '');
    observerStore.setSuggestion(thread.id, ObserverTaskType.RenameTitle, title);
  },
};
