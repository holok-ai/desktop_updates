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
  RequestOptionsDTO,
} from '../services/mokuapi/thread.types.js';
import type { MessageRole } from '../types/thread.types.js';
import {
  type IMessageInspector,
  MessageInspector,
  DuplicationInspector,
  PlaceholderInspector,
  GuardInspector,
  ObserverPromptsInspector,
  ToolUseInspector,
  ResponseCompletedInspector,
} from './inspectors/index.js';

export class ThreadRepository {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  // API-first architecture - no longer loading from local disk
  // Threads are fetched from Moku API on demand
  private readonly threadsById: Map<string, Thread> = new Map();
  private readonly idempotencyIndex: Map<string, Map<string, string>> = new Map();

  private readonly messageInspectors: IMessageInspector[] = [
    new ObserverPromptsInspector(),
    new ResponseCompletedInspector(),
    new ToolUseInspector(),
    new DuplicationInspector(),
    new PlaceholderInspector(),
    new GuardInspector(),
  ];

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

    const result = await threadApiService.createThread(newRequest);
    if (!result.success) {
      throw new Error(`Failed to create thread: ${result.errorText}`);
    }

    const thread = this.mapDTOToThread(result.data);

    // Cache locally for session
    this.threadsById.set(thread.id, thread);

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

  private async loadThreadMeta(threadId: string): Promise<Thread | null> {
    log.info('[ThreadRepository.loadThreadMeta] Start', {
      threadId,
      stack: new Error().stack,
    });

    const cachedThread = this.threadsById.get(threadId);
    if (cachedThread) {
      return this.cloneThread(cachedThread);
    }

    const threadResult = await threadApiService.getThread(threadId);
    if (!threadResult.success) {
      log.error('[ThreadRepository] Failed to load thread:', threadResult.errorText);
      return null;
    }

    const thread = this.mapDTOToThread(threadResult.data);
    this.threadsById.set(thread.id, thread);
    return this.cloneThread(thread);
  }

  public async loadThread(threadId: string): Promise<Thread | null> {
    return this.loadThreadMeta(threadId);
  }

  public async loadThreadMessages(threadId: string): Promise<Message[]> {
    log.info('[ThreadRepository.loadThreadMessages] Start', {
      threadId,
      stack: new Error().stack,
    });
    const messagesResult = await threadApiService.getMessages(threadId, { size: 1000 });

    if (!messagesResult.success) {
      log.error('[ThreadRepository] Failed to load messages for thread:', messagesResult.errorText);
      return [];
    }

    const threadTitle = this.threadsById.get(threadId)?.title ?? '';
    const mapped = messagesResult.data.content.map((dto) => this.mapDTOToMessage(dto, threadTitle));
    const finalMessages = MessageInspector.run(this.messageInspectors, mapped);
    const toolUseCount = finalMessages.filter((m) => (m.toolUses?.length ?? 0) > 0).length;
    const assistantCount = finalMessages.filter((m) => m.role === 'assistant').length;
    log.info('[ThreadRepository] Loaded thread messages with toolUses', {
      threadId,
      total: finalMessages.length,
      toolUseCount,
      assistantCount,
    });

    const cached = this.threadsById.get(threadId);
    if (cached) {
      cached.messages = finalMessages;
      this.threadsById.set(threadId, cached);
    }

    return finalMessages;
  }

  public async listThreads(options?: {
    projectId?: string;
    page?: number;
    size?: number;
  }): Promise<Thread[]> {
    const result = await threadApiService.getThreads({
      type: options?.projectId ? 'project' : undefined,
      projectId: options?.projectId,
      page: options?.page || 0,
      size: options?.size || 50,
      sort: 'createdAt,desc',
    });

    if (!result.success) {
      log.error('[ThreadRepository] Failed to list threads:', result.errorText);
      return [];
    }

    const threads = result.data.content.map((dto) => {
      return this.mapDTOToThread(dto);
    });

    // create a key in cache that we know this thread
    threads.forEach((thread) => this.threadsById.set(thread.id, thread));

    return threads.map((t) => this.cloneThread(t));
  }

