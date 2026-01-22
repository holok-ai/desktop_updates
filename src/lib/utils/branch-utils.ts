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
 * Get all messages belonging to a specific branch (including all ancestors)
 * E.g., for "1.0.1", returns messages with branchIds: "1.0", "1.0.1"
 */
export function getBranchMessages(messages: Message[], branchId: string): Message[] {
  const normalized = normalizeBranchId(branchId);
  const parts = normalized.split('.');
  const relevantBranchIds = new Set<string>();
  
  // Build all parent branch IDs
  for (let i = 1; i <= parts.length; i++) {
    relevantBranchIds.add(parts.slice(0, i).join('.'));
  }

  // Filter messages that belong to this branch hierarchy
  return messages
    .filter((m) => relevantBranchIds.has(normalizeBranchId(m.branchId)))
    .sort((a, b) => a.createdAt - b.createdAt);
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
 */
export function buildContextFromSelectedBranches(
  messages: Message[],
  selectedBranchIds: string[],
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
    const normalizedMsgId = normalizeBranchId(msg.branchId);
    const msgRowNum = getRowNumber(normalizedMsgId);
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
        const msgParts = normalizedMsgId.split('.');
        if (msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0') {
          // Check if this row has a fork point - include if no fork exists in this row
          const forkPointInRow = forkPoints.find(fp => {
            const normalizedFp = normalizeBranchId(fp);
            const fpRowNum = getRowNumber(normalizedFp);
            return fpRowNum === msgRowNum;
          });
          
          if (forkPointInRow === undefined) {
            // This is a normal sequential message in a row without forks, include it
            includedMessages.push(msg);
          }
          // If there's a fork in this row but no selected branch, exclude it
        }
      }
    }
  }

  // Sort by creation time to maintain order
  return includedMessages.sort((a, b) => a.createdAt - b.createdAt);
}
