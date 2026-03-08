import { ChatService } from '@holokai/chat-component';
import type {
  ProviderConfig,
  ToolDefinition,
  ToolUse as ChatComponentToolUse,
  ToolResult,
} from '@holokai/chat-component';
import type { DesktopChatRequest } from './chat-types.js';
import type {
  ToolOrchestra,
  ToolUseCallback,
  ToolExecutionContext,
} from '../tool-calling/orchestrator-types.js';
import { ToolOrchestrator } from '../tool-calling/orchestrator.js';
import { fileStorageService } from '../file-storage.service.js';
import { interfaceStatusRegistry } from '../reliability/interface-status-registry.js';
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

  constructor(providerType: string, config: ProviderConfig, workingDirectory?: string) {
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
      urL: config.url,
      workingDirectory: this.threadContext.workingDirectory,
    });

    // Check if this provider/model combination supports tool calling
    const canUseTools = this.toolOrchestra.supportsToolCalling(providerType, config.model);
    log.info('[DesktopChatService] Tool calling support:', {
      provider: providerType,
      model: config.model,
      supported: canUseTools,
    });

    // Get tool definitions and create callback adapter if tools are available AND supported
    const tools: ToolDefinition[] = canUseTools ? this.toolOrchestra.getToolDefinitions() : [];
    const onToolUse: ((toolUse: ChatComponentToolUse) => Promise<ToolResult>) | undefined =
      canUseTools
        ? async (toolUse: ChatComponentToolUse) => {
            this.threadContext.currentToolCallId = toolUse.id;
            try {
              return await this.toolOrchestra.executeTool(
                toolUse.name,
                toolUse.input,
                this.threadContext,
              );
            } finally {
              this.threadContext.currentToolCallId = undefined;
            }
          }
        : undefined;

    // Create file received callback to handle files from chat responses (e.g., Gemini generated images)
    const onFileReceivedAsync = async (
      threadId: string,
      fileId: string,
      mimeType: string,
      contents: string,
      displayName: string,
    ): Promise<void> => {
      try {
        log.info('[DesktopChatService] onFileReceived called', {
          threadId,
          fileId,
          mimeType,
          displayName,
          contentLength: contents.length,
        });

        // Convert base64 contents to Buffer
        const buffer = Buffer.from(contents, 'base64');

        // Save file using file storage service - pass fileId from chat-service to ensure consistency
        const attachment = await fileStorageService.saveFile(
          threadId,
          buffer,
          displayName,
          mimeType,
          fileId,
        );

        log.info('[DesktopChatService] File saved successfully', {
          threadId,
          fileId: attachment.id,
          displayName,
          size: buffer.length,
        });
      } catch (error) {
        log.error('[DesktopChatService] Failed to save received file', {
          threadId,
          fileId,
          displayName,
          error,
        });
      }
    };

    // Wrapper to handle async onFileReceived without returning promise (void return required by setTools)
    const onFileReceived = (
      threadId: string,
      fileId: string,
      mimeType: string,
      contents: string,
      displayName: string,
    ): void => {
      void onFileReceivedAsync(threadId, fileId, mimeType, contents, displayName);
    };

    if (canUseTools && onToolUse !== undefined) {
      this.chatService = new ChatService(providerType, config, true);
      this.chatService.setTools(tools, onToolUse, onFileReceived);
    } else {
      this.chatService = new ChatService(providerType, config, true);
      this.chatService.setTools(
        [],
        (_toolUse: ChatComponentToolUse) => Promise.resolve({ success: false }),
        onFileReceived,
      );
    }
  }

  /**
   * Send chat message with desktop-specific request handling
   * @param abortSignal - Optional AbortSignal to cancel the in-flight stream
   */
  async chat(
    request: DesktopChatRequest,
    onToken: (token: string) => void,
    onToolUse?: ToolUseCallback,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    // Extract desktop-specific properties
    const { working_directory } = request;
    const threadId = (request as unknown as { thread_id?: string }).thread_id ?? '';
    const branchId = request.branch_id ?? '';

    log.info('[DesktopChatService] chat called', {
      thread_id: threadId,
      branch_id: branchId,
      messageCount: request.messages.length,
      working_directory: working_directory || this.threadContext.workingDirectory,
    });

    // Update thread context for this message
    if (working_directory) {
      (request as unknown as { workingDirectory: string }).workingDirectory = working_directory;
    }
    this.threadContext.threadId = threadId;
    this.threadContext.branchId = branchId;
    this.threadContext.toolUseCallback = onToolUse;
    if (working_directory) {
      this.threadContext.workingDirectory = working_directory;
    }

    // If an abort signal is provided, attach it to the request so the underlying
    // ChatService can honour cancellation (if it supports it).
    if (abortSignal) {
      (request as unknown as { abortSignal: AbortSignal }).abortSignal = abortSignal;
    }

    try {
      await this.chatService.chat(request, onToken);
      this.recordReliabilitySuccess();
    } catch (error) {
      this.recordReliabilityError(error);
      throw error;
    } finally {
      this.threadContext.toolUseCallback = undefined;
    }
  }

  /**
   * Get audit logs from underlying ChatService
   */
  getAuditLogs(): unknown[] {
    return this.chatService.getAuditLogs();
  }

  // ---------------------------------------------------------------------------
  // Reliability recording
  // ---------------------------------------------------------------------------

  private recordReliabilitySuccess(): void {
    try {
      if (interfaceStatusRegistry.hasMonitor('holo-api')) {
        interfaceStatusRegistry.getMonitor('holo-api').recordSuccess();
      }
    } catch {
      // Registry not ready yet; ignore
    }
  }

  private recordReliabilityError(error: unknown): void {
    try {
      if (!interfaceStatusRegistry.hasMonitor('holo-api')) {
        return;
      }
      const monitor = interfaceStatusRegistry.getMonitor('holo-api');

      // Extract status code from error if possible
      let statusCode = -1;
      let message = 'Unknown error';

      if (error instanceof Error) {
        message = error.message;
        const asAny = error as unknown as Record<string, unknown>;
        if (typeof asAny['statusCode'] === 'number') {
          statusCode = asAny['statusCode'];
        } else if (typeof asAny['status'] === 'number') {
          statusCode = asAny['status'];
        }
      }

      monitor.recordError(statusCode, message);
    } catch {
      // Registry not ready yet; ignore
    }
  }
}
