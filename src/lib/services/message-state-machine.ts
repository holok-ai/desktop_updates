/* eslint-disable security/detect-object-injection */
/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
// MessageStateMachine: front-end FSM for message lifecycle transitions
// Implements a lightweight, testable state machine with in-memory actors,
// local snapshot persistence (localStorage), retry scheduling, and a
// subscription API for UI components to observe per-message state changes.

import { threadService } from '$lib/services/thread.service.js';
import type { Message } from '$lib/types/thread.type.js';

type UUID = string;

export type MessageStatus = 'sending' | 'sent' | 'retrying' | 'failed' | 'complete' | 'archived';

export interface MessageStateSnapshot {
  clientMessageId: UUID;
  threadId: UUID;
  previousState?: MessageStatus;
  state: MessageStatus;
  attemptCount: number;
  lastSequenceId?: string | number;
  changedAt: string; // ISO
  metadata?: Record<string, unknown>;
}

export type ExternalEvent =
  | {
      type: 'ACK';
      clientMessageId: UUID;
      threadId: UUID;
      serverMessageId?: string;
      sequenceId?: string | number;
    }
  | {
      type: 'FAIL';
      clientMessageId: UUID;
      threadId: UUID;
      errorCode?: number;
      errorMessage?: string;
      sequenceId?: string | number;
    }
  | { type: 'RETRY_TRIGGER'; clientMessageId: UUID; threadId: UUID }
  | { type: 'CONFIRM'; clientMessageId: UUID; threadId: UUID }
  | { type: 'ARCHIVE'; clientMessageId: UUID; threadId: UUID };

type Subscriber = (snap: MessageStateSnapshot) => void;

const RETRY_BACKOFF_MS = [3000, 6000]; // two automatic retries (3s, 6s) => <=10s total
const STORAGE_KEY_PREFIX = 'msm:snapshot:';

type ChatResult = { success?: boolean; status?: number; error?: string } | undefined;

type Metadata = Record<string, unknown> & { model?: unknown };

