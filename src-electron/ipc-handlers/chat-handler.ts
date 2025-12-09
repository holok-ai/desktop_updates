import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ChatService } from '../services/chat/ChatService.js';
import type {
  ChatRequest,
  ChatRequestWithOptions,
} from '../services/chat/interfaces/ChatMessage.js';
import type { ProviderConfig } from '../services/chat/factories/ChatProviderFactory.js';
import { AuthService } from '../services/auth.service.js';
import { getSettingsService } from './settings-handler.js';
import log from 'electron-log';

/**
 * Chat IPC Handlers
 * Handles all chat-related IPC communication between renderer and main process.
 * Manages ChatService lifecycle and streaming token responses.
 */

let chatService: ChatService | null = null;
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

        chatService = new ChatService(providerType, config, true, allowedPaths);
        log.info('[IPC] Chat service created successfully with whitelist', {
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
      request: ChatRequest,
    ): Promise<{ success: boolean; error?: string }> => {
      log.info('[IPC] chat:send called');

      if (!chatService) {
        const errorMessage = 'Chat service not initialized. Call createProvider first.';
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      try {
        await chatService.chat(request, (token: string) => {
          // Send streaming tokens back to renderer
          event.sender.send('chat:token', token);
        });
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
   * Send Chat Message with Options - Send message with additional options and streaming
   */
  ipcMain.handle(
    'chat:sendWithOptions',
    async (
      event: IpcMainInvokeEvent,
      request: ChatRequestWithOptions,
    ): Promise<{ success: boolean; error?: string }> => {
      log.info('[IPC] chat:sendWithOptions called');

      if (!chatService) {
        const errorMessage = 'Chat service not initialized. Call createProvider first.';
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      try {
        await chatService.chatWithOptions(request, (token: string) => {
          // Send streaming tokens back to renderer
          event.sender.send('chat:token', token);
        });
        log.info('[IPC] Chat message with options sent successfully');
        return { success: true };
      } catch (error) {
        log.error('[IPC] Error sending chat message with options:', error);
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
   * Send Chat Message with File Tools - Send message with file tools enabled and streaming
   */
  ipcMain.handle(
    'chat:sendWithFileTools',
    async (
      event: IpcMainInvokeEvent,
      request: ChatRequest,
      workingDirectory?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      log.info('[IPC] chat:sendWithFileTools called');

      if (!chatService) {
        const errorMessage = 'Chat service not initialized. Call createProvider first.';
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      try {
        if (workingDirectory) {
          chatService.setFileToolsWorkingDirectory(workingDirectory);
        }

        await chatService.chatWithFileTools(
          request,
          (token: string) => {
            // Send streaming tokens back to renderer
            event.sender.send('chat:token', token);
          },
          (toolName: string, input: unknown, notification) => {
            // Send tool use notifications back to renderer, including stage/result payload
            event.sender.send('chat:toolUse', {
              toolName,
              input,
              ...notification,
            });
          },
          (status) => {
            // Send tool status notifications back to renderer (for UI feedback)
            event.sender.send('chat:toolStatus', status);
          },
        );
        log.info('[IPC] Chat message with file tools sent successfully');
        return { success: true };
      } catch (error) {
        log.error('[IPC] Error sending chat message with file tools:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  /**
   * Set File Tools Working Directory - Configure working directory for file tools
   */
  ipcMain.handle(
    'chat:setFileToolsWorkingDirectory',
    (_event, dir: string): { success: boolean; error?: string } => {
      log.info('[IPC] chat:setFileToolsWorkingDirectory called', { dir });

      if (!chatService) {
        const errorMessage = 'Chat service not initialized. Call createProvider first.';
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      try {
        chatService.setFileToolsWorkingDirectory(dir);
        log.info('[IPC] File tools working directory set successfully');
        return { success: true };
      } catch (error) {
        log.error('[IPC] Error setting file tools working directory:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

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
  ipcMain.removeHandler('chat:sendWithOptions');
  ipcMain.removeHandler('chat:sendWithFileTools');
  ipcMain.removeHandler('chat:setFileToolsWorkingDirectory');
  ipcMain.removeHandler('chat:getAuditLogs');
  ipcMain.removeHandler('chat:destroy');
  ipcMain.removeHandler('chat:close');

  // Clean up service instance
  chatService = null;

  log.info('[IPC] Chat handlers unregistered');
}
