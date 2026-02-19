/* eslint-disable security/detect-object-injection */
import log from 'electron-log';
import { Message, ThreadMetadata, Thread, JsonValue } from '../types/thread.types.js';
import type { Attachment } from '../../src-shared/types/attachment.types.js';
import { fileStorageService } from '../services/file-storage.service.js';
import { titleGeneratorService } from '../services/title-generator.service.js';
import { threadApiService } from '../services/mokuapi/thread-api.service.js';
import type {
  ThreadDTO,
  MessageDTO,
  CreateThreadRequest,
  UpdateThreadRequest,
} from '../services/mokuapi/thread.types.js';
import type { MessageRole } from '../types/thread.types.js';

export class ThreadRepository {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  // API-first architecture - no longer loading from local disk
  // Threads are fetched from Moku API on demand
  private readonly threadsById: Map<string, Thread> = new Map();
  private readonly idempotencyIndex: Map<string, Map<string, string>> = new Map();

  private parseApiTimeMs(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value !== 'string') return Number.NaN;

    const s = value.trim();
    if (s.length === 0) return Number.NaN;

    // Normalize common server formats that omit timezone.
    // - "2026-01-20 17:02:02.123" -> "2026-01-20T17:02:02.123"
    // - If no timezone is present, treat as UTC by appending "Z"
    const isoLike = s.includes(' ') && !s.includes('T') ? s.replace(' ', 'T') : s;
    const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(isoLike);
    const normalized = hasTz ? isoLike : `${isoLike}Z`;

