/**
 * Tool Types
 * Shared type definitions for tool calling functionality
 */

/**
 * Tool definition for LLM tool calling
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Tool status for UI feedback during long operations
 */
export interface ToolStatus {
  toolName: string;
  state: 'in_progress' | 'complete';
  message?: string;
}

/**
 * Callback for tool status updates
 */
export type ToolStatusCallback = (status: ToolStatus) => void;

// ============================================================================
// Tool Result Types
// ============================================================================

/**
 * Folder entry information
 */
export interface FolderEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: number;
  extension?: string;
}

/**
 * Result from read_folder tool
 */
export interface ReadFolderResult {
  path: string;
  entries: FolderEntry[];
  total_files: number;
  total_directories: number;
}

/**
 * Result from read_file tool
 */
export interface ReadFileResult {
  path: string;
  content: string;
  metadata: {
    size: number;
    lines: number;
    modified: number;
    encoding: string;
  };
  truncated: boolean;
}

/**
 * Parameters for write_file tool
 */
export interface WriteFileParams {
  path: string;
  content: string;
  overwrite?: boolean;
  encoding?: 'utf-8' | 'ascii' | 'latin1';
}

/**
 * Result from write_file tool
 */
export interface WriteFileResult {
  path: string;
  created: boolean;
  bytesWritten: number;
  metadata: {
    size: number;
    modified: number;
    encoding: string;
    previousSize?: number;
  };
}

/**
 * Result from shell tools (windows_shell and unix_shell)
 */
export interface ShellResult {
  command: string;
  arguments: string;
  output: string;
}

/**
 * Generic result interface for all tool executions
 */
export interface ToolResult {
  success: boolean;
  data?: ReadFolderResult | ReadFileResult | WriteFileResult | ShellResult;
  error?: string;
}
