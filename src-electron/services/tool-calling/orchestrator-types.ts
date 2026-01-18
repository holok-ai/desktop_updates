import type { ToolDefinition, ToolStatus, ToolStatusCallback, ToolResult } from './tool-types.js';

/**
 * Tool use information from LLM response
 */
export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool use notification for UI feedback
 */
export interface ToolUseNotification {
  toolCallId: string;
  stage: 'start' | 'complete';
  result?: ToolResult;
}

/**
 * Callback for tool use events
 */
export type ToolUseCallback = (
  toolName: string,
  input: unknown,
  notification?: ToolUseNotification
) => void;

/**
 * Tool orchestra interface - provides tool definitions and execution
 */
export interface ToolOrchestra {
  /**
   * Get all available tool definitions
   */
  getToolDefinitions(): ToolDefinition[];

  /**
   * Execute a tool by name with input parameters
   */
  executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult>;

  /**
   * Determines if a provider/model combination supports tool calling
   */
  supportsToolCalling(provider: string, model: string): boolean;

  /**
   * Set working directory for file operations
   */
  setWorkingDirectory?(dir: string): void;

  /**
   * Set callback for tool status updates
   */
  setStatusCallback?(callback: ToolStatusCallback | null): void;

  /**
   * Get current working directory
   */
  getWorkingDirectory?(): string;
}
