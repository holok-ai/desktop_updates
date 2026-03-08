import log from 'electron-log';
import { getSettingsService } from '../ipc-handlers/settings-handler.js';
import { getAuthService } from '../ipc-handlers/auth-handler.js';
import { interfaceStatusRegistry } from './reliability/interface-status-registry.js';

export type NotificationSeverity = 'info' | 'warn' | 'error';

export type NotificationEventType =
  | 'guard_started'
  | 'guard_passed'
  | 'guard_failed'
  | 'status'
  | 'provider_request_started'
  | 'provider_response_completed'
  | 'provider_error'
  | (string & {});

export interface NotificationEvent {
  id: string;
  ts: number;
  organizationId: string;
  userId: string;
  appSlug?: string;
  threadId?: string;
  requestId?: string;
  branchId?: string;
  type: NotificationEventType;
  severity: NotificationSeverity;
  message: string;
  payload?: unknown;
}

export type NotificationCallback = (event: NotificationEvent) => void;

export interface NotificationContext {
  threadId?: string;
  isSharedProject: boolean;
}

/**
 * Notification stream service (SSE)
 * - Connects to /api/notifications/stream
 * - Filters events locally by threadId
 * - Only connects when in a shared project and threadId is set
 */
export class NotificationService {
  private abortController?: AbortController;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectDelayMs = 1500;
  private listeners = new Set<NotificationCallback>();
  private context: NotificationContext = { isSharedProject: false };
  private connecting = false;
  private connected = false;

  public start(): void {
    void this.ensureConnection();
  }

