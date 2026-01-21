/**
 * Tool Registry
 * Central registry of all available tool factories
 */

import type { ITool, ToolContext } from './base-tool.js';
import { createFolderReadTool } from './folder-read.tool.js';
import { createFileReadTool } from './file-read.tool.js';
import { createFileWriteTool } from './file-write.tool.js';
import { createWindowsShellTool } from './windows-shell.tool.js';
import { createUnixShellTool } from './unix-shell.tool.js';
import { createReadWordTool } from './read-word.tool.js';
import { createReadExcelTool } from './read-excel.tool.js';
import { createReadPdfTool } from './read-pdf.tool.js';

/**
 * Factory function type for creating tools
 */
export type ToolFactory = (context: ToolContext) => ITool;

/**
 * Array of all available tool factories
 * Add new tool factories here as they are implemented
 */
export const TOOL_FACTORIES: ToolFactory[] = [
  createFolderReadTool,
  createFileReadTool,
  createFileWriteTool,
  createWindowsShellTool,
  createUnixShellTool,
  createReadWordTool,
  createReadExcelTool,
  createReadPdfTool,
];
