import type { Message } from '../repository/thread-repository.js';
import type { ThreadRepository } from '../repository/thread-repository.js';

/**
 * Assembles context for LLM by finding all messages in the same branch hierarchy.
 * Returns an ordered array of messages from root to the specified message based on branchId.
 *
 * @param threadId - The thread containing the message
 * @param messageId - The message ID to start from
 * @param repository - ThreadRepository instance for data access
 * @returns Array of messages ordered from root to current message
 *
 * @example
 * // Given branchIds: "1.0" -> "1.0" -> "1.1" (branch) -> "1.1.1"
 * const context = assembleContext(threadId, messageId_of_1.1.1, repo);
 * // Returns all messages with branchIds: "1.0", "1.1", "1.1.1"
 */
export function assembleContext(
  threadId: string,
  messageId: string,
  repository: ThreadRepository,
): Message[] {
  const message = repository.getMessage(threadId, messageId);
  if (!message) {
    return [];
  }

  const targetBranchId = message.branchId;

  // Load thread to get all messages
  const loadedThread = repository['threadsById'].get(threadId);
  if (!loadedThread) {
    return [];
  }

  // Get all messages that belong to this branch hierarchy
  // For branchId "1.1.1", include messages with "1.0", "1.1", "1.1.1"
  const branchParts = targetBranchId.split('.');
  const relevantBranchIds = new Set<string>();
  
  // Build all parent branch IDs
  for (let i = 1; i <= branchParts.length; i++) {
    relevantBranchIds.add(branchParts.slice(0, i).join('.'));
  }

  // Filter and sort messages by their branch hierarchy
  const relevantMessages = loadedThread.messages.filter((m: Message) => 
    relevantBranchIds.has(m.branchId)
  );

  // Sort by creation time to maintain conversation order
  relevantMessages.sort((a: Message, b: Message) => a.createdAt - b.createdAt);

  return relevantMessages;
}

/**
 * Gets the next branchId for creating a variation.
 *
 * @param currentBranchId - The branch ID to create a variation from
 * @param threadId - The thread ID
 * @param repository - ThreadRepository instance
 * @returns Next available branch ID (e.g., "1.0" -> "1.1", "1.1" -> "1.2")
 */
export function getNextBranchId(
  currentBranchId: string,
  threadId: string,
  repository: ThreadRepository,
): string {
  const loadedThread = repository['threadsById'].get(threadId);
  if (!loadedThread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  // Parse current branch ID
  const parts = currentBranchId.split('.');

  // Find all existing variations at this level
  const existingVariations = loadedThread.messages
    .map((m: Message) => m.branchId)
    .filter((bid: string) => {
      const bidParts = bid.split('.');
      // Must be exactly one level deeper and share the same base
      if (bidParts.length !== parts.length + 1) return false;
      const bidBase = bidParts.slice(0, -1).join('.');
      return bidBase === currentBranchId;
    });

  // Find the next available index
  let nextIndex = 1;
  while (existingVariations.includes(`${currentBranchId}.${nextIndex}`)) {
    nextIndex++;
    if (nextIndex > 99) {
      throw new Error('Maximum branch variations reached (max: 99)');
  }
  }

  return `${currentBranchId}.${nextIndex}`;
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
