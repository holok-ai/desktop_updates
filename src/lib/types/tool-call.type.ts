/**
 * Represents a single tool call during an assistant streaming turn.
 * Populated from chat:toolUse IPC events and held in ThreadStreamService.
 */
export interface ToolCall {
  id: string;
  name: string;
  inputHint: string;
  status: 'in_progress' | 'complete' | 'error';
  message?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}
