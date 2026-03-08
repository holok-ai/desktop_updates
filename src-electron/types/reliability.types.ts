/**
 * Interface Reliability & Status Monitoring Types
 *
 * Shared types for tracking the availability and health of external interfaces:
 * - Moku API (REST)
 * - Holo API (Chat)
 * - Holo Notifications (SSE)
 */

/** Possible states for a monitored interface */
export type InterfaceStatus = 'unknown' | 'available' | 'not-available' | 'down';

/** Identifiers for the three monitored interfaces */
export type InterfaceName = 'moku-api' | 'holo-api' | 'holo-notifications';

/**
 * Serializable snapshot of a single interface's status and metrics.
 * Sent to the renderer via IPC.
 */
export interface InterfaceStatusSnapshot {
  name: InterfaceName;
  status: InterfaceStatus;
  lastUseTime: number | null;
  messageDescription: string;
  messagesSentCount: number;
  errorCount: number;
  lastErrorMessage: string | null;
  timeFirstUp: number | null;
}

/**
 * Aggregate status snapshot for all monitored interfaces.
 */
export interface AllInterfaceStatuses {
  mokuApi: InterfaceStatusSnapshot;
  holoApi: InterfaceStatusSnapshot;
  holoNotifications: InterfaceStatusSnapshot;
  timestamp: number;
}

/**
 * Determines whether an error indicates the interface itself is down
 * vs. a request-level error (e.g., bad input) where the interface is still up.
 */
export interface ErrorClassifier {
  isInterfaceDown(statusCode: number, errorMessage: string): boolean;
}

/** Async function that returns true if the interface is reachable */
export type HealthCheckFn = () => Promise<boolean>;

/**
 * Event emitted when an interface transitions between availability states.
 * Sent to the renderer via IPC so the UI can react to status changes.
 */
export interface InterfaceStatusChangeEvent {
  name: InterfaceName;
  previousStatus: InterfaceStatus;
  newStatus: InterfaceStatus;
  snapshot: InterfaceStatusSnapshot;
  timestamp: number;
}

/** Callback type for status change notifications */
export type StatusChangeCallback = (event: InterfaceStatusChangeEvent) => void;
