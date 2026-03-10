/**
 * Background Chat IPC Handler
 *
 * Single stateless IPC endpoint for running background AI tasks.
 * Creates an ephemeral DesktopChatService, accumulates the streamed response,
 * and returns the complete result via ApiResponse<string>.
 *
 * No queue, no state, no broadcast — the renderer-side ThreadObserver
 * manages task lifecycle and concurrency.
 */

import { ipcMain } from 'electron';
import { AuthService } from '../services/auth.service.js';
import { CreateChatServiceCommand } from '../commands/chat.create-service.js';
import { apiOk, apiFail, type ApiResponse } from '../types/api-response.js';
import type { DesktopChatRequest } from '../services/chat/index.js';
import type { BackgroundChatRequest } from '../../src-shared/types/observer.types.js';
import log from 'electron-log';

/**
 * Register the chat:background IPC handler.
 * Called once at app startup from main.ts.
 */
export function registerBackgroundChatHandler(auth: AuthService): void {
  ipcMain.handle(
    'chat:background',
    async (_event, request: BackgroundChatRequest): Promise<ApiResponse<string>> => {
      try {
        log.info('[background-chat] Executing task:', {
          taskType: request.taskType,
          threadId: request.threadId,
        });

        // Get access token
        const accessToken = await auth.getAccessToken();

        // Create ephemeral chat service
        const cmd = new CreateChatServiceCommand();
        const result = await cmd.execute(
          request.threadId,
          '0.0.0', // background tasks don't use real branches
          request.model ?? '',
          accessToken,
          undefined, // workingDirectory
          true, // excludeTools — observer tasks never use tools
        );

        if (!result.success) {
          return apiFail(-1, result.errorText);
        }

        const chatService = result.data;

        // Build the chat request
        const chatRequest: DesktopChatRequest = {
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
          streaming: true,
          model: request.model ?? '',
          system: request.system,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          responseFormat: request.responseFormat,
          thread_id: request.threadId,
          branch_id: '0.0.0',
        };

        // Accumulate streamed tokens into a buffer
        let buffer = '';
        await chatService.chat(chatRequest, (token: string) => {
          buffer += token;
        });

        log.info('[background-chat] Task completed:', {
          taskType: request.taskType,
          threadId: request.threadId,
          resultLength: buffer.length,
        });

        return apiOk(buffer);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Background chat failed';
        log.error('[background-chat] Task failed:', {
          taskType: request.taskType,
          threadId: request.threadId,
          error: errorMessage,
        });
        return apiFail(-1, errorMessage);
      }
    },
  );

  log.info('[background-chat] Handler registered');
}

/**
 * Unregister the background chat handler — called when app is closing
 */
export function unregisterBackgroundChatHandler(): void {
  ipcMain.removeHandler('chat:background');
  log.info('[background-chat] Handler unregistered');
}
