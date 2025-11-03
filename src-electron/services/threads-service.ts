import { randomUUID } from 'crypto';

/**
 * In-memory Threads service
 * - Memory-only store for threads and messages
 * - APIs: createThread, saveThread, loadThread, listThreads, addMessage, replaceMessages, deleteThread, clearAll
 * - Designed for simple UI integration; no persistence
 */

export type MessageRole = 'user' | 'assistant' | 'system';

// UUID type alias (string at runtime, aliased for clarity)
export type UUID = string;

export interface Message {
  id: UUID;
  title: string;
  role: MessageRole;
  content: string;
  createdAt: number; // epoch ms
}

export interface ThreadMetadata {
  title?: string;
  description?: string;
  model?: string; // model identifier for this thread (e.g. gpt-4o)
  [key: string]: unknown;
}

export interface Thread {
  id: UUID;
  // Top-level title for convenience (mirrors metadata.title)
  title: string;
  metadata: ThreadMetadata;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

function generateId(prefix = ''): string {
  // Use Node's crypto.randomUUID for stable UUID generation, keep prefix if provided
  return `${prefix}${randomUUID()}`;
}

export class ThreadsService {
  private readonly threadsById: Map<string, Thread> = new Map();

  /**
   * Create a new thread with optional metadata and return a clone of it
   */
  public createThread(metadata: ThreadMetadata = {}): Thread {
    const now = Date.now();
    const thread: Thread = {
      id: generateId('thread_'),
      title: typeof metadata.title === 'string' ? metadata.title : '',
      metadata: { ...metadata },
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    this.threadsById.set(thread.id, thread);
    return this.cloneThread(thread);
  }

  /**
   * Save or update a thread. If the thread does not exist it will be created.
   */
  public saveThread(thread: Thread): Thread {
    const now = Date.now();
    const existing = this.threadsById.get(thread.id);
    const toSave: Thread = existing
      ? {
          ...existing,
          title: typeof thread.title === 'string' ? thread.title : existing.title,
          metadata: { ...thread.metadata },
          messages: [...thread.messages],
          updatedAt: now,
        }
      : { ...thread, createdAt: thread.createdAt ?? now, updatedAt: now };

    this.threadsById.set(toSave.id, toSave);
    return this.cloneThread(toSave);
  }

  /**
   * Load a thread by id. Returns null if not found.
   */
  public loadThread(threadId: string): Thread | null {
    const thread = this.threadsById.get(threadId);
    return thread ? this.cloneThread(thread) : null;
  }

  /**
   * List all threads (shallow clones). Order is insertion order.
   */
  public listThreads(): Thread[] {
    return Array.from(this.threadsById.values()).map((t) => this.cloneThread(t));
  }

  /**
   * Append a message to a thread. If the thread does not exist an error is thrown.
   * Returns the appended message.
   */
  public addMessage(threadId: string, role: MessageRole, content: string): Message {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const message: Message = {
      id: generateId('msg_'),
      title: thread.title,
      role,
      content,
      createdAt: Date.now(),
    };

    thread.messages.push(message);
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);

    return { ...message };
  }

  /**
   * Convenience: add a user prompt. If threadId is null/undefined a new thread
   * will be created using optional metadata and the prompt added to it.
   * Returns the thread and the created message.
   */
  public addUserPrompt(
    threadId: string | null | undefined,
    prompt: string,
    opts: { title?: string; description?: string; model?: string } = {},
  ): { thread: Thread; message: Message } {
    let tid = threadId;
    if (!tid) {
      const th = this.createThread({
        title: opts.title,
        description: opts.description,
        model: opts.model,
      });
      tid = th.id;
    }

    const message = this.addMessage(tid, 'user', prompt);
    const thread = this.loadThread(tid);
    if (!thread) throw new Error(`Thread disappeared after creation: ${tid}`);
    return { thread, message };
  }

  /**
   * Convenience: add an assistant/model response to a thread.
   * Returns the created message.
   */
  public addAssistantResponse(threadId: string, response: string, model?: string): Message {
    // Optionally record model at thread metadata level
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    if (model) {
      thread.metadata = { ...thread.metadata, model };
      thread.updatedAt = Date.now();
      this.threadsById.set(thread.id, thread);
    }

    return this.addMessage(threadId, 'assistant', response);
  }

  /**
   * Update thread metadata (shallow merge). Returns the updated thread.
   */
  public updateThreadMetadata(threadId: string, updates: Partial<ThreadMetadata>): Thread {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.metadata = { ...thread.metadata, ...updates };
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    return this.cloneThread(thread);
  }

  /**
   * Set the model used for this thread.
   */
  public setThreadModel(threadId: string, model: string): Thread {
    return this.updateThreadMetadata(threadId, { model });
  }

  /**
   * Get the model configured for a thread, if any.
   */
  public getThreadModel(threadId: string): string | undefined {
    const thread = this.threadsById.get(threadId);
    if (!thread) return undefined;
    const m = thread.metadata?.model;
    return typeof m === 'string' ? m : undefined;
  }

  /**
   * List threads filtered by model identifier.
   */
  public listThreadsByModel(model: string): Thread[] {
    return Array.from(this.threadsById.values())
      .filter((t) => t.metadata?.model === model)
      .map((t) => this.cloneThread(t));
  }

  /**
   * Convenience: save both a user prompt and one or more model responses as a
   * single operation. Returns the thread and created messages.
   */
  public savePromptAndResponses(
    threadId: string | null | undefined,
    prompt: string,
    responses: { text: string; model?: string }[],
    opts: { title?: string; description?: string } = {},
  ): { thread: Thread; promptMessage: Message; responseMessages: Message[] } {
    const { thread, message: promptMessage } = this.addUserPrompt(threadId, prompt, opts);
    const responseMessages: Message[] = [];
    for (const r of responses) {
      const resp = this.addAssistantResponse(thread.id, r.text, r.model);
      responseMessages.push(resp);
    }
    const t = this.loadThread(thread.id);
    if (!t) throw new Error(`Thread not found after save: ${thread.id}`);
    return { thread: t, promptMessage, responseMessages };
  }

  /**
   * Replace messages for a thread. Useful for syncing or bulk edits.
   */
  public replaceMessages(threadId: string, messages: Message[]): Thread {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.messages = messages.map((m) => ({ ...m }));
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    return this.cloneThread(thread);
  }

  /**
   * Delete a thread. Returns true if deleted, false if not found.
   */
  public deleteThread(threadId: string): boolean {
    return this.threadsById.delete(threadId);
  }

  /**
   * Remove all threads (useful for testing or resetting state).
   */
  public clearAll(): void {
    this.threadsById.clear();
  }

  /**
   * Test helper: set explicit createdAt/updatedAt for a thread.
   * For testing purposes only. TODO: remove later when we integrate with a real database.
   */
  public setThreadTimestamps(threadId: string, createdAt: number, updatedAt: number): Thread {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.createdAt = createdAt;
    thread.updatedAt = updatedAt;
    this.threadsById.set(thread.id, thread);
    return this.cloneThread(thread);
  }

  /**
   * Internal: return a deep-safe clone to avoid exposing internal state.
   */
  private cloneThread(thread: Thread): Thread {
    return {
      id: thread.id,
      title: thread.title,
      metadata: { ...thread.metadata },
      messages: thread.messages.map((m) => ({ ...m })),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }
}

// Export a singleton instance for simple usage in the UI layer.
export const threadsService = new ThreadsService();

export default ThreadsService;