    return new Date(normalized).getTime();
  }

  public async createThread(newRequest: CreateThreadRequest): Promise<Thread> {
    log.info('[ThreadRepository] Creating thread via API:', newRequest.title);
    log.info('[ThreadRepository] Metadata being sent to API:', JSON.stringify(newRequest, null, 2));

    const threadDTO = await threadApiService.createThread(newRequest);

    // log.info('[ThreadRepository] ThreadDTO received from API:', JSON.stringify(threadDTO, null, 2));
    // log.info(
    //   '[ThreadRepository] Metadata in ThreadDTO:',
    //   JSON.stringify(threadDTO.metadata, null, 2),
    // );

    const thread = this.mapDTOToThread(threadDTO);

    // log.info(
    //   '[ThreadRepository] Mapped thread metadata:',
    //   JSON.stringify(thread.metadata, null, 2),
    // );

    // Cache locally for session
    this.threadsById.set(thread.id, thread);
    // log.info('[ThreadRepository] Thread created and cached:', thread.id);

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
    // Note: No longer saving to disk - API-first architecture
    return this.cloneThread(toSave);
  }

  /**
   * Filter out duplicate audit records from tool-loop continuations.
   * When a chat request uses tools, the audit service records:
   * 1. Initial request with user message
   * 2. Continuation request(s) with tool results
   *
   * This function keeps only the initial request and filters out continuations,
   * which are identified by having the same content and branch_id as a previous message.
   */
  private deduplicateToolLoopMessages(messageDTOs: MessageDTO[]): MessageDTO[] {
    const seen = new Map<string, MessageDTO>();
    const filtered: MessageDTO[] = [];

    for (const dto of messageDTOs) {
      const branchId =
        (dto.options as { branch_id?: string } | null)?.branch_id ?? dto.branchId ?? '1.0';
      // Create key from role, content, and branchId to catch all duplicates
      const key = `${dto.role}:${String(dto.content)}:${branchId}`;

      // Check if we've seen this exact message on this branch before
      if (seen.has(key)) {
        const existing = seen.get(key);
        if (!existing) continue;

        // Keep the earlier timestamp (initial request, not continuation)
        const existingTime = this.parseApiTimeMs(existing.createdAt);
        const currentTime = this.parseApiTimeMs(dto.createdAt);

        if (currentTime < existingTime) {
          // Current is earlier, replace the existing one
          const index = filtered.indexOf(existing);
          if (index !== -1) {
            filtered[index] = dto;
          }
          seen.set(key, dto);
        }
        // else: Existing is earlier, skip current (it's a duplicate)
        log.info('[ThreadRepository] Skipping duplicate message:', {
          role: dto.role,
          branchId,
          contentPreview:
            dto.content && typeof dto.content === 'string'
              ? dto.content.substring(0, 50)
              : '(empty)',
        });
      } else {
        // First time seeing this message
        seen.set(key, dto);
        filtered.push(dto);
      }
    }

    // log.info('[ThreadRepository] Deduplication:', {
    //   original: messageDTOs.length,
    //   filtered: filtered.length,
    //   removed: messageDTOs.length - filtered.length,
    // });

    return filtered;
  }

  public async loadThread(threadId: string): Promise<Thread | null> {
    // Check cache first
    const cachedThread = this.threadsById.get(threadId);
    if (cachedThread) {
      // log.info(
      //   '[ThreadRepository] Thread found in cache (refreshing messages from API):',
      //   threadId,
      //   'with',
      //   cachedThread.messages.length,
      //   'cached messages',
      // );

      const cachedMessagesCount = cachedThread.messages.length;
      try {
        const messagesResponse = await threadApiService.getMessages(threadId, { size: 1000 });
        // log.info(
        //   '[ThreadRepository] Received',
        //   messagesResponse.content.length,
        //   'message DTOs from API for cached thread',
        // );

        // Deduplicate tool-loop continuation messages
        const dedupedMessages = this.deduplicateToolLoopMessages(messagesResponse.content);

        // If API returned messages, use them. Otherwise, if cache has messages, keep them (local-only not yet synced)
        if (dedupedMessages.length > 0) {
          cachedThread.messages = dedupedMessages.map((dto) =>
            this.mapDTOToMessage(dto, cachedThread.title),
          );
          // Insert placeholder user messages for orphan assistant messages
          this.insertPlaceholderUserMessages(cachedThread.messages);
          // Process guard messages and mark them as hidden
          this.processGuardMessages(cachedThread.messages);
          this.threadsById.set(threadId, cachedThread);
          // log.info(
          //   '[ThreadRepository] Refreshed',
          //   cachedThread.messages.length,
          //   'messages for cached thread',
          // );
        } else if (cachedMessagesCount > 0) {
          // API returned empty but cache has messages - keep cached messages (likely local-only)
          // log.info(
          //   '[ThreadRepository] API returned empty, keeping',
          //   cachedMessagesCount,
          //   'cached messages (likely local-only not yet synced)',
          // );
        }
      } catch (error) {
        log.error('[ThreadRepository] Failed to refresh messages for cached thread:', error);
        // On error, keep cached messages if they exist
        if (cachedMessagesCount > 0) {
          // log.info('[ThreadRepository] Keeping cached messages due to API error');
        }
      }

      return this.cloneThread(cachedThread);
    }

    // Fetch from API
    try {
      // log.info('[ThreadRepository] Fetching thread from API:', threadId);
      const threadDTO = await threadApiService.getThread(threadId);

      // log.info(
      //   '[ThreadRepository] ThreadDTO received from API:',
      //   JSON.stringify(threadDTO, null, 2),
      // );
      // log.info(
      //   '[ThreadRepository] Metadata in ThreadDTO:',
      //   JSON.stringify(threadDTO.metadata, null, 2),
      // );

      const thread = this.mapDTOToThread(threadDTO);

      // log.info(
      //   '[ThreadRepository] Mapped thread metadata:',
      //   JSON.stringify(thread.metadata, null, 2),
      // );

      // Fetch messages for the thread
      // log.info('[ThreadRepository] Fetching messages for thread:', threadId);
      const messagesResponse = await threadApiService.getMessages(threadId, { size: 1000 });
      // log.info(
      //   '[ThreadRepository] Received',
      //   messagesResponse.content.length,
      //   'message DTOs from API',
      // );

      // Deduplicate tool-loop continuation messages
      const dedupedMessages = this.deduplicateToolLoopMessages(messagesResponse.content);

      thread.messages = dedupedMessages.map((dto) => this.mapDTOToMessage(dto, thread.title));

      // Insert placeholder user messages for orphan assistant messages
      this.insertPlaceholderUserMessages(thread.messages);

      // Process guard messages and mark them as hidden
      this.processGuardMessages(thread.messages);

      // Update cache
      this.threadsById.set(thread.id, thread);
      // log.info(
      //   '[ThreadRepository] Thread fetched and cached:',
      //   threadId,
      //   'with',
      //   thread.messages.length,
      //   'messages',
      // );

      return this.cloneThread(thread);
    } catch (error) {
      log.error('[ThreadRepository] Failed to load thread:', error);
      return null;
    }
  }

  /**
   * Get messages for a thread from cache without fetching from API.
   * If thread is not cached, loads it first (which will fetch from API).
   * This method is optimized to avoid redundant API calls when messages are already loaded.
   */
  public async getMessages(threadId: string): Promise<Message[]> {
    const cachedThread = this.threadsById.get(threadId);
    if (cachedThread) {
      // Return cached messages without API call
      // log.info(
      //   '[ThreadRepository] getMessages - returning',
      //   cachedThread.messages.length,
      //   'cached messages',
      // );
      return cachedThread.messages.map((m) => ({ ...m }));
    }

    // Not cached - load the thread (which will fetch messages)
    // log.info('[ThreadRepository] getMessages - thread not cached, loading from API');
    const thread = await this.loadThread(threadId);
    if (!thread) return [];
    return thread.messages.map((m) => ({ ...m }));
  }

  public async listThreads(options?: {
    projectId?: string;
    page?: number;
    size?: number;
  }): Promise<Thread[]> {
    try {
      const response = await threadApiService.getThreads({
        type: options?.projectId ? 'project' : undefined,
        projectId: options?.projectId,
        page: options?.page || 0,
        size: options?.size || 50,
        sort: 'createdAt,desc',
      });

      const threads = response.content.map((dto) => {
        return this.mapDTOToThread(dto);
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

  public async addMessage(
    threadId: string,
    role: MessageRole,
    branchId: string,
    content: string,
  ): Promise<Message> {
    // Get thread to use its current branchId
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    return this.appendMessage(threadId, {
      role,
      content,
      branchId,
      provider: thread.metadata.initialProvider ?? '',
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
      provider?: string | null;
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
          // log.info('[ThreadRepository] Message found in local idempotency cache:', existingId);
          return { ...found };
        }
      }
    }

    // Content size check
    const contentBytes = Buffer.byteLength(payload.content ?? '', 'utf8');
    if (contentBytes > this.MAX_FILE_SIZE) throw new Error('MESSAGE_TOO_LARGE');

    // Get thread from cache or fetch it
    let thread = this.threadsById.get(threadId);
    if (!thread) {
      // log.info('[ThreadRepository] Thread not in cache, fetching:', threadId);
      const loadedThread = await this.loadThread(threadId);
      if (!loadedThread) throw new Error(`Thread not found: ${threadId}`);
      thread = loadedThread;
    }

    // Create message locally (no API call)
    // Calculate timestamp to ensure new messages always appear after existing ones
    const localNow = Date.now();
    const lastMessageTime =
      thread.messages.length > 0 ? Math.max(...thread.messages.map((m) => m.createdAt)) : localNow;
    const now = Math.max(localNow, lastMessageTime + 1000); // Add 1 second to ensure it's after

    // log.info(
    //   '[ThreadRepository] Creating message with timestamp:',
    //   new Date(now).toISOString(),
    //   '(local:',
    //   new Date(localNow).toISOString(),
    //   ', last:',
    //   new Date(lastMessageTime).toISOString(),
    //   ')',
    // );

    const rawBranchId = payload.branchId ?? '1.0.0';
    const branchId = this.normalizeBranchId(rawBranchId);
    const message: Message = {
      id: crypto.randomUUID(), // Generate local ID
      threadId: threadId,
      title: thread.title,
      role: payload.role,
      content: payload.content,
      createdAt: now,
      userId: '',
      rawData: payload.metadata as JsonValue,
      clientMessageId: payload.clientMessageId,
      deletedAt: null,
      branchId: branchId,
      modelId: payload.modelId ?? '',
      provider: payload.provider || '',
    };

    // log.info('[ThreadRepository] Created message locally:', message.id, 'branchId:', branchId);

    // Check for duplicates before adding to cache
    const duplicate = thread.messages.find(
      (m) => m.branchId === branchId && m.role === payload.role && m.content === payload.content,
    );

    if (duplicate) {
      // log.warn('[ThreadRepository] Duplicate message detected, skipping add:', {
      //   existingId: duplicate.id,
      //   newId: message.id,
      //   branchId: branchId,
      //   role: payload.role,
      // });
      return duplicate;
    }

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
      provider: string | null;
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
          // log.info('[ThreadRepository] Message found in local idempotency cache:', existingId);
          return { ...found };
        }
      }
    }

    // Content size check
    const contentBytes = Buffer.byteLength(payload.content ?? '', 'utf8');
    if (contentBytes > this.MAX_FILE_SIZE) throw new Error('MESSAGE_TOO_LARGE');

    // Get thread from cache or fetch it
    let thread = this.threadsById.get(threadId);
    if (!thread) {
      // log.info('[ThreadRepository] Thread not in cache, fetching:', threadId);
      const loadedThread = await this.loadThread(threadId);
      if (!loadedThread) throw new Error(`Thread not found: ${threadId}`);
      thread = loadedThread;
    }

    // Delegate to appendMessageLocal for local-only creation
    return this.appendMessageLocal(threadId, payload);
  }

  public async addAssistantResponse(
    threadId: string,
    response: string,
    branchId: string,
    model?: string,
  ): Promise<Message> {
    const thread = this.threadsById.get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    if (model) {
      this.threadsById.set(thread.id, thread);
    }

    // Check if this is the first assistant response and thread needs a title
    const assistantMessageCount = thread.messages.filter((m) => m.role === 'assistant').length;
    const isFirstResponse = assistantMessageCount === 0;
    const needsTitle = !thread.title || thread.title.trim() === '';

    // log.info(
    //   `[ThreadRepository] Auto-title check for thread ${threadId}: assistantCount=${assistantMessageCount}, isFirst=${isFirstResponse}, needsTitle=${needsTitle}, currentTitle="${thread.title}"`,
    // );

    // Auto-generate title from first user prompt if this is the first response
    if (isFirstResponse && needsTitle) {
      const firstUserPrompt = thread.messages.find((m) => m.role === 'user');
      // log.info(
      //   `[ThreadRepository] Found first user prompt: ${firstUserPrompt ? `"${firstUserPrompt.content.substring(0, 50)}..."` : 'NONE'}`,
      // );

      if (firstUserPrompt && firstUserPrompt.content) {
        try {
          // Get existing titles for uniqueness checking
          const existingTitles = Array.from(this.threadsById.values())
            .filter((t) => t.id !== threadId)
            .map((t) => t.title);

          // Generate and ensure unique title
          const candidateTitle = titleGeneratorService.generateTitle(firstUserPrompt.content);
          // log.info(`[ThreadRepository] Generated candidate title: "${candidateTitle}"`);

          const uniqueTitle = titleGeneratorService.ensureUniqueTitle(
            candidateTitle,
            existingTitles,
          );

          // Update thread title locally
          thread.title = uniqueTitle;
          thread.updatedAt = Date.now();
          this.threadsById.set(thread.id, thread);

          // Update title via API
          try {
            await threadApiService.updateThread(threadId, { title: uniqueTitle });
            // log.info(
            //   `[ThreadRepository] ✅ Auto-generated and updated title for thread ${threadId}: "${uniqueTitle}"`,
            // );
          } catch (error) {
            log.error('[ThreadRepository] Failed to update title via API:', error);
            // Continue with local title change
          }
        } catch (error) {
          log.error('[ThreadRepository] ❌ Failed to generate title:', error);
          // Continue without title - addMessage will still work
        }
      } else {
        // log.warn(`[ThreadRepository] ⚠️ Cannot generate title - no user prompt found`);
      }
    } else {
      // log.info(
      //   `[ThreadRepository] Skipping auto-title: isFirst=${isFirstResponse}, needsTitle=${needsTitle}`,
      // );
    }

    return this.addMessage(threadId, 'assistant', branchId, response);
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

    try {
      const req: UpdateThreadRequest = {
        title: thread.title,
        status: thread.status,
        projectId: projectId,
        metadata: thread.metadata,
      };
      await threadApiService.updateThread(threadId, req);
    } catch (error) {
      log.error('[ThreadRepository] Failed to update thread project assignment via API:', error);
      // Still update local cache so UI isn't stuck; next fetch may reconcile
    }

    const updatedLocal = this.updateThreadMetadata(threadId, thread.metadata);
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
  public async renameThread(threadId: string, newTitle: string, _userId?: string): Promise<Thread> {
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

    const _previousTitle = thread.title;
    const now = Date.now();

    try {
      // log.info('[ThreadRepository] Renaming thread via API:', threadId);
      await threadApiService.updateThread(threadId, { title: trimmedTitle });

      // Update local cache
      thread.title = trimmedTitle;
      thread.metadata = {
        ...thread.metadata,
      };
      thread.updatedAt = now;

      this.threadsById.set(thread.id, thread);

      // log.info(
      //   `[ThreadRepository] ✅ Renamed thread ${threadId}: "${previousTitle}" → "${trimmedTitle}"`,
      // );

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

  // public setThreadModel(threadId: string, model: string): Thread {
  //   return this.updateThreadMetadata(threadId, { model });
  // }

  public getThreadModel(threadId: string): string | undefined {
    const thread = this.threadsById.get(threadId);
    if (!thread) return undefined;
    const m = thread.metadata.initalModel;
    return typeof m === 'string' ? m : undefined;
  }

  // public listThreadsByModel(model: string): Thread[] {
  //   return Array.from(this.threadsById.values())
  //     .filter((t) => t.metadata.initalModel === model)
  //     .map((t) => this.cloneThread(t));
  // }

  // public async savePromptAndResponses(
  //   threadId: string | null | undefined,
  //   prompt: string,
  //   responses: { text: string; model?: string }[],
  //   opts: { title?: string; description?: string } = {},
  // ): Promise<{ thread: Thread; promptMessage: Message; responseMessages: Message[] }> {
  //   const { thread, message: promptMessage } = await this.addUserPrompt(threadId, prompt, opts);
  //   const responseMessages: Message[] = [];
  //   for (const r of responses) {
  //     const resp = await this.addAssistantResponse(thread.id, r.text, r.model);
  //     responseMessages.push(resp);
  //   }
  //   const t = await this.loadThread(thread.id);
  //   if (!t) throw new Error(`Thread not found after save: ${thread.id}`);
  //   return { thread: t, promptMessage, responseMessages };
  // }

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
      // log.info('[ThreadRepository] Deleting thread via API:', threadId);
      await threadApiService.deleteThread(threadId);

      // Remove from local cache
      const deleted = this.threadsById.delete(threadId);
      // log.info('[ThreadRepository] Thread deleted:', threadId);
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
      // log.info('[ThreadRepository] Soft deleting thread via API:', threadId);
      await threadApiService.deleteThread(threadId);

      // Update local cache
      thread.deletedAt = Date.now();
      thread.status = 'deleted';
      thread.metadata = { ...thread.metadata };
      thread.updatedAt = Date.now();
      this.threadsById.set(thread.id, thread);

      // log.info('[ThreadRepository] Thread soft deleted:', threadId);
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
      .filter((m) => {
        const normalizedId = this.normalizeBranchId(m.branchId);
        return normalizedId === '1.0.0' || normalizedId.startsWith('1.0.0.');
      })
      .map((m) => ({ ...m }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get the row number from a branchId (first number)
   * E.g., "2.0" -> 2, "2.1.0" -> 2, "3.0" -> 3
   */
  private normalizeBranchId(branchId: string): string {
    const parts = branchId.split('.');
    if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
    if (parts.length > 3) return parts.slice(0, 3).join('.');
    return branchId; // already 3-part
  }

  private getRowNumber(branchId: string): number {
    const parts = branchId.split('.');
    const rowNum = parseInt(parts[0] || '0', 10);
    return isNaN(rowNum) ? 0 : rowNum;
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
    const normalizedBranchId = this.normalizeBranchId(branchId);
    if (normalizedBranchId === '1.0.0' || normalizedBranchId.startsWith('1.0.0.')) {
      throw new Error('Cannot delete main branch');
    }

    // Remove messages from local cache only
    // Messages remain in API but won't be displayed when thread loads
    const branchPrefix = `${branchId}.`;
    thread.messages = thread.messages.filter(
      (m) => m.branchId !== branchId && !m.branchId.startsWith(branchPrefix),
    );
    thread.updatedAt = Date.now();

    this.threadsById.set(threadId, thread);
    // log.info('[ThreadRepository] Deleted branch from cache:', branchId);
  }

  /**
   * Map DesktopThreadDTO to internal Thread model.
   * Converts ISO-8601 timestamps to epoch milliseconds.
   * Preserves custom metadata from API (including model configuration).
   */
  private mapDTOToThread(dto: ThreadDTO): Thread {
    return {
      id: dto.id,
      createdUserId: dto.createdUserId,
      description: dto.description,
      title: dto.title,
      projectId: dto.projectId,
      type: dto.type,
      status: dto.status,
      metadata: (dto.metadata as unknown as ThreadMetadata) || {},
      messages: [], // Messages loaded separately
      createdAt: this.parseApiTimeMs(dto.createdAt),
      updatedAt: this.parseApiTimeMs(dto.updatedAt),
      deletedAt: dto.status === 'deleted' ? Date.now() : null,
    };
  }

  /**
   * Map MessageDTO from API to internal Message model.
   * Converts ISO-8601 timestamps to epoch milliseconds.
   */
  private mapDTOToMessage(dto: MessageDTO, threadTitle: string): Message {
    // Extract branchId from dto.branchId or from options.branch_id
    let branchId = dto.branchId;
    if (!branchId && (dto.options as { branch_id?: string } | null)?.branch_id) {
      branchId = (dto.options as { branch_id?: string }).branch_id ?? null;
    }
    // Fallback to "1.0.0" for legacy messages without branchId
    if (!branchId) {
      branchId = '1.0.0';
      // log.warn('[ThreadRepository] Message missing branchId, defaulting to "1.0.0":', dto.id);
    } else {
      // Normalize/cap to 3-part format
      branchId = this.normalizeBranchId(branchId);
    }

    const message: Message = {
      id: dto.id,
      threadId: dto.threadId,
      title: threadTitle,
      userId: dto.createdUserId || '',
      role: dto.role as MessageRole,
      content: (dto.content as string) || '',
      createdAt: this.parseApiTimeMs(dto.createdAt),
      rawData: (dto.rawData as JsonValue) ?? undefined,
      deletedAt: null,
      editedAt: dto.updatedAt !== dto.createdAt ? this.parseApiTimeMs(dto.updatedAt) : undefined,
      branchId,
      modelId: dto.model || '',
      provider: dto.provider || '',
    };

    // If assistant message has no content but has rawData, set content to "empty"
    if (
      message.role === 'assistant' &&
      (!message.content || message.content.trim() === '') &&
      message.rawData &&
      Object.keys(message.rawData).length > 0
    ) {
      // log.info('[ThreadRepository] Assistant message has empty content but has rawData, setting content to "empty":', message.id);
      message.content = 'empty';
    }

    if (message.role === 'assistant' && message.rawData) {
      message.attachments = this.extractAttachmentsFromRawData(message.rawData, message.provider);
      // log.info('[ThreadRepository] Extraction result:', {
      //   attachmentsCount: message.attachments?.length || 0,
      // });
    } else {
      // log.info('[ThreadRepository] Skipping attachment extraction:', {
      //   reason: message.role !== 'assistant' ? 'not assistant' : 'no rawData',
      // });
    }

    return message;
  }

  /**
   * Insert placeholder user messages for orphan assistant messages
   * If an assistant message doesn't have a preceding user message with the same branchId,
   * create a placeholder user message to maintain request-response pairing
   */
  private insertPlaceholderUserMessages(messages: Message[]): void {
    log.info(
      '[ThreadRepository] Checking for orphan assistant messages, total messages:',
      messages.length,
    );

    // Sort messages by branchId and createdAt to ensure correct order
    messages.sort((a, b) => {
      const [aRow, aLane, aIter] = a.branchId.split('.').map(Number);
      const [bRow, bLane, bIter] = b.branchId.split('.').map(Number);

      if (aRow !== bRow) return aRow - bRow;
      if (aLane !== bLane) return aLane - bLane;
      if (aIter !== bIter) return aIter - bIter;
      return a.createdAt - b.createdAt;
    });

    const toInsert: { index: number; message: Message }[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Check if this is an assistant message
      if (message.role === 'assistant') {
        // Look for a preceding user message with the same branchId
        let hasUserMessage = false;
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].branchId === message.branchId) {
            if (messages[j].role === 'user') {
              hasUserMessage = true;
              break;
            }
          }
        }

        // If no user message found, create a placeholder
        if (!hasUserMessage) {
          log.info('[ThreadRepository] Creating placeholder user message for orphan assistant:', {
            assistantId: message.id,
            branchId: message.branchId,
          });

          const placeholderUser: Message = {
            id: crypto.randomUUID(),
            threadId: message.threadId,
            title: message.title,
            userId: message.userId,
            role: 'user',
            content: '', // Empty content for placeholder
            createdAt: message.createdAt - 1, // Set timestamp slightly before assistant
            branchId: message.branchId,
            modelId: message.modelId,
            provider: message.provider,
            deletedAt: null,
          };

          toInsert.push({ index: i, message: placeholderUser });
        }
      }
    }

    // Insert placeholder messages in reverse order to maintain correct indices
    for (let i = toInsert.length - 1; i >= 0; i--) {
      const { index, message } = toInsert[i];
      messages.splice(index, 0, message);
    }

    if (toInsert.length > 0) {
      log.info('[ThreadRepository] Inserted', toInsert.length, 'placeholder user messages');
    }
  }

  /**
   * Process guard messages and mark them as hidden
   * Guard responses have content.response = { passed: boolean, errors: Array<{title, text}> }
   */
  private processGuardMessages(messages: Message[]): void {
    // log.info('[ThreadRepository] Processing guard messages, total messages:', messages.length);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Check if this is an assistant or system message with guard structure
      if (message.role === 'assistant' || message.role === 'system') {
        try {
          // Parse content if it's a string (might be JSON)
          let content: unknown = message.content;
          if (typeof content === 'string') {
            try {
              content = JSON.parse(content) as unknown;
            } catch {
              // Not JSON, skip
              continue;
            }
          }

          // Check for guard response structure
          const hasResponse = content && typeof content === 'object' && 'response' in content;
          if (hasResponse) {
            const guardContent = content as { response: unknown };
            let response = guardContent.response;

            // The response field might be a JSON string, parse it
            if (typeof response === 'string') {
              try {
                response = JSON.parse(response);
              } catch {
                // Not valid JSON, skip
                continue;
              }
            }

            // Now check if it has the guard structure (passed field is required, errors is optional)
            if (response && typeof response === 'object' && 'passed' in response) {
              const _passed = (response as { passed: boolean }).passed;
              // log.info('[ThreadRepository] Found guard message:', {
              //   messageId: message.id,
              //   role: message.role,
              //   passed: passed,
              //   errorCount: response.errors?.length || 0,
              //   errors: response.errors,
              // });

              // Always mark the guard response as hidden
              message.isHidden = true;
              // log.info('[ThreadRepository] Marked guard response as hidden:', message.id);

              // Always mark the guard request (previous message) as hidden
              if (i > 0 && messages[i - 1].role === 'user') {
                messages[i - 1].isHidden = true;
                // log.info('[ThreadRepository] Marked guard request as hidden:', messages[i - 1].id);
              }

              // Commented out: Hide the actual message that triggered the guard
              // if (!passed && i > 1) {
              //   // The message before the guard request is the actual user message that triggered the guard
              //   messages[i - 2].isHidden = true;
              //   log.info('[ThreadRepository] Guard failed - marked triggering message as hidden:', messages[i - 2].id);
              // }
            }
          }

          // Check for error response structure (type:"error", status:400)
          if (
            content &&
            typeof content === 'object' &&
            'type' in content &&
            (content as { type: string }).type === 'error' &&
            'status' in content &&
            (content as { status: number }).status === 400 &&
            'requestId' in content &&
            'seq' in content &&
            'error' in content
          ) {
            const _errorContent = content as {
              type: string;
              status: number;
              requestId: string;
              seq: number;
              error: unknown;
            };
            // log.info('[ThreadRepository] Found error response (status 400):', {
            //   messageId: message.id,
            //   requestId: errorContent.requestId,
            //   error: errorContent.error,
            // });

            // Mark this error response as hidden
            message.isHidden = true;
            // log.info('[ThreadRepository] Marked error response as hidden:', message.id);
          }
        } catch (error) {
          log.error('[ThreadRepository] Error processing guard message:', error);
        }
      }
    }
  }

  /**
   * Extract image attachments from response rawData based on provider
   */
  private extractAttachmentsFromRawData(
    rawData: unknown,
    provider: string,
  ): Attachment[] | undefined {
    // log.info('[ThreadRepository] extractAttachmentsFromRawData called', {
    //   hasRawData: !!rawData,
    //   provider,
    //   rawDataType: typeof rawData,
    //   rawDataKeys: rawData ? Object.keys(rawData).slice(0, 20) : [],
    // });

    // Log first 500 chars of rawData for debugging
    // if (rawData) {
    //   try {
    //     const preview = JSON.stringify(rawData).substring(0, 500);
    //     log.info('[ThreadRepository] rawData preview:', preview);
    //   } catch (e) {
    //     log.warn('[ThreadRepository] Could not stringify rawData');
    //   }
    // }

    if (!rawData) {
      // log.info('[ThreadRepository] No rawData, skipping attachment extraction');
      return undefined;
    }

    const normalizedProvider = (provider || '').toLowerCase();
    // log.info('[ThreadRepository] Normalized provider:', normalizedProvider);

    switch (normalizedProvider) {
      case 'gemini':
        // log.info('[ThreadRepository] Calling extractGeminiAttachments');
        return this.extractGeminiAttachments(rawData);
      case 'claude':
      case 'anthropic':
        // log.info('[ThreadRepository] Claude/Anthropic provider - not yet implemented');
        return undefined;
      case 'openai':
        // log.info('[ThreadRepository] OpenAI provider - not yet implemented');
        return undefined;
      case 'ollama':
        // log.info('[ThreadRepository] Ollama provider - not yet implemented');
        return undefined;
      default:
        // log.warn('[ThreadRepository] Unknown provider for attachment extraction:', normalizedProvider);
        return undefined;
    }
  }

  /**
   * Extract image attachments from Gemini response rawData
   */
  private extractGeminiAttachments(rawData: unknown): Attachment[] | undefined {
    try {
      // Type guard to check if rawData has the expected Gemini structure
      if (!rawData || typeof rawData !== 'object') {
        return undefined;
      }

      const data = rawData as Record<string, unknown>;
      const message = data.message as Record<string, unknown> | undefined;
      if (!message) {
        return undefined;
      }

      const usageMetadata = message.usageMetadata as Record<string, unknown> | undefined;
      const candidatesTokensDetails = usageMetadata?.candidatesTokensDetails as
        | Array<{ modality?: string }>
        | undefined;

      // Log the modality value - FIXED: it's candidatesTokensDetails (plural Tokens)
      const modality = candidatesTokensDetails?.[0]?.modality;
      // log.info('[ThreadRepository] Gemini modality check:', {
      //   modality,
      //   isImage: modality === 'IMAGE',
      // });

      // Check if response contains image data
      const hasImage = modality === 'IMAGE';

      if (!hasImage) {
        // log.info('[ThreadRepository] No image detected in Gemini response (modality !== "IMAGE")');
        return undefined;
      }

      // log.info('[ThreadRepository] Image detected! Extracting inline data...');

      // Get all parts from the response
      const candidates = message.candidates as Array<Record<string, unknown>> | undefined;
      const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
      const parts = content?.parts as Array<Record<string, unknown>> | undefined;

      // log.info('[ThreadRepository] Checking candidates structure', {
      //   hasCandidates: !!message.candidates,
      //   candidatesLength: (message.candidates as Array<unknown> | undefined)?.length,
      //   hasFirstCandidate: !!candidates?.[0],
      //   hasContent: !!candidates?.[0]?.content,
      //   hasParts: !!parts,
      //   partsLength: parts?.length,
      // });

      if (!parts || parts.length === 0) {
        // log.warn('[ThreadRepository] No parts found in candidates');
        return undefined;
      }

      // FIXED: Find the part with inlineData (image can be in any part, not just first)
      const imagePart = parts.find((part) => 'inlineData' in part && part.inlineData);

      if (!imagePart || !('inlineData' in imagePart)) {
        return undefined;
      }

      const inlineData = imagePart.inlineData as { mimeType?: string; data?: string } | undefined;

      // log.info('[ThreadRepository] InlineData search:', {
      //   foundImagePart: !!imagePart,
      //   hasMimeType: !!inlineData?.mimeType,
      //   mimeType: inlineData?.mimeType,
      //   hasData: !!inlineData?.data,
      //   dataLength: inlineData?.data?.length,
      // });

      if (!inlineData || !inlineData.mimeType || !inlineData.data) {
        // log.warn('[ThreadRepository] Gemini image found but inlineData is incomplete', {
        //   imagePart,
        // });
        return undefined;
      }

      // Calculate size from base64 data
      const base64Data = inlineData.data;
      const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);

      const attachment: Attachment = {
        id: crypto.randomUUID(),
        filename: `gemini-image-${Date.now()}.${this.getExtensionFromMimeType(inlineData.mimeType)}`,
        mimeType: inlineData.mimeType,
        size: sizeInBytes,
        uploadedAt: Date.now(),
        status: 'success',
        data: base64Data, // Store base64 data for inline display
      };

      // Clear the inlineData from rawData to save space (data is now in attachment)
      const inlineDataMutable = inlineData as { data?: string };
      delete inlineDataMutable.data;
      // log.info('[ThreadRepository] Cleared inlineData from rawData to save space');

      // log.info('[ThreadRepository] ✅ Successfully extracted Gemini image attachment:', {
      //   mimeType: attachment.mimeType,
      //   size: attachment.size,
      //   dataLength: base64Data.length,
      //   filename: attachment.filename,
      // });

      return [attachment];
    } catch (error) {
      log.error('[ThreadRepository] ❌ Failed to extract Gemini attachments:', error);
      return undefined;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
    };
    return mimeMap[mimeType] || '';
  }

  private cloneThread(thread: Thread): Thread {
    return {
      id: thread.id,
      title: thread.title,
      type: thread.type,
      createdUserId: thread.createdUserId,
      description: thread.description,
      status: thread.status,
      projectId: thread.projectId,
      metadata: { ...thread.metadata },
      messages: thread.messages.map((m) => ({ ...m })),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      deletedAt: thread.deletedAt ?? null,
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
