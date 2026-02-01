import { ChatService } from '@holokai/chat-component';
import type { ProviderConfig, ToolDefinition, ToolUse as ChatComponentToolUse, ToolResult, ChatRequest } from '@holokai/chat-component';
import type { DesktopChatRequest } from './chat-types.js';
import type {
  ToolOrchestra,
  ToolUseCallback,
  ToolExecutionContext
} from '../tool-calling/orchestrator-types.js';
import type { ToolStatusCallback } from '../tool-calling/tool-types.js';
import { ToolOrchestrator } from '../tool-calling/orchestrator.js';
import log from 'electron-log';

/**
 * Desktop wrapper around ChatService from @holokai/chat-component
 * Handles desktop-specific concerns like thread tracking, working directory, and tool orchestration
 */
export class DesktopChatService {
  private chatService: ChatService;
  private toolOrchestra: ToolOrchestra;
  private providerType: string;
  private model: string;
  private threadContext: ToolExecutionContext;

  constructor(
    providerType: string,
    config: ProviderConfig,
    workingDirectory?: string
  ) {
    this.providerType = providerType;
    this.model = config.model;

    // Get singleton orchestrator
    this.toolOrchestra = ToolOrchestrator.getInstance();

    // Initialize thread context
    this.threadContext = {
      workingDirectory: workingDirectory || process.cwd(),
      threadId: '',
      branchId: '',
    };

    log.info('[DesktopChatService] Initializing with provider:', providerType, {
      model: config.model,
      workingDirectory: this.threadContext.workingDirectory,
    });

    // Check if this provider/model combination supports tool calling
    const canUseTools = this.toolOrchestra.supportsToolCalling(providerType, config.model);
    log.info('[DesktopChatService] Tool calling support:', {
      provider: providerType,
      model: config.model,
      supported: canUseTools
    });

    // Get tool definitions and create callback adapter if tools are available AND supported
    const tools: ToolDefinition[] | undefined = canUseTools ? this.toolOrchestra.getToolDefinitions() : undefined;
    const onToolUse: ((toolUse: ChatComponentToolUse) => Promise<ToolResult>) | undefined =
      canUseTools
        ? async (toolUse: ChatComponentToolUse) => {
            return await this.toolOrchestra.executeTool(
              toolUse.name,
              toolUse.input,
              this.threadContext
            );
          }
        : undefined;

    if (canUseTools) {
      this.chatService = new ChatService(providerType, config, true, tools, onToolUse);
    }
    else {
      this.chatService = new ChatService(providerType, config, true, undefined, undefined);
    }
  }

  /**
   * Send chat message with desktop-specific request handling
   */
  async chat(
    request: DesktopChatRequest,
    onToken: (token: string) => void,
    onToolUse?: ToolUseCallback,
    onToolStatus?: ToolStatusCallback
  ): Promise<void> {
    // Extract desktop-specific properties
    const { thread_id, branch_id, working_directory, ...chatRequest } = request;

    log.info('[DesktopChatService] chat called', {
      thread_id,
      branch_id,
      messageCount: request.messages.length,
      working_directory: working_directory || this.threadContext.workingDirectory,
    });

    // Update thread context for this message
    if (working_directory) {
      this.threadContext.workingDirectory = working_directory;
    }
    this.threadContext.threadId = thread_id || '';
    this.threadContext.branchId = branch_id || '';
    this.threadContext.statusCallback = onToolStatus || undefined;

    try {
      await this.chatService.chat({
        ...chatRequest,
        ...(thread_id && { thread_id }),
        ...(branch_id && { branch_id }),
      } as ChatRequest & { thread_id?: string; branch_id?: string }, onToken);
    } finally {
      // Clear status callback after message completes
      this.threadContext.statusCallback = undefined;
    }
  }

  /**
   * Get audit logs from underlying ChatService
   */
  getAuditLogs(): unknown[] {
    return this.chatService.getAuditLogs();
  }

  /**
   * Update working directory for this chat service instance
   */
  setWorkingDirectory(directory: string): void {
    log.info('[DesktopChatService] Setting working directory:', directory);
    this.threadContext.workingDirectory = directory;
  }

  /**
   * Get current working directory
   */
  getWorkingDirectory(): string {
    return this.threadContext.workingDirectory;
  }
}
