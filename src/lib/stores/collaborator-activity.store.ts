import { writable, get } from 'svelte/store';

/**
 * Tracks active collaborator activity on shared project threads.
 * Entries represent a collaborator whose provider request is in progress.
 */
export interface CollaboratorActivity {
  threadId: string;
  branchId: string | null;
  userId: string;
  requestId: string | null;
  startedAt: number;
}

/** Max age before an activity entry is auto-pruned (5 minutes). */
const EXPIRY_MS = 5 * 60 * 1000;

function makeKey(threadId: string, userId: string): string {
  return `${threadId}:${userId}`;
}

const store = writable<Map<string, CollaboratorActivity>>(new Map());

/**
 * Add or update a collaborator activity entry.
 * Keyed by threadId+userId so one entry per collaborator per thread.
 */
export function addCollaboratorActivity(activity: Omit<CollaboratorActivity, 'startedAt'>): void {
  store.update((map) => {
    const next = new Map(map);
    next.set(makeKey(activity.threadId, activity.userId), {
      ...activity,
      startedAt: Date.now(),
    });
    return next;
  });
}

/**
 * Remove a collaborator activity entry.
 */
export function removeCollaboratorActivity(threadId: string, userId: string): void {
  store.update((map) => {
    const next = new Map(map);
    next.delete(makeKey(threadId, userId));
    return next;
  });
}

/**
 * Clear all collaborator activities for a thread.
 */
export function clearCollaboratorActivities(threadId: string): void {
  store.update((map) => {
    const next = new Map(map);
    for (const [key, entry] of next) {
      if (entry.threadId === threadId) {
        next.delete(key);
      }
    }
    return next;
  });
}

/**
 * Get active collaborator activities for a specific thread.
 * Auto-prunes expired entries older than EXPIRY_MS.
 */
export function getCollaboratorActivities(threadId: string): CollaboratorActivity[] {
  const now = Date.now();
  const current = get(store);
  const results: CollaboratorActivity[] = [];
  const expired: string[] = [];

  for (const [key, entry] of current) {
    if (now - entry.startedAt > EXPIRY_MS) {
      expired.push(key);
      continue;
    }
    if (entry.threadId === threadId) {
      results.push(entry);
    }
  }

  // Prune expired entries if any found
  if (expired.length > 0) {
    store.update((map) => {
      const next = new Map(map);
      for (const key of expired) {
        next.delete(key);
      }
      return next;
    });
  }

  return results;
}

/** The raw store — subscribe for reactivity in Svelte components. */
export const collaboratorActivityStore = store;
