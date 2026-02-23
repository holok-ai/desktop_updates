/**
 * CreateThreadCommand
 *
 * Orchestrates thread creation: validates the requested model exists
 * (via modelRepository), then delegates to threadRepository.createThread.
 */

import { modelRepository } from '../repository/model-repository.js';
import { threadRepository } from '../repository/thread-repository.js';
import { apiOk, apiFail, type ApiResponse } from '../types/api-response.js';
import type { Thread } from '../types/thread.types.js';
import type { CreateThreadRequest } from '../services/mokuapi/thread.types.js';
import { createScopedLogger } from '../utils/logger.js';

const log = createScopedLogger('cmd:thread:create');

export class CreateThreadCommand {
  async execute(request: CreateThreadRequest): Promise<ApiResponse<Thread>> {
    log.info('Execute', { title: request.title, agentId: request.agentId });

    // Validate model availability when a model is specified
    if (request.initalModel) {
      const modelsResult = await modelRepository.listAllModels();
      if (!modelsResult.success) {
        return apiFail(-1, 'Failed to load models');
      }
      const mdl = modelsResult.data.find(
        (m) => m.id === request.initalModel || m.accessName === request.initalModel,
      );
      if (!mdl) {
        return apiFail(400, 'Model unavailable—choose another');
      }
    }

    const thread = await threadRepository.createThread(request);
    return apiOk(thread);
  }
}
