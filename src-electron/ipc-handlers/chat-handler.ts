import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ChatService } from '../services/chat/ChatService.js';
import type {
  ChatRequest,
  ChatRequestWithOptions,
} from '../services/chat/interfaces/ChatMessage.js';
import type { ProviderConfig } from '../services/chat/factories/ChatProviderFactory.js';
import log from 'electron-log';

/**
 * Chat IPC Handlers
 * Handles all chat-related IPC communication between renderer and main process.
 * Manages ChatService lifecycle and streaming token responses.
 */

let chatService: ChatService | null = null;

/**
 * Register all chat IPC handlers
 */
export function registerChatHandlers(): void {
  /**
   * Create Chat Provider - Initialize ChatService with provider type and config
   */
  ipcMain.handle(
    'chat:createProvider',
    (
      _event,
      providerType: string,
      config: ProviderConfig,
    ): { success: boolean; error?: string } => {
      log.info('[IPC] chat:createProvider called', { providerType });

      try {
        chatService = new ChatService(providerType, config, true);
        log.info('[IPC] Chat service created successfully');
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

  log.info('[IPC] Chat handlers registered');
}

/**
 * Unregister chat handlers - Called when app is closing
 */
export function unregisterChatHandlers(): void {
  ipcMain.removeHandler('chat:createProvider');
  ipcMain.removeHandler('chat:send');
  ipcMain.removeHandler('chat:sendWithOptions');
  ipcMain.removeHandler('chat:getAuditLogs');
  ipcMain.removeHandler('chat:destroy');

  // Clean up service instance
  chatService = null;

  log.info('[IPC] Chat handlers unregistered');
}
