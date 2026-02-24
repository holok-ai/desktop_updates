/**
 * BackgroundPromptService
 *
 * Manages a queue of background AI prompt tasks that run independently of the
 * user's main chat thread. Tasks are executed using ephemeral DesktopChatService
 * instances (not stored in the chat handler's Map) and results are broadcast back
 * to the renderer via IPC events.
 *
 * Features:
 * - Priority queue (high > normal > low) with FIFO within each level
 * - Configurable max concurrency (default 2)
 * - Per-task AbortController for cancellation
 * - Deduplication: only 1 task per type per threadId at a time
 * - Replacement policy: new tasks of the same type+thread cancel/replace previous ones
 */

import type { DesktopChatRequest } from './chat/index.js';
import { DesktopChatService } from './chat/index.js';
import { CreateChatServiceCommand } from '../commands/chat.create-service.js';
import { AuthService } from './auth.service.js';
import log from 'electron-log';
import {
  BackgroundPromptPriority,
  BackgroundPromptStatus,
  BackgroundPromptType,
  type BackgroundPromptRequest,
  type BackgroundPromptResult,
} from '../../src-shared/types/background-prompt.types.js';

/** Internal task wrapper with execution state */
interface QueuedTask {
  request: BackgroundPromptRequest;
  abortController: AbortController;
  startTime?: number;
}

/** Callback to broadcast results to the renderer */
export type BroadcastResultFn = (result: BackgroundPromptResult) => void;

