import { ChatService } from '@holokai/chat-component';
import type { ProviderConfig, ToolDefinition, ToolUse as ChatComponentToolUse, ToolResult } from '@holokai/chat-component';
import type { DesktopChatRequest } from './chat-types.js';
import { formatThreadId } from './chat-types.js';
import type {
  ToolOrchestra,
  ToolUseCallback
} from '../tool-calling/orchestrator-types.js';
import type { ToolStatusCallback } from '../tool-calling/tool-types.js';
import log from 'electron-log';

/**
 * Desktop wrapper around ChatService from @holokai/chat-component
 * Handles desktop-specific concerns like thread tracking, working directory, and tool orchestration
 */
export class DesktopChatService {
  private chatService: ChatService;
  private workingDirectory: string | null = null;
  private toolOrchestra: ToolOrchestra | null = null;
  private providerType: string;
  private model: string;

  constructor(
    providerType: string,
    config: ProviderConfig,
    toolOrchestra?: ToolOrchestra
  ) {
    this.providerType = providerType;
    this.model = config.model;

    log.info('[DesktopChatService] Initializing with provider:', providerType, {
      model: config.model,
      hasTools: !!toolOrchestra
    });

    // Check if this provider/model combination supports tool calling
    const canUseTools = toolOrchestra?.supportsToolCalling(providerType, config.model) ?? false;
    log.info('[DesktopChatService] Tool calling support:', {
      provider: providerType,
      model: config.model,
      supported: canUseTools
    });

    // Get tool definitions and create callback adapter if tools are available AND supported
    const tools: ToolDefinition[] | undefined = (toolOrchestra) ? toolOrchestra.getToolDefinitions() : undefined;
    const onToolUse: ((toolUse: ChatComponentToolUse) => Promise<ToolResult>) | undefined =
      (toolOrchestra) ? async (toolUse: ChatComponentToolUse) => {
        return await toolOrchestra.executeTool(toolUse.name, toolUse.input);
      } : undefined;

    if (canUseTools) {
      this.chatService = new ChatService(providerType, config, true, tools, onToolUse);
    }
    else {
      this.chatService = new ChatService(providerType, config, true, undefined, undefined);
    }

    this.toolOrchestra = toolOrchestra || null;
  }

  /**
   * Send chat message with desktop-specific request handling
   * Tool support is automatically enabled if toolOrchestra was provided in constructor
   */
  async chat(
    request: DesktopChatRequest,
    onToken: (token: string) => void,
    onToolUse?: ToolUseCallback,
    onToolStatus?: ToolStatusCallback
  ): Promise<void> {
    // Extract desktop-specific properties
    const { thread_guid, branch_id, working_directory, ...chatRequest } = request;
    const capBranchId = (id: string | undefined): string | undefined => {
      if (!id) return undefined;
      const parts = id.split('.');
      return parts.length > 3 ? parts.slice(0, 3).join('.') : id;
    };
    const cappedBranchId = capBranchId(branch_id);

    log.info('[DesktopChatService] chat called', {
      thread_guid,
      branch_id,
      cappedBranchId,
      messageCount: request.messages.length,
      working_directory: working_directory || this.workingDirectory,
      hasTools: !!this.toolOrchestra
    });

    // Handle working directory
    if (working_directory) {
      this.workingDirectory = working_directory;
      if (this.toolOrchestra?.setWorkingDirectory) {
        this.toolOrchestra.setWorkingDirectory(working_directory);
      }
    }

    // Set up tool status callback
    if (onToolStatus && this.toolOrchestra?.setStatusCallback) {
      this.toolOrchestra.setStatusCallback(onToolStatus);
    }

    try {
      // Format thread_id from thread_guid and branch_id
      const thread_id = formatThreadId(thread_guid, cappedBranchId);
      log.info('[DesktopChatService] formatted thread_id', { thread_id });

      // Call ChatService - it handles tools internally if configured
      await this.chatService.chat({
        ...chatRequest,
        ...(thread_id && { thread_id })
      }, onToken);
    } finally {
      // Clean up status callback
      if (onToolStatus && this.toolOrchestra?.setStatusCallback) {
        this.toolOrchestra.setStatusCallback(null);
      }
    }
  }

  /**
   * Get audit logs from underlying ChatService
   */
  getAuditLogs(): unknown[] {
    return this.chatService.getAuditLogs();
  }

  /**
   * Set working directory for file operations
   */
  setWorkingDirectory(directory: string): void {
    log.info('[DesktopChatService] Setting working directory:', directory);
    this.workingDirectory = directory;
  }

  /**
   * Get current working directory
   */
  getWorkingDirectory(): string | null {
    return this.workingDirectory;
  }
}
