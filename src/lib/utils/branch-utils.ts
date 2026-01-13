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
  const baseDepth = baseBranchId.split('.').length;
  return messages.filter((m) => {
    const parts = m.branchId.split('.');
    // Must be exactly one level deeper
    if (parts.length !== baseDepth + 1) {return false;}
    return m.branchId.startsWith(`${baseBranchId  }.`);
  });
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
  const parts = branchId.split('.');
  const relevantBranchIds = new Set<string>();
  
  // Build all parent branch IDs
  for (let i = 1; i <= parts.length; i++) {
    relevantBranchIds.add(parts.slice(0, i).join('.'));
  }

  // Filter messages that belong to this branch hierarchy
  return messages
    .filter((m) => relevantBranchIds.has(m.branchId))
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
    .filter((m) => m.branchId === '1.0')
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get all fork points (branchIds that have variations)
 */
export function getForkPoints(messages: Message[]): string[] {
  const forkPoints = new Set<string>();
  
  for (const message of messages) {
    const parts = message.branchId.split('.');
    if (parts.length > 2) { // Has at least one variation level
      // The parent branchId is a fork point
      const parentBranchId = parts.slice(0, -1).join('.');
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
  const existingVariations = getVariationsForBranch(messages, baseBranchId);
  const existingIndices = existingVariations.map(m => {
    const parts = m.branchId.split('.');
    return parseInt(parts[parts.length - 1]);
  });
  
  // Find the next available index
  let nextIndex = 1;
  while (existingIndices.includes(nextIndex)) {
    nextIndex++;
    if (nextIndex > 99) {
      throw new Error('Maximum branch variations reached (max: 99)');
    }
  }
  
  return `${baseBranchId}.${nextIndex}`;
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
