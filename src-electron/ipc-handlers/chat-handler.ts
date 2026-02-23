import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { DesktopChatService, ToolOrchestrator } from '../services/chat/index.js';
import type { DesktopChatRequest, ToolStatus } from '../services/chat/index.js';
import { AuthService } from '../services/auth.service.js';
import { getSettingsService } from './settings-handler.js';
import log from 'electron-log';
import { apiOk, apiFail, type ApiResponse } from '../types/api-response.js';
import { CreateChatServiceCommand } from '../commands/chat.create-service.js';

/**
 * Chat IPC Handlers
 * Handles all chat-related IPC communication between renderer and main process.
 * Manages ChatService lifecycle and streaming token responses.
 * All handlers return ApiResponse<T>.
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
    ): Promise<ApiResponse<void>> => {
      try {
        let accessToken = '';
        if (authService) {
          accessToken = await authService.getAccessToken();
        }

        const cmd = new CreateChatServiceCommand();
        const result = await cmd.execute(threadId, branchId, modelAccessName, accessToken, workingDirectory);
        if (!result.success) return result as ApiResponse<void>;

        // Store in map with composite key (threadId:branchId)
        const serviceKey = buildServiceKey(threadId, branchId);
        chatServices.set(serviceKey, result.data);
        log.info('[IPC] Chat service created and stored with key:', serviceKey, modelAccessName);

        return apiOk(undefined) as ApiResponse<void>;
      } catch (error) {
        log.error('[IPC] Error creating chat service:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return apiFail(-1, errorMessage);
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
    ): Promise<ApiResponse<void>> => {
      // Extract branchId from request - required for service lookup and stream routing
      const branchId = request.branch_id;
      if (!branchId) {
        const errorMessage = 'branch_id is required in chat request';
        log.error('[IPC]', errorMessage);
        return apiFail(-1, errorMessage);
      }

      log.info('[IPC] chat:send called for thread:', threadId, 'branch:', branchId);

      // Build service key using threadId and branchId
      const serviceKey = buildServiceKey(threadId, branchId);
      const chatService = chatServices.get(serviceKey);
      if (!chatService) {
        const errorMessage = `Chat service not initialized for thread: ${threadId}, branch: ${branchId} (key: ${serviceKey})`;
        log.error('[IPC]', errorMessage);
        return apiFail(-1, errorMessage);
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
        return apiOk(undefined) as ApiResponse<void>;
      } catch (error) {
        log.error('[IPC] Error sending chat message:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return apiFail(-1, errorMessage);
      }
    },
  );

  /**
   * Get Audit Logs - Retrieve chat audit logs from thread+branch service
   */
  ipcMain.handle('chat:getAuditLogs', (_event, threadId: string, branchId: string): ApiResponse<unknown[]> => {
    log.info('[IPC] chat:getAuditLogs called for thread:', threadId, 'branch:', branchId);
    if (!threadId || !branchId) {
      return apiFail(-1, 'threadId and branchId are required');
    }

    const serviceKey = buildServiceKey(threadId, branchId);
    const chatService = chatServices.get(serviceKey);
    if (!chatService) {
      return apiFail(-1, `Chat service not found for key: ${serviceKey}`);
    }

    try {
      const logs = chatService.getAuditLogs();
      log.info('[IPC] Audit logs retrieved successfully');
      return apiOk(logs);
    } catch (error) {
      log.error('[IPC] Error retrieving audit logs:', error);
      const message = error instanceof Error ? error.message : String(error);
      return apiFail(-1, message);
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
