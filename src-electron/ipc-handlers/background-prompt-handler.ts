import { ipcMain, BrowserWindow } from 'electron';
import { BackgroundPromptService } from '../services/background-prompt.service.js';
import { AuthService } from '../services/auth.service.js';
import log from 'electron-log';
import { apiOk, apiFail, type ApiResponse } from '../types/api-response.js';
import type {
  BackgroundPromptRequest,
  BackgroundPromptResult,
} from '../../src-shared/types/background-prompt.types.js';

/**
 * Background Prompt IPC Handlers
 *
 * Handles all background prompt-related IPC communication between renderer and main process.
 * Manages the BackgroundPromptService lifecycle and result broadcasting.
 *
 * Channels:
 * - bgprompt:submit — Enqueue a background prompt task
 * - bgprompt:cancel — Cancel a specific task by taskId
 * - bgprompt:cancelAllForThread — Cancel all tasks for a given thread
 * - bgprompt:result — Event broadcast when a task completes/fails (renderer listens)
 */

let service: BackgroundPromptService | null = null;

/**
 * Broadcast an event to all renderer windows
 */
function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, ...args);
  });
}

/**
 * Register all background prompt IPC handlers
 */
export function registerBackgroundPromptHandlers(auth?: AuthService): void {
  service = new BackgroundPromptService();

  // Wire auth service for access token resolution
  if (auth) {
    service.setAuthService(auth);
  }

  // Wire the broadcast function so results flow back to the renderer
  service.setBroadcastFn((result: BackgroundPromptResult) => {
    broadcast('bgprompt:result', result);
  });

  /**
   * Submit a background prompt task
   */
  ipcMain.handle(
    'bgprompt:submit',
    (_event, request: BackgroundPromptRequest): ApiResponse<void> => {
      try {
        if (!service) {
          return apiFail(-1, 'BackgroundPromptService not initialized');
        }

        log.info('[IPC] bgprompt:submit called:', {
          taskId: request.taskId,
          type: request.type,
          threadId: request.threadId,
        });

        service.submit(request);
        return apiOk(undefined) as ApiResponse<void>;
      } catch (error) {
        log.error('[IPC] Error submitting background prompt:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return apiFail(-1, errorMessage);
      }
    },
  );

  /**
   * Cancel a specific background prompt task
   */
  ipcMain.handle('bgprompt:cancel', (_event, taskId: string): ApiResponse<void> => {
    if (!service) {
      return apiFail(-1, 'BackgroundPromptService not initialized');
    }

    log.info('[IPC] bgprompt:cancel called for taskId:', taskId);
    service.cancel(taskId);
    return apiOk(undefined) as ApiResponse<void>;
  });

  /**
   * Cancel all background prompt tasks for a thread
   */
  ipcMain.handle('bgprompt:cancelAllForThread', (_event, threadId: string): ApiResponse<void> => {
    if (!service) {
      return apiFail(-1, 'BackgroundPromptService not initialized');
    }

    log.info('[IPC] bgprompt:cancelAllForThread called for thread:', threadId);
    service.cancelAllForThread(threadId);
    return apiOk(undefined) as ApiResponse<void>;
  });

  log.info('[IPC] Background prompt handlers registered');
}

/**
 * Get the background prompt service instance (for direct use by other handlers)
 */
export function getBackgroundPromptService(): BackgroundPromptService | null {
  return service;
}

/**
 * Unregister background prompt handlers — called when app is closing
 */
export function unregisterBackgroundPromptHandlers(): void {
  ipcMain.removeHandler('bgprompt:submit');
  ipcMain.removeHandler('bgprompt:cancel');
  ipcMain.removeHandler('bgprompt:cancelAllForThread');

  if (service) {
    service.cleanup();
    service = null;
  }

  log.info('[IPC] Background prompt handlers unregistered');
}
