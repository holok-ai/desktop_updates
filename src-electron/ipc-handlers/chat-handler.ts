import { ipcMain, IpcMainInvokeEvent } from 'electron';
import type { ProviderConfig } from '@holokai/chat-component';
import { DesktopChatService, ToolOrchestrator } from '../services/chat/index.js';
import type { DesktopChatRequest, ToolStatus } from '../services/chat/index.js';
import { AuthService } from '../services/auth.service.js';
import { getSettingsService } from './settings-handler.js';
import log from 'electron-log';

/**
 * Chat IPC Handlers
 * Handles all chat-related IPC communication between renderer and main process.
 * Manages ChatService lifecycle and streaming token responses.
 */

let chatService: DesktopChatService | null = null;
let authService: AuthService | null = null;

/**
 * Register all chat IPC handlers
 */
export function registerChatHandlers(auth?: AuthService): void {
  // Store auth service reference if provided
  if (auth) {
    authService = auth;
  }

  /**
   * Create Chat Provider - Initialize ChatService with provider type and config
   */
  ipcMain.handle(
    'chat:createProvider',
    async (
      _event,
      providerType: string,
      config: ProviderConfig,
    ): Promise<{ success: boolean; error?: string }> => {
      log.info('[IPC] chat:createProvider called', { providerType });

      try {
        // Inject access token from auth service if available
        if (authService) {
          try {
            const accessToken = await authService.getAccessToken();
            config.apiKey = accessToken;
            log.info('[IPC] Access token injected into chat provider config');
          } catch (error) {
            log.warn('[IPC] Could not get access token, using provided apiKey:', error);
          }
        }

        // Get whitelist from settings
        const settingsService = getSettingsService();
        const allowedPaths = settingsService.getDirectoryWhitelist();

        // Create ToolOrchestrator for file tools
        const toolOrchestrator = new ToolOrchestrator(undefined, allowedPaths);

        // Create DesktopChatService with tool support
        const newConfig: ProviderConfig = {
          url: (config as any).url || '', // Will use default if empty
          apiKey: config.apiKey || '',
          model: config.model
        };
        chatService = new DesktopChatService(providerType, newConfig, toolOrchestrator);

        log.info('[IPC] DesktopChatService created successfully with tool support', {
          whitelistCount: allowedPaths.length,
        });
        return { success: true };
      } catch (error) {
        log.error('[IPC] Error creating chat provider:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  /**
   * Send Chat Message - Send message with streaming token response
   */
  ipcMain.handle(
    'chat:send',
    async (
      event: IpcMainInvokeEvent,
      request: DesktopChatRequest,
    ): Promise<{ success: boolean; error?: string }> => {
      log.info('[IPC] chat:send called');

      if (!chatService) {
        const errorMessage = 'Chat service not initialized. Call createProvider first.';
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      try {
        await chatService.chat(
          request,
          (token: string) => {
            // Send streaming tokens back to renderer
            event.sender.send('chat:token', token);
          },
          (toolName, input, notification) => {
            // Send tool use events back to renderer
            event.sender.send('chat:toolUse', {
              toolName,
              input,
              ...notification,
            });
          },
          (status: ToolStatus) => {
            // Send tool status events back to renderer
            event.sender.send('chat:toolStatus', status);
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
   * Get Audit Logs - Retrieve chat audit logs from current service
   */
  ipcMain.handle('chat:getAuditLogs', () => {
    log.info('[IPC] chat:getAuditLogs called');

    if (!chatService) {
      const errorMessage = 'Chat service not initialized. Call createProvider first.';
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
   * Destroy Chat Service - Clean up current chat service instance
   */
  ipcMain.handle('chat:destroy', (): { success: boolean } => {
    log.info('[IPC] chat:destroy called');

    try {
      chatService = null;
      log.info('[IPC] Chat service destroyed successfully');
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error destroying chat service:', error);
      throw error;
    }
  });

  /**
   * Close Chat Provider - Alias for destroy (cleanup current chat service)
   */
  ipcMain.handle('chat:close', (): { success: boolean } => {
    log.info('[IPC] chat:close called');

    try {
      chatService = null;
      log.info('[IPC] Chat service closed successfully');
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error closing chat service:', error);
      throw error;
    }
  });

  log.info('[IPC] Chat handlers registered');
}

/**
 * Unregister chat handlers - Called when app is closing
 */
export function unregisterChatHandlers(): void {
  ipcMain.removeHandler('chat:createProvider');
  ipcMain.removeHandler('chat:send');
  ipcMain.removeHandler('chat:getAuditLogs');
  ipcMain.removeHandler('chat:destroy');
  ipcMain.removeHandler('chat:close');

  // Clean up service instance
  chatService = null;

  log.info('[IPC] Chat handlers unregistered');
}
