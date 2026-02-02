/**
 * Base Tool Interface and Types
 */

import type { ToolDefinition, ToolResult } from '../tool-types.js';
import type { FileToolsService } from '../file-tools.service.js';
import type { ToolExecutionContext } from '../orchestrator-types.js';

/**
 * Tool execution context - dependencies passed to tool factories
 */
export interface ToolContext {
  /**
   * Reference to FileToolsService for security checks and utilities
   */
  service: FileToolsService;
}

/**
 * Base interface that all tools must implement
 */
export interface ITool {
  /**
   * Get the tool's name
   */
  getName(): string;

  /**
   * Get the tool's definition for LLM
   */
  getDefinition(): ToolDefinition;

  /**
   * Execute the tool with given input and execution context
   */
  execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;
}
