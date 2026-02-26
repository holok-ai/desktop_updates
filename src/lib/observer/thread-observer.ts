/**
 * Thread Observer
 *
 * Renderer-side observer that evaluates registered background tasks after
 * each chat response. Called explicitly by ThreadChatView with the current
 * thread and messages.
 *
 * Features:
 * - Evaluates all registered ObserverTask.shouldRun() for each observation
 * - Local tasks (execute defined): run directly without LLM call or queue slot
 * - LLM tasks (buildRequest defined): calls window.electronAPI.chat.background()
 * - Tracks submitted prompt count vs MAX_Q_LENGTH, quietly skips beyond
 * - Dedup: one active task per thread+taskType
 * - Dispatches structured results to ObserverTask.onResult()
 * - Updates observer store for UI
 */

import type { Message } from '$lib/types/thread.type';
import type { ObserverTask, ObserverThread } from './observer-task.interface';
import { observerStore } from './observer.store';
import { modelService } from '$lib/services/model.service';
import { renameTitleTask } from './tasks/rename-title';
import { compressContextTask } from './tasks/compress-context';
import { updateContextStatusTask } from './tasks/update-context-status';
import { suggestPromptTask as _suggestPromptTask } from './tasks/suggest-prompt';
import { ObserverTaskType } from '../../../src-shared/types/observer.types';

/** Maximum number of concurrently submitted background LLM prompts */
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
   * Called by ThreadChatView when a thread is loaded and messages are available.
   * Runs initialize() on every task that defines it — no shouldRun check,
   * no queue slot consumed, no dedup. Tasks that don't need initialization omit the method.
   */
  initializeThread(thread: ObserverThread, messages: Message[]): void {
    console.warn(
      `[ThreadObserver] initializeThread — thread=${thread.id} messages=${messages.length}`,
    );
    for (const task of this.tasks) {
      if (task.initialize === undefined) {
        continue;
      }
      console.warn(`[ThreadObserver] initialize ${task.taskType} thread=${thread.id}`);
      try {
        const result = task.initialize(thread, messages);
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[ThreadObserver] initialize error ${task.taskType}: ${msg}`);
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[ThreadObserver] initialize error ${task.taskType}: ${msg}`);
      }
    }
  }

  /**
   * Called by ThreadChatView after a response completes.
   * Evaluates all registered tasks and submits ready ones.
   */
  private async pickFirstModel(agentId: string): Promise<string | null> {
    const models = await modelService.getModelsForApplication(agentId);
    return models.length > 0 ? models[0].accessName : null;
  }

  observe(thread: ObserverThread, messages: Message[]): void {
    console.warn(
      `[ThreadObserver] observe — thread=${thread.id} tasks=${this.tasks.length} messages=${messages.length}`,
    );

    for (const task of this.tasks) {
      const key = `${thread.id}:${task.taskType}`;

      if (this.activeByKey.has(key)) {
        console.warn(`[ThreadObserver] skip ${task.taskType} — already active`);
        continue;
      }

      if (task.execute === undefined && this.submittedCount >= MAX_Q_LENGTH) {
        console.warn(
          `[ThreadObserver] skip ${task.taskType} — queue full (${this.submittedCount}/${MAX_Q_LENGTH})`,
        );
        return;
      }

      if (!task.shouldRun(thread, messages)) {
        console.warn(`[ThreadObserver] shouldRun ${task.taskType} = false`);
        continue;
      }
      console.warn(`[ThreadObserver] shouldRun ${task.taskType} = true`);

      console.warn(`[ThreadObserver] executing ${task.taskType} for thread=${thread.id}`);

      if (task.execute !== undefined) {
        void this.executeLocalTask(task, thread, messages);
      } else {
        void this.executeTask(task, thread, messages);
      }
    }
  }

  /**
   * Force-execute a specific task by type, bypassing shouldRun.
   * Used for user-initiated actions like "Compact Now".
   */
  forceTask(taskType: ObserverTaskType, thread: ObserverThread, messages: Message[]): void {
    const task = this.tasks.find((t) => t.taskType === taskType);
    if (task === undefined) {
      console.warn(`[ThreadObserver] forceTask: task ${taskType} not found`);
      return;
    }

    const key = `${thread.id}:${task.taskType}`;
    if (this.activeByKey.has(key)) {
      console.warn(`[ThreadObserver] forceTask skip ${task.taskType} — already active`);
      return;
    }

    console.warn(`[ThreadObserver] forceTask ${task.taskType} for thread=${thread.id}`);
    if (task.execute !== undefined) {
      void this.executeLocalTask(task, thread, messages);
    } else {
      void this.executeTask(task, thread, messages);
    }
  }

  /**
   * Execute a local (no-LLM) task directly.
   * Does not consume a queue slot.
   */
  private async executeLocalTask(
    task: ObserverTask,
    thread: ObserverThread,
    messages: Message[],
  ): Promise<void> {
    if (task.execute === undefined) {
      return;
    }

    const key = `${thread.id}:${task.taskType}`;
    this.activeByKey.set(key, true);
    observerStore.setRunning(thread.id, task.taskType, true);
    console.warn(`[ThreadObserver] start local ${task.taskType} thread=${thread.id}`);

    try {
      await task.execute(thread, messages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[ThreadObserver] exception (local) ${task.taskType}: ${errorMessage}`);
      task.onError?.(thread, errorMessage);
    } finally {
      this.activeByKey.delete(key);
      observerStore.setRunning(thread.id, task.taskType, false);
      console.warn(`[ThreadObserver] done local ${task.taskType} thread=${thread.id}`);
    }
  }

  private async executeTask(
    task: ObserverTask,
    thread: ObserverThread,
    messages: Message[],
  ): Promise<void> {
    if (task.buildRequest === undefined) {
      console.warn(`[ThreadObserver] executeTask: no buildRequest for ${task.taskType}`);
      return;
    }

    const key = `${thread.id}:${task.taskType}`;
    this.activeByKey.set(key, true);
    this.submittedCount++;
    observerStore.setRunning(thread.id, task.taskType, true);
    console.warn(`[ThreadObserver] start ${task.taskType} thread=${thread.id}`);

    try {
      const request = task.buildRequest(thread, messages);

      if (request.model === undefined || request.model === '') {
        const agentId =
          (thread as unknown as { metadata?: { agentId?: string } }).metadata?.agentId ?? '';
        if (agentId !== '') {
          const firstModel = await this.pickFirstModel(agentId);
          if (firstModel !== null) {
            request.model = firstModel;
          }
        }
      }

      if (window.electronAPI?.chat?.background === undefined) {
        console.warn('[ThreadObserver] Electron API not available');
        return;
      }

      const response = await window.electronAPI.chat.background(request);
      console.warn(`[ThreadObserver] response ${task.taskType} success=${response.success}`);

      if (response.success) {
        if (task.onResult !== undefined) {
          await task.onResult(thread, response.data);
        }
      } else {
        console.warn(`[ThreadObserver] error ${task.taskType}: ${response.errorText}`);
        task.onError?.(thread, response.errorText);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[ThreadObserver] exception ${task.taskType}: ${errorMessage}`);
      task.onError?.(thread, errorMessage);
    } finally {
      this.activeByKey.delete(key);
      this.submittedCount--;
      observerStore.setRunning(thread.id, task.taskType, false);
      console.warn(`[ThreadObserver] done ${task.taskType} thread=${thread.id}`);
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
  observer.register(updateContextStatusTask);
  // observer.register(suggestPromptTask);
}
