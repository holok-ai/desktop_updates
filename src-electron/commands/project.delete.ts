/**
 * DeleteProjectCommand
 *
 * Orchestrates project deletion: handles threads in the project
 * (delete or unassign) via threadRepository, then deletes the project
 * via projectRepository.
 */

import { threadRepository } from '../repository/thread-repository.js';
import { projectRepository } from '../repository/project-repository.js';
import { type ApiResponse } from '../types/api-response.js';
import type { GUID } from '../../src/lib/types/app.type.js';
import log from 'electron-log';

export class DeleteProjectCommand {
  async execute(
    projectId: string,
    options?: { deleteThreads?: boolean },
  ): Promise<ApiResponse<boolean>> {
    const pid = projectId as GUID;
    const deleteThreads = options?.deleteThreads === true;

    // Best-effort: handle threads before deleting the project
    try {
      const projectThreads = await threadRepository.listThreads({ projectId });
      if (deleteThreads) {
        await Promise.all(projectThreads.map((t) => threadRepository.deleteThread(t.id)));
      } else {
        await Promise.all(
          projectThreads.map((t) => threadRepository.setThreadProjectId(t.id, null)),
        );
      }
    } catch (error) {
      log.warn('[DeleteProjectCommand] Failed to handle project threads before deletion:', error);
    }

    const result = await projectRepository.deleteProject(pid);
    return result;
  }
}
