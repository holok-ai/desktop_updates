import type { BranchType, Message } from '../repository/thread-repository.js';
import type { ThreadRepository } from '../repository/thread-repository.js';

/**
 * Assembles context for LLM by walking up the message tree from a given message to the root.
 * Returns an ordered array of messages from root to the specified message.
 *
 * @param threadId - The thread containing the message
 * @param messageId - The message ID to start from
 * @param repository - ThreadRepository instance for data access
 * @returns Array of messages ordered from root to current message
 *
 * @example
 * // Given a tree: Root -> M1 -> M2 (branch 0) -> M3
 * //                          \-> M2a (branch 1)
 * const context = assembleContext(threadId, 'M3', repo);
 * // Returns: [Root, M1, M2, M3]
 */
export function assembleContext(
  threadId: string,
  messageId: string,
  repository: ThreadRepository,
): Message[] {
  const path: Message[] = [];
  let currentId: string | null = messageId;

  // Walk up the tree from current message to root
  while (currentId !== null) {
    const message = repository.getMessage(threadId, currentId);
    if (!message) {
      // Message not found - invalid tree state
      break;
    }

    // Add to front of array (building root-to-current order)
    path.unshift(message);

    // Move to parent
    currentId = message.parentMessageId;
  }

  return path;
}

export function getNextBranchIndex(
  threadId: string,
  parentMessageId: string | null,
  branchType: Exclude<BranchType, null>,
  repository: ThreadRepository,
): number {
  const siblings = repository.getMessagesByParentId(threadId, parentMessageId);

  if (branchType === 'prompt-variation') {
    const hasPromptVariation = siblings.some((m) => m.branchType === 'prompt-variation');
    if (hasPromptVariation) {
      throw new Error('Only one prompt variation allowed');
    }
    return 1;
  }

  const usedIndices = new Set<number>();
  for (const m of siblings) {
    if (typeof m.branchIndex === 'number') {
      usedIndices.add(m.branchIndex);
    }
  }

  for (let i = 1; i <= 9; i += 1) {
    if (!usedIndices.has(i)) {
      return i;
    }
  }

  throw new Error('Maximum variation branches reached (max: 9)');
}

/**
 * Gets all messages in the active branch path from root to a specific message.
 * This is a convenience wrapper around assembleContext for external use and
 * is intended to back the "Continue with this branch" command.
 *
 * @param threadId - The thread containing the message
 * @param messageId - The message ID to build context for
 * @param repository - ThreadRepository instance
 * @returns Array of messages in the active path
 */
export function getActiveBranchPath(
  threadId: string,
  messageId: string,
  repository: ThreadRepository,
): Message[] {
  return assembleContext(threadId, messageId, repository);
}
