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
    const shouldrenameTitle = thread.title.trim() === '' || thread.title.startsWith('New');
    const userMessageCount = messages.filter((m) => m.role === 'user').length;
    return shouldrenameTitle && userMessageCount >= 2 && userMessageCount < 5;
  },

  buildRequest(thread: ObserverThread, messages: Message[]): BackgroundChatRequest {
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .slice(0, 2)
      .map((m) => m.content);
    const prompt =
      'Generate a short, descriptive title (3-8 words) for this conversation. Generate a title that generalizes or summarizes the messages.' +
      'Avoid titles of the format: this and that. Return ONLY the title text, nothing else. No quotes, no punctuation at the end. ' +
      `Messages: ${JSON.stringify(userMessages)}`;
    return {
      taskType: ObserverTaskType.RenameTitle,
      threadId: thread.id,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 60,
      temperature: 0.7,
    };
  },

  onResult(thread: ObserverThread, response: string): void {
    const title = response.trim().replace(/^["']|["']$/g, '');
    console.warn(`[rename-title] onResult thread=${thread.id} suggestedTitle="${title}"`);
    observerStore.setSuggestion(thread.id, ObserverTaskType.RenameTitle, title);
  },
};
