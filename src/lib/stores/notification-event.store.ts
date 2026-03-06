import { writable } from 'svelte/store';

/**
 * Tracks notification events (guard_started, guard_passed, guard_failed, etc.)
 * for display in the UI. Entries auto-expire after DISPLAY_MS.
 */
export interface NotificationEventEntry {
  id: string;
  type: 'guard_started' | 'guard_passed' | 'guard_failed';
  threadId: string;
  userId: string;
  message: string;
  receivedAt: number;
}

/** How long a resolved notification (passed/failed) stays visible. */
const DISPLAY_MS = 5_000;

/** How long guard_started stays if no follow-up arrives. */
const GUARD_STARTED_TIMEOUT_MS = 30_000;

let nextId = 0;
const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

const store = writable<NotificationEventEntry[]>([]);

/**
 * Add a notification event. For guard_started, auto-removes after GUARD_STARTED_TIMEOUT_MS.
 * For guard_passed/guard_failed, auto-removes after DISPLAY_MS.
 */
export function addNotificationEvent(
  entry: Omit<NotificationEventEntry, 'id' | 'receivedAt'>,
): void {
  const id = `notif-${++nextId}`;
  const full: NotificationEventEntry = {
    ...entry,
    id,
    receivedAt: Date.now(),
  };

  store.update((list) => [...list, full]);

  const timeout = entry.type === 'guard_started' ? GUARD_STARTED_TIMEOUT_MS : DISPLAY_MS;
  const timer = setTimeout(() => {
    removeNotificationEvent(id);
  }, timeout);
  timerMap.set(id, timer);
}

/**
 * Transition an existing guard_started entry to guard_passed or guard_failed
 * for the given threadId. If no guard_started entry exists, adds a new one.
 * The resolved entry auto-removes after DISPLAY_MS.
 */
export function resolveGuardEvent(
  threadId: string,
  type: 'guard_passed' | 'guard_failed',
  message: string,
  userId: string,
): void {
  let didResolve = false;

  store.update((list) =>
    list.map((entry) => {
      if (entry.type === 'guard_started' && entry.threadId === threadId) {
        didResolve = true;
        // Clear the old timeout
        const oldTimer = timerMap.get(entry.id);
        if (oldTimer !== undefined) {
          clearTimeout(oldTimer);
          timerMap.delete(entry.id);
        }
        // Set new auto-remove timeout for the resolved state
        const timer = setTimeout(() => {
          removeNotificationEvent(entry.id);
        }, DISPLAY_MS);
        timerMap.set(entry.id, timer);

        const fallbackMessage = type === 'guard_passed' ? 'Guard passed.' : 'Guard failed.';
        return { ...entry, type, message: message !== '' ? message : fallbackMessage };
      }
      return entry;
    }),
  );

  // If there was no guard_started to transition, add a fresh resolved entry
  if (!didResolve) {
    const fallback = type === 'guard_passed' ? 'Guard passed.' : 'Guard failed.';
    addNotificationEvent({ type, threadId, userId, message: message !== '' ? message : fallback });
  }
}

/**
 * Remove a notification event by id.
 */
export function removeNotificationEvent(id: string): void {
  const timer = timerMap.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timerMap.delete(id);
  }
  store.update((list) => list.filter((e) => e.id !== id));
}

/**
 * Clear all notification events.
 */
export function clearNotificationEvents(): void {
  for (const timer of timerMap.values()) {
    clearTimeout(timer);
  }
  timerMap.clear();
  store.set([]);
}

/** The raw store for Svelte reactivity. */
export const notificationEventStore = store;
