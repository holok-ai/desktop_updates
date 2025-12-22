import type { Message } from '../repository/thread-repository.js';
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

/**
 * Gets the next available branch index for creating a retry branch.
 * Validates that we haven't exceeded the maximum of 10 branches (0-9).
 *
 * @param threadId - The thread containing the messages
 * @param parentMessageId - The parent message ID to branch from
 * @param repository - ThreadRepository instance for data access
 * @returns The next available branch index (0-9)
 * @throws Error if maximum retry branches (9) has been reached
 *
 * @example
 * // Parent has children with branchIndex 0, 1, 2
 * const nextIndex = getNextBranchIndex(threadId, parentId, repo);
 * // Returns: 3
 */
export function getNextBranchIndex(
  threadId: string,
  parentMessageId: string | null,
  repository: ThreadRepository,
): number {
  // Get all existing children of this parent
  const siblings = repository.getMessagesByParentId(threadId, parentMessageId);

  if (siblings.length === 0) {
    // No existing children, start with index 0
    return 0;
  }

  // Find the maximum branch index currently used
  const maxIndex = Math.max(...siblings.map((m) => m.branchIndex ?? 0));

  // Check if we've hit the limit (0-9 = 10 total branches)
  if (maxIndex >= 9) {
    throw new Error('Maximum retry branches reached (max: 9)');
  }

  // Return next available index
  return maxIndex + 1;
}

/**
 * Gets all messages in the active branch path from root to a specific message.
 * This is a convenience wrapper around assembleContext for external use.
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

/**
 * Validates if a message can have another retry branch created.
 * Checks if the branch limit (10 branches, indices 0-9) has been reached.
 *
 * @param threadId - The thread containing the message
 * @param messageId - The message to check
 * @param repository - ThreadRepository instance
 * @returns true if another branch can be created, false otherwise
 */
export function canCreateRetryBranch(
  threadId: string,
  messageId: string,
  repository: ThreadRepository,
): boolean {
  const message = repository.getMessage(threadId, messageId);
  if (!message) return false;

  try {
    // Attempt to get next branch index - if it throws, we're at the limit
    getNextBranchIndex(threadId, message.parentMessageId, repository);
    return true;
  } catch {
    return false;
  }
}
