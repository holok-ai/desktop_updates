import type { Message } from '$lib/types/thread.type';

export type FileWriteEvent = {
  id: string;
  toolCallId: string;
  messageId: string;
  status: 'pending' | 'complete';
  filePath: string;
  created: boolean;
  bytesWritten: number | null;
  content: string;
  previousSizeBytes: number | null;
  overwriteRequested: boolean | null;
  success: boolean | null;
  error: string | null;
  startedAtMs?: number;
  durationMs?: number;
  _hideNotification?: boolean;
};

export interface ToolUseData {
  toolName: string;
  input: unknown;
  stage: 'in_progress' | 'complete' | 'error';
  toolCallId: string;
  result?: unknown;
  error?: string;
}

export class FileWriteEventService {
  private fileWriteEventsByMessageId: Record<string, FileWriteEvent[]> = {};
  private toolCallMessageMap: Record<string, string> = {};
  private pendingTimers: Record<string, number> = {};
  private static readonly NOTIFICATION_DURATION_THRESHOLD_MS = 2000;
  private updateCallback?: () => void;

  setUpdateCallback(callback: () => void): void {
    this.updateCallback = callback;
  }

  /**
   * Handle tool use event from chat service
   */
  handleToolUse(data: ToolUseData, messages: Message[]): Record<string, FileWriteEvent[]> {
    if (data.toolName !== 'write_file') {
      return this.getFilteredEvents();
    }

    const input = data.input as {
      path?: string;
      content?: string;
      overwrite?: boolean;
    };

    const basePath = input.path ?? '';
    const baseContent = input.content ?? '';
    const isoverwriteRequested = input.overwrite === true;

    if (data.stage === 'in_progress') {
      const userMessages = messages.filter((m) => m.role === 'user');
      const targetMessage = userMessages[userMessages.length - 1];
      if (targetMessage === null || targetMessage === undefined) {
        return this.getFilteredEvents();
      }

      this.toolCallMessageMap[data.toolCallId] = targetMessage.id;

      const existingForMessage = this.fileWriteEventsByMessageId[targetMessage.id] ?? [];
      const newEvent: FileWriteEvent = {
        id: data.toolCallId,
        toolCallId: data.toolCallId,
        messageId: targetMessage.id,
        status: 'pending',
        filePath: basePath,
        created: !isoverwriteRequested,
        bytesWritten: null,
        content: baseContent,
        previousSizeBytes: null,
        overwriteRequested: isoverwriteRequested,
        success: null,
        error: null,
        startedAtMs: Date.now(),
        _hideNotification: true,
      };

      this.fileWriteEventsByMessageId[targetMessage.id] = [...existingForMessage, newEvent];

      const { id: targetMsgId } = targetMessage;
      const { toolCallId } = data;
      const timerId = window.setTimeout(() => {
        // eslint-disable-next-line security/detect-object-injection
        const events = this.fileWriteEventsByMessageId[targetMsgId];
        if (events !== null && events !== undefined && Array.isArray(events)) {
          const eventIndex = events.findIndex((e) => e.toolCallId === toolCallId);
          // eslint-disable-next-line security/detect-object-injection
          const foundEvent = events[eventIndex];
          if (eventIndex !== -1 && foundEvent?.status === 'pending') {
            const updatedEvent = { ...foundEvent, _hideNotification: false };
            const updatedEvents = [...events];
            // eslint-disable-next-line security/detect-object-injection
            updatedEvents[eventIndex] = updatedEvent;
            // eslint-disable-next-line security/detect-object-injection
            this.fileWriteEventsByMessageId[targetMsgId] = updatedEvents;
            if (this.updateCallback !== null && this.updateCallback !== undefined) {
              this.updateCallback();
            }
          }
        }
        // Remove timer by filtering
        const entries = Object.entries(this.pendingTimers);
        const filtered = entries.filter(([key]) => key !== toolCallId);
        this.pendingTimers = Object.fromEntries(filtered);
      }, FileWriteEventService.NOTIFICATION_DURATION_THRESHOLD_MS);

      // eslint-disable-next-line security/detect-object-injection
      this.pendingTimers[toolCallId] = timerId;

      return this.getFilteredEvents();
    }

    const { toolCallId } = data;
    // eslint-disable-next-line security/detect-object-injection
    const messageId = this.toolCallMessageMap[toolCallId];
    if (messageId === null || messageId === undefined || messageId === '') {
      return this.getFilteredEvents();
    }

    // Clear the pending timer if it exists
    // eslint-disable-next-line security/detect-object-injection
    const timer = this.pendingTimers[toolCallId];
    if (timer !== undefined) {
      clearTimeout(timer);
      // Remove timer by filtering
      const entries = Object.entries(this.pendingTimers);
      const filtered = entries.filter(([key]) => key !== toolCallId);
      this.pendingTimers = Object.fromEntries(filtered);
    }

    // eslint-disable-next-line security/detect-object-injection
    const existingForMessage = this.fileWriteEventsByMessageId[messageId] ?? [];
    const result = data.result as
      | {
          success: boolean;
          data?: {
            path?: string;
            created?: boolean;
            bytesWritten?: number;
            metadata?: {
              previousSize?: number;
            };
            error?: string;
          };
          error?: string;
        }
      | undefined;

    const updatedEvents = existingForMessage.map((event) => {
      if (event.toolCallId !== data.toolCallId) {
        return event;
      }

      if (result?.success === true && result.data !== undefined && result.data !== null) {
        const dataResult = result.data;
        const bytesWritten = dataResult.bytesWritten ?? event.bytesWritten ?? 0;
        const durationMs =
          typeof event.startedAtMs === 'number' && Number.isFinite(event.startedAtMs)
            ? Date.now() - event.startedAtMs
            : undefined;
        const isdurationKnown = typeof durationMs === 'number' && Number.isFinite(durationMs);
        // Hide notification for fast operations (<= threshold). Show for slower operations.
        const shouldhideNotification =
          isdurationKnown && durationMs <= FileWriteEventService.NOTIFICATION_DURATION_THRESHOLD_MS;

        return {
          ...event,
          status: 'complete' as const,
          filePath: dataResult.path ?? event.filePath,
          created: dataResult.created === true,
          bytesWritten,
          previousSizeBytes: dataResult.metadata?.previousSize ?? event.previousSizeBytes,
          success: true,
          error: null,
          durationMs,
          _hideNotification: shouldhideNotification,
        };
      }

      return {
        ...event,
        status: 'complete' as const,
        bytesWritten: event.bytesWritten ?? 0,
        success: false,
        error: data.error ?? result?.error ?? 'File write failed',
      };
    });

    // Keep pending events; for completed successes, keep only if not hidden; always keep failures
    const filteredEvents = updatedEvents.filter((event) => {
      if (event.status === 'pending') {
        return true;
      }
      if (event.error !== null && event.error !== undefined) {
        return true;
      }
      if (event.success === false) {
        return true;
      }
      if (event.success === true) {
        return event._hideNotification !== true;
      }
      return true;
    });

    // eslint-disable-next-line security/detect-object-injection
    this.fileWriteEventsByMessageId[messageId] = filteredEvents;

    const { [data.toolCallId]: _removed, ...rest } = this.toolCallMessageMap;
    this.toolCallMessageMap = rest;

    return this.getFilteredEvents();
  }