function storageKey(threadId: string, clientMessageId: string): string {
  return `${STORAGE_KEY_PREFIX}${threadId}:${clientMessageId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getModelFromMetadata(metadata?: Metadata): string {
  if (metadata !== undefined && metadata !== null && typeof metadata.model === 'string') {
    return metadata.model;
  }
  return 'llama3:latest';
}

type ElectronAPIType = {
  chat?: { chat: (req: unknown) => Promise<ChatResult> };
  log?: { info: (tag: string, payload?: unknown) => void };
  messageStateMachine?: unknown;
};

export class MessageStateMachine {
  private snapshots: Map<string, MessageStateSnapshot> = new Map();
  private subscribers: Map<string, Set<Subscriber>> = new Map();
  private retryTimers: Map<string, number> = new Map();

  // Initialize from storage for messages the app cares about.
  public loadSnapshot(threadId: string, clientMessageId: string): MessageStateSnapshot | null {
    // Return in-memory snapshot if present. Loading from IndexedDB is async; callers
    // that need durable load should call `loadSnapshotAsync`.
    const existing = this.snapshots.get(clientMessageId);
    if (existing !== undefined) {
      return existing;
    }
    return null;
  }

  public persistSnapshot(snap: MessageStateSnapshot): void {
    // keep in-memory and write to IndexedDB asynchronously
    this.snapshots.set(snap.clientMessageId, { ...snap });
    this.emitToSubscribers(snap.clientMessageId, snap);
    // fire-and-forget async persistence
    void this.writeSnapshotIndexedDB(snap).catch((e) => {
      console.error('MessageStateMachine: failed to write snapshot to IndexedDB', e);
    });
  }

  // Async read from IndexedDB
  public async loadSnapshotAsync(
    threadId: string,
    clientMessageId: string,
  ): Promise<MessageStateSnapshot | null> {
    try {
      const key = storageKey(threadId, clientMessageId);
      const db = await this.openDB();
      return await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('snapshots', 'readonly');
          const store = tx.objectStore('snapshots');
          const req = store.get(key);
          req.onsuccess = () => {
            const val = req.result as { id: string; snap?: MessageStateSnapshot } | undefined;
            if (!val?.snap) {
              resolve(null);
              return;
            }
            this.snapshots.set(clientMessageId, val.snap);
            resolve(val.snap ?? null);
          };
          req.onerror = () => reject(req.error ?? new Error('IDB request error'));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
    } catch (e) {
      console.error('loadSnapshotAsync failed', e);
      return null;
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open('msm-db', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('snapshots')) {
            db.createObjectStore('snapshots', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IDB request error'));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  private async writeSnapshotIndexedDB(snap: MessageStateSnapshot): Promise<void> {
    const key = storageKey(snap.threadId, snap.clientMessageId);
    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        const payload = { id: key, snap };
        const req = store.put(payload);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('IDB write error'));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  // Create initial sending snapshot and persist it. Returns the created snapshot.
  public createSending(
    threadId: string,
    clientMessageId: string,
    metadata?: Record<string, unknown>,
  ): MessageStateSnapshot {
    const snap: MessageStateSnapshot = {
      clientMessageId,
      threadId,
      previousState: undefined,
      state: 'sending',
      attemptCount: 0,
      changedAt: nowIso(),
      metadata: metadata ? { ...metadata } : undefined,
    };
    this.persistSnapshot(snap);
    return snap;
  }

  // Subscribe to state updates for a specific message
  public subscribe(clientMessageId: string, cb: Subscriber): () => void {
    if (!this.subscribers.has(clientMessageId)) {
      this.subscribers.set(clientMessageId, new Set());
    }
    const set = this.subscribers.get(clientMessageId);
    if (set === undefined) {
      // Defensive: should not happen, but ensure we return a no-op unsubscribe
      return () => {};
    }
    set.add(cb);
    // If snapshot exists, notify immediately
    const snap = this.snapshots.get(clientMessageId);
    if (snap !== undefined) {
      cb(snap);
    }
    return () => set.delete(cb);
  }

  private emitToSubscribers(clientMessageId: string, snap: MessageStateSnapshot): void {
    const set = this.subscribers.get(clientMessageId);
    if (set === undefined) {
      return;
    }
    for (const cb of Array.from(set)) {
      cb({ ...snap });
    }
  }

  // Handle an external event (ACK/FAIL/RETRY_TRIGGER/CONFIRM/ARCHIVE)
  public handleEvent(evt: ExternalEvent): void {
    const { clientMessageId } = evt;
    const existing = this.snapshots.get(clientMessageId);
    if (existing === undefined) {
      // No local snapshot — nothing to reconcile locally (could load from storage if desired)
      console.warn('MessageStateMachine: received event for unknown message', evt);
      return;
    }

    // Dedupe with sequenceId if present (only ACK and FAIL carry sequenceId)
    let sequenceId: string | number | undefined;
    if (evt.type === 'ACK' || evt.type === 'FAIL') {
      sequenceId = evt.sequenceId;
    }
    if (sequenceId !== undefined && existing.lastSequenceId !== undefined) {
      try {
        // numeric or string comparison: coerce to Number when possible
        const seqNum = Number(sequenceId);
        const prevNum = Number(existing.lastSequenceId as unknown);
        if (!Number.isNaN(seqNum) && !Number.isNaN(prevNum) && seqNum <= prevNum) {
          return; // stale event
        }
      } catch {
        // fallthrough — if we cannot compare, continue
      }
    }

    switch (evt.type) {
      case 'ACK': {
        const { sequenceId: ackSeq, serverMessageId } = evt;
        this.transitionTo(existing, 'sent', {
          lastSequenceId: ackSeq,
          metadata: { serverMessageId },
        });
        break;
      }
      case 'FAIL': {
        const { errorCode, errorMessage, sequenceId: seqId } = evt;
        if (this.isTransientError(errorCode)) {
          // mark failed then schedule automatic retry
          this.transitionTo(existing, 'failed', {
            lastSequenceId: seqId,
            metadata: {
              errorCode,
              errorMessage,
            },
          });
          void this.scheduleAutomaticRetry(existing);
        } else {
          this.transitionTo(existing, 'failed', {
            lastSequenceId: seqId,
            metadata: {
              errorCode,
              errorMessage,
            },
          });
        }
        break;
      }
      case 'RETRY_TRIGGER':
        this.transitionTo(existing, 'retrying');
        void this.performRetry(existing);
        break;
      case 'CONFIRM':
        this.transitionTo(existing, 'complete');
        break;
      case 'ARCHIVE':
        this.transitionTo(existing, 'archived');
        break;
      default:
        break;
    }
  }

  private transitionTo(
    base: MessageStateSnapshot,
    newState: MessageStatus,
    opts?: { lastSequenceId?: string | number; metadata?: Record<string, unknown> },
  ): void {
    // Guard illegal transitions
    if (!this.isAllowedTransition(base.state, newState)) {
      console.warn(`Illegal transition attempted: ${base.state} -> ${newState}`);
      return;
    }

    const snap: MessageStateSnapshot = {
      ...base,
      previousState: base.state,
      state: newState,
      attemptCount: base.attemptCount ?? 0,
      lastSequenceId: opts?.lastSequenceId ?? base.lastSequenceId,
      changedAt: nowIso(),
      metadata: opts?.metadata
        ? { ...(base.metadata ?? {}), ...(opts.metadata ?? {}) }
        : base.metadata,
    };

    // If moving into retrying via an automatic path, increment attemptCount
    if (newState === 'retrying') {
      snap.attemptCount = (base.attemptCount ?? 0) + 1;
    }

    this.persistSnapshot(snap);

    // side effects: compute duration from previous state's changedAt when available
    let durationMs: number | undefined;
    try {
      if (typeof base.changedAt === 'string' && base.changedAt.length > 0) {
        const prevTs = Date.parse(base.changedAt);
        durationMs = Date.now() - prevTs;
      }
    } catch {
      durationMs = undefined;
    }
    this.emitTelemetryTransition(snap.previousState, snap.state, snap, durationMs);

    // cancel any existing retry timer when leaving retrying or failed
    if (this.retryTimers.has(snap.clientMessageId) && newState !== 'retrying') {
      const t = this.retryTimers.get(snap.clientMessageId);
      if (typeof t === 'number') {
        clearTimeout(t);
      }
      this.retryTimers.delete(snap.clientMessageId);
    }
  }

  private isAllowedTransition(from: MessageStatus, to: MessageStatus): boolean {
    const allowed: Record<MessageStatus, MessageStatus[]> = {
      sending: ['sent', 'failed'],
      sent: ['complete', 'archived'],
      failed: ['retrying'],
      retrying: ['sent', 'failed'],
      complete: [],
      archived: [],
    };
    return allowed[from].includes(to);
  }

  private isTransientError(code?: number): boolean {
    if (typeof code !== 'number') {
      return false;
    }
    // Common transient codes
    return [502, 503, 504, 429].includes(code);
  }

  private scheduleAutomaticRetry(snap: MessageStateSnapshot): void {
    const attempts = snap.attemptCount ?? 0;
    if (attempts >= RETRY_BACKOFF_MS.length) {
      // exhausted automatic retries
      return;
    }
    const delay = RETRY_BACKOFF_MS[attempts];
    const timer = window.setTimeout(() => {
      this.handleEvent({
        type: 'RETRY_TRIGGER',
        clientMessageId: snap.clientMessageId,
        threadId: snap.threadId,
      });
    }, delay);
    this.retryTimers.set(snap.clientMessageId, timer);
  }

  private async performRetry(snap: MessageStateSnapshot): Promise<void> {
    try {
      // Attempt to find the original message content from the thread repository via service
      const msgs = await threadService.getMessages(snap.threadId);
      const orig = msgs.find(
        (m: Message) => m.clientMessageId === snap.clientMessageId || m.id === snap.clientMessageId,
      );
      if (!orig) {
        console.warn('performRetry: original message not found for', snap.clientMessageId);
        return;
      }

      const content = String(orig.content ?? '');
      const model = getModelFromMetadata(snap.metadata);

      const request = {
        messages: [{ role: 'user', content }],
        streaming: false,
        model,
      } as const;

      // Fire the chat request; server should emit ACK/FAIL events that will be handled
      // by the FSM via IPC. If the chat call itself fails synchronously, mark as FAIL.
      // Call through electronAPI only if available
      const maybeApi = (window as unknown as { electronAPI?: ElectronAPIType }).electronAPI;
      if (maybeApi === undefined || typeof maybeApi.chat?.chat !== 'function') {
        // Treat as failure if API not available
        this.handleEvent({
          type: 'FAIL',
          clientMessageId: snap.clientMessageId,
          threadId: snap.threadId,
          errorMessage: 'chat_api_unavailable',
        });
        return;
      }

      const result = await maybeApi.chat.chat(request);
      if (result?.success !== true) {
        const failure = result ?? {};
        this.handleEvent({
          type: 'FAIL',
          clientMessageId: snap.clientMessageId,
          threadId: snap.threadId,
          errorCode:
            typeof (failure as { status?: number }).status === 'number'
              ? (failure as { status?: number }).status
              : 0,
          errorMessage:
            typeof (failure as { error?: string }).error === 'string'
              ? (failure as { error?: string }).error
              : 'retry_failed',
        });
      }
      // otherwise, assume server will emit ACK and FSM will reconcile
    } catch (e) {
      // On unexpected errors, transition to failed and do not schedule more retries here
      console.error('performRetry error', e);
      this.handleEvent({
        type: 'FAIL',
        clientMessageId: snap.clientMessageId,
        threadId: snap.threadId,
        errorMessage: (e as Error).message,
      });
    }
  }

  private transitionCounts: Map<string, number> = new Map();
  private transitionDurationsMs: Map<string, number[]> = new Map();

  private emitTelemetryTransition(
    prev?: MessageStatus,
    next?: MessageStatus,
    snap?: MessageStateSnapshot,
    durationMs?: number,
  ): void {
    const key = `${prev ?? 'unknown'}->${next ?? 'unknown'}`;
    const prevCount = this.transitionCounts.get(key) ?? 0;
    this.transitionCounts.set(key, prevCount + 1);
    if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
      const arr = this.transitionDurationsMs.get(key) ?? [];
      arr.push(durationMs);
      this.transitionDurationsMs.set(key, arr);
    }

    // Emit lightweight logs to main process via the existing logging bridge
    try {
      const maybeApi = (window as unknown as { electronAPI?: ElectronAPIType }).electronAPI;
      if (maybeApi && typeof maybeApi.log?.info === 'function') {
        maybeApi.log.info('telemetry:state.transition', {
          prev,
          next,
          clientMessageId: snap?.clientMessageId,
          threadId: snap?.threadId,
          attemptCount: snap?.attemptCount,
          durationMs,
        });
      } else {
        console.warn('telemetry: state.transition', {
          prev,
          next,
          clientMessageId: snap?.clientMessageId,
          threadId: snap?.threadId,
          attemptCount: snap?.attemptCount,
          durationMs,
        });
      }
    } catch (e) {
      console.warn('emitTelemetryTransition failed', e instanceof Error ? e : String(e));
    }
  }

  // Expose in-memory metrics snapshot for tests / debugging
  public getMetrics(): {
    counts: Record<string, number>;
    durations: Record<string, { count: number; avgMs: number }>;
  } {
    const counts: Record<string, number> = {};
    for (const [k, v] of this.transitionCounts.entries()) {
      counts[k] = v;
    }
    const durations: Record<string, { count: number; avgMs: number }> = {};
    for (const [k, arr] of this.transitionDurationsMs.entries()) {
      const sum = arr.reduce((s, n) => s + n, 0);
      durations[k] = { count: arr.length, avgMs: arr.length ? Math.round(sum / arr.length) : 0 };
    }
    return { counts, durations };
  }
}

export const messageStateMachine = new MessageStateMachine();

// Expose for E2E tests to simulate server events
try {
  if (typeof window !== 'undefined') {
    (window as unknown as { messageStateMachine?: MessageStateMachine }).messageStateMachine =
      messageStateMachine;
  }
} catch {
  // ignore in non-browser contexts
}
