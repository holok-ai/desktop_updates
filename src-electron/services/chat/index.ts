/**
 * Desktop wrapper for @holokai/chat-component
 * Exports desktop-specific chat service and types
 */

export { DesktopChatService } from './desktop-chat-service.js';
export type { DesktopChatRequest, DesktopChatMessage } from './chat-types.js';
export { ToolOrchestrator } from '../tool-calling/orchestrator.js';
export type {
  ToolOrchestra,
  ToolUse,
  ToolUseNotification,
  ToolUseCallback
} from '../tool-calling/orchestrator-types.js';
export type {
  ToolStatus,
  ToolStatusCallback
} from '../tool-calling/tool-types.js';
