/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { ApiResponse } from '../../../src-electron/preload.js';
import type { Message } from '$lib/types/thread.type.js';
import { threadMessageService } from './thread-message.service';

/**
 * Domain service for thread branch operations.
 *
 * Owns:
 * - Branch lane selection (selectBranchLane)
 * - Branch deletion (deleteBranch)
 *
 * Depends on: ThreadMessageService (for updateMessageDesktopOptions)
 *
 * Plain singleton (no IPC listeners).
 */
export class ThreadBranchService {
  private static instance: ThreadBranchService;

  private constructor() {}

  static getInstance(): ThreadBranchService {
    if (!ThreadBranchService.instance) {
      ThreadBranchService.instance = new ThreadBranchService();
    }
    return ThreadBranchService.instance;
  }

  /**
   * Mark the selected branch lane as isSelectedBranch=true and all other lanes in the same
   * branch row as isSelectedBranch=false.
   *
   * @param threadId - The thread ID
   * @param selectedLaneBranchId - The lane.branchId of the selected lane (e.g. "2.1")
   * @param messages - Current messages array to search for user prompts in each lane
   */
  async selectBranchLane(
    threadId: string,
    selectedLaneBranchId: string,
    messages: Message[],
  ): Promise<void> {
    const [rowStr, laneStr] = selectedLaneBranchId.split('.');
    const row = parseInt(rowStr);
    const selectedLaneNum = parseInt(laneStr);

    // Iterate lane numbers 1, 2, 3… stopping when no user message found for that lane
    for (let laneNum = 1; ; laneNum++) {
      const lanePrefix = `${row}.${laneNum}.`;
      const firstUserMsg = messages.find(
        (m) => m.branchId.startsWith(lanePrefix) && m.role === 'user',
      );
      if (!firstUserMsg) {
        break;
      }

      const wasselected = laneNum === selectedLaneNum;
      const result = await threadMessageService.updateMessageDesktopOptions(
        threadId,
        firstUserMsg.id,
        {
          isSelectedBranch: wasselected,
        },
      );
      if (!result.success) {
        console.error(
          `[ThreadBranchService] selectBranchLane: failed to set isSelectedBranch=${String(wasselected)}`,
          firstUserMsg.id,
          result,
        );
      }
    }
  }

  /**
   * Delete a branch from a thread
   */
  async deleteBranch(threadId: string, branchId: string): Promise<ApiResponse<void>> {
    return window.electronAPI.thread.deleteBranch(threadId, branchId);
  }
}

export const threadBranchService = ThreadBranchService.getInstance();
