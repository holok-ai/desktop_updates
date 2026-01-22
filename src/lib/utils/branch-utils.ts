/**
 * Branch utilities for thread message tree operations using hierarchical branchId
 */

import type { Message } from '$lib/types/thread.type';

export interface BranchInfo {
  baseBranchId: string;
  branches: Array<{
    branchId: string;
    messages: Message[];
  }>;
  selectedBranchId: string | null;
}

/**
 * Parse branchId to get depth and hierarchy
 * E.g., "1.0" -> {parts: ["1", "0"], depth: 2}
 */
export function parseBranchId(branchId: string): { parts: string[]; depth: number } {
  const parts = branchId.split('.');
  return { parts, depth: parts.length };
}

/**
 * Normalize branchId to always use 3-part "x.y.z" format.
 * Back-compat:
 * - "2.0" -> "2.0.0"
 * - "2.1.0" -> "2.1.0"
 * - Longer ids are capped to 3 parts
 */
export function normalizeBranchId(branchId: string): string {
  const parts = branchId.split('.');
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1]}.0`;
  }
  if (parts.length > 3) {
    return parts.slice(0, 3).join('.');
  }
  return branchId;
}

/**
 * Get the row number from a branchId (first number)
 * E.g., "2.0" -> 2, "2.1.0" -> 2, "3.0" -> 3
 */
export function getRowNumber(branchId: string): number {
  const parts = branchId.split('.');
  const firstPart = parts[0] ?? '';
  const rowNum = Number.parseInt(firstPart !== '' ? firstPart : '0', 10);
  return Number.isNaN(rowNum) ? 0 : rowNum;
}

/**
 * Check if branchId is a variation of baseBranchId
 * E.g., "1.0.1" is a variation of "1.0"
 */
export function isVariationOf(branchId: string, baseBranchId: string): boolean {
  return branchId.startsWith(`${baseBranchId  }.`);
}

/**
 * Get all variation branches for a specific base branchId
 * E.g., for "1.0", get all "1.0.1", "1.0.2", etc.
 */
export function getVariationsForBranch(messages: Message[], baseBranchId: string): Message[] {
  // Normalize baseBranchId to 3-part format
  const normalizedBase = normalizeBranchId(baseBranchId);
  const baseParts = normalizedBase.split('.');
  const [baseNum] = baseParts;
  
  // 3-part scheme:
  // - main lane: baseNum.0.0
  // - variation roots: baseNum.<lane>.0, where <lane> > 0
  const candidates = messages.filter((m) => {
    const normalizedId = normalizeBranchId(m.branchId);
    const parts = normalizedId.split('.');
    if (parts.length !== 3) {
      return false;
    }
    if (parts[0] !== baseNum || parts[1] === '0' || parts[2] !== '0') {
      return false;
    }
    // Middle part must be a valid number > 0
    const middleNum = Number.parseInt(parts[1], 10);
    if (Number.isNaN(middleNum) || middleNum <= 0) {
      return false;
    }
    // Only treat user messages as variation roots
    if (m.role !== 'user') {
      return false;
    }
    return true;
  });

  const byBranch = new Map<string, Message>();

  for (const m of candidates) {
    const existing = byBranch.get(m.branchId);
    if (existing === undefined || m.createdAt < existing.createdAt) {
      byBranch.set(m.branchId, m);
    }
  }

  return Array.from(byBranch.values()).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Check if a branch has any variations
 */
export function hasVariations(messages: Message[], branchId: string): boolean {
  return getVariationsForBranch(messages, branchId).length > 0;
}

/**
 * Get the fork point message for a given branchId
 * Returns the user message that is the fork point (has variations created from it)
 */
function getForkPointMessage(messages: Message[], branchId: string): Message | null {
  const normalized = normalizeBranchId(branchId);
  
  // Check if this branch has variations
  if (!hasVariations(messages, normalized)) {
    return null;
  }
  
  // Find the user message with this branchId (the fork point)
  const forkPointMessage = messages.find(m => {
    const normalizedMsgId = normalizeBranchId(m.branchId);
    return normalizedMsgId === normalized && m.role === 'user';
  });
  
  return forkPointMessage ?? null;
}

/**
 * Get message IDs that should be hidden after a fork point in the original branch
 * When a variation is created from a middle message, messages after the fork point should be hidden
 * @param messages - All messages in the thread
 * @param onlyHideBeforeVariation - If true, only hide messages created before the variation was created
 * @returns Set of message IDs that should be excluded from display
 */
export function getMessagesToHideAfterForkPoint(messages: Message[], onlyHideBeforeVariation: boolean = false): Set<string> {
  const hiddenIds = new Set<string>();
  const forkPoints = getForkPoints(messages);
  
  for (const forkBranchId of forkPoints) {
    const forkPointMessage = getForkPointMessage(messages, forkBranchId);
    if (!forkPointMessage) continue;
    
    const forkPointRowNum = getRowNumber(forkPointMessage.branchId);
    const forkPointCreatedAt = forkPointMessage.createdAt;
    
    // Find the variation message to get its creation time
    // The variation is the first message with branchId like X.Y.0 where Y > 0
    const variationMessage = messages.find(m => {
      const normalizedId = normalizeBranchId(m.branchId);
      const parts = normalizedId.split('.');
      return parts.length === 3 && 
             parts[0] === String(forkPointRowNum) && 
             parts[1] !== '0' && 
             parts[2] === '0' &&
             m.role === 'user';
    });
    
    const variationCreatedAt = variationMessage?.createdAt ?? forkPointCreatedAt;
    
    // Find all messages that come after the fork point in the original branch path
    // These are messages with branchId format X.0.0 where X > forkPointRowNum
    for (const msg of messages) {
      const msgNormalized = normalizeBranchId(msg.branchId);
      const msgParts = msgNormalized.split('.');
      const msgRowNum = getRowNumber(msgNormalized);
      
      // Check if this is a message in the original branch path after the fork point
      const isOriginalBranchPath = msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0';
      
      if (isOriginalBranchPath && msgRowNum > forkPointRowNum) {
        if (onlyHideBeforeVariation) {
          // Only hide messages that existed before the variation was created
          // This allows new messages created after branch selection to be visible
          if (msg.createdAt < variationCreatedAt) {
            hiddenIds.add(msg.id);
          }
        } else {
          // Hide all messages after fork point (before branch selection)
          hiddenIds.add(msg.id);
        }
      }
    }
  }
  
  return hiddenIds;
}

/**
 * Get all messages belonging to a specific branch (including all ancestors)
 * E.g., for "1.0.1", returns messages with branchIds: "1.0", "1.0.1"
 * 
 * When a variation is created from a message, fork point logic applies:
 * - Original branch: includes messages up to and including fork point, excludes messages after
 * - Variation branch: includes messages before fork point, excludes fork point and messages after
 */
export function getBranchMessages(messages: Message[], branchId: string): Message[] {
  const normalized = normalizeBranchId(branchId);
  const parts = normalized.split('.');
  const relevantBranchIds = new Set<string>();
  
  // Build all parent branch IDs
  for (let i = 1; i <= parts.length; i++) {
    relevantBranchIds.add(parts.slice(0, i).join('.'));
  }

  // Check if this is a variation branch (middle part > 0)
  const isVariationBranch = parts.length === 3 && parts[1] !== '0';
  
  // Get fork point if this branch or its base has variations
  const baseBranchId = isVariationBranch ? `${parts[0]}.0.0` : normalized;
  const forkPointMessage = getForkPointMessage(messages, baseBranchId);
  
  // Collect messages in the branch hierarchy (ancestors)
  let branchMessages = messages
    .filter((m) => {
      const normalizedMsgId = normalizeBranchId(m.branchId);
      return relevantBranchIds.has(normalizedMsgId);
    })
    .sort((a, b) => a.createdAt - b.createdAt);
  
  // Apply fork point exclusion logic
  if (forkPointMessage) {
    const forkPointRowNum = getRowNumber(forkPointMessage.branchId);
    
    // Filter branch hierarchy messages based on fork point
    branchMessages = branchMessages.filter((m) => {
      const msgRowNum = getRowNumber(m.branchId);
      const msgNormalized = normalizeBranchId(m.branchId);
      const msgParts = msgNormalized.split('.');
      
      // Messages before the fork point row are always included
      if (msgRowNum < forkPointRowNum) {
        return true;
      }
      
      // For the fork point row itself
      if (msgRowNum === forkPointRowNum) {
        if (isVariationBranch) {
          // Variation branch: exclude the fork point message itself
          return m.id !== forkPointMessage.id;
        } else {
          // Original branch: include the fork point message
          return true;
        }
      }
      
      // For messages after the fork point row
      if (msgRowNum > forkPointRowNum) {
        // Check if this message belongs to the original branch path (X.0.0 format)
        const isOriginalBranchPath = msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0';
        
        if (isOriginalBranchPath) {
          // Exclude messages in the original branch path after the fork point
          return false;
        }
        
        // Include messages that are part of the current branch (variation or continuation)
        if (isVariationBranch) {
          // For variation branch, include messages in this variation's path
          const variationPrefix = `${parts[0]}.${parts[1]}`;
          return msgNormalized.startsWith(`${variationPrefix}.`);
        } else {
          // For original branch, exclude all messages after fork point
          return false;
        }
      }
      
      return true;
    });
    
    // Include sequential messages (X.0.0 format) before the fork point
    // These are messages in the main conversation path before the fork
    const sequentialMessages = messages.filter((m) => {
      const msgNormalized = normalizeBranchId(m.branchId);
      const msgParts = msgNormalized.split('.');
      const msgRowNum = getRowNumber(msgNormalized);
      
      // Include sequential messages (X.0.0 format) before the fork point
      if (msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0') {
        if (isVariationBranch) {
          // Variation branch: exclude fork point, include only before
          return msgRowNum < forkPointRowNum;
        } else {
          // Original branch: include up to and including fork point
          return msgRowNum <= forkPointRowNum;
        }
      }
      
      return false;
    });
    
    // Merge branch hierarchy messages and sequential messages, deduplicate
    const allMessages = [...branchMessages, ...sequentialMessages];
    const seenIds = new Set<string>();
    branchMessages = allMessages.filter((m) => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    }).sort((a, b) => a.createdAt - b.createdAt);
  } else {
    // No fork point, include sequential messages in the main path
    const rowNum = getRowNumber(normalized);
    const sequentialMessages = messages.filter((m) => {
      const msgNormalized = normalizeBranchId(m.branchId);
      const msgParts = msgNormalized.split('.');
      const msgRowNum = getRowNumber(msgNormalized);
      
      // Include sequential messages (X.0.0 format) up to this row
      if (msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0') {
        return msgRowNum <= rowNum;
      }
      
      return false;
    });
    
    // Merge and deduplicate
    const allMessages = [...branchMessages, ...sequentialMessages];
    const seenIds = new Set<string>();
    branchMessages = allMessages.filter((m) => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    }).sort((a, b) => a.createdAt - b.createdAt);
  }

  return branchMessages;
}

/**
 * Assemble context by getting all messages in the same branch hierarchy
 * Returns ordered array [root...current] following the branch path
 */
export function assembleContext(messages: Message[], messageId: string): Message[] {
  const message = messages.find(m => m.id === messageId);
  if (message === null || message === undefined) {return [];}
  
  return getBranchMessages(messages, message.branchId);
}

/**
 * Get the main branch path (branchId starting with "1.0")
 */
export function getMainBranchPath(messages: Message[]): Message[] {
  return messages
    .filter((m) => {
      const normalizedId = normalizeBranchId(m.branchId);
      return normalizedId === '1.0.0' || normalizedId.startsWith('1.0.0.');
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get all fork points (branchIds that have variations)
 */
export function getForkPoints(messages: Message[]): string[] {
  const forkPoints = new Set<string>();
  
  for (const message of messages) {
    const normalizedId = normalizeBranchId(message.branchId);
    const parts = normalizedId.split('.');
    // Variation root: "<base>.<lane>.0" where lane > 0
    // Fork point is "<base>.0.0"
    if (parts.length === 3 && parts[1] !== '0' && parts[2] === '0') {
      const baseNum = parts[0] ?? '0';
      const parentBranchId = `${baseNum}.0.0`;
      forkPoints.add(parentBranchId);
    }
  }
  
  return Array.from(forkPoints);
}

/**
 * Check if a branchId is a fork point
 */
export function isForkPoint(messages: Message[], branchId: string): boolean {
  return hasVariations(messages, branchId);
}

/**
 * Get the first variation point in a thread
 * Returns the base branchId where the first variation occurred
 */
export function getFirstForkPoint(messages: Message[]): string | null {
  const forkPoints = getForkPoints(messages);
  if (forkPoints.length === 0) {return null;}
  
  // Sort by depth (shallowest first) and return the first one
  forkPoints.sort((a, b) => {
    const depthA = a.split('.').length;
    const depthB = b.split('.').length;
    if (depthA !== depthB) {return depthA - depthB;}
    // Same depth, sort lexicographically
    return a.localeCompare(b);
  });
  
  return forkPoints[0];
}

/**
 * Get next available branchId for creating a variation
 * E.g., from "1.0" -> "1.0.1", from "1.0" -> "1.0.2" (if 1.0.1 exists)
 */
export function getNextVariationBranchId(baseBranchId: string, messages: Message[]): string {
  const normalizedBase = normalizeBranchId(baseBranchId);
  const baseParts = normalizedBase.split('.');
  const baseNum = Number.parseInt(baseParts[0] ?? '0', 10);
  
  // Find existing variations: baseNum.X.0
  const existingIndices: number[] = [];
  for (const m of messages) {
    const parts = normalizeBranchId(m.branchId).split('.');
    if (parts.length === 3 && parts[0] === (baseParts[0] ?? '') && parts[2] === '0') {
      const middleNum = Number.parseInt(parts[1] ?? '0', 10);
      if (!Number.isNaN(middleNum) && middleNum > 0) {
        existingIndices.push(middleNum);
      }
    }
  }
  
  // Find the next available middle index
  let nextIndex = 1;
  while (existingIndices.includes(nextIndex)) {
    nextIndex++;
    if (nextIndex > 99) {
      throw new Error('Maximum branch variations reached (max: 99)');
    }
  }
  
  // Return format: "baseNum.nextIndex.0" (e.g., "2.1.0", "2.2.0")
  return `${baseNum}.${nextIndex}.0`;
}

/**
 * Get the next branchId for continuing a conversation in an existing branch
 * E.g., "2.1.0" -> "2.1.1", "2.1.1" -> "2.1.2", "2.0" -> "2.1"
 * @param currentBranchId - The current branchId to continue from
 * @param messages - All messages in the thread
 * @returns The next branchId in the same branch hierarchy
 */
export function getNextBranchIdInBranch(currentBranchId: string, messages: Message[]): string {
  // Normalize to 3-part format first
  const normalizedId = normalizeBranchId(currentBranchId);
  const parts = normalizedId.split('.');
  const baseNum = parts[0] ?? '0';
  const variationNum = parts[1] ?? '0';
  const third = parts[2] ?? '0';

  // Root: X.Y.0
  if (parts.length === 3 && third === '0') {
    const existing: number[] = [];
    for (const m of messages) {
      const mParts = normalizeBranchId(m.branchId).split('.');
      if (mParts.length === 3 && mParts[0] === baseNum && mParts[1] === variationNum && mParts[2] !== '0') {
        const idx = Number.parseInt(mParts[2] ?? '0', 10);
        if (!Number.isNaN(idx) && idx > 0) {
          existing.push(idx);
        }
      }
    }
    let next = 1;
    while (existing.includes(next)) {
      next += 1;
      if (next > 99) {
        break;
      }
    }
    return `${baseNum}.${variationNum}.${next}`;
  }

  // Continuation: X.Y.Z -> increment Z
  if (parts.length === 3 && third !== '0') {
    const currentIdx = Number.parseInt(third, 10);
    const next = Number.isNaN(currentIdx) ? 1 : currentIdx + 1;
    return `${baseNum}.${variationNum}.${next}`;
  }

  return normalizedId;
}

/**
 * Get the next sequential branchId for a linear conversation
 * E.g., if messages have "1.0", "2.0", "3.0", returns "4.0"
 * @param messages - All messages in the thread
 * @returns The next sequential branchId (e.g., "2.0", "3.0")
 */
export function getNextSequentialBranchId(messages: Message[]): string {
  // Find all top-level: "N.0.0"
  const topLevelBranchIds = messages
    .map(m => normalizeBranchId(m.branchId))
    .filter(bid => {
      const parts = bid.split('.');
      return parts.length === 3 && parts[1] === '0' && parts[2] === '0';
    })
    .map(bid => {
      const [firstPart] = bid.split('.');
      const num = Number.parseInt(firstPart !== undefined && firstPart.length > 0 ? firstPart : '0', 10);
      return Number.isNaN(num) ? 0 : num;
    })
    .filter(num => num > 0);

  // Find the highest number and increment
  const maxNum = topLevelBranchIds.length > 0 ? Math.max(...topLevelBranchIds) : 0;
  const nextNum = maxNum + 1;
  
  return `${nextNum}.0.0`;
}

/**
 * Check if message can have a variation created from it
 */
export function canCreateVariation(message: Message | undefined): boolean {
  if (message?.role !== 'user') {
    return false;
  }

  // Allow creating variations from any user message
  return true;
}

/**
 * Get all branch boxes for horizontal display
 * Returns array of branches with their messages
 */
export function getBranchBoxes(messages: Message[], forkBranchId: string): Array<{
  branchId: string;
  messages: Message[];
  isOriginal: boolean;
}> {
  const variations = getVariationsForBranch(messages, forkBranchId);
  const boxes: Array<{
    branchId: string;
    messages: Message[];
    isOriginal: boolean;
  }> = [];
  
  // Add original branch
  boxes.push({
    branchId: forkBranchId,
    messages: getBranchMessages(messages, forkBranchId),
    isOriginal: true,
  });
  
  // Add each variation
  for (const variation of variations) {
    boxes.push({
      branchId: variation.branchId,
      messages: getBranchMessages(messages, variation.branchId),
      isOriginal: false,
    });
  }
  
  return boxes;
}

/**
 * Build context from multiple selected branches
 * Includes all messages from selected branches and excludes non-selected branches from same rows
 * Permanently excludes messages that come after fork points in the original branch path
 * @param messages - All messages in the thread
 * @param selectedBranchIds - Array of selected branch IDs
 * @param currentVariationBranchId - Optional: the variation branch ID we're building context for (e.g., "6.1.0")
 *                                   If provided, messages after this fork point will be excluded
 */
export function buildContextFromSelectedBranches(
  messages: Message[],
  selectedBranchIds: string[],
  currentVariationBranchId?: string,
): Message[] {
  if (selectedBranchIds.length === 0) {
    // No selected branches, return all messages (main branch)
    return messages;
  }

  // Get all fork points
  const forkPoints = getForkPoints(messages);
  
  if (forkPoints.length === 0) {
    // No forks, return all messages
    return messages;
  }

  // Find the highest row number among ALL selected branches
  // Sequential messages after any selected branch should be included
  let maxSelectedBranchRow = 0;
  for (const branchId of selectedBranchIds) {
    const rowNum = getRowNumber(branchId);
    if (rowNum > maxSelectedBranchRow) {
      maxSelectedBranchRow = rowNum;
    }
  }

  // If building context for a specific variation branch or continuation from a fork point, get its fork point
  let currentVariationForkPointRow: number | null = null;
  let currentVariationForkPointMessage: Message | null = null;
  if (currentVariationBranchId) {
    const normalizedVariationId = normalizeBranchId(currentVariationBranchId);
    const variationParts = normalizedVariationId.split('.');
    if (variationParts.length === 3) {
      if (variationParts[1] !== '0') {
        // This is a variation branch (e.g., 6.1.0), the fork point is at the same row (6.0.0)
        currentVariationForkPointRow = getRowNumber(normalizedVariationId);
        // Get the fork point message to exclude it
        const forkPointBranchId = `${variationParts[0]}.0.0`;
        currentVariationForkPointMessage = getForkPointMessage(messages, forkPointBranchId);
      } else if (variationParts[2] !== '0') {
        // This is a continuation from an original branch (e.g., 7.0.2 from 7.0.0)
        // Check if the base branch (7.0.0) is a fork point (has variations)
        const forkPointBranchId = `${variationParts[0]}.0.0`;
        if (hasVariations(messages, forkPointBranchId)) {
          // The base branch is a fork point, exclude messages after it
          currentVariationForkPointRow = getRowNumber(normalizedVariationId);
          // Get the fork point message to exclude it
          currentVariationForkPointMessage = getForkPointMessage(messages, forkPointBranchId);
        }
      }
    }
  }

  // Find all fork point rows that have selected branches (to exclude messages after them)
  const forkPointRowsWithSelectedBranches = new Set<number>();
  for (const forkBranchId of forkPoints) {
    const forkPointMessage = getForkPointMessage(messages, forkBranchId);
    if (!forkPointMessage) continue;
    
    const forkPointRowNum = getRowNumber(forkPointMessage.branchId);
    
    // Check if there's a selected branch at the same row as this fork point
    const hasSelectedBranchAtForkRow = selectedBranchIds.some(branchId => {
      const branchRowNum = getRowNumber(branchId);
      return branchRowNum === forkPointRowNum;
    });
    
    if (hasSelectedBranchAtForkRow) {
      forkPointRowsWithSelectedBranches.add(forkPointRowNum);
    }
  }

  // Build set of messages to permanently exclude (messages after fork points in original branch path)
  // Messages that come after a fork point in the original path should be excluded
  // EXCEPT sequential messages that come after the highest selected branch row
  // This set contains messages that should NEVER be included, even if they come after a selected branch
  const permanentlyExcludedIds = new Set<string>();
  // Also track messages that are temporarily excluded but can be included if they come after a selected branch
  const temporarilyExcludedIds = new Set<string>();
  for (const forkBranchId of forkPoints) {
    const forkPointMessage = getForkPointMessage(messages, forkBranchId);
    if (!forkPointMessage) continue;
    
    const forkPointRowNum = getRowNumber(forkPointMessage.branchId);
    
    // Check if there's a selected branch for this specific fork point
    const hasSelectedBranchForThisFork = selectedBranchIds.some(branchId => {
      const branchRowNum = getRowNumber(branchId);
      return branchRowNum === forkPointRowNum;
    });
    
    // Check if this is the fork point for the current variation branch we're building context for
    const isCurrentVariationForkPoint = currentVariationForkPointRow !== null && 
                                        currentVariationForkPointRow === forkPointRowNum;
    
    // Exclude all messages in the original branch path (X.0.0) that come after this fork point
    // BUT include sequential messages that come after the highest selected branch row
    for (const msg of messages) {
      const msgNormalized = normalizeBranchId(msg.branchId);
      const msgParts = msgNormalized.split('.');
      const msgRowNum = getRowNumber(msgNormalized);
      
      // Check if this is a message in the original branch path after the fork point
      const isOriginalBranchPath = msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0';
      
      if (isOriginalBranchPath && msgRowNum > forkPointRowNum) {
        // If this is the fork point for the current variation branch, exclude ALL messages after it
        if (isCurrentVariationForkPoint) {
          // Building context for variation branch (e.g., 6.1.0), exclude all messages after fork point (ok7, ok8)
          permanentlyExcludedIds.add(msg.id);
        } else if (hasSelectedBranchForThisFork && maxSelectedBranchRow > 0) {
          // There's a selected branch for this fork point (but not the current variation)
          // Check if selected branch is at same row as fork point (variation scenario)
          const selectedBranchAtForkRow = selectedBranchIds.some(branchId => {
            const branchRowNum = getRowNumber(branchId);
            return branchRowNum === forkPointRowNum;
          });
          
          if (selectedBranchAtForkRow) {
            // Selected branch is at same row as fork point (e.g., 2.1.0 and 2.0.0 both at row 2)
            // Exclude messages in original path after this fork point
            // BUT only exclude messages immediately after the fork point, not sequential messages after other fork points
            // Sequential messages after the highest selected branch will be included by processing loop
            if (maxSelectedBranchRow === forkPointRowNum) {
              // This is the highest selected branch, but we still need to check if messages come after it
              // Only exclude messages that don't come after the selected branch
              // Messages that come after the selected branch are sequential messages and should be included
              const comesAfterSelectedBranch = selectedBranchIds.some(branchId => {
                const branchRowNum = getRowNumber(branchId);
                return msgRowNum > branchRowNum;
              });
              
              if (!comesAfterSelectedBranch) {
                // This message doesn't come after any selected branch, exclude it (e.g., 3.0.0, 4.0.0 after fork point 2.0.0)
                permanentlyExcludedIds.add(msg.id);
              }
              // If it comes after a selected branch, don't exclude it - it will be included by the processing loop
            } else {
              // There's a higher selected branch, only exclude messages immediately after this fork point
              // Find the next fork point after this one
              const nextForkPoint = forkPoints.find(fp => {
                const fpMsg = getForkPointMessage(messages, fp);
                if (!fpMsg) return false;
                const fpRowNum = getRowNumber(fpMsg.branchId);
                return fpRowNum > forkPointRowNum;
              });
              
              if (nextForkPoint) {
                const nextForkPointMsg = getForkPointMessage(messages, nextForkPoint);
                if (nextForkPointMsg) {
                  const nextForkPointRowNum = getRowNumber(nextForkPointMsg.branchId);
                  // Only exclude messages between this fork point and the next fork point
                  // BUT don't exclude messages that come after the selected branch (they're sequential messages)
                  // For fork point 2.0.0 with selected branch 2.1.0: exclude 3.0.0, 4.0.0, but include 5.0.0 (sequential after 2.1.0)
                  if (msgRowNum < nextForkPointRowNum) {
                    // Find the selected branch at this fork point
                    const selectedBranchAtThisFork = selectedBranchIds.find(b => {
                      const bRow = getRowNumber(b);
                      return bRow === forkPointRowNum;
                    });
                    
                    if (selectedBranchAtThisFork) {
                      // For variation branches, the selected branch is at the same row as the fork point
                      // We should exclude messages immediately after the fork point (3.0.0, 4.0.0), but NOT sequential messages after the selected branch (5.0.0)
                      // The key is: messages between the fork point and the first sequential message after the selected branch should be excluded
                      // Find the first sequential message after the selected branch (the first X.0.0 message where X > selectedBranchRowNum)
                      const selectedBranchRowNum = getRowNumber(selectedBranchAtThisFork);
                      let firstSequentialAfterSelected = null;
                      for (const msg2 of messages) {
                        const msg2Normalized = normalizeBranchId(msg2.branchId);
                        const msg2Parts = msg2Normalized.split('.');
                        const msg2RowNum = getRowNumber(msg2Normalized);
                        const isMsg2OriginalPath = msg2Parts.length === 3 && msg2Parts[1] === '0' && msg2Parts[2] === '0';
                        
                        if (isMsg2OriginalPath && msg2RowNum > selectedBranchRowNum) {
                          firstSequentialAfterSelected = msg2RowNum;
                          break;
                        }
                      }
                      
                      // If there's a first sequential message after the selected branch, exclude messages between fork point and that message
                      // Otherwise, exclude all messages after the fork point
                      if (firstSequentialAfterSelected !== null) {
                        if (msgRowNum < firstSequentialAfterSelected) {
                          // This message is between the fork point and the first sequential message, exclude it (e.g., 3.0.0, 4.0.0)
                          permanentlyExcludedIds.add(msg.id);
                        }
                        // If msgRowNum >= firstSequentialAfterSelected, it's a sequential message and will be included by processing loop
                      } else {
                        // No sequential message found after selected branch, exclude all messages after fork point
                        permanentlyExcludedIds.add(msg.id);
                      }
                    } else {
                      // No selected branch found, exclude all messages after fork point
                      permanentlyExcludedIds.add(msg.id);
                    }
                  }
                  // Messages at or after the next fork point will be handled by that fork point's logic
                } else {
                  // No next fork point found, exclude all messages after this fork point
                  permanentlyExcludedIds.add(msg.id);
                }
              } else {
                // No next fork point, exclude all messages after this fork point
                permanentlyExcludedIds.add(msg.id);
              }
            }
          } else if (msgRowNum <= maxSelectedBranchRow) {
            // Selected branch is at different row, exclude messages between fork point and selected branch
            permanentlyExcludedIds.add(msg.id);
          }
          // If msgRowNum > maxSelectedBranchRow and maxSelectedBranchRow !== forkPointRowNum, it's a sequential message after selection, don't exclude it
        } else {
          // No selected branch for this fork point, exclude all messages after fork point
          permanentlyExcludedIds.add(msg.id);
        }
      }
    }
  }

  // Find the first fork point
  const [firstForkPoint] = forkPoints;
  const firstForkPointIndex = messages.findIndex(m => 
    m.branchId === firstForkPoint && m.role === 'user'
  );

  // Get all messages before the first fork point
  const messagesBeforeFirstFork = firstForkPointIndex >= 0 
    ? messages.slice(0, firstForkPointIndex)
    : [];

  // Build a map of row number -> selected branch ID
  // If multiple branches in same row, keep the last one (shouldn't happen per requirements, but handle it)
  const selectedBranchByRow = new Map<number, string>();
  for (const branchId of selectedBranchIds) {
    const rowNum = getRowNumber(branchId);
    // For main branches (X.0), store as-is
    // For variations (X.Y.0), store the variation ID
    // For continuations (X.Y.Z), store the base variation (X.Y.0)
    const parts = normalizeBranchId(branchId).split('.');
    if (parts[1] === '0') {
      selectedBranchByRow.set(rowNum, `${parts[0]}.0.0`);
    } else {
      selectedBranchByRow.set(rowNum, `${parts[0]}.${parts[1]}.0`);
    }
  }

  // Collect all messages from selected branches (including continuations)
  const selectedBranchMessages = new Set<string>();
  for (const branchId of selectedBranchIds) {
    // Normalize branchId to x.x.x format
    const normalizedId = normalizeBranchId(branchId);
    
    // Get all messages in this branch (ancestors)
    const branchMessages = getBranchMessages(messages, normalizedId);
    for (const msg of branchMessages) {
      selectedBranchMessages.add(msg.id);
    }
    
    // Also include continuations of this branch (e.g., "2.1.0" -> include "2.1.1", "2.1.2", etc.)
    // For continuations, we need to check if the message's branchId starts with the base prefix
    // For "2.1.0", continuations are "2.1.1", "2.1.2", etc. which all start with "2.1."
    const normalizedParts = normalizedId.split('.');
    const basePrefix = normalizedParts.slice(0, 2).join('.'); // e.g., "2.1" for "2.1.0"
    
    for (const msg of messages) {
      // Skip permanently excluded messages
      if (permanentlyExcludedIds.has(msg.id)) continue;
      
      const normalizedMsgId = normalizeBranchId(msg.branchId);
      const msgParts = normalizedMsgId.split('.');
      const msgBasePrefix = msgParts.slice(0, 2).join('.'); // e.g., "2.1" for "2.1.1"
      
      // Include if:
      // 1. Exact match (normalized or original)
      // 2. Continuation: same base prefix (e.g., "2.1.0" and "2.1.1" both have base "2.1")
      // 3. Starts with normalizedId + "." (for deeper continuations like "2.1.0.1" if that format exists)
      if (msg.branchId === branchId || normalizedMsgId === normalizedId) {
        selectedBranchMessages.add(msg.id);
      } else if (msgBasePrefix === basePrefix && msgParts.length >= 3) {
        // Same base prefix means it's a continuation (e.g., "2.1.1" is continuation of "2.1.0")
        selectedBranchMessages.add(msg.id);
      } else if (normalizedMsgId.startsWith(`${normalizedId  }.`)) {
        // Deeper continuations (if any)
        selectedBranchMessages.add(msg.id);
      }
    }
  }

  // Collect all messages to include
  const includedMessages: Message[] = [...messagesBeforeFirstFork];

  // Process messages after the first fork point
  for (const msg of messages.slice(firstForkPointIndex >= 0 ? firstForkPointIndex : 0)) {
    // If building context for a variation branch, exclude the fork point message itself
    if (currentVariationForkPointMessage && msg.id === currentVariationForkPointMessage.id) {
      continue; // Skip the fork point message
    }
    
    // Skip permanently excluded messages (messages after fork points in original branch path)
    // BUT allow sequential messages after highest selected branch to be included even if they were marked as excluded
    const normalizedMsgId = normalizeBranchId(msg.branchId);
    const msgRowNum = getRowNumber(normalizedMsgId);
    const msgParts = normalizedMsgId.split('.');
    const isOriginalBranchPath = msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0';
    
    // Check if this message is permanently excluded - these should NEVER be included
    if (permanentlyExcludedIds.has(msg.id)) {
      // Permanently excluded messages should NEVER be included, even if they come after a selected branch
      continue;
    }
    
    // Check if this message comes after the current variation's fork point - if so, exclude it
    // This check must happen BEFORE the sequential message check to ensure messages after fork points are excluded
    if (currentVariationForkPointRow !== null && isOriginalBranchPath && msgRowNum > currentVariationForkPointRow) {
      // This message comes after the current variation's fork point, exclude it (e.g., 8.0.0, 9.0.0 after fork point 7.0.0)
      continue;
    }
    
    // Check if this is a sequential message (X.0.0 format) that comes after a selected branch
    // These should be included even if they're not in any exclusion set
    // This check must happen BEFORE checking temporarilyExcludedIds to ensure sequential messages are included
    if (isOriginalBranchPath) {
      // Check if this message comes after any selected branch row
      const comesAfterAnySelectedBranch = selectedBranchIds.length > 0 && selectedBranchIds.some(branchId => {
        const branchRowNum = getRowNumber(branchId);
        return msgRowNum > branchRowNum;
      });
      
      if (comesAfterAnySelectedBranch) {
        // This message comes after a selected branch, it's a sequential message
        
        // Check if it comes immediately after a fork point with a selected branch
        let shouldExclude = false;
        for (const forkPointRow of forkPointRowsWithSelectedBranches) {
          if (msgRowNum === forkPointRow + 1) {
            // This is the first message after the fork point, exclude it (e.g., 3.0.0 after fork point 2.0.0, 7.0.0 after fork point 6.0.0)
            shouldExclude = true;
            break;
          }
        }
        
        if (!shouldExclude) {
          // This is a sequential message after a selected branch, include it (e.g., 5.0.0 after selected branch 2.1.0, 6.0.0 after selected branch 2.1.0, 8.0.0 after selected branch 6.1.0)
          includedMessages.push(msg);
          continue; // Skip the rest of the processing for this message
        } else {
          // This message comes immediately after a fork point, exclude it
          continue;
        }
      }
    }
    
    // Check if this message is temporarily excluded - these can be included if they come after a selected branch
    if (temporarilyExcludedIds.has(msg.id)) {
      // Check if this message should be included despite being marked as excluded
      // Include sequential messages that come after any selected branch row
      // BUT exclude messages that come after the current variation's fork point or any fork point with a selected branch
      if (isOriginalBranchPath && maxSelectedBranchRow > 0) {
        // Check if this message comes after any selected branch row
        const comesAfterAnySelectedBranch = selectedBranchIds.some(branchId => {
          const branchRowNum = getRowNumber(branchId);
          return msgRowNum > branchRowNum;
        });
        
        if (comesAfterAnySelectedBranch) {
          // Check if this message comes after the current variation's fork point
          if (currentVariationForkPointRow !== null && msgRowNum > currentVariationForkPointRow) {
            // This message comes after the current variation's fork point, exclude it (ok7, ok8)
            continue;
          }
          
          // Check if this message comes immediately after a fork point with a selected branch
          // We should exclude the first message after a fork point (e.g., 7.0.0 after fork point 6.0.0)
          // BUT include sequential messages after that (e.g., 8.0.0 after selected branch 6.1.0)
          // For messages between fork points (e.g., 5.0.0 between fork point 2.0.0 and 6.0.0):
          // - If it comes after a selected branch, include it (it's sequential)
          // - Otherwise, exclude it (it's in the original path after a fork point)
          let shouldExcludeAfterForkPoint = false;
          for (const forkPointRow of forkPointRowsWithSelectedBranches) {
            // Check if this message is the first message immediately after this fork point
            if (msgRowNum === forkPointRow + 1) {
              // This is the first message after the fork point, exclude it (e.g., 7.0.0 after fork point 6.0.0)
              shouldExcludeAfterForkPoint = true;
              break;
            }
          }
          
          if (shouldExcludeAfterForkPoint) {
            // This message comes immediately after a fork point with a selected branch, exclude it (e.g., 7.0.0 after fork point 6.0.0)
            continue;
          }
          
          // This is a sequential message after a selected branch, include it (e.g., 5.0.0 after selected branch 2.1.0, 8.0.0 after selected branch 6.1.0)
          // Explicitly include it here instead of falling through
          includedMessages.push(msg);
          continue; // Skip the rest of the processing for this message
        } else {
          // This message doesn't come after any selected branch, it's permanently excluded (ok3, ok4)
          continue;
        }
      } else {
        // This is a permanently excluded message, skip it
        continue;
      }
    }
    
    const selectedBranchInRow = selectedBranchByRow.get(msgRowNum);

    if (selectedBranchInRow !== null && selectedBranchInRow !== undefined && selectedBranchInRow !== '') {
      // This message is in a row with a selected branch
      // Include it only if it belongs to the selected branch (including continuations)
      if (selectedBranchMessages.has(msg.id)) {
        includedMessages.push(msg);
      } else if (normalizedMsgId === selectedBranchInRow || normalizedMsgId.startsWith(`${selectedBranchInRow  }.`)) {
        // Double-check: if the message's branchId matches the selected branch or is a continuation
        // This handles edge cases where the message might not have been added to selectedBranchMessages
        includedMessages.push(msg);
      }
      // Exclude messages from non-selected branches in the same row
    } else {
      // This message is in a row without any selected branch
      // Check if it's a continuation of a selected branch
      const matchingSelectedBranch = selectedBranchIds.find(selectedBranchId => {
        const normalizedSelectedId = normalizeBranchId(selectedBranchId);
        // Check if normalizedMsgId is a continuation of normalizedSelectedId
        // e.g., selectedBranchId = "2.1.0", msg.branchId = "2.1.1" -> continuation
        // e.g., selectedBranchId = "2.1.0", msg.branchId = "3.0.0" -> not continuation
        return normalizedMsgId.startsWith(`${normalizedSelectedId  }.`);
      });
      
      if (matchingSelectedBranch !== undefined) {
        // This is a continuation of a selected branch, include it
        includedMessages.push(msg);
      } else {
        // Check if this is a normal sequential message (X.0.0 format) that's not part of any fork
        // These should be included (e.g., "3.0.0" when there's no fork at row 3)
        // BUT only if they come after the highest selected branch row (sequential messages after selection)
        const msgParts = normalizedMsgId.split('.');
        if (msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0') {
          // Check if this row has a fork point - include if no fork exists in this row
          const forkPointInRow = forkPoints.find(fp => {
            const normalizedFp = normalizeBranchId(fp);
            const fpRowNum = getRowNumber(normalizedFp);
            return fpRowNum === msgRowNum;
          });
          
          if (forkPointInRow === undefined) {
            // This is a normal sequential message in a row without forks
            // Include if it comes after any selected branch row (sequential after selection)
            // Messages before/at highest selected branch row that come after a fork point should be excluded
            // BUT also exclude messages that come after the current variation's fork point
            if (maxSelectedBranchRow > 0) {
              // Check if this message comes after any selected branch row
              const comesAfterAnySelectedBranch = selectedBranchIds.some(branchId => {
                const branchRowNum = getRowNumber(branchId);
                return msgRowNum > branchRowNum;
              });
              
              if (comesAfterAnySelectedBranch) {
                // This message comes after at least one selected branch
                // BUT check if it comes after the current variation's fork point - if so, exclude it
                if (currentVariationForkPointRow !== null && msgRowNum > currentVariationForkPointRow) {
                  // This message comes after the current variation's fork point, exclude it
                  // Skip it - don't include
                } else {
                  // Check if it comes immediately after a fork point with a selected branch
                  let shouldExclude = false;
                  for (const forkPointRow of forkPointRowsWithSelectedBranches) {
                    if (msgRowNum === forkPointRow + 1) {
                      // This is the first message after the fork point, exclude it (e.g., 7.0.0 after fork point 6.0.0)
                      shouldExclude = true;
                      break;
                    }
                  }
                  
                  if (shouldExclude) {
                    // This message comes immediately after a fork point with a selected branch, exclude it
                    // Skip it - don't include
                  } else {
                    // This is a sequential message after a selected branch, include it (e.g., 5.0.0 after selected branch 2.1.0, 8.0.0 after selected branch 6.1.0)
                    includedMessages.push(msg);
                  }
                }
              } else if (msgRowNum > maxSelectedBranchRow) {
                // This message comes after the highest selected branch row but not after any selected branch
                // Check if it comes after the current variation's fork point - if so, exclude it
                if (currentVariationForkPointRow !== null && msgRowNum > currentVariationForkPointRow) {
                  // This message comes after the current variation's fork point, exclude it
                  // Skip it - don't include
                } else {
                  // Check if it comes after any fork point with a selected branch
                  let shouldExclude = false;
                  for (const forkPointRow of forkPointRowsWithSelectedBranches) {
                    if (msgRowNum > forkPointRow) {
                      shouldExclude = true;
                      break;
                    }
                  }
                  
                  if (shouldExclude) {
                    // This message comes after a fork point with a selected branch, exclude it
                    // Skip it - don't include
                  } else {
                    // This is a sequential message after selection from an earlier fork point, include it
                    includedMessages.push(msg);
                  }
                }
              }
              // If msgRowNum <= maxSelectedBranchRow and it doesn't come after any selected branch, it's after a fork point but before selected branch, exclude it
            } else if (maxSelectedBranchRow === 0) {
              // No selected branches, include all sequential messages
              includedMessages.push(msg);
            }
          }
          // If there's a fork in this row but no selected branch, exclude it
        }
      }
    }
  }

  // Sort by creation time to maintain order
  return includedMessages.sort((a, b) => a.createdAt - b.createdAt);
}
