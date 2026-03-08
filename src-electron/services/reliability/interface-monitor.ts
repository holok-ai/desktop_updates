/**
 * InterfaceMonitor
 *
 * Tracks the reliability status and metrics for a single external interface.
 * Provides lifecycle methods (init, reset, dispose) and recording methods
 * (recordSuccess, recordError) to be called by interface wrappers.
 *
 * When an interface becomes not-available, starts an escalating health check
 * schedule: 2s intervals for 10s, then 5s intervals for 30s, then declares down.
 */

import log from 'electron-log';
import type {
  InterfaceName,
  InterfaceStatus,
  InterfaceStatusSnapshot,
  InterfaceStatusChangeEvent,
  ErrorClassifier,
  HealthCheckFn,
  StatusChangeCallback,
} from '../../types/reliability.types.js';

/** Default error classifier: 500/502/503/504 and network errors mean interface is down */
const DEFAULT_ERROR_CLASSIFIER: ErrorClassifier = {
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

/** Health check escalation constants */
const FAST_INTERVAL_MS = 2000;
const FAST_DURATION_MS = 10000;
const SLOW_INTERVAL_MS = 5000;
const SLOW_DURATION_MS = 30000;

export class InterfaceMonitor {
  private status: InterfaceStatus = 'unknown';
  private lastUseTime: number | null = null;
  private messagesSentCount = 0;
  private errorCount = 0;
  private lastErrorMessage: string | null = null;
  private timeFirstUp: number | null = null;

  private statusChangeListeners = new Set<StatusChangeCallback>();

  private healthCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private healthCheckPhase: 'fast' | 'slow' | 'done' = 'done';
  private healthCheckElapsedMs = 0;
  private healthCheckRunning = false;

  constructor(
    private readonly name: InterfaceName,
    private readonly messageDescription: string,
    private readonly healthCheckFn: HealthCheckFn,
    private readonly errorClassifier: ErrorClassifier = DEFAULT_ERROR_CLASSIFIER,
  ) {}

  // ---------------------------------------------------------------------------
  // Status change notifications
  // ---------------------------------------------------------------------------

  /**
   * Register a callback that fires whenever the interface status changes.
   * Returns an unsubscribe function.
   */
  public onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeListeners.add(callback);
    return () => this.statusChangeListeners.delete(callback);
  }

  /**
   * Centralized status setter. Fires change callbacks when the status
   * actually transitions to a different value.
   */
  private setStatus(newStatus: InterfaceStatus): void {
    const previousStatus = this.status;
    if (previousStatus === newStatus) {
      return;
    }

    this.status = newStatus;
    log.info(`[InterfaceMonitor:${this.name}] status: ${previousStatus} → ${newStatus}`);

    const event: InterfaceStatusChangeEvent = {
      name: this.name,
      previousStatus,
      newStatus,
      snapshot: this.getSnapshot(),
      timestamp: Date.now(),
    };

    for (const cb of this.statusChangeListeners) {
      try {
        cb(event);
      } catch (err) {
        log.error(`[InterfaceMonitor:${this.name}] statusChange listener error`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Initialize the monitor. Sets status to unknown. */
  public init(): void {
    log.info(`[InterfaceMonitor:${this.name}] init`);
    this.setStatus('unknown');
  }

  /** Reset all metrics and cancel health checks. */
  public reset(): void {
    log.info(`[InterfaceMonitor:${this.name}] reset`);
    this.stopHealthChecks();
    this.setStatus('unknown');
    this.lastUseTime = null;
    this.messagesSentCount = 0;
    this.errorCount = 0;
    this.lastErrorMessage = null;
    this.timeFirstUp = null;
  }

  /** Clean up timers on shutdown. */
  public dispose(): void {
    log.info(`[InterfaceMonitor:${this.name}] dispose`);
    this.stopHealthChecks();
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  /** Record a successful interface call. */
  public recordSuccess(): void {
    const now = Date.now();
    this.lastUseTime = now;
    this.messagesSentCount++;

    if (this.status !== 'available') {
      if (this.timeFirstUp === null) {
        this.timeFirstUp = now;
      }
      this.setStatus('available');
      this.stopHealthChecks();
    }
  }

  /** Record an interface error. Classifies whether the interface is down. */
  public recordError(statusCode: number, errorMessage: string): void {
    this.lastUseTime = Date.now();
    this.errorCount++;
    this.lastErrorMessage = errorMessage;

    const isDown = this.errorClassifier.isInterfaceDown(statusCode, errorMessage);

    if (isDown && (this.status === 'available' || this.status === 'unknown')) {
      this.setStatus('not-available');
      this.startEscalatingHealthChecks();
    }
    // If !isDown, the interface is still up (e.g., 400 bad request). Status stays as-is.
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  /** Run a single health check immediately and update status. */
  public async healthcheck(): Promise<void> {
    log.info(`[InterfaceMonitor:${this.name}] manual healthcheck`);
    const up = await this.runHealthCheck();
    log.info(`[InterfaceMonitor:${this.name}] healthcheck result: ${up ? 'UP' : 'DOWN'}`);
    if (up) {
      this.recordSuccess();
    }
  }

  private async runHealthCheck(): Promise<boolean> {
    try {
      return await this.healthCheckFn();
    } catch (err) {
      log.warn(`[InterfaceMonitor:${this.name}] healthcheck threw`, {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Start the escalating health check schedule:
   * - Phase "fast": every 2s for 10s (5 checks)
   * - Phase "slow": every 5s for 30s (6 checks)
   * - Then declare "down"
   */
  private startEscalatingHealthChecks(): void {
    this.stopHealthChecks();
    this.healthCheckPhase = 'fast';
    this.healthCheckElapsedMs = 0;
    log.info(`[InterfaceMonitor:${this.name}] starting escalating health checks`);
    this.scheduleNextHealthCheck();
  }

  private scheduleNextHealthCheck(): void {
    if (this.healthCheckPhase === 'done') {
      return;
    }

    const intervalMs = this.healthCheckPhase === 'fast' ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;

    this.healthCheckTimer = setTimeout(() => {
      void this.runScheduledHealthCheck(intervalMs);
    }, intervalMs);
  }

  private async runScheduledHealthCheck(intervalMs: number): Promise<void> {
    if (this.healthCheckRunning) {
      return;
    }
    this.healthCheckRunning = true;

    try {
      const up = await this.runHealthCheck();

      if (up) {
        log.info(`[InterfaceMonitor:${this.name}] healthcheck succeeded, restoring available`);
        this.recordSuccess();
        return; // recordSuccess stops health checks
      }

      // Still down — advance the schedule
      this.healthCheckElapsedMs += intervalMs;

      if (this.healthCheckPhase === 'fast' && this.healthCheckElapsedMs >= FAST_DURATION_MS) {
        log.info(`[InterfaceMonitor:${this.name}] fast phase exhausted, switching to slow`);
        this.healthCheckPhase = 'slow';
        this.healthCheckElapsedMs = 0;
      } else if (
        this.healthCheckPhase === 'slow' &&
        this.healthCheckElapsedMs >= SLOW_DURATION_MS
      ) {
        log.warn(`[InterfaceMonitor:${this.name}] all health checks exhausted, declaring down`);
        this.setStatus('down');
        this.healthCheckPhase = 'done';
        return;
      }

      this.scheduleNextHealthCheck();
    } finally {
      this.healthCheckRunning = false;
    }
  }

  private stopHealthChecks(): void {
    if (this.healthCheckTimer !== null) {
      clearTimeout(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.healthCheckPhase = 'done';
    this.healthCheckElapsedMs = 0;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /** Return a serializable snapshot of current status and metrics. */
  public getSnapshot(): InterfaceStatusSnapshot {
    return {
      name: this.name,
      status: this.status,
      lastUseTime: this.lastUseTime,
      messageDescription: this.messageDescription,
      messagesSentCount: this.messagesSentCount,
      errorCount: this.errorCount,
      lastErrorMessage: this.lastErrorMessage,
      timeFirstUp: this.timeFirstUp,
    };
  }
}
