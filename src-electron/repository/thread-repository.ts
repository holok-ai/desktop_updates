import log from 'electron-log';
import type { MessageMetadata } from '../../src-shared/types/attachment.types.js';
import { fileStorageService } from '../services/file-storage.service.js';
import { titleGeneratorService } from '../services/title-generator.service.js';
import { threadApiService } from '../services/mokuapi/thread-api.service.js';
import type {
  ThreadDTO,
  DesktopThreadDTO,
  MessageDTO,
  CreateThreadRequest,
  UpdateThreadRequest,
} from '../services/mokuapi/thread.types.js';

export type MessageRole = 'user' | 'assistant' | 'system';
export type UUID = string;

export interface MessageVersion {
  content: string;
  editedAt: number;
}

export type BranchType = 'prompt-variation' | 'model-variation' | null;

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
  /** Branch ID for the message (immutable, hierarchical like 1.0, 1.1, 1.1.1) */
  branchId: string;
  modelId?: string | null;
}

/**
 * Title history entry for tracking rename operations
 */
export interface TitleHistoryEntry {
  /** The new title after this rename */
  title: string;
  /** Timestamp when the rename occurred (epoch ms) */
  timestamp: number;
  /** The previous title before this rename */
  previousTitle: string;
  /** Optional: User ID who performed the rename */
  userId?: string;
}

export interface ThreadMetadata {
  title?: string;
  description?: string;
  model?: string;
  /** History of title changes for audit and undo functionality */
  titleHistory?: TitleHistoryEntry[];
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
  /** Current active branch ID (e.g., "1.0", "1.1", "1.1.1") */
  currentBranchId: string;
}

export class ThreadRepository {
  // API-first architecture - no longer loading from local disk
  // Threads are fetched from Moku API on demand
  private readonly threadsById: Map<string, Thread> = new Map();
  private readonly idempotencyIndex: Map<string, Map<string, string>> = new Map();

