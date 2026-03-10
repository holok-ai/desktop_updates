/**
 * IPC handlers for Interface Reliability & Status Monitoring.
 *
 * Exposes interface status data to the renderer via:
 *   reliability:getAllStatuses      - snapshot of all three interfaces
 *   reliability:getStatus           - snapshot of a single interface
 *   reliability:healthcheck         - trigger a manual health check
 *   reliability:reset               - reset a single interface's metrics
 *   reliability:statusChanged       - push event when an interface changes status
 */

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import type { InterfaceName, InterfaceStatusChangeEvent } from '../types/reliability.types.js';
import { interfaceStatusRegistry } from '../services/reliability/interface-status-registry.js';

/**
 * Broadcast an event to all renderer windows.
 */
function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, ...args);
  });
}

export function registerReliabilityHandlers(): void {
  ipcMain.handle('reliability:getAllStatuses', () => {
    return interfaceStatusRegistry.getAllStatuses();
  });

  ipcMain.handle('reliability:getStatus', (_event, name: InterfaceName) => {
    return interfaceStatusRegistry.getStatus(name);
  });

  ipcMain.handle('reliability:healthcheck', async (_event, name: InterfaceName) => {
    try {
      const monitor = interfaceStatusRegistry.getMonitor(name);
      await monitor.healthcheck();
      return monitor.getSnapshot();
    } catch (err) {
      log.error('[ReliabilityHandler] healthcheck failed', {
        name,
        error: err instanceof Error ? err.message : String(err),
      });
      return interfaceStatusRegistry.getStatus(name);
    }
  });

  ipcMain.handle('reliability:reset', (_event, name: InterfaceName) => {
    try {
      const monitor = interfaceStatusRegistry.getMonitor(name);
      monitor.reset();
      return monitor.getSnapshot();
    } catch (err) {
      log.error('[ReliabilityHandler] reset failed', {
        name,
        error: err instanceof Error ? err.message : String(err),
      });
      return interfaceStatusRegistry.getStatus(name);
    }
  });

  log.info('[ReliabilityHandler] IPC handlers registered');
}

/**
 * Subscribe to status change events on all monitors and broadcast to renderer.
 * Call this AFTER monitors have been initialized (i.e., after initializeReliabilityMonitors).
 */
export function subscribeToStatusChanges(): void {
  const interfaceNames: InterfaceName[] = ['moku-api', 'holo-api', 'holo-notifications'];

  for (const name of interfaceNames) {
    if (interfaceStatusRegistry.hasMonitor(name)) {
      const monitor = interfaceStatusRegistry.getMonitor(name);
      monitor.onStatusChange((event: InterfaceStatusChangeEvent) => {
        log.info('[ReliabilityHandler] broadcasting status change', {
          name: event.name,
          from: event.previousStatus,
          to: event.newStatus,
        });
        broadcast('reliability:statusChanged', event);
      });
    }
  }

  log.info('[ReliabilityHandler] status change subscriptions active');
}
