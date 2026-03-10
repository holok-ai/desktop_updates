/**
 * InterfaceStatusRegistry
 *
 * Singleton registry that holds all InterfaceMonitor instances.
 * Provides aggregate status queries and coordinated lifecycle management.
 */

import log from 'electron-log';
import type {
  InterfaceName,
  AllInterfaceStatuses,
  InterfaceStatusSnapshot,
  ErrorClassifier,
  HealthCheckFn,
} from '../../types/reliability.types.js';
import { InterfaceMonitor } from './interface-monitor.js';

/** Error classifier for Holo API: 500-level = down, others = chat error (Holo still up) */
export const holoErrorClassifier: ErrorClassifier = {
  isInterfaceDown(statusCode: number, _errorMessage: string): boolean {
    return (
      statusCode === 500 ||
      statusCode === 502 ||
      statusCode === 503 ||
      statusCode === 504 ||
      statusCode === -1
    );
  },
};

/** Error classifier for Moku API: 500-level and network errors = down */
export const mokuErrorClassifier: ErrorClassifier = {
  isInterfaceDown(statusCode: number, _errorMessage: string): boolean {
    return (
      statusCode === 500 ||
      statusCode === 502 ||
      statusCode === 503 ||
      statusCode === 504 ||
      statusCode === -1
    );
  },
};

/** Error classifier for Holo Notifications (SSE): any connection failure = down */
export const notificationsErrorClassifier: ErrorClassifier = {
  isInterfaceDown(_statusCode: number, _errorMessage: string): boolean {
    // SSE connection failure always means the notification channel is unavailable
    return true;
  },
};

export class InterfaceStatusRegistry {
  private monitors = new Map<InterfaceName, InterfaceMonitor>();

  /** Register a monitor. Replaces any existing monitor with the same name. */
  public register(name: InterfaceName, monitor: InterfaceMonitor): void {
    const existing = this.monitors.get(name);
    if (existing) {
      existing.dispose();
    }
    this.monitors.set(name, monitor);
    log.info(`[InterfaceStatusRegistry] registered monitor: ${name}`);
  }

  /** Get a monitor by name. Throws if not registered. */
  public getMonitor(name: InterfaceName): InterfaceMonitor {
    const monitor = this.monitors.get(name);
    if (!monitor) {
      throw new Error(`[InterfaceStatusRegistry] monitor not registered: ${name}`);
    }
    return monitor;
  }

  /** Check if a monitor is registered. */
  public hasMonitor(name: InterfaceName): boolean {
    return this.monitors.has(name);
  }

  /** Get snapshots of all registered interfaces. */
  public getAllStatuses(): AllInterfaceStatuses {
    return {
      mokuApi: this.getSnapshotOrDefault('moku-api', 'REST API call'),
      holoApi: this.getSnapshotOrDefault('holo-api', 'Chat API call'),
      holoNotifications: this.getSnapshotOrDefault('holo-notifications', 'SSE notification'),
      timestamp: Date.now(),
    };
  }

  /** Get a single interface snapshot. */
  public getStatus(name: InterfaceName): InterfaceStatusSnapshot {
    const monitor = this.monitors.get(name);
    if (monitor) {
      return monitor.getSnapshot();
    }
    return this.defaultSnapshot(name, '');
  }

  /** Reset all monitors to unknown. */
  public resetAll(): void {
    log.info('[InterfaceStatusRegistry] resetting all monitors');
    for (const monitor of this.monitors.values()) {
      monitor.reset();
    }
  }

  /** Dispose all monitors (cancel timers, clean up). */
  public disposeAll(): void {
    log.info('[InterfaceStatusRegistry] disposing all monitors');
    for (const monitor of this.monitors.values()) {
      monitor.dispose();
    }
    this.monitors.clear();
  }

  private getSnapshotOrDefault(
    name: InterfaceName,
    messageDescription: string,
  ): InterfaceStatusSnapshot {
    const monitor = this.monitors.get(name);
    if (monitor) {
      return monitor.getSnapshot();
    }
    return this.defaultSnapshot(name, messageDescription);
  }

  private defaultSnapshot(
    name: InterfaceName,
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
}

/** Singleton registry instance */
export const interfaceStatusRegistry = new InterfaceStatusRegistry();

/**
 * Initialize all three interface monitors and register them with the registry.
 * Call this after SettingsService and AuthService are ready.
 */
export function initializeReliabilityMonitors(
  mokuHealthCheckFn: HealthCheckFn,
  holoHealthCheckFn: HealthCheckFn,
  notificationsHealthCheckFn: HealthCheckFn,
): void {
  const mokuMonitor = new InterfaceMonitor(
    'moku-api',
    'REST API call',
    mokuHealthCheckFn,
    mokuErrorClassifier,
  );

  const holoMonitor = new InterfaceMonitor(
    'holo-api',
    'Chat API call',
    holoHealthCheckFn,
    holoErrorClassifier,
  );

  const notificationsMonitor = new InterfaceMonitor(
    'holo-notifications',
    'SSE notification',
    notificationsHealthCheckFn,
    notificationsErrorClassifier,
  );

  interfaceStatusRegistry.register('moku-api', mokuMonitor);
  interfaceStatusRegistry.register('holo-api', holoMonitor);
  interfaceStatusRegistry.register('holo-notifications', notificationsMonitor);

  mokuMonitor.init();
  holoMonitor.init();
  notificationsMonitor.init();

  log.info('[InterfaceStatusRegistry] all monitors initialized');
}