  public stop(): void {
    this.connected = false;
    this.connecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // ignore
      }
      this.abortController = undefined;
    }
  }

  /**
   * Update thread/project context. When not shared or no thread, connection is stopped.
   */
  public setActiveThread(threadId: string | null, isSharedProject: boolean): void {
    this.context = {
      threadId: threadId || undefined,
      isSharedProject,
    };

    if (!this.shouldListen()) {
      this.stop();
      return;
    }

    void this.ensureConnection();
  }

  /**
   * Register callback for notifications.
   */
  public onNotification(cb: NotificationCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private shouldListen(): boolean {
    return Boolean(this.context.threadId);
  }

  private getHoloApiUrl(): string {
    const settingsService = getSettingsService();
    return settingsService.getHoloApiUrl();
  }

  private getAccessToken(): string | null {
    const authService = getAuthService();
    const authState = authService.getAuthState();
    return authState.tokens?.accessToken || null;
  }

  private async ensureConnection(): Promise<void> {
    if (!this.shouldListen()) {
      return;
    }

    if (this.connected || this.connecting) {
      return;
    }

    await this.connect();
  }

  private scheduleReconnect(reason: string): void {
    if (!this.shouldListen()) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    log.warn('[NotificationService] Reconnecting stream', {
      reason,
      delayMs: this.reconnectDelayMs,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, this.reconnectDelayMs);
  }

  private async connect(): Promise<void> {
    if (!this.shouldListen()) {
      return;
    }

    const accessToken = this.getAccessToken();
    if (!accessToken) {
      this.scheduleReconnect('missing_access_token');
      return;
    }

    const holoApiUrl: string = this.getHoloApiUrl();
    const threadId = this.context.threadId;
    const url = threadId
      ? `${holoApiUrl}/api/notifications/stream?threadId=${encodeURIComponent(threadId)}`
      : `${holoApiUrl}/api/notifications/stream`;

    this.connecting = true;
    this.abortController = new AbortController();

    log.info('[NotificationService] Connecting SSE stream', { url, threadId });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'text/event-stream',
        },
        signal: this.abortController.signal,
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`SSE connect failed: ${response.status} ${errorText}`);
      }

      this.connected = true;
      this.connecting = false;
      log.info('[NotificationService] SSE connected', {
        status: response.status,
        contentType: response.headers.get('content-type'),
      });
      this.recordReliability(true);

      await this.readEventStream(response.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('[NotificationService] SSE stream error', { message });
      this.recordReliability(false, message);
    } finally {
      this.connected = false;
      this.connecting = false;

      if (this.abortController) {
        this.abortController = undefined;
      }

      this.scheduleReconnect('stream_closed');
    }
  }

  private async readEventStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      log.info('[NotificationService] raw chunk received', {
        length: chunk.length,
        preview: chunk.slice(0, 200),
      });
      buffer += chunk;

      // Process complete SSE events (delimited by double newline)
      while (true) {
        const idxLf = buffer.indexOf('\n\n');
        const idxCr = buffer.indexOf('\r\n\r\n');

        let cut = -1;
        let delim = 0;
        if (idxCr >= 0 && (idxLf < 0 || idxCr < idxLf)) {
          cut = idxCr;
          delim = 4;
        } else if (idxLf >= 0) {
          cut = idxLf;
          delim = 2;
        }

        if (cut < 0) {
          break;
        }

        const raw = buffer.slice(0, cut);
        buffer = buffer.slice(cut + delim);

        this.handleSseBlock(raw);
      }
    }
  }

  private handleSseBlock(raw: string): void {
    if (!this.shouldListen()) {
      return;
    }

    const lines = raw.split(/\r?\n/);
    let eventName = '';
    let eventId = '';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (!line || line.startsWith(':')) {
        continue;
      }

      const sep = line.indexOf(':');
      const field = sep === -1 ? line : line.slice(0, sep);
      const value = sep === -1 ? '' : line.slice(sep + 1).trimStart();

      switch (field) {
        case 'event':
          eventName = value;
          break;
        case 'id':
          eventId = value;
          break;
        case 'retry': {
          const retry = Number.parseInt(value, 10);
          if (Number.isFinite(retry) && retry > 0) {
            this.reconnectDelayMs = retry;
          }
          break;
        }
        case 'data':
          dataLines.push(value);
          break;
        default:
          break;
      }
    }

    if (!dataLines.length) {
      return;
    }

    const dataStr = dataLines.join('\n');

    let parsed: NotificationEvent | null = null;
    try {
      parsed = JSON.parse(dataStr) as NotificationEvent;
    } catch (err) {
      log.warn('[NotificationService] Failed to parse SSE data', {
        eventName,
        eventId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (!parsed) {
      return;
    }

    if (eventName && parsed.type && eventName !== parsed.type) {
      // Prefer payload type if set, but keep log for debugging
      log.debug('[NotificationService] SSE event/type mismatch', {
        eventName,
        payloadType: parsed.type,
      });
    }

    this.dispatch(parsed);
  }

  private dispatch(ev: NotificationEvent): void {
    log.info('[NotificationService] dispatch received', {
      type: ev.type,
      threadId: ev.threadId,
      userId: ev.userId,
      requestId: ev.requestId,
      branchId: ev.branchId,
    });

    if (!this.shouldListen()) {
      log.info('[NotificationService] dispatch skipped: shouldListen=false');
      return;
    }

    const threadId = this.context.threadId;
    if (threadId && ev.threadId !== threadId) {
      log.info('[NotificationService] dispatch skipped: threadId mismatch', {
        expected: threadId,
        got: ev.threadId,
      });
      return;
    }

    // Record each dispatched event as a successful notification message
    this.recordReliability(true);

    log.info('[NotificationService] dispatch forwarding to', this.listeners.size, 'listeners');

    for (const cb of this.listeners) {
      try {
        cb(ev);
      } catch (err) {
        log.error('[NotificationService] Listener error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Reliability recording
  // ---------------------------------------------------------------------------

  private recordReliability(success: boolean, errorMessage?: string): void {
    try {
      if (!interfaceStatusRegistry.hasMonitor('holo-notifications')) {
        return;
      }
      const monitor = interfaceStatusRegistry.getMonitor('holo-notifications');
      if (success) {
        monitor.recordSuccess();
      } else {
        monitor.recordError(-1, errorMessage || 'SSE connection error');
      }
    } catch {
      // Registry not ready yet; ignore
    }
  }
}

export const notificationService = new NotificationService();

export default NotificationService;