  public async createThread(metadata: ThreadMetadata = {}): Promise<Thread> {
    const request: CreateThreadRequest = {
      title: typeof metadata.title === 'string' ? metadata.title : 'New Thread',
      projectId: metadata.projectId as string | null | undefined,
      metadata: metadata,
    };

    log.info('[ThreadRepository] Creating thread via API:', request.title);
    log.info('[ThreadRepository] Metadata being sent to API:', JSON.stringify(metadata, null, 2));

    const threadDTO = await threadApiService.createThread(request);

    log.info('[ThreadRepository] ThreadDTO received from API:', JSON.stringify(threadDTO, null, 2));
    log.info('[ThreadRepository] Metadata in ThreadDTO:', JSON.stringify(threadDTO.metadata, null, 2));

    const desktopDTO = this.toDesktopThreadDTO(threadDTO);
    const thread = this.mapDTOToThread(desktopDTO);

    log.info('[ThreadRepository] Mapped thread metadata:', JSON.stringify(thread.metadata, null, 2));

    // Cache locally for session
    this.threadsById.set(thread.id, thread);
    log.info('[ThreadRepository] Thread created and cached:', thread.id);

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
          currentBranchId: thread.currentBranchId,
        }
      : { ...thread, createdAt: thread.createdAt ?? now, updatedAt: now };
    this.threadsById.set(toSave.id, toSave);
    // Note: No longer saving to disk - API-first architecture
    return this.cloneThread(toSave);
  }

  public async loadThread(threadId: string): Promise<Thread | null> {
    // Check cache first
    const cachedThread = this.threadsById.get(threadId);
    if (cachedThread) {
      log.info('[ThreadRepository] Thread found in cache:', threadId, 'with', cachedThread.messages.length, 'messages');

      // If thread is in cache but has no messages, we need to load them from API
      // This happens when listThreads() cached the thread without messages
      if (cachedThread.messages.length === 0) {
        log.info('[ThreadRepository] Thread has no messages, fetching from API');
        try {
          const messagesResponse = await threadApiService.getMessages(threadId, { size: 1000 });
          log.info('[ThreadRepository] API response:', JSON.stringify(messagesResponse, null, 2));
          log.info('[ThreadRepository] Received', messagesResponse.content.length, 'message DTOs from API');

          messagesResponse.content.forEach((dto, index) => {
            const contentPreview = typeof dto.content === 'string'
              ? dto.content.substring(0, 100)
              : JSON.stringify(dto.content).substring(0, 100);
            log.info(`[ThreadRepository] DTO ${index}: id=${dto.id}, role=${dto.role}, contentType=${typeof dto.content}, contentPreview="${contentPreview}"`);
          });

          cachedThread.messages = messagesResponse.content.map((dto) =>
            this.mapDTOToMessage(dto, cachedThread.title),
          );

          log.info('[ThreadRepository] Mapped messages:', cachedThread.messages.length);
          cachedThread.messages.forEach((msg, index) => {
            const contentPreview = msg.content.substring(0, 100);
            log.info(`[ThreadRepository] Mapped ${index}: id=${msg.id}, role=${msg.role}, contentLength=${msg.content.length}, contentPreview="${contentPreview}"`);
          });

          this.threadsById.set(threadId, cachedThread);
          log.info('[ThreadRepository] Loaded', cachedThread.messages.length, 'messages for cached thread');
        } catch (error) {
          log.error('[ThreadRepository] Failed to load messages for cached thread:', error);
        }
      }

      return this.cloneThread(cachedThread);
    }

    // Fetch from API
    try {
      log.info('[ThreadRepository] Fetching thread from API:', threadId);
      const threadDTO = await threadApiService.getThread(threadId);

      log.info('[ThreadRepository] ThreadDTO received from API:', JSON.stringify(threadDTO, null, 2));
      log.info('[ThreadRepository] Metadata in ThreadDTO:', JSON.stringify(threadDTO.metadata, null, 2));

      const desktopDTO = this.toDesktopThreadDTO(threadDTO);
      const thread = this.mapDTOToThread(desktopDTO);

      log.info('[ThreadRepository] Mapped thread metadata:', JSON.stringify(thread.metadata, null, 2));

      // Fetch messages for the thread
      log.info('[ThreadRepository] Fetching messages for thread:', threadId);
      const messagesResponse = await threadApiService.getMessages(threadId, { size: 1000 });
      log.info('[ThreadRepository] API response:', JSON.stringify(messagesResponse, null, 2));
      log.info('[ThreadRepository] Received', messagesResponse.content.length, 'message DTOs from API');

      messagesResponse.content.forEach((dto, index) => {
        const contentPreview = typeof dto.content === 'string'
          ? dto.content.substring(0, 100)
          : JSON.stringify(dto.content).substring(0, 100);
        log.info(`[ThreadRepository] DTO ${index}: id=${dto.id}, role=${dto.role}, contentType=${typeof dto.content}, contentPreview="${contentPreview}"`);
      });

      thread.messages = messagesResponse.content.map((dto) =>
        this.mapDTOToMessage(dto, thread.title),
      );

      log.info('[ThreadRepository] Mapped messages:', thread.messages.length);
      thread.messages.forEach((msg, index) => {
        const contentPreview = msg.content.substring(0, 100);
        log.info(`[ThreadRepository] Mapped ${index}: id=${msg.id}, role=${msg.role}, contentLength=${msg.content.length}, contentPreview="${contentPreview}"`);
      });

      // Update cache
      this.threadsById.set(thread.id, thread);
      log.info('[ThreadRepository] Thread fetched and cached:', threadId, 'with', thread.messages.length, 'messages');

      return this.cloneThread(thread);
    } catch (error) {
      log.error('[ThreadRepository] Failed to load thread:', error);
      return null;
    }
  }

  public async listThreads(options?: { projectId?: string; page?: number; size?: number }): Promise<Thread[]> {
    try {
      const response = await threadApiService.getThreads({
        type: options?.projectId ? 'project' : undefined,
        projectId: options?.projectId,
        page: options?.page || 0,
        size: options?.size || 50,
        sort: 'createdAt,desc',
      });

      const threads = response.content.map((dto) => {
        const desktopDTO = this.toDesktopThreadDTO(dto);
        return this.mapDTOToThread(desktopDTO);
      });

      // Update cache
      threads.forEach((thread) => this.threadsById.set(thread.id, thread));

      return threads.map((t) => this.cloneThread(t));
    } catch (error) {
      log.error('[ThreadRepository] Failed to list threads:', error);
      return [];
    }
  }

  /**
   * Get total thread count for a project.
   *
   * Uses the threads list endpoint and reads `totalElements` to avoid paging through all results.
   */
  public async getProjectThreadCount(projectId: string): Promise<number> {
    try {
      const response = await threadApiService.getThreads({
        type: 'project',
        projectId,
        page: 0,
        size: 1,
        sort: 'createdAt,desc',
      });

      return response.totalElements;
    } catch (error) {
      log.error('[ThreadRepository] Failed to get project thread count:', error);
      return 0;
    }
  }

  public async addMessage(threadId: string, role: MessageRole, content: string): Promise<Message> {
    // Get thread to use its current branchId
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    
    return this.appendMessage(threadId, {
      role,
      content,
      branchId: thread.currentBranchId,
    });
  }

  /**
   * Create message locally without API call
   * Messages are created when chat function is called, not via API
   */
  public async appendMessageLocal(
    threadId: string,
    payload: {
      role: MessageRole;
      content: string;
      metadata?: Record<string, unknown>;
      clientMessageId?: string;
      branchId?: string;
      modelId?: string | null;
    },
  ): Promise<Message> {
    // Check local idempotency cache first
    if (payload.clientMessageId) {
      const byThread = this.idempotencyIndex.get(threadId);
      const existingId = byThread?.get(payload.clientMessageId);
      if (existingId) {
        const thread = this.threadsById.get(threadId);
        const found = thread?.messages.find((m) => m.id === existingId);
        if (found) {
          log.info('[ThreadRepository] Message found in local idempotency cache:', existingId);
          return { ...found };
        }
      }
    }

    // Content size check
    const contentBytes = Buffer.byteLength(payload.content ?? '', 'utf8');
    if (contentBytes > 8 * 1024) throw new Error('MESSAGE_TOO_LARGE');

    // Get thread from cache or fetch it
    let thread = this.threadsById.get(threadId);
    if (!thread) {
      log.info('[ThreadRepository] Thread not in cache, fetching:', threadId);
      const loadedThread = await this.loadThread(threadId);
      if (!loadedThread) throw new Error(`Thread not found: ${threadId}`);
      thread = loadedThread;
    }

    // Create message locally (no API call)
    const now = Date.now();
    const branchId = payload.branchId ?? thread.currentBranchId;
    const message: Message = {
      id: crypto.randomUUID(), // Generate local ID
      title: thread.title,
      role: payload.role,
      content: payload.content,
      createdAt: now,
      metadata: payload.metadata as MessageMetadata | undefined,
      clientMessageId: payload.clientMessageId,
      deletedAt: null,
      branchId: branchId,
      modelId: payload.modelId ?? null,
    };

    log.info('[ThreadRepository] Created message locally:', message.id, 'branchId:', branchId);

    // Update local cache
    thread.messages.push(message);
    thread.updatedAt = now;
    this.threadsById.set(thread.id, thread);

    // Update idempotency index
    if (payload.clientMessageId) {
      let byThread = this.idempotencyIndex.get(threadId);
      if (!byThread) {
        byThread = new Map();
        this.idempotencyIndex.set(threadId, byThread);
      }
      byThread.set(payload.clientMessageId, message.id);
    }

    return { ...message };
  }

  /**
   * @deprecated Use appendMessageLocal instead. Messages are now created locally when chat is called.
   * This method now delegates to appendMessageLocal for local-only creation.
   */
  public async appendMessage(
    threadId: string,
    payload: {
      role: MessageRole;
      content: string;
      metadata?: Record<string, unknown>;
      clientMessageId?: string;
      branchId?: string; // Use thread's currentBranchId if not provided
      modelId?: string | null;
    },
  ): Promise<Message> {
    // Check local idempotency cache first
    if (payload.clientMessageId) {
      const byThread = this.idempotencyIndex.get(threadId);
      const existingId = byThread?.get(payload.clientMessageId);
      if (existingId) {
        const thread = this.threadsById.get(threadId);
        const found = thread?.messages.find((m) => m.id === existingId);
        if (found) {
          log.info('[ThreadRepository] Message found in local idempotency cache:', existingId);
          return { ...found };
        }
      }
    }

    // Content size check
    const contentBytes = Buffer.byteLength(payload.content ?? '', 'utf8');
    if (contentBytes > 8 * 1024) throw new Error('MESSAGE_TOO_LARGE');

    // Get thread from cache or fetch it
    let thread = this.threadsById.get(threadId);
    if (!thread) {
      log.info('[ThreadRepository] Thread not in cache, fetching:', threadId);
      const loadedThread = await this.loadThread(threadId);
      if (!loadedThread) throw new Error(`Thread not found: ${threadId}`);
      thread = loadedThread;
    }

    // Delegate to appendMessageLocal for local-only creation
    return this.appendMessageLocal(threadId, payload);
  }

  /**
   * Duplicate an existing message within the same thread by message id.
   * Preserves exact content and metadata. Only user prompts may be duplicated.
   */
  public async duplicateMessage(threadId: string, messageId: string): Promise<Message> {
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

  public async addUserPrompt(
    threadId: string | null | undefined,
    prompt: string,
    opts: ThreadMetadata = {},
  ): Promise<{ thread: Thread; message: Message }> {
    let tid = threadId;
    if (!tid) {
      const th = await this.createThread(opts);
      tid = th.id;
    }
    
    // Get thread to use its current branchId
    const thread = this.threadsById.get(tid);
    if (!thread) throw new Error(`Thread not found: ${tid}`);
    
    // Use appendMessage directly
    const message = await this.appendMessage(tid, {
      role: 'user',
      content: prompt,
      branchId: thread.currentBranchId,
    });
    
    const updatedThread = await this.loadThread(tid);
    if (!updatedThread) throw new Error(`Thread disappeared after creation: ${tid}`);
    return { thread: updatedThread, message };
  }

  public async addAssistantResponse(threadId: string, response: string, model?: string): Promise<Message> {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    if (model) {
      thread.metadata = { ...thread.metadata, model };
      thread.updatedAt = Date.now();
      this.threadsById.set(thread.id, thread);
    }

    // Check if this is the first assistant response and thread needs a title
    const assistantMessageCount = thread.messages.filter((m) => m.role === 'assistant').length;
    const isFirstResponse = assistantMessageCount === 0;
    const needsTitle = !thread.title || thread.title.trim() === '';

    log.info(
      `[ThreadRepository] Auto-title check for thread ${threadId}: assistantCount=${assistantMessageCount}, isFirst=${isFirstResponse}, needsTitle=${needsTitle}, currentTitle="${thread.title}"`,
    );

    // Auto-generate title from first user prompt if this is the first response
    if (isFirstResponse && needsTitle) {
      const firstUserPrompt = thread.messages.find((m) => m.role === 'user');
      log.info(
        `[ThreadRepository] Found first user prompt: ${firstUserPrompt ? `"${firstUserPrompt.content.substring(0, 50)}..."` : 'NONE'}`,
      );

      if (firstUserPrompt && firstUserPrompt.content) {
        try {
          // Get existing titles for uniqueness checking
          const existingTitles = Array.from(this.threadsById.values())
            .filter((t) => t.id !== threadId)
            .map((t) => t.title);

          // Generate and ensure unique title
          const candidateTitle = titleGeneratorService.generateTitle(firstUserPrompt.content);
          log.info(`[ThreadRepository] Generated candidate title: "${candidateTitle}"`);

          const uniqueTitle = titleGeneratorService.ensureUniqueTitle(
            candidateTitle,
            existingTitles,
          );

          // Update thread title locally
          thread.title = uniqueTitle;
          thread.metadata = { ...thread.metadata, title: uniqueTitle };
          thread.updatedAt = Date.now();
          this.threadsById.set(thread.id, thread);

          // Update title via API
          try {
            await threadApiService.updateThread(threadId, { title: uniqueTitle });
            log.info(
              `[ThreadRepository] ✅ Auto-generated and updated title for thread ${threadId}: "${uniqueTitle}"`,
            );
          } catch (error) {
            log.error('[ThreadRepository] Failed to update title via API:', error);
            // Continue with local title change
          }
        } catch (error) {
          log.error('[ThreadRepository] ❌ Failed to generate title:', error);
          // Continue without title - addMessage will still work
        }
      } else {
        log.warn(`[ThreadRepository] ⚠️ Cannot generate title - no user prompt found`);
      }
    } else {
      log.info(
        `[ThreadRepository] Skipping auto-title: isFirst=${isFirstResponse}, needsTitle=${needsTitle}`,
      );
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
    // Note: No longer saving to disk - API-first architecture
    return this.cloneThread(thread);
  }

  /**
   * Assign/unassign a thread to/from a project (persists via API).
   *
   * @param threadId - Thread ID
   * @param projectId - Target project ID or null to unassign
   */
  public async setThreadProjectId(threadId: string, projectId: string | null): Promise<Thread> {
    const thread = this.threadsById.get(threadId) ?? (await this.loadThread(threadId));
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const nextMetadata: ThreadMetadata = { ...(thread.metadata ?? {}) };
    nextMetadata.projectId = projectId;
    // Keep type consistent for downstream filtering/UI
    nextMetadata.type = projectId ? 'project' : 'personal';

    try {
      await threadApiService.updateThread(threadId, {
        projectId,
        metadata: nextMetadata as Record<string, unknown>,
      });
    } catch (error) {
      log.error('[ThreadRepository] Failed to update thread project assignment via API:', error);
      // Still update local cache so UI isn't stuck; next fetch may reconcile
    }

    const updatedLocal = this.updateThreadMetadata(threadId, nextMetadata);
    return this.cloneThread(updatedLocal);
  }

  /**
   * Rename a thread with title history tracking
   * @param threadId - The thread ID to rename
   * @param newTitle - The new title (will be validated)
   * @param userId - Optional user ID who performed the rename
   * @returns The updated thread
   * @throws Error if thread not found or title is invalid
   */
  public async renameThread(threadId: string, newTitle: string, userId?: string): Promise<Thread> {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    // Basic validation (more comprehensive validation should be done by TitleValidationService)
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle.length === 0) {
      throw new Error('TITLE_EMPTY');
    }
    if (trimmedTitle.length > 200) {
      throw new Error('TITLE_TOO_LONG');
    }

    // Don't do anything if title hasn't changed
    if (thread.title === trimmedTitle) {
      return this.cloneThread(thread);
    }

    const previousTitle = thread.title;
    const now = Date.now();

    // Create title history entry
    const historyEntry: TitleHistoryEntry = {
      title: trimmedTitle,
      timestamp: now,
      previousTitle,
      userId,
    };

    // Initialize titleHistory if it doesn't exist
    const titleHistory = Array.isArray(thread.metadata?.titleHistory)
      ? [...thread.metadata.titleHistory]
      : [];

    // Add new entry to history
    titleHistory.push(historyEntry);

    try {
      log.info('[ThreadRepository] Renaming thread via API:', threadId);
      await threadApiService.updateThread(threadId, { title: trimmedTitle });

      // Update local cache
      thread.title = trimmedTitle;
      thread.metadata = {
        ...thread.metadata,
        title: trimmedTitle,
        titleHistory,
      };
      thread.updatedAt = now;

      this.threadsById.set(thread.id, thread);

      log.info(
        `[ThreadRepository] ✅ Renamed thread ${threadId}: "${previousTitle}" → "${trimmedTitle}"`,
      );

      return this.cloneThread(thread);
    } catch (error) {
      log.error('[ThreadRepository] Failed to rename thread:', error);
      throw error;
    }
  }

  /**
   * Undo the most recent rename operation for a thread
   * @param threadId - The thread ID to undo rename
   * @returns The updated thread with previous title restored
   * @throws Error if thread not found or no rename history available
   */
  public async undoRenameThread(threadId: string): Promise<Thread> {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const titleHistory = thread.metadata?.titleHistory;
    if (!Array.isArray(titleHistory) || titleHistory.length === 0) {
      throw new Error('NO_RENAME_HISTORY');
    }

    // Get the most recent rename entry
    const lastEntry = titleHistory[titleHistory.length - 1];
    const previousTitle = lastEntry.previousTitle;

    // Remove the last entry from history
    const updatedHistory = titleHistory.slice(0, -1);

    try {
      log.info('[ThreadRepository] Undoing rename via API:', threadId);
      await threadApiService.updateThread(threadId, { title: previousTitle });

      // Update local cache
      const now = Date.now();
      thread.title = previousTitle;
      thread.metadata = {
        ...thread.metadata,
        title: previousTitle,
        titleHistory: updatedHistory,
      };
      thread.updatedAt = now;

      this.threadsById.set(thread.id, thread);

      log.info(
        `[ThreadRepository] ↩️  Undid rename for thread ${threadId}: "${lastEntry.title}" → "${previousTitle}"`,
      );

      return this.cloneThread(thread);
    } catch (error) {
      log.error('[ThreadRepository] Failed to undo rename:', error);
      throw error;
    }
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

  public async savePromptAndResponses(
    threadId: string | null | undefined,
    prompt: string,
    responses: { text: string; model?: string }[],
    opts: { title?: string; description?: string } = {},
  ): Promise<{ thread: Thread; promptMessage: Message; responseMessages: Message[] }> {
    const { thread, message: promptMessage } = await this.addUserPrompt(threadId, prompt, opts);
    const responseMessages: Message[] = [];
    for (const r of responses) {
      const resp = await this.addAssistantResponse(thread.id, r.text, r.model);
      responseMessages.push(resp);
    }
    const t = await this.loadThread(thread.id);
    if (!t) throw new Error(`Thread not found after save: ${thread.id}`);
    return { thread: t, promptMessage, responseMessages };
  }

  public replaceMessages(threadId: string, messages: Message[]): Thread {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.messages = messages.map((m) => ({ ...m }));
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    // Note: No longer saving to disk - API-first architecture
    return this.cloneThread(thread);
  }

  public async deleteThread(threadId: string): Promise<boolean> {
    // Delete associated files before deleting thread
    fileStorageService.deleteThreadFiles(threadId).catch((error) => {
      console.error('[ThreadRepository] Failed to delete thread files:', error);
      // Continue with thread deletion even if file deletion fails
    });

    try {
      log.info('[ThreadRepository] Deleting thread via API:', threadId);
      await threadApiService.deleteThread(threadId);

      // Remove from local cache
      const deleted = this.threadsById.delete(threadId);
      log.info('[ThreadRepository] Thread deleted:', threadId);
      return deleted;
    } catch (error) {
      log.error('[ThreadRepository] Failed to delete thread:', error);
      return false;
    }
  }

  public async softDeleteThread(threadId: string): Promise<boolean> {
    const thread = this.threadsById.get(threadId);
    if (!thread) return false;

    // Delete associated files on soft delete as well
    fileStorageService.deleteThreadFiles(threadId).catch((error) => {
      console.error('[ThreadRepository] Failed to delete thread files:', error);
      // Continue with soft delete even if file deletion fails
    });

    try {
      log.info('[ThreadRepository] Soft deleting thread via API:', threadId);
      await threadApiService.deleteThread(threadId);

      // Update local cache
      thread.deletedAt = Date.now();
      thread.metadata = { ...thread.metadata, status: 'deleted' };
      thread.updatedAt = Date.now();
      this.threadsById.set(thread.id, thread);

      log.info('[ThreadRepository] Thread soft deleted:', threadId);
      return true;
    } catch (error) {
      log.error('[ThreadRepository] Failed to soft delete thread:', error);
      return false;
    }
  }

  public clearAll(): void {
    this.threadsById.clear();
    this.idempotencyIndex.clear();
    // Note: No longer saving to disk - API-first architecture
  }

  public setThreadTimestamps(threadId: string, createdAt: number, updatedAt: number): Thread {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.createdAt = createdAt;
    thread.updatedAt = updatedAt;
    this.threadsById.set(thread.id, thread);
    // Note: No longer saving to disk - API-first architecture
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
    // Note: No longer saving to disk - API-first architecture

    return {
      ...message,
      isEdited: true,
      editedAt: message.editedAt,
      versions: message.versions ? [...message.versions] : [],
    };
  }

  /**
   * Update message metadata (e.g., for adding/editing comments)
   */
  public updateMessageMetadata(
    threadId: string,
    messageId: string,
    metadataUpdates: Partial<MessageMetadata>,
  ): Message {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const message = thread.messages.find((m) => m.id === messageId);
    if (!message) throw new Error(`Message not found: ${messageId}`);

    // Merge metadata updates
    if (!message.metadata) {
      message.metadata = {};
    }
    message.metadata = {
      ...message.metadata,
      ...metadataUpdates,
    };

    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);
    // Note: No longer saving to disk - API-first architecture

    return {
      ...message,
      metadata: message.metadata ? { ...message.metadata } : undefined,
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
    // Note: No longer saving to disk - API-first architecture
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
    // Note: No longer saving to disk - API-first architecture
  }

  /**
   * Get a single message by ID within a thread.
   * Used for tree traversal operations.
   */
  public getMessage(threadId: string, messageId: string): Message | null {
    const thread = this.threadsById.get(threadId);
    if (!thread) return null;
    const message = thread.messages.find((m) => m.id === messageId);
    return message ? { ...message } : null;
  }

  /**
   * Get all messages for a specific branchId.
   * Returns messages that belong to this branch.
   */
  public getMessagesByBranchId(threadId: string, branchId: string): Message[] {
    const thread = this.threadsById.get(threadId);
    if (!thread) return [];
    return thread.messages
      .filter((m) => m.branchId === branchId)
      .map((m) => ({ ...m }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get all branch variations for a base branchId.
   * E.g., for "1.0", returns all "1.0.1", "1.0.2", etc.
   */
  public getBranchesForMessage(threadId: string, messageId: string): Message[] {
    const thread = this.threadsById.get(threadId);
    if (!thread) return [];
    const message = thread.messages.find((m) => m.id === messageId);
    if (!message) return [];

    const baseBranchId = message.branchId;
    const baseDepth = baseBranchId.split('.').length;

    // Find all messages that are direct variations of this branch
    return thread.messages
      .filter((m) => {
        const parts = m.branchId.split('.');
        // Must be exactly one level deeper
        if (parts.length !== baseDepth + 1) return false;
        return m.branchId.startsWith(baseBranchId + '.');
      })
      .map((m) => ({ ...m }))
      .sort((a, b) => a.branchId.localeCompare(b.branchId));
  }

  /**
   * Get all root messages in a thread (messages with branchId = "1.0").
   */
  public getRootMessages(threadId: string): Message[] {
    const thread = this.threadsById.get(threadId);
    if (!thread) return [];
    return thread.messages
      .filter((m) => m.branchId === '1.0')
      .map((m) => ({ ...m }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Switch active branch for a thread
   */
  public async switchBranch(threadId: string, branchId: string): Promise<Thread | null> {
    const thread = this.threadsById.get(threadId);
    if (!thread) {
      log.warn('[ThreadRepository] Thread not found for switchBranch:', threadId);
      return null;
    }

    // Update current branch in metadata
    thread.currentBranchId = branchId;
    thread.metadata = { ...thread.metadata, currentBranchId: branchId };
    thread.updatedAt = Date.now();

    // Update in API
    try {
      const updateRequest: UpdateThreadRequest = {
        metadata: thread.metadata,
      };
      await threadApiService.updateThread(threadId, updateRequest);
      log.info('[ThreadRepository] Switched to branch:', branchId, 'for thread:', threadId);
    } catch (error) {
      log.error('[ThreadRepository] Failed to update branch in API:', error);
      // Continue anyway - local state is updated
    }

    // Update cache
    this.threadsById.set(threadId, thread);

    return this.cloneThread(thread);
  }

  /**
   * Delete a branch (removes from local cache only, messages remain in API)
   */
  public deleteBranch(threadId: string, branchId: string): void {
    const thread = this.threadsById.get(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    // Cannot delete main branch
    if (branchId === '1.0') {
      throw new Error('Cannot delete main branch');
    }

    // Cannot delete currently active branch
    if (thread.currentBranchId === branchId) {
      throw new Error('Cannot delete active branch. Switch to another branch first.');
    }

    // Remove messages from local cache only
    // Messages remain in API but won't be displayed when thread loads
    const branchPrefix = `${branchId}.`;
    thread.messages = thread.messages.filter(
      (m) => m.branchId !== branchId && !m.branchId.startsWith(branchPrefix),
    );
    thread.updatedAt = Date.now();

    this.threadsById.set(threadId, thread);
    log.info('[ThreadRepository] Deleted branch from cache:', branchId);
  }

  /**
   * Convert ThreadDTO from Moku API to DesktopThreadDTO by extracting currentBranchId
   */
  private toDesktopThreadDTO(dto: ThreadDTO): DesktopThreadDTO {
    const currentBranchId = (dto.metadata?.currentBranchId as string) || '1.0';
    return {
      ...dto,
      currentBranchId,
    };
  }

  /**
   * Map DesktopThreadDTO to internal Thread model.
   * Converts ISO-8601 timestamps to epoch milliseconds.
   * Preserves custom metadata from API (including model configuration).
   */
  private mapDTOToThread(dto: DesktopThreadDTO): Thread {
    return {
      id: dto.id,
      title: dto.title,
      metadata: {
        // Standard fields
        type: dto.type,
        projectId: dto.projectId,
        status: dto.status,
        // Merge in custom metadata from API (provider, modelAccessName, url, etc.)
        ...(dto.metadata || {}),
      },
      messages: [], // Messages loaded separately
      createdAt: new Date(dto.createdAt).getTime(),
      updatedAt: new Date(dto.updatedAt).getTime(),
      deletedAt: dto.status === 'deleted' ? Date.now() : null,
      currentBranchId: dto.currentBranchId,
    };
  }

  /**
   * Map MessageDTO from API to internal Message model.
   * Converts ISO-8601 timestamps to epoch milliseconds.
   */
  private mapDTOToMessage(dto: MessageDTO, threadTitle: string): Message {
    // Extract branchId from dto.branchId or from options.branch_id
    let branchId = dto.branchId;
    if (!branchId && dto.options?.branch_id) {
      branchId = dto.options.branch_id;
    }
    // Fallback to "1.0" for legacy messages without branchId
    if (!branchId) {
      branchId = '1.0';
      log.warn('[ThreadRepository] Message missing branchId, defaulting to "1.0":', dto.id);
    }

    log.info(`[ThreadRepository] Mapping message ${dto.id}: branchId=${branchId}, role=${dto.role}, contentLength=${dto.content.length}`);

    return {
      id: dto.id,
      title: threadTitle,
      role: dto.role as MessageRole,
      content: dto.content,
      createdAt: new Date(dto.createdAt).getTime(),
      metadata: dto.metadata as MessageMetadata | undefined,
      deletedAt: null,
      editedAt: dto.updatedAt !== dto.createdAt ? new Date(dto.updatedAt).getTime() : undefined,
      branchId: branchId,
      modelId: dto.model ?? null,
    };
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
      currentBranchId: thread.currentBranchId,
    };
  }

  /**
   * @deprecated No longer used - API-first architecture.
   * Threads are fetched from Moku API on demand.
   * Kept for backward compatibility.
   */
  private getStorePath(): string | null {
    return null;
  }

  /**
   * @deprecated No longer used - API-first architecture.
   * All thread operations now persist to Moku API directly.
   * Kept for backward compatibility but does nothing.
   */
  private saveToDisk(): void {
    // No-op: API-first architecture - threads persist via API calls
  }

  /**
   * @deprecated No longer used - API-first architecture.
   * Threads are fetched from Moku API via loadThread/listThreads.
   * Kept for backward compatibility but does nothing.
   */
  private loadFromDisk(): void {
    // No-op: API-first architecture - threads loaded via API calls
  }
}

export const threadRepository = new ThreadRepository();

export default ThreadRepository;
