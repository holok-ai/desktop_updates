/**
 * CreateChatServiceCommand
 *
 * Orchestrates chat service creation: loads the thread from threadRepository,
 * resolves the agent from modelRepository, then assembles and returns
 * a DesktopChatService instance.
 */

import type { ProviderConfig } from '@holokai/chat-component';
import { DesktopChatService } from '../services/chat/index.js';
import { threadRepository } from '../repository/thread-repository.js';
import { modelRepository } from '../repository/model-repository.js';
import { apiFail, apiOk, type ApiResponse } from '../types/api-response.js';
import log from 'electron-log';

export class CreateChatServiceCommand {
  async execute(
    threadId: string,
    branchId: string,
    modelAccessName: string,
    accessToken: string,
    workingDirectory?: string,
  ): Promise<ApiResponse<DesktopChatService>> {
    // Load thread — must already exist since we're chatting on it
    const thisThread = await threadRepository.loadThread(threadId);
    if (!thisThread) {
      log.error('[CreateChatServiceCommand] Could not find thread for chat service.');
      return apiFail(-1, 'Could not find thread id');
    }

    // Resolve the agent to get the provider URL
    const agentResult = await modelRepository.getAgentById(thisThread.metadata.agentId);
    if (!agentResult.success) {
      log.error('[CreateChatServiceCommand] Could not find agent for thread chat service.');
      return apiFail(-1, 'Could not find agent for thread');
    }

    const url: string = agentResult.data.url ?? '';
    const provider: string = agentResult.data.provider;

    const config: ProviderConfig = {
      url,
      apiKey: accessToken,
      model: modelAccessName,
    };

    const chatService = new DesktopChatService(provider, config, workingDirectory);
    return apiOk(chatService);
  }
}
