/**
 * Branch utilities for thread message tree operations
 */

import type { Message, BranchType } from '$lib/types/thread.type';

const MAX_PROMPT_VARIATIONS = 1;
const MAX_MODEL_VARIATIONS = 9;

export interface BranchInfo {
  parentMessageId: string;
  branches: Message[];
  selectedBranchIndex: number;
}

/** Get root messages (parentMessageId is null) */
export function getRootMessages(messages: Message[]): Message[] {
  return messages.filter((m) => m.parentMessageId === null);
}

/** Get direct children of a parent message */
export function getMessagesByParentId(messages: Message[], parentId: string | null): Message[] {
  return messages.filter((m) => m.parentMessageId === parentId);
}

/** Get all branch variations for a specific parent (siblings with same parent, different branchIndex) */
export function getBranchesForMessage(messages: Message[], parentId: string): Message[] {
  return messages
    .filter((m) => m.parentMessageId === parentId)
    .sort((a, b) => a.branchIndex - b.branchIndex);
}

/** Check if a message has multiple branches (is a fork point) */
export function isForkPoint(messages: Message[], messageId: string): boolean {
  const children = messages.filter((m) => m.parentMessageId === messageId);
  const uniqueBranches = new Set(children.map((c) => c.branchIndex));
  return uniqueBranches.size > 1;
}

/** Get all fork points in a thread */
export function getForkPoints(messages: Message[]): string[] {
  const forkPoints: string[] = [];
  const parentIds = new Set(messages.map((m) => m.parentMessageId).filter(Boolean) as string[]);

  for (const parentId of parentIds) {
    if (isForkPoint(messages, parentId)) {
      forkPoints.push(parentId);
    }
  }
  return forkPoints;
}

/**
 * Assemble context by walking from a message up to root.
 * Returns ordered array [root...current] following the branch path.
 */
export function assembleContext(messages: Message[], messageId: string): Message[] {
  const path: Message[] = [];
  const messageMap = new Map(messages.map((m) => [m.id, m]));

  let current = messageMap.get(messageId);
  while (current) {
    path.unshift(current);
    if (current.parentMessageId === null) break;
    current = messageMap.get(current.parentMessageId);
  }

  return path;
}

/**
 * Get the main branch path (branchIndex=0) from root to latest message
 */
export function getMainBranchPath(messages: Message[]): Message[] {
  const result: Message[] = [];
  const childrenByParent = new Map<string | null, Message[]>();

  for (const m of messages) {
    const key = m.parentMessageId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(m);
  }

  // Start from root (null parent), follow branchIndex=0
  let current: Message | undefined = childrenByParent.get(null)?.find((m) => m.branchIndex === 0);
  while (current) {
    result.push(current);
    current = childrenByParent.get(current.id)?.find((m) => m.branchIndex === 0);
  }

  return result;
}

/**
 * Get next available branch index for a parent message.
 * Throws error if limit is reached.
 */
export function getNextBranchIndex(
  messages: Message[],
  parentId: string,
  branchType: BranchType,
): number {
  const siblings = messages.filter((m) => m.parentMessageId === parentId);

  if (branchType === 'prompt-variation') {
    const promptVariations = siblings.filter((m) => m.branchType === 'prompt-variation');
    if (promptVariations.length >= MAX_PROMPT_VARIATIONS) {
      throw new Error('Only one prompt variation allowed');
    }
    // Prompt variation always gets branchIndex 1
    return 1;
  }

  if (branchType === 'model-variation') {
    const modelVariations = siblings.filter((m) => m.branchType === 'model-variation');
    if (modelVariations.length >= MAX_MODEL_VARIATIONS) {
      throw new Error('Maximum variation branches reached (max: 9)');
    }
    // Find next available index starting from 1
    const usedIndices = new Set(modelVariations.map((m) => m.branchIndex));
    for (let i = 1; i <= MAX_MODEL_VARIATIONS; i++) {
      if (!usedIndices.has(i)) return i;
    }
    throw new Error('Maximum variation branches reached (max: 9)');
  }

  // Default: return 0 for original messages
  return 0;
}

/**
 * Check if more variations can be created for a parent message
 */
export function canCreateVariation(
  messages: Message[],
  parentId: string,
  branchType: BranchType,
): boolean {
  try {
    getNextBranchIndex(messages, parentId, branchType);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get branch info at a fork point - returns all branches and which is selected
 */
export function getBranchInfo(
  messages: Message[],
  forkPointId: string,
  selectedBranchIndex = 0,
): BranchInfo {
  const branches = getBranchesForMessage(messages, forkPointId);
  return {
    parentMessageId: forkPointId,
    branches,
    selectedBranchIndex,
  };
}

/**
 * Build a tree structure from flat messages for rendering
 */
export interface MessageTreeNode {
  message: Message;
  children: MessageTreeNode[];
}

export function buildMessageTree(messages: Message[]): MessageTreeNode[] {
  const nodeMap = new Map<string, MessageTreeNode>();
  const roots: MessageTreeNode[] = [];

  // Create nodes
  for (const m of messages) {
    nodeMap.set(m.id, { message: m, children: [] });
  }

  // Link children to parents
  for (const m of messages) {
    const node = nodeMap.get(m.id)!;
    if (m.parentMessageId === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(m.parentMessageId);
      if (parent) parent.children.push(node);
    }
  }

  // Sort children by branchIndex
  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.message.branchIndex - b.message.branchIndex);
  }

  return roots.sort((a, b) => a.message.createdAt - b.message.createdAt);
}

/**
 * Get the linear message path following selected branches at each fork
 */
export function getLinearPath(
  messages: Message[],
  branchSelections: Map<string, number> = new Map(),
): Message[] {
  const result: Message[] = [];
  const childrenByParent = new Map<string | null, Message[]>();

  for (const m of messages) {
    const key = m.parentMessageId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(m);
  }

  // Start from root, follow selected branch at each fork
  let parentId: string | null = null;
  while (true) {
    const children = childrenByParent.get(parentId) || [];
    if (children.length === 0) break;

    const selectedIndex = parentId ? (branchSelections.get(parentId) ?? 0) : 0;
    const selected = children.find((c) => c.branchIndex === selectedIndex) || children[0];

    result.push(selected);
    parentId = selected.id;
  }

  return result;
}