  /**
   * Get filtered events (excluding hidden notifications) for all messages
   */
  private getFilteredEvents(): Record<string, FileWriteEvent[]> {
    const filtered: Record<string, FileWriteEvent[]> = {};
    Object.entries(this.fileWriteEventsByMessageId).forEach(([messageId, events]) => {
      const visibleEvents = events.filter((event) => event._hideNotification !== true);
      if (visibleEvents.length > 0) {
        // eslint-disable-next-line security/detect-object-injection
        filtered[messageId] = visibleEvents;
      }
    });
    return filtered;
  }

  /**
   * Get file write events for a specific message (filters out hidden notifications)
   */
  getEventsForMessage(messageId: string): FileWriteEvent[] {
    // eslint-disable-next-line security/detect-object-injection
    const events = this.fileWriteEventsByMessageId[messageId] ?? [];
    return events.filter((event) => event._hideNotification !== true);
  }

  /**
   * Get all file write events (filters out hidden notifications)
   */
  getAllEvents(): Record<string, FileWriteEvent[]> {
    return this.getFilteredEvents();
  }

  /**
   * Clear all events (useful when switching threads)
   */
  clear(): void {
    // Clear all pending timers
    Object.values(this.pendingTimers).forEach((timer) => {
      clearTimeout(timer);
    });
    this.pendingTimers = {};
    this.fileWriteEventsByMessageId = {};
    this.toolCallMessageMap = {};
  }
}
