/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { Message } from '$lib/types/thread.type.js';
import type { ToolCall } from '$lib/types/tool-call.type.js';
import { BaseElectronService } from './base-electron.service';

/**
 * Represents an active streaming session for a specific thread + branch.
 * Holds the user prompt message and the in-progress assistant response content
 * so that getMessages() can merge them with API results when the user switches
 * back to a thread mid-stream.
 */
export interface StreamingSession {
  threadId: string;
  branchId: string;
  userMessage: Message;
  assistantContent: string;
  modelId?: string;
}

/**
 * Represents a background stream for a thread.
 * Lives in the ThreadStreamService singleton so it survives component destruction
 * (e.g., when ThreadPage sets loading=true and the {#if loading} conditional
 * removes ThreadChatView from the DOM).
 */
export interface BackgroundStream {
  threadId: string;
  branchId: string;
  accumulatedText: string;
  unsubscribe: (() => void) | null;
}

/**
 * Domain service for streaming token management.
 *
 * Owns:
 * - Stream subscription (onToken IPC listener, subscribe/unsubscribe)
 * - Streaming session lifecycle (register, update, clear, query)
 * - Background stream lifecycle (get, set, delete, has)
 * - Merge logic for injecting streaming data into API message results
 */
export class ThreadStreamService extends BaseElectronService {
  // Map: "threadId:branchId" -> Set of callbacks for streaming tokens
  private streamCallbacks = new Map<string, Set<(token: string) => void>>();

  // Map: "threadId:branchId" -> current list of tool calls for that stream
  private activeToolCalls = new Map<string, ToolCall[]>();

  // Map: "threadId:branchId" -> Set of callbacks notified on tool call updates
  private toolUseCallbacks = new Map<string, Set<(calls: ToolCall[]) => void>>();

  /**
   * Active streaming sessions keyed by threadId.
   * Registered when a prompt is submitted and streaming starts.
   * Updated as tokens arrive. Removed when streaming completes.
   * Used by getMessages() to merge streaming data with API results.
   */
  private streamingSessions = new Map<string, StreamingSession>();

  /**
   * Background streams keyed by threadId.
   * Each thread can have an independent background stream that survives
   * component destruction. Tokens keep accumulating even when the UI
   * component is torn down and re-created.
   */
  private backgroundStreams = new Map<string, BackgroundStream>();

  private constructor() {
    super();
  }

  public static getInstance(): ThreadStreamService {
    return this.getSingletonInstance();
  }

  protected initializeEventListeners(): void {
    // Listen for streaming token events
    const unsubTokens = window.electronAPI.chat.onToken(
      (data: { threadId: string; branchId: string; token: string }) => {
        if (!data.branchId) {
          console.error(
            '[ThreadStreamService] Token event missing branchId - this is an error!',
            data,
          );
          return;
        }

        const key = this.buildStreamKey(data.threadId, data.branchId);
        const callbacks = this.streamCallbacks.get(key);

        if (callbacks) {
          callbacks.forEach((callback) => callback(data.token));
        } else {
          console.warn('[ThreadStreamService] No subscribers for stream:', key);
        }
      },
    );
    this.registerCleanup(unsubTokens);

    // Listen for tool use events
    const unsubToolUse = window.electronAPI.chat.onToolUse((data) => {
      const key = this.buildStreamKey(data.threadId, data.branchId);
      const calls = this.activeToolCalls.get(key) ?? [];

      if (data.stage === 'in_progress') {
        const newCall: ToolCall = {
          id: data.toolCallId,
          name: data.toolName,
          inputHint: data.inputHint ?? data.toolName.replace(/_/g, ' '),
          status: 'in_progress',
          message: data.message,
          startedAt: Date.now(),
        };
        this.activeToolCalls.set(key, [...calls, newCall]);
      } else {
        const updated = calls.map((call) => {
          if (call.id !== data.toolCallId) {
            return call;
          }
          return {
            ...call,
            status: data.stage as 'complete' | 'error',
            error: data.error,
            completedAt: Date.now(),
          };
        });
        this.activeToolCalls.set(key, updated);
      }

      const callbacks = this.toolUseCallbacks.get(key);
      if (callbacks) {
        const current = this.activeToolCalls.get(key) ?? [];
        callbacks.forEach((cb) => cb(current));
      }
    });
    this.registerCleanup(unsubToolUse);
  }

  // ── Stream subscription ──

