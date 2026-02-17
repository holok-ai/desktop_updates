import { ipcMain, IpcMainInvokeEvent } from 'electron';
import type { ProviderConfig } from '@holokai/chat-component';
import { DesktopChatService, ToolOrchestrator } from '../services/chat/index.js';
import type { DesktopChatRequest, ToolStatus } from '../services/chat/index.js';
import { AuthService } from '../services/auth.service.js';
import { getSettingsService } from './settings-handler.js';
import { modelRepository } from '../repository/model-repository.js';
import log from 'electron-log';

/**
 * Chat IPC Handlers
 * Handles all chat-related IPC communication between renderer and main process.
 * Manages ChatService lifecycle and streaming token responses.
 * 
 * INTERIM SOLUTION: Uses Map<threadId, DesktopChatService> for per-thread service management.
 * Future ticket (#361) will replace this with StreamManager architecture.
 */

// Map of chat services per thread (interim solution)
const chatServices: Map<string, DesktopChatService> = new Map();
let authService: AuthService | null = null;

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
   * Create Chat Provider - Initialize ChatService for a thread
   */
  ipcMain.handle(
    'chat:createServiceForThread',
    async (
      _event,
      threadId: string,
      modelAccessName: string,
      providerType: string,
      config: ProviderConfig,
      workingDirectory?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // Inject access token from auth service if available
        if (authService) {
          try {
            const accessToken = await authService.getAccessToken();
            config.apiKey = accessToken;
          } catch (error) {
            log.warn('[IPC] Could not get access token, using provided apiKey');
          }
        }

        // Look up model details if modelAccessName provided
        if (modelAccessName) {
          const allModels = await modelRepository.listAll();
          const foundModel = allModels.find(m => m.accessName === modelAccessName);

          if (foundModel) {
            providerType = foundModel.provider;

            // Look up application by applicationSlug to get apiKey
            const allApplications = await modelRepository.listAllApplications();
            const foundApplication = allApplications.find(app => app.slug === foundModel.applicationSlug);

            if (foundApplication) {
              const appApiKey = (foundApplication as any).apiKey;
              if (appApiKey) {
                config.apiKey = appApiKey;
              }
            }

            // Update config with model details
            config.model = foundModel.accessName;
            if (foundModel.url) {
              (config as { url?: string }).url = foundModel.url;
            }
          }
        }

        // Create DesktopChatService for this thread
        const newConfig: ProviderConfig = {
          url: (config as { url?: string }).url ?? '',
          apiKey: config.apiKey ?? '',
          model: config.model,
        };

        const chatService = new DesktopChatService(
          providerType,
          newConfig,
          workingDirectory
        );

        // Store in map
        chatServices.set(threadId, chatService);

        return { success: true };
      } catch (error) {
        log.error('[IPC] Error creating chat service:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  /**
   * Send Chat Message - Send message for a specific thread
   */
  ipcMain.handle(
    'chat:send',
    async (
      event: IpcMainInvokeEvent,
      threadId: string,
      request: DesktopChatRequest,
    ): Promise<{ success: boolean; error?: string }> => {
      log.info('[IPC] chat:send called for thread:', threadId);

      const chatService = chatServices.get(threadId);
      if (!chatService) {
        const errorMessage = `Chat service not initialized for thread: ${threadId}`;
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      try {
        // Extract branchId from request - required for stream routing
        const branchId = request.branch_id;
        if (!branchId) {
          throw new Error('branch_id is required in chat request');
        }

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
          }
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
   * Get Audit Logs - Retrieve chat audit logs from thread service
   */
  ipcMain.handle('chat:getAuditLogs', (_event, threadId: string) => {
    log.info('[IPC] chat:getAuditLogs called for thread:', threadId);

    const chatService = chatServices.get(threadId);
    if (!chatService) {
      const errorMessage = `Chat service not initialized for thread: ${threadId}`;
      log.error('[IPC]', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const logs = chatService.getAuditLogs();
      log.info('[IPC] Audit logs retrieved successfully');
      return logs;
    } catch (error) {
      log.error('[IPC] Error retrieving audit logs:', error);
      throw error;
    }
  });

  /**
   * Destroy Chat Service - Clean up when thread is closed
   */
  ipcMain.handle('chat:destroyProvider', (_event, threadId: string): { success: boolean } => {
    log.info('[IPC] chat:destroyProvider called for thread:', threadId);
    chatServices.delete(threadId);
    return { success: true };
  });

  /**
   * Update allowed paths for all future tool executions
   */
  ipcMain.handle(
    'chat:updateAllowedPaths',
    (_event, allowedPaths: string[]): { success: boolean } => {
      log.info('[IPC] chat:updateAllowedPaths called');
      const orchestrator = ToolOrchestrator.getInstance();
      orchestrator.setAllowedPaths(allowedPaths);
      return { success: true };
    }
  );

  log.info('[IPC] Chat handlers registered');
}

/**
 * Unregister chat handlers - Called when app is closing
 */
export function unregisterChatHandlers(): void {
  ipcMain.removeHandler('chat:createServiceForThread');
  ipcMain.removeHandler('chat:send');
  ipcMain.removeHandler('chat:getAuditLogs');
  ipcMain.removeHandler('chat:destroyProvider');
  ipcMain.removeHandler('chat:updateAllowedPaths');

  // Clean up all service instances
  chatServices.clear();

  log.info('[IPC] Chat handlers unregistered');
}
