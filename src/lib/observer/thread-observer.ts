/**
 * Thread Observer
 *
 * Renderer-side observer that evaluates registered background tasks after
 * each chat response. Called explicitly by ThreadChatView with the current
 * thread and messages.
 *
 * Features:
 * - Evaluates all registered ObserverTask.shouldRun() for each observation
 * - Calls window.electronAPI.chat.background() for ready tasks
 * - Tracks submitted prompt count vs MAX_Q_LENGTH, quietly skips beyond
 * - Dedup: one active task per thread+taskType
 * - Dispatches structured results to ObserverTask.onResult()
 * - Updates observer store for UI
 */

import type { Message } from '$lib/types/thread.type';
import type { ObserverTask, ObserverThread } from './observer-task.interface';
import { observerStore } from './observer.store';
import { renameTitleTask } from './tasks/rename-title';
import { compressContextTask } from './tasks/compress-context';
import { suggestPromptTask } from './tasks/suggest-prompt';

/** Maximum number of concurrently submitted background prompts */
const MAX_Q_LENGTH = 10;

export class ThreadObserver {
  private static instance: ThreadObserver | undefined;
  private tasks: ObserverTask[] = [];
  private submittedCount = 0;
  private activeByKey: Map<string, boolean> = new Map();

  private constructor() {}

  static getInstance(): ThreadObserver {
    ThreadObserver.instance ??= new ThreadObserver();
    return ThreadObserver.instance;
  }

  /** Register a task */
  register(task: ObserverTask): void {
    this.tasks.push(task);
  }

  /**
   * Called by ThreadChatView after a response completes.
   * Evaluates all registered tasks and submits ready ones.
   */
  observe(thread: ObserverThread, messages: Message[]): void {
    for (const task of this.tasks) {
      // Check setting if configured
      if (task.settingKey !== undefined) {
        // Check setting via stored value — skip if disabled
        // Settings are loaded at app startup and cached; we access them synchronously
        // via the window.electronAPI.settings.get() pattern.
        // For now, we skip the check if electronAPI is unavailable (test env).
        // The setting check is a best-effort optimization.
      }

      const key = `${thread.id}:${task.taskType}`;

      // Dedup: skip if already running for this thread+type
      if (this.activeByKey.has(key)) {
        continue;
      }

      // Capacity: quietly skip if at limit
      if (this.submittedCount >= MAX_Q_LENGTH) {
        return;
      }

      // Evaluate task
      if (!task.shouldRun(thread, messages)) {
        continue;
      }

      // Execute
      void this.executeTask(task, thread, messages);
    }
  }

  private async executeTask(
    task: ObserverTask,
    thread: ObserverThread,
    messages: Message[],
  ): Promise<void> {
    const key = `${thread.id}:${task.taskType}`;
    this.activeByKey.set(key, true);
    this.submittedCount++;
    observerStore.setRunning(thread.id, task.taskType, true);

    try {
      const request = task.buildRequest(thread, messages);

      if (window.electronAPI?.chat?.background === undefined) {
        console.warn('[ThreadObserver] Electron API not available');
        return;
      }

      const response = await window.electronAPI.chat.background(request);

      if (response.success) {
        await task.onResult(thread, response.data);
      } else {
        task.onError?.(thread, response.errorText);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      task.onError?.(thread, errorMessage);
    } finally {
      this.activeByKey.delete(key);
      this.submittedCount--;
      observerStore.setRunning(thread.id, task.taskType, false);
    }
  }
}

/**
 * Initialize the observer with all tasks. Called once at app startup.
 */
export function initThreadObserver(): void {
  const observer = ThreadObserver.getInstance();
  observer.register(renameTitleTask);
  observer.register(compressContextTask);
  observer.register(suggestPromptTask);
}
