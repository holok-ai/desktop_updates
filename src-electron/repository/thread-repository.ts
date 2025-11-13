import { randomUUID } from 'crypto';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { MessageMetadata } from '../../src-shared/types/attachment.types.js';
import { fileStorageService } from '../services/file-storage.service.js';

export type MessageRole = 'user' | 'assistant' | 'system';
export type UUID = string;

export interface MessageVersion {
  content: string;
  editedAt: number;
}

export interface Message {
  id: UUID;
  title: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  metadata?: MessageMetadata;
  clientMessageId?: string;
  deletedAt?: number | null;
  editedAt?: number;
  versions?: MessageVersion[];
  isEdited?: boolean;
}

export interface ThreadMetadata {
  title?: string;
  description?: string;
  model?: string;
  [key: string]: unknown;
}

export interface Thread {
  id: UUID;
  title: string;
  metadata: ThreadMetadata;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

function generateId(prefix = ''): string {
  return `${prefix}${randomUUID()}`;
}

export class ThreadRepository {
  private readonly threadsById: Map<string, Thread> = new Map();
  private readonly idempotencyIndex: Map<string, Map<string, string>> = new Map();

  constructor() {
    this.loadFromDisk();
  }

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
    this.saveToDisk();
    return this.cloneThread(thread);
  }

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
    this.saveToDisk();
    return this.cloneThread(toSave);
  }

  public loadThread(threadId: string): Thread | null {
    const thread = this.threadsById.get(threadId);
    return thread ? this.cloneThread(thread) : null;
  }

  public listThreads(): Thread[] {
    return Array.from(this.threadsById.values())
      .filter((t) => !t.deletedAt && t.metadata?.status !== 'deleted')
      .map((t) => this.cloneThread(t))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

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
    this.saveToDisk();
    return { ...message };
  }

  public appendMessage(
    threadId: string,
    payload: {
      role: MessageRole;
      content: string;
      metadata?: Record<string, unknown>;
      clientMessageId?: string;
    },
  ): Message {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    const contentBytes = Buffer.byteLength(payload.content ?? '', 'utf8');
    if (contentBytes > 8 * 1024) throw new Error('MESSAGE_TOO_LARGE');
    if (payload.clientMessageId) {
      const byThread = this.idempotencyIndex.get(threadId);
      const existingId = byThread?.get(payload.clientMessageId);
      if (existingId) {
        const found = thread.messages.find((m) => m.id === existingId);
        if (found) return { ...found };
      }
    }
    const message: Message = {
      id: generateId('msg_'),
      title: thread.title,
      role: payload.role,
      content: payload.content,
      createdAt: Date.now(),
      metadata: payload.metadata ? { ...payload.metadata } : undefined,
      clientMessageId: payload.clientMessageId,
      deletedAt: null,
    };
    thread.messages.push(message);
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    if (payload.clientMessageId) {
      if (!this.idempotencyIndex.has(threadId)) this.idempotencyIndex.set(threadId, new Map());
      const index = this.idempotencyIndex.get(threadId);
      if (index) index.set(payload.clientMessageId, message.id);
    }
    this.saveToDisk();
    return { ...message };
  }

  /**
   * Duplicate an existing message within the same thread by message id.
   * Preserves exact content and metadata. Only user prompts may be duplicated.
   */
  public duplicateMessage(threadId: string, messageId: string): Message {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    const original = thread.messages.find((m) => m.id === messageId);
    if (!original) throw new Error(`Message not found: ${messageId}`);
    if (original.role !== 'user') throw new Error('CAN_ONLY_DUPLICATE_USER_PROMPTS');
    // Use appendMessage to preserve idempotency and size checks
    return this.appendMessage(threadId, {
      role: 'user',
      content: original.content,
      metadata: original.metadata,
    });
  }

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

  public addAssistantResponse(threadId: string, response: string, model?: string): Message {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    if (model) {
      thread.metadata = { ...thread.metadata, model };
      thread.updatedAt = Date.now();
      this.threadsById.set(thread.id, thread);
    }
    return this.addMessage(threadId, 'assistant', response);
  }

  public updateThreadMetadata(threadId: string, updates: Partial<ThreadMetadata>): Thread {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    const merged: ThreadMetadata = { ...thread.metadata, ...updates };
    // Support explicit deletions: if a key exists in updates with value undefined, remove it
    for (const key of Object.keys(updates)) {
      if (updates[key as keyof typeof updates] === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete merged[key as keyof typeof merged];
      }
    }
    thread.metadata = merged;
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    this.saveToDisk();
    return this.cloneThread(thread);
  }

  public setThreadModel(threadId: string, model: string): Thread {
    return this.updateThreadMetadata(threadId, { model });
  }

  public getThreadModel(threadId: string): string | undefined {
    const thread = this.threadsById.get(threadId);
    if (!thread) return undefined;
    const m = thread.metadata?.model;
    return typeof m === 'string' ? m : undefined;
  }

  public listThreadsByModel(model: string): Thread[] {
    return Array.from(this.threadsById.values())
      .filter((t) => t.metadata?.model === model)
      .map((t) => this.cloneThread(t));
  }

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

  public replaceMessages(threadId: string, messages: Message[]): Thread {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.messages = messages.map((m) => ({ ...m }));
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    this.saveToDisk();
    return this.cloneThread(thread);
  }

  public deleteThread(threadId: string): boolean {
    // Delete associated files before deleting thread
    fileStorageService.deleteThreadFiles(threadId).catch((error) => {
      console.error('[ThreadRepository] Failed to delete thread files:', error);
      // Continue with thread deletion even if file deletion fails
    });

    const deleted = this.threadsById.delete(threadId);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  public softDeleteThread(threadId: string): boolean {
    const thread = this.threadsById.get(threadId);
    if (!thread) return false;

    // Delete associated files on soft delete as well
    fileStorageService.deleteThreadFiles(threadId).catch((error) => {
      console.error('[ThreadRepository] Failed to delete thread files:', error);
      // Continue with soft delete even if file deletion fails
    });

    thread.deletedAt = Date.now();
    thread.metadata = { ...thread.metadata, status: 'deleted' };
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    this.saveToDisk();
    return true;
  }

  public clearAll(): void {
    this.threadsById.clear();
    this.idempotencyIndex.clear();
    this.saveToDisk();
  }

  public setThreadTimestamps(threadId: string, createdAt: number, updatedAt: number): Thread {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.createdAt = createdAt;
    thread.updatedAt = updatedAt;
    this.threadsById.set(thread.id, thread);
    this.saveToDisk();
    return this.cloneThread(thread);
  }

  public updateMessage(threadId: string, messageId: string, newContent: string): Message {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const message = thread.messages.find((m) => m.id === messageId);
    if (!message) throw new Error(`Message not found: ${messageId}`);

    if (message.role !== 'user') {
      throw new Error('Only user messages can be edited');
    }

    if (!message.versions) {
      message.versions = [];
    }
    message.versions.push({
      content: message.content,
      editedAt: message.editedAt ?? message.createdAt,
    });

    message.content = newContent;
    message.editedAt = Date.now();
    message.isEdited = true;

    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    this.saveToDisk();

    return {
      ...message,
      isEdited: true,
      editedAt: message.editedAt,
      versions: message.versions ? [...message.versions] : [],
    };
  }

  public getMessageVersions(threadId: string, messageId: string): MessageVersion[] {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const message = thread.messages.find((m) => m.id === messageId);
    if (!message) throw new Error(`Message not found: ${messageId}`);

    return message.versions ? [...message.versions] : [];
  }

  public markSubsequentMessagesAsOldPrompt(threadId: string, messageId: string): void {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const messageIndex = thread.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) throw new Error(`Message not found: ${messageId}`);

    // Mark all subsequent messages as based on old prompt version
    const subsequentMessages = thread.messages.slice(messageIndex + 1);
    for (const msg of subsequentMessages) {
      if (!msg.metadata) msg.metadata = {};
      msg.metadata.basedOnOldPrompt = true;
      msg.metadata.originalPromptId = messageId;
    }

    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    this.saveToDisk();
  }

  public deleteMessagesAfter(threadId: string, messageId: string): void {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const messageIndex = thread.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) throw new Error(`Message not found: ${messageId}`);

    // Remove all messages after the specified message
    thread.messages = thread.messages.slice(0, messageIndex + 1);
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    this.saveToDisk();
  }

  private cloneThread(thread: Thread): Thread {
    return {
      id: thread.id,
      title: thread.title,
      metadata: { ...thread.metadata },
      messages: thread.messages.map((m) => ({ ...m })),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      deletedAt: thread.deletedAt ?? null,
    };
  }

  private getStorePath(): string | null {
    try {
      const userData = app.getPath('userData');
      return path.join(userData, 'threads-storage.json');
    } catch {
      return null;
    }
  }

  private saveToDisk(): void {
    try {
      const storePath = this.getStorePath();
      if (!storePath) return;
      const payload = { version: 1, threads: Array.from(this.threadsById.values()) };
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(storePath, JSON.stringify(payload), 'utf-8');
    } catch {
      // ignore IO errors
    }
  }

  private loadFromDisk(): void {
    try {
      const storePath = this.getStorePath();
      if (!storePath) return;
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(storePath)) return;
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const data = fs.readFileSync(storePath, 'utf-8');
      const parsed = JSON.parse(data) as { version?: number; threads?: Thread[] };
      const threads = Array.isArray(parsed.threads) ? parsed.threads : [];
      this.threadsById.clear();
      this.idempotencyIndex.clear();
      for (const t of threads) {
        if (typeof t.id !== 'string' || !Array.isArray(t.messages)) continue;
        this.threadsById.set(t.id, {
          id: t.id,
          title: t.title ?? '',
          metadata: { ...(t.metadata ?? {}) },
          messages: t.messages.map((m) => ({ ...m })),
          createdAt: t.createdAt ?? Date.now(),
          updatedAt: t.updatedAt ?? Date.now(),
          deletedAt: t.deletedAt ?? null,
        });
        for (const m of t.messages) {
          const key = typeof m.clientMessageId === 'string' ? m.clientMessageId : undefined;
          if (key) {
            if (!this.idempotencyIndex.has(t.id)) this.idempotencyIndex.set(t.id, new Map());
            const index = this.idempotencyIndex.get(t.id);
            if (index) index.set(key, m.id);
          }
        }
      }
    } catch {
      // ignore malformed store
    }
  }
}

export const threadRepository = new ThreadRepository();

export default ThreadRepository;
