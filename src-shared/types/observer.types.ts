/**
 * Observer Types
 * Shared between main process and renderer
 *
 * Defines the task types, labels, and request shape for the Thread Observer
 * background task system.
 */

/** Task type enumeration for all observer background tasks */
export enum ObserverTaskType {
  RenameTitle = 'rename-title',
  CompressContext = 'compress-context',
  SuggestPrompt = 'suggest-prompt',
  UpdateContextStatus = 'update-context-status',
}

/** Human-readable label for each task type */
export function getTaskTypeLabel(type: ObserverTaskType): string {
  const labels: Record<ObserverTaskType, string> = {
    [ObserverTaskType.RenameTitle]: 'Title Generation',
    [ObserverTaskType.CompressContext]: 'Context Compression',
    [ObserverTaskType.SuggestPrompt]: 'Prompt Suggestion',
    [ObserverTaskType.UpdateContextStatus]: 'Context Status',
  };
  return labels[type];
}

/** Request sent to the chat:background IPC handler */
export interface BackgroundChatRequest {
  taskType: ObserverTaskType;
  threadId: string;
  messages: { role: string; content: string }[];
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: unknown;
}