export class BackgroundPromptService {
  private queue: QueuedTask[] = [];
  private runningTasks: Map<string, QueuedTask> = new Map();
  private readonly maxConcurrent: number;
  private broadcastResult: BroadcastResultFn | null = null;
  private authService: AuthService | null = null;

  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = maxConcurrent;
    log.info('[BackgroundPromptService] Initialized with maxConcurrent:', maxConcurrent);
  }

  /**
   * Set the auth service reference for obtaining access tokens
   */
  setAuthService(auth: AuthService): void {
    this.authService = auth;
  }

  /**
   * Set the broadcast function for sending results to the renderer
   */
  setBroadcastFn(fn: BroadcastResultFn): void {
    this.broadcastResult = fn;
  }

  /**
   * Submit a background prompt task.
   * Handles deduplication: if a task of the same type+thread already exists
   * (queued or running), it is cancelled and replaced.
   */
  submit(request: BackgroundPromptRequest): void {
    log.info('[BackgroundPromptService] Submitting task:', {
      taskId: request.taskId,
      type: request.type,
      threadId: request.threadId,
      priority: request.priority ?? BackgroundPromptPriority.Normal,
    });

    // Cancel any existing task of the same type+thread (dedup/replacement)
    this.cancelByTypeAndThread(request.type, request.threadId);

    const task: QueuedTask = {
      request,
      abortController: new AbortController(),
    };

    // Insert into queue respecting priority
    this.enqueue(task);

    // Try to process the queue
    this.processQueue();
  }

  /**
   * Cancel a specific task by taskId
   */
  cancel(taskId: string): boolean {
    // Check running tasks
    const running = this.runningTasks.get(taskId);
    if (running) {
      log.info('[BackgroundPromptService] Cancelling running task:', taskId);
      running.abortController.abort();
      this.runningTasks.delete(taskId);
      this.emitResult({
        taskId,
        type: running.request.type,
        threadId: running.request.threadId,
        status: BackgroundPromptStatus.Cancelled,
      });
      this.processQueue();
      return true;
    }

    // Check queued tasks
    const queueIdx = this.queue.findIndex((t) => t.request.taskId === taskId);
    if (queueIdx !== -1) {
      log.info('[BackgroundPromptService] Removing queued task:', taskId);
      const removed = this.queue.splice(queueIdx, 1)[0];
      removed.abortController.abort();
      this.emitResult({
        taskId,
        type: removed.request.type,
        threadId: removed.request.threadId,
        status: BackgroundPromptStatus.Cancelled,
      });
      return true;
    }

    log.warn('[BackgroundPromptService] Task not found for cancel:', taskId);
    return false;
  }

  /**
   * Cancel all tasks (queued and running) for a given thread
   */
  cancelAllForThread(threadId: string): void {
    log.info('[BackgroundPromptService] Cancelling all tasks for thread:', threadId);

    // Cancel running tasks for this thread
    for (const [taskId, task] of this.runningTasks.entries()) {
      if (task.request.threadId === threadId) {
        task.abortController.abort();
        this.runningTasks.delete(taskId);
        this.emitResult({
          taskId,
          type: task.request.type,
          threadId,
          status: BackgroundPromptStatus.Cancelled,
        });
      }
    }

    // Remove queued tasks for this thread
    const remaining: QueuedTask[] = [];
    for (const task of this.queue) {
      if (task.request.threadId === threadId) {
        task.abortController.abort();
        this.emitResult({
          taskId: task.request.taskId,
          type: task.request.type,
          threadId,
          status: BackgroundPromptStatus.Cancelled,
        });
      } else {
        remaining.push(task);
      }
    }
    this.queue = remaining;

    this.processQueue();
  }

  /**
   * Cancel any existing task matching the given type and threadId
   */
  private cancelByTypeAndThread(type: BackgroundPromptType, threadId: string): void {
    // Check running tasks
    for (const [taskId, task] of this.runningTasks.entries()) {
      if (task.request.type === type && task.request.threadId === threadId) {
        log.info('[BackgroundPromptService] Replacing running task:', taskId, type);
        task.abortController.abort();
        this.runningTasks.delete(taskId);
        // Don't emit cancelled result for replaced tasks — the replacement supersedes it
      }
    }

    // Check queued tasks
    this.queue = this.queue.filter((task) => {
      if (task.request.type === type && task.request.threadId === threadId) {
        log.info('[BackgroundPromptService] Replacing queued task:', task.request.taskId, type);
        task.abortController.abort();
        return false;
      }
      return true;
    });
  }

  /**
   * Insert a task into the queue respecting priority ordering.
   * High-priority tasks go before normal, normal before low.
   */
  private enqueue(task: QueuedTask): void {
    const priority = task.request.priority ?? BackgroundPromptPriority.Normal;
    const priorityOrder = new Map<BackgroundPromptPriority, number>([
      [BackgroundPromptPriority.High, 0],
      [BackgroundPromptPriority.Normal, 1],
      [BackgroundPromptPriority.Low, 2],
    ]);

    const taskOrder = priorityOrder.get(priority) ?? 1;

    // Find insertion point: insert before the first item with lower priority
    let insertIdx = this.queue.length;
    let idx = 0;
    for (const queued of this.queue) {
      const existingPriority = queued.request.priority ?? BackgroundPromptPriority.Normal;
      const existingOrder = priorityOrder.get(existingPriority) ?? 1;
      if (existingOrder > taskOrder) {
        insertIdx = idx;
        break;
      }
      idx++;
    }

    this.queue.splice(insertIdx, 0, task);
  }

  /**
   * Process the queue: start tasks up to the max concurrency limit
   */
  private processQueue(): void {
    while (this.runningTasks.size < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task === undefined) {
        break;
      }
      this.runningTasks.set(task.request.taskId, task);
      // Fire-and-forget — errors are handled inside executeTask
      void this.executeTask(task);
    }
  }

  /**
   * Execute a single background prompt task
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    const { request, abortController } = task;
    task.startTime = Date.now();

    log.info('[BackgroundPromptService] Executing task:', {
      taskId: request.taskId,
      type: request.type,
      threadId: request.threadId,
    });

    this.emitResult({
      taskId: request.taskId,
      type: request.type,
      threadId: request.threadId,
      status: BackgroundPromptStatus.Running,
    });

    try {
      // Get access token
      let accessToken = '';
      if (this.authService) {
        accessToken = await this.authService.getAccessToken();
      }

      // Create ephemeral chat service using the same command as the chat handler
      const cmd = new CreateChatServiceCommand();
      const modelOverride = request.model ?? '';
      const serviceResult = await cmd.execute(
        request.threadId,
        '0.0.0', // background prompts don't use real branches
        modelOverride, // Will use thread's default model if empty
        accessToken,
      );

      if (!serviceResult.success) {
        throw new Error(serviceResult.errorText ?? 'Failed to create chat service');
      }

      const chatService: DesktopChatService = serviceResult.data;

      // Build the chat request
      const chatRequest: DesktopChatRequest = {
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        streaming: true,
        model: modelOverride,
        system: request.system,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        responseFormat: request.responseFormat,
        thread_id: request.threadId,
        branch_id: '0.0.0',
      };

      // Accumulate the full response via a buffer callback
      let responseBuffer = '';
      await chatService.chat(
        chatRequest,
        (token: string) => {
          if (abortController.signal.aborted) return;
          responseBuffer += token;
        },
        undefined, // no tool use callback
        undefined, // no tool status callback
        abortController.signal,
      );

      // If aborted during execution, don't emit a completed result
      if (abortController.signal.aborted) {
        return;
      }

      const durationMs = Date.now() - (task.startTime ?? Date.now());

      // Try to parse structured output if responseFormat was specified
      let structuredResult: unknown;
      if (request.responseFormat && responseBuffer) {
        try {
          structuredResult = JSON.parse(responseBuffer);
        } catch {
          // Not valid JSON — leave structuredResult undefined, use raw result
        }
      }

      log.info('[BackgroundPromptService] Task completed:', {
        taskId: request.taskId,
        type: request.type,
        durationMs,
        resultLength: responseBuffer.length,
      });

      this.emitResult({
        taskId: request.taskId,
        type: request.type,
        threadId: request.threadId,
        status: BackgroundPromptStatus.Completed,
        result: responseBuffer,
        structuredResult,
        durationMs,
      });
    } catch (error) {
      // If aborted, the cancel method already emitted the cancelled status
      if (abortController.signal.aborted) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - (task.startTime ?? Date.now());

      log.error('[BackgroundPromptService] Task failed:', {
        taskId: request.taskId,
        type: request.type,
        error: errorMessage,
        durationMs,
      });

      this.emitResult({
        taskId: request.taskId,
        type: request.type,
        threadId: request.threadId,
        status: BackgroundPromptStatus.Failed,
        error: errorMessage,
        durationMs,
      });
    } finally {
      this.runningTasks.delete(request.taskId);
      this.processQueue();
    }
  }

  /**
   * Emit a result via the broadcast function
   */
  private emitResult(result: BackgroundPromptResult): void {
    if (this.broadcastResult) {
      this.broadcastResult(result);
    }
  }

  /**
   * Clean up all tasks (called on app shutdown)
   */
  cleanup(): void {
    // Abort all running tasks
    for (const task of this.runningTasks.values()) {
      task.abortController.abort();
    }
    this.runningTasks.clear();

    // Abort all queued tasks
    for (const task of this.queue) {
      task.abortController.abort();
    }
    this.queue = [];

    log.info('[BackgroundPromptService] Cleaned up all tasks');
  }
}
