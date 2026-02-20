import { ipcMain, IpcMainInvokeEvent } from 'electron';
import type { ProviderConfig } from '@holokai/chat-component';
import { DesktopChatService, ToolOrchestrator } from '../services/chat/index.js';
import type { DesktopChatRequest, ToolStatus } from '../services/chat/index.js';
import { AuthService } from '../services/auth.service.js';
import { getSettingsService } from './settings-handler.js';
import { modelRepository } from '../repository/model-repository.js';
import log from 'electron-log';
import { threadRepository } from '../repository/thread-repository.js';

/**
 * Chat IPC Handlers
 * Handles all chat-related IPC communication between renderer and main process.
 * Manages ChatService lifecycle and streaming token responses.
 *
 * INTERIM SOLUTION: Uses Map<threadId, DesktopChatService> for per-thread service management.
 * Future ticket (#361) will replace this with StreamManager architecture.
 */

// Map of chat services per thread+branch (interim solution)
// Key format: "${threadId}:${branchId}"
const chatServices: Map<string, DesktopChatService> = new Map();
let authService: AuthService | null = null;

/**
 * Build service key from threadId and branchId
 */
function buildServiceKey(threadId: string, branchId: string): string {
  return `${threadId}:${branchId}`;
}

/**
 * Register all chat IPC handlers
 */
export function registerChatHandlers(auth?: AuthService): void {
  // Store auth service reference if provided
  if (auth) {
    authService = auth;
  }

  // Initialize ToolOrchestrator singleton once at startup
  const settingsService = getSettingsService();
  const allowedPaths = settingsService.getDirectoryWhitelist();
  ToolOrchestrator.getInstance(allowedPaths);

  /**
   * Create Chat Provider - Initialize ChatService for a thread+branch
   */
  ipcMain.handle(
    'chat:createServiceForThread',
    async (
      _event,
      threadId: string,
      branchId: string,
      modelAccessName: string,
      workingDirectory?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // get the users api key to use in chat service
        let accessToken = '';
        if (authService) {
          accessToken = await authService.getAccessToken();
        }

        // thread should be in repository since we're trying to chat on it
        const thisThread = await threadRepository.loadThread(threadId);
        if (!thisThread) {
          log.error('[IPC] Could not find thread for chat service.');
          return { success: false, error: 'Could not find thread id' };
        }

        const thisAgent = await modelRepository.getAgentById(thisThread.metadata.agentId);
        if (!thisAgent) {
          log.error('[IPC] Could not find agent for thread chat service.');
          return { success: false, error: 'Could not find thread id' };
        }
        const url: string = thisAgent?.url ?? '';
        const provider: string = thisAgent.provider; //  thisThread.metadata.initialProvider ?? '';

        // Create DesktopChatService for this thread+branch
        const newConfig: ProviderConfig = {
          url: url,
          apiKey: accessToken,
          model: modelAccessName,
        };

        const chatService = new DesktopChatService(provider, newConfig, workingDirectory);

        // Store in map with composite key (threadId:branchId)
        const serviceKey = buildServiceKey(threadId, branchId);
        chatServices.set(serviceKey, chatService);
        log.info(
          '[IPC] Chat service created and stored with key:',
          serviceKey,
          url,
          modelAccessName,
        );

        return { success: true };
      } catch (error) {
        log.error('[IPC] Error creating chat service:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  /**
   * Send Chat Message - Send message for a specific thread+branch
   */
  ipcMain.handle(
    'chat:send',
    async (
      event: IpcMainInvokeEvent,
      threadId: string,
      request: DesktopChatRequest,
    ): Promise<{ success: boolean; error?: string }> => {
      // Extract branchId from request - required for service lookup and stream routing
      const branchId = request.branch_id;
      if (!branchId) {
        const errorMessage = 'branch_id is required in chat request';
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      log.info('[IPC] chat:send called for thread:', threadId, 'branch:', branchId);

      // Build service key using threadId and branchId
      const serviceKey = buildServiceKey(threadId, branchId);
      const chatService = chatServices.get(serviceKey);
      if (!chatService) {
        const errorMessage = `Chat service not initialized for thread: ${threadId}, branch: ${branchId} (key: ${serviceKey})`;
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      try {
        await chatService.chat(
          request,
          (token: string) => {
            event.sender.send('chat:token', { threadId, branchId, token });
          },
          (toolName, input, notification) => {
            event.sender.send('chat:toolUse', {
              threadId,
              toolName,
              input,
              ...notification,
            });
          },
          (status: ToolStatus) => {
            event.sender.send('chat:toolStatus', { threadId, ...status });
          },
        );
        log.info('[IPC] Chat message sent successfully');
        return { success: true };
      } catch (error) {
        log.error('[IPC] Error sending chat message:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  /**
   * Get Audit Logs - Retrieve chat audit logs from thread+branch service
   */
  ipcMain.handle('chat:getAuditLogs', (_event, threadId: string, branchId: string) => {
    log.info('[IPC] chat:getAuditLogs called for thread:', threadId, 'branch:', branchId);
    if (!threadId || !branchId) return;

    const serviceKey = buildServiceKey(threadId, branchId);
    const chatService = chatServices.get(serviceKey);
    if (chatService) {
      try {
        const logs = chatService.getAuditLogs();
        log.info('[IPC] Audit logs retrieved successfully');
        return logs;
      } catch (error) {
        log.error('[IPC] Error retrieving audit logs:', error);
        throw error;
      }
    }
  });

  log.info('[IPC] Chat handlers registered');
}

/**
 * Unregister chat handlers - Called when app is closing
 */
export function unregisterChatHandlers(): void {
  ipcMain.removeHandler('chat:createServiceForThread');
  ipcMain.removeHandler('chat:send');
  ipcMain.removeHandler('chat:getAuditLogs');

  // Clean up all service instances
  chatServices.clear();

  log.info('[IPC] Chat handlers unregistered');
}