  /**
   * Subscribe to streaming tokens for a specific thread + branch
   * branchId format: "1.0", "1.1", "2.1.3", etc. - uniquely identifies message stream
   * @returns Unsubscribe function
   */
  subscribeToStream(
    threadId: string,
    branchId: string,
    callback: (token: string) => void,
  ): () => void {
    if (!threadId || !branchId) {
      throw new Error(
        '[ThreadStreamService] threadId and branchId are required for stream subscription',
      );
    }

    const key = this.buildStreamKey(threadId, branchId);

    if (!this.streamCallbacks.has(key)) {
      this.streamCallbacks.set(key, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.streamCallbacks.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.streamCallbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.streamCallbacks.delete(key);
        }
      }
    };
  }

  /**
   * Subscribe to tool use updates for a specific thread + branch.
   * Callback is invoked whenever a tool call changes state.
   * @returns Unsubscribe function
   */
  subscribeToToolUse(
    threadId: string,
    branchId: string,
    callback: (calls: ToolCall[]) => void,
  ): () => void {
    const key = this.buildStreamKey(threadId, branchId);
    if (!this.toolUseCallbacks.has(key)) {
      this.toolUseCallbacks.set(key, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.toolUseCallbacks.get(key)!.add(callback);
    return () => {
      const callbacks = this.toolUseCallbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.toolUseCallbacks.delete(key);
        }
      }
    };
  }

  /**
   * Get the current tool calls for a specific thread + branch.
   */
  getToolCalls(threadId: string, branchId: string): ToolCall[] {
    return this.activeToolCalls.get(this.buildStreamKey(threadId, branchId)) ?? [];
  }

  /**
   * Clear tool calls for a specific thread + branch (call when stream completes).
   */
  clearToolCalls(threadId: string, branchId: string): void {
    const key = this.buildStreamKey(threadId, branchId);
    this.activeToolCalls.delete(key);
    this.toolUseCallbacks.delete(key);
  }

  /**
   * Unsubscribe ALL stream callbacks for a given threadId.
   * Useful for cleaning up when navigating away from a thread.
   */
  unsubscribeAllForThread(threadId: string): void {
    const prefix = `${threadId}:`;
    for (const key of Array.from(this.streamCallbacks.keys())) {
      if (key.startsWith(prefix)) {
        this.streamCallbacks.delete(key);
      }
    }
  }

  /**
   * Build stream key from threadId and branchId
   */
  private buildStreamKey(threadId: string, branchId: string): string {
    return `${threadId}:${branchId}`;
  }

  // ── Streaming session management ──

  /**
   * Register a streaming session when a prompt is submitted and streaming starts.
   */
  registerStreamingSession(
    threadId: string,
    branchId: string,
    userMessage: Message,
    modelId?: string,
  ): void {
    this.streamingSessions.set(threadId, {
      threadId,
      branchId,
      userMessage,
      assistantContent: '',
      modelId,
    });
  }

  /**
   * Update the accumulated assistant content for an active streaming session.
   * Called by the token callback as tokens arrive.
   */
  updateStreamingContent(threadId: string, content: string): void {
    const session = this.streamingSessions.get(threadId);
    if (session) {
      session.assistantContent = content;
    }
  }

  /**
   * Remove a streaming session when streaming completes (success or error).
   */
  clearStreamingSession(threadId: string): void {
    this.streamingSessions.delete(threadId);
  }

  /**
   * Check if a thread has an active streaming session.
   */
  hasStreamingSession(threadId: string): boolean {
    return this.streamingSessions.has(threadId);
  }

  /**
   * Get the streaming session for a thread (if any).
   */
  getStreamingSession(threadId: string): StreamingSession | undefined {
    return this.streamingSessions.get(threadId);
  }

  // ── Background stream management ──

  /**
   * Get the background stream for a thread (if any).
   */
  getBackgroundStream(threadId: string): BackgroundStream | undefined {
    return this.backgroundStreams.get(threadId);
  }

  /**
   * Store a background stream for a thread.
   */
  setBackgroundStream(threadId: string, stream: BackgroundStream): void {
    this.backgroundStreams.set(threadId, stream);
  }

  /**
   * Remove a background stream for a thread.
   */
  deleteBackgroundStream(threadId: string): void {
    this.backgroundStreams.delete(threadId);
  }

  /**
   * Check if a thread has an active background stream.
   */
  hasBackgroundStream(threadId: string): boolean {
    return this.backgroundStreams.has(threadId);
  }

  // ── Streaming merge logic ──

  /**
   * Merge API messages with an active streaming session.
   *
   * Three cases (matched by branchId):
   * 1. API has neither the user prompt nor assistant response for this branch:
   *    → Append both the streaming user message and a synthetic assistant message.
   * 2. API has the user prompt but no assistant response for this branch:
   *    → Append a synthetic assistant message with the streaming content.
   * 3. API has both the user prompt and assistant response for this branch:
   *    → Use the API version (streaming is complete or nearly so).
   */
  mergeStreamingMessages(apiMessages: Message[], session: StreamingSession): Message[] {
    const { branchId, userMessage, assistantContent, modelId } = session;

    const isuserPresent = apiMessages.some((m) => m.branchId === branchId && m.role === 'user');
    const isassistantPresent = apiMessages.some(
      (m) => m.branchId === branchId && m.role === 'assistant',
    );

    // Case 3: API has both — use API data, streaming is done or nearly done
    if (isuserPresent && isassistantPresent) {
      return apiMessages;
    }

    const merged = [...apiMessages];

    // Case 1: API has neither — append both
    if (!isuserPresent) {
      merged.push(userMessage);
    }

    // Case 1 & 2: API is missing the assistant response — append synthetic one
    if (!isassistantPresent && assistantContent) {
      merged.push({
        id: `streaming-${branchId}`,
        threadId: session.threadId,
        role: 'assistant',
        content: assistantContent,
        createdAt: Date.now(),
        branchId,
        modelId: modelId ?? null,
        isLocal: true,
        guardExecution: 'none',
        guardMessageId: null,
        guardError: '',
      });
    }

    return merged;
  }
}

export const threadStreamService = ThreadStreamService.getInstance();
