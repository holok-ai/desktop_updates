import { writable, derived } from 'svelte/store';
import type {
  AllInterfaceStatuses,
  InterfaceStatusSnapshot,
  InterfaceStatusChangeEvent,
  InterfaceStatus,
} from '../../../src-electron/preload';

/**
 * Aggregate application status derived from individual interface statuses.
 * - 'available': all interfaces are available (or unknown)
 * - 'reduced': only notifications degraded (Moku + Holo still up)
 * - 'down': Moku API or Holo API is not-available or down
 */
export type AggregateStatus = 'available' | 'reduced' | 'down';

function defaultSnapshot(
  name: InterfaceStatusSnapshot['name'],
  messageDescription: string,
): InterfaceStatusSnapshot {
  return {
    name,
    status: 'unknown',
    lastUseTime: null,
    messageDescription,
    messagesSentCount: 0,
    errorCount: 0,
    lastErrorMessage: null,
    timeFirstUp: null,
  };
}

const defaultStatuses: AllInterfaceStatuses = {
  mokuApi: defaultSnapshot('moku-api', 'REST API call'),
  holoApi: defaultSnapshot('holo-api', 'Chat API call'),
  holoNotifications: defaultSnapshot('holo-notifications', 'SSE notification'),
  timestamp: 0,
};

function isDown(status: InterfaceStatus): boolean {
  return status === 'not-available' || status === 'down';
}

function createReliabilityStore(): {
  subscribe: (run: (value: AllInterfaceStatuses) => void) => () => void;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
} {
  const { subscribe, set, update } = writable<AllInterfaceStatuses>(defaultStatuses);

  let unsubscribeIpc: (() => void) | null = null;

  return {
    subscribe,

    /**
     * Initialize the store: seed from backend and subscribe to push events.
     * Call once when the app is ready (after auth).
     */
    async init(): Promise<void> {
      try {
        const statuses = await window.electronAPI.reliability.getAllStatuses();
        set(statuses);
      } catch (err) {
        console.warn('[ReliabilityStore] failed to seed initial statuses', err);
      }

      // Subscribe to real-time status change events (status transitions only —
      // metrics like messagesSentCount update via refresh())
      unsubscribeIpc = window.electronAPI.reliability.onStatusChange(
        (event: InterfaceStatusChangeEvent) => {
          update((current) => {
            const updated = { ...current, timestamp: event.timestamp };

            if (event.name === 'moku-api') {
              updated.mokuApi = event.snapshot;
            } else if (event.name === 'holo-api') {
              updated.holoApi = event.snapshot;
            } else if (event.name === 'holo-notifications') {
              updated.holoNotifications = event.snapshot;
            }

            return updated;
          });
        },
      );
    },

    /**
     * Re-fetch all statuses from the backend and update the store.
     * Call this periodically when the status dialog is open to keep
     * metrics (messagesSentCount, lastUseTime) fresh between status changes.
     */
    async refresh(): Promise<void> {
      try {
        const statuses = await window.electronAPI.reliability.getAllStatuses();
        set(statuses);
      } catch (err) {
        console.warn('[ReliabilityStore] failed to refresh statuses', err);
      }
    },

    /**
     * Reset the store to defaults and unsubscribe from IPC.
     */
    reset(): void {
      if (unsubscribeIpc !== null) {
        unsubscribeIpc();
        unsubscribeIpc = null;
      }
      set(defaultStatuses);
    },
  };
}

export const reliabilityStore = createReliabilityStore();

/**
 * Aggregate status: available / reduced / down.
 */
export const aggregateStatus = derived<typeof reliabilityStore, AggregateStatus>(
  reliabilityStore,
  ($store) => {
    const isMokuDown = isDown($store.mokuApi.status);
    const isHoloDown = isDown($store.holoApi.status);
    const isNotificationsDown = isDown($store.holoNotifications.status);

    if (isMokuDown || isHoloDown) {
      return 'down';
    }
    if (isNotificationsDown) {
      return 'reduced';
    }
    return 'available';
  },
);

/**
 * Whether the badge should be visible.
 * True when at least one interface has moved past 'unknown'.
 */
export const showBadge = derived(
  reliabilityStore,
  ($store) =>
    $store.mokuApi.status !== 'unknown' ||
    $store.holoApi.status !== 'unknown' ||
    $store.holoNotifications.status !== 'unknown',
);
