import type { ToolDefinition, ToolStatusCallback, ToolResult } from './tool-types.js';

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
  notification?: ToolUseNotification,
) => void;

/**
 * Context provided for each tool execution
 * Isolated per thread/message
 */
export interface ToolExecutionContext {
  /** Working directory for this execution - used to resolve relative paths */
  workingDirectory: string;

  /** Thread ID for this execution (required) */
  threadId: string;

  /** Branch ID for this execution (required) */
  branchId: string;

  /** Status callback for this execution (optional) - called for progress updates */
  statusCallback?: ToolStatusCallback;
}

/**
 * Tool orchestra interface - provides tool definitions and execution
 */
export interface ToolOrchestra {
  /**
   * Get all available tool definitions
   */
  getToolDefinitions(): ToolDefinition[];

  /**
   * Execute a tool by name with input parameters and execution context
   */
  executeTool(
    name: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult>;

  /**
   * Determines if a provider/model combination supports tool calling
   */
  supportsToolCalling(provider: string, model: string): boolean;

  /**
   * Set allowed paths for file access (global setting)
   */
  setAllowedPaths(paths: string[]): void;

  /**
   * Get current allowed paths
   */
  getAllowedPaths(): string[];

  /**
   * Add allowed paths to whitelist
   */
  addAllowedPaths(...paths: string[]): void;

  /**
   * Remove allowed paths from whitelist
   */
  removeAllowedPaths(...paths: string[]): void;

  /**
   * Clear all allowed paths
   */
  clearAllowedPaths(): void;
}
