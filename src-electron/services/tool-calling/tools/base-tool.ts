/**
 * Base Tool Interface and Types
 */

import type { ToolDefinition, ToolResult } from '../tool-types.js';
import type { FileToolsService } from '../file-tools.service.js';

/**
 * Tool execution context - dependencies passed to tool factories
 */
export interface ToolContext {
  /**
   * Reference to FileToolsService for utility methods and execution
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
   * Execute the tool with given input
   */
  execute(input: Record<string, unknown>): Promise<ToolResult>;
}