  /**
   * Get total thread count for a project.
   *
   * Uses the threads list endpoint and reads `totalElements` to avoid paging through all results.
   */
  public async getProjectThreadCount(projectId: string): Promise<number> {
    const result = await threadApiService.getThreads({
      type: 'project',
      projectId,
      page: 0,
      size: 1,
      sort: 'createdAt,desc',
    });

    if (!result.success) {
      log.error('[ThreadRepository] Failed to get project thread count:', result.errorText);
      return 0;
    }

    return result.data.totalElements;
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
  private async appendMessageLocal(
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
      guardExecution: 'none',
      guardMessageId: null,
      guardError: '',
    };

    // Check for duplicates before adding to cache
    const duplicate = thread.messages.find(
      (m) => m.branchId === branchId && m.role === payload.role && m.content === payload.content,
    );

    if (duplicate) {
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

    // Auto-generate title from first user prompt if this is the first response
    if (isFirstResponse && needsTitle) {
      const firstUserPrompt = thread.messages.find((m) => m.role === 'user');

      if (firstUserPrompt && firstUserPrompt.content) {
        try {
          // Get existing titles for uniqueness checking
          const existingTitles = Array.from(this.threadsById.values())
            .filter((t) => t.id !== threadId)
            .map((t) => t.title);

          // Generate and ensure unique title
          const candidateTitle = titleGeneratorService.generateTitle(firstUserPrompt.content);

          const uniqueTitle = titleGeneratorService.ensureUniqueTitle(
            candidateTitle,
            existingTitles,
          );

          // Update thread title locally
          thread.title = uniqueTitle;
          thread.updatedAt = Date.now();
          this.threadsById.set(thread.id, thread);

          // Update title via API
          const titleResult = await threadApiService.updateThread(threadId, { title: uniqueTitle });
          if (!titleResult.success) {
            log.error('[ThreadRepository] Failed to update title via API:', titleResult.errorText);
            // Continue with local title change
          }
        } catch (error) {
          log.error('[ThreadRepository] ❌ Failed to generate title:', error);
          // Continue without title - addMessage will still work
        }
      }
    }

    return this.addMessage(threadId, 'assistant', branchId, response);
  }

  private updateThreadMetadata(threadId: string, updates: Partial<ThreadMetadata>): Thread {
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

    const req: UpdateThreadRequest = {
      title: thread.title,
      status: thread.status,
      projectId: projectId,
      metadata: thread.metadata,
    };
    const updateResult = await threadApiService.updateThread(threadId, req);
    if (!updateResult.success) {
      log.error(
        '[ThreadRepository] Failed to update thread project assignment via API:',
        updateResult.errorText,
      );
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

    const renameResult = await threadApiService.updateThread(threadId, { title: trimmedTitle });
    if (!renameResult.success) {
      log.error('[ThreadRepository] Failed to rename thread:', renameResult.errorText);
      throw new Error(renameResult.errorText);
    }

    // Update local cache
    thread.title = trimmedTitle;
    thread.metadata = {
      ...thread.metadata,
    };
    thread.updatedAt = now;

    this.threadsById.set(thread.id, thread);

    return this.cloneThread(thread);
  }

  /**
   * Undo the most recent rename operation for a thread
   * @param threadId - The thread ID to undo rename
   * @returns The updated thread with previous title restored
   * @throws Error if thread not found or no rename history available
   */

  public async deleteThread(threadId: string): Promise<boolean> {
    // Delete associated files before deleting thread
    fileStorageService.deleteThreadFiles(threadId).catch((error) => {
      console.error('[ThreadRepository] Failed to delete thread files:', error);
      // Continue with thread deletion even if file deletion fails
    });

    const result = await threadApiService.deleteThread(threadId);
    if (!result.success) {
      log.error('[ThreadRepository] Failed to delete thread:', result.errorText);
      return false;
    }

    // Remove from local cache
    const deleted = this.threadsById.delete(threadId);
    return deleted;
  }

  public async softDeleteThread(threadId: string): Promise<boolean> {
    const thread = this.threadsById.get(threadId);
    if (!thread) return false;

    // Delete associated files on soft delete as well
    fileStorageService.deleteThreadFiles(threadId).catch((error) => {
      console.error('[ThreadRepository] Failed to delete thread files:', error);
      // Continue with soft delete even if file deletion fails
    });

    const result = await threadApiService.deleteThread(threadId);
    if (!result.success) {
      log.error('[ThreadRepository] Failed to soft delete thread:', result.errorText);
      return false;
    }

    // Update local cache
    thread.deletedAt = Date.now();
    thread.status = 'deleted';
    thread.metadata = { ...thread.metadata };
    thread.updatedAt = Date.now();
    this.threadsById.set(thread.id, thread);

    return true;
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
   * Get the row number from a branchId (first number)
   * E.g., "2.0" -> 2, "2.1.0" -> 2, "3.0" -> 3
   */
  private normalizeBranchId(branchId: string): string {
    const parts = branchId.split('.');
    if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
    if (parts.length > 3) return parts.slice(0, 3).join('.');
    return branchId; // already 3-part
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
    const rawBranchId = dto.branchId || '1.0.0';
    const normalizedBranchId = this.normalizeBranchId(rawBranchId);
    const branchId = normalizedBranchId;

    const opts = dto.options as { desktop_options?: RequestOptionsDTO } | null;
    const desktopOptions = opts?.desktop_options ?? null;

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
      rawBranchId,
      normalizedBranchId,
      modelId: dto.model || '',
      provider: dto.provider || '',
      guardExecution: 'none',
      guardMessageId: null,
      guardError: '',
      desktopOptions,
    };

    // If assistant message has no content but has rawData, set content to "empty"
    if (
      message.role === 'assistant' &&
      (!message.content || message.content.trim() === '') &&
      message.rawData &&
      Object.keys(message.rawData).length > 0
    ) {
      message.content = 'empty';
    }

    if (message.role === 'assistant' && message.rawData) {
      message.attachments = this.extractAttachmentsFromRawData(message.rawData, message.provider);
    }

    // Set token count: use API-provided value, fall back to content-length estimate
    console.log(
      `[mapDTOToMessage] id=${dto.id} role=${dto.role} dto.tokens=${String(dto.tokens)} → resolved=${String(dto.tokens ?? Math.ceil(message.content.length / 4))}`,
    );
    message.tokens = dto.tokens ?? Math.ceil(message.content.length / 4);

    return message;
  }

  /**
   * Extract image attachments from response rawData based on provider
   */
  private extractAttachmentsFromRawData(
    rawData: unknown,
    provider: string,
  ): Attachment[] | undefined {
    if (!rawData) {
      return undefined;
    }

    const normalizedProvider = (provider || '').toLowerCase();

    switch (normalizedProvider) {
      case 'gemini':
        return this.extractGeminiAttachments(rawData);
      case 'claude':
      case 'anthropic':
        return undefined;
      case 'openai':
        return undefined;
      case 'ollama':
        return undefined;
      default:
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

      // Check if response contains image data
      const hasImage = modality === 'IMAGE';

      if (!hasImage) {
        return undefined;
      }

      // Get all parts from the response
      const candidates = message.candidates as Array<Record<string, unknown>> | undefined;
      const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
      const parts = content?.parts as Array<Record<string, unknown>> | undefined;

      if (!parts || parts.length === 0) {
        return undefined;
      }

      // FIXED: Find the part with inlineData (image can be in any part, not just first)
      const imagePart = parts.find((part) => 'inlineData' in part && part.inlineData);

      if (!imagePart || !('inlineData' in imagePart)) {
        return undefined;
      }

      const inlineData = imagePart.inlineData as { mimeType?: string; data?: string } | undefined;

      if (!inlineData || !inlineData.mimeType || !inlineData.data) {
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
}

export const threadRepository = new ThreadRepository();

export default ThreadRepository;
