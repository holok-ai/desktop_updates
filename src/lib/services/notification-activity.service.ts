import {
  addCollaboratorActivity,
  removeCollaboratorActivity,
} from '$lib/stores/collaborator-activity.store';
import { addNotificationEvent, resolveGuardEvent } from '$lib/stores/notification-event.store';

/**
 * Initialize IPC listeners for notification events.
 * Call once at app startup (from main.ts).
 *
 * Bridges the electron `thread:notificationEvent` broadcast
 * into the appropriate Svelte stores.
 */
export function initNotificationActivityListeners(): void {
  if (window.electronAPI?.thread?.onNotificationEvent === undefined) {
    return;
  }

  console.warn('[NotificationEvent] IPC listener registered');
  window.electronAPI.thread.onNotificationEvent((data) => {
    console.warn('[NotificationEvent] IPC event received', data);

    if (data.event === 'started') {
      addCollaboratorActivity({
        threadId: data.threadId ?? '',
        branchId: data.branchId ?? null,
        userId: data.userId,
        requestId: data.requestId ?? null,
      });
    } else if (data.event === 'completed') {
      removeCollaboratorActivity(data.threadId ?? '', data.userId);
    } else if (data.event === 'guard_started') {
      addNotificationEvent({
        type: 'guard_started',
        threadId: data.threadId ?? '',
        userId: data.userId,
        message: 'Running guards...',
      });
    } else if (data.event === 'guard_passed' || data.event === 'guard_failed') {
      resolveGuardEvent(data.threadId ?? '', data.event, data.message ?? '', data.userId);
    }
  });
}
