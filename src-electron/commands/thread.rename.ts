/**
 * RenameThreadCommand
 *
 * Orchestrates thread renaming: loads thread, gathers existing titles,
 * validates via titleValidationService, then delegates to threadRepository.renameThread.
 */

import { threadRepository } from '../repository/thread-repository.js';
import { titleValidationService } from '../services/title-validation.service.js';
import { apiOk, apiFail, type ApiResponse } from '../types/api-response.js';
import type { Thread } from '../types/thread.types.js';
import { createScopedLogger } from '../utils/logger.js';

const log = createScopedLogger('cmd:thread:rename');

export class RenameThreadCommand {
  async execute(threadId: string, newTitle: string, userId?: string): Promise<ApiResponse<Thread>> {
    const internal = await threadRepository.loadThread(threadId);
    if (!internal) {
      return apiFail(404, 'THREAD_NOT_FOUND');
    }

    // Gather existing titles for duplicate checking
    const allThreads = await threadRepository.listThreads();
    const existingTitles = allThreads.filter((t) => t.id !== threadId).map((t) => t.title);

    // Validate the new title
    const validation = titleValidationService.validate(newTitle, existingTitles, internal.title);

    if (!validation.valid) {
      return apiFail(400, validation.error || 'Invalid title');
    }

    const sanitizedTitle = validation.sanitizedTitle || newTitle;

    try {
      const updated = await threadRepository.renameThread(threadId, sanitizedTitle, userId);
      log.info(`Thread ${threadId} renamed to "${sanitizedTitle}"`);
      return apiOk(updated);
    } catch (error) {
      const err = error as Error;
      log.error(`Failed to rename thread ${threadId}:`, err);

      if (err.message === 'TITLE_EMPTY' || err.message === 'TITLE_TOO_LONG') {
        return apiFail(400, err.message);
      }
      return apiFail(500, err.message || 'Failed to rename thread');
    }
  }
}
