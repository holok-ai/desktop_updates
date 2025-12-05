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
};

export interface ToolUseData {
  toolName: string;
  input: unknown;
  stage: 'start' | 'complete';
  toolCallId: string;
  result?: unknown;
}

export class FileWriteEventService {
  private fileWriteEventsByMessageId: Record<string, FileWriteEvent[]> = {};
  private toolCallMessageMap: Record<string, string> = {};

  /**
   * Handle tool use event from chat service
   */
  handleToolUse(
    data: ToolUseData,
    messages: Message[],
  ): Record<string, FileWriteEvent[]> {
    if (data.toolName !== 'write_file') {
      return this.fileWriteEventsByMessageId;
    }

    const input = data.input as {
      path?: string;
      content?: string;
      overwrite?: boolean;
    };

    const basePath = input.path ?? '';
    const baseContent = input.content ?? '';
    const isoverwriteRequested = input.overwrite === true;

    if (data.stage === 'start') {
      const userMessages = messages.filter((m) => m.role === 'user');
      const targetMessage = userMessages[userMessages.length - 1];
      if (targetMessage === undefined || targetMessage === null) {
        return this.fileWriteEventsByMessageId;
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
      };

      this.fileWriteEventsByMessageId[targetMessage.id] = [...existingForMessage, newEvent];
      return { ...this.fileWriteEventsByMessageId };
    }

    const messageId = this.toolCallMessageMap[data.toolCallId];
    if (messageId === undefined || messageId === '') {
      return this.fileWriteEventsByMessageId;
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
        return {
          ...event,
          status: 'complete' as const,
          filePath: dataResult.path ?? event.filePath,
          created: dataResult.created === true,
          bytesWritten: dataResult.bytesWritten ?? event.bytesWritten ?? 0,
          previousSizeBytes: dataResult.metadata?.previousSize ?? event.previousSizeBytes,
          success: true,
          error: null,
        };
      }

      return {
        ...event,
        status: 'complete' as const,
        bytesWritten: event.bytesWritten ?? 0,
        success: false,
        error: result?.error ?? 'File write failed',
      };
    });

    // eslint-disable-next-line security/detect-object-injection
    this.fileWriteEventsByMessageId[messageId] = updatedEvents;

    const { [data.toolCallId]: _removed, ...rest } = this.toolCallMessageMap;
    this.toolCallMessageMap = rest;

    return { ...this.fileWriteEventsByMessageId };
  }

  /**
   * Get file write events for a specific message
   */
  getEventsForMessage(messageId: string): FileWriteEvent[] {
    // eslint-disable-next-line security/detect-object-injection
    return this.fileWriteEventsByMessageId[messageId] ?? [];
  }

  /**
   * Get all file write events
   */
  getAllEvents(): Record<string, FileWriteEvent[]> {
    return { ...this.fileWriteEventsByMessageId };
  }

  /**
   * Clear all events (useful when switching threads)
   */
  clear(): void {
    this.fileWriteEventsByMessageId = {};
    this.toolCallMessageMap = {};
  }
}

