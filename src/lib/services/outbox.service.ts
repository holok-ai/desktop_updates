import { MESSAGE_STATUS } from '$lib/constants/status.constant';
import type { MessageStatus } from '$lib/types/status.type';
import type { Message } from '../types/thread.type';
import { writable, type Writable } from 'svelte/store';

interface PendingMessage {
  message: Message;
  threadId: string;
  retryCount: number;
  lastAttempt: number;
  error?: string;
}

const DB_NAME = 'HolokaiOutbox';
const DB_VERSION = 1;
const STORE_NAME = 'pendingMessages';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const TIMEOUT_MS = 10000;

class OutboxService {
  private db: IDBDatabase | null = null;
  private pendingMessages: Writable<Map<string, PendingMessage>> = writable<Map<string, PendingMessage>>(new Map<string, PendingMessage>());
  private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error ?? new Error('IndexedDB open error'));
      request.onsuccess = () => {
        this.db = request.result;
        void this.loadPendingMessages();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'message.id' });
        }
      };
    });
  }

  private async loadPendingMessages(): Promise<void> {
    if (this.db === null) {
      return;
    }

    const transaction = this.db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const items = await new Promise<PendingMessage[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as PendingMessage[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll error'));
    });

    const pending = new Map<string, PendingMessage>();
    items.forEach((item) => pending.set(item.message.id, item));
    this.pendingMessages.set(pending);
  }

  async addPendingMessage(message: Message, threadId: string): Promise<void> {
    if (this.db === null) {
      await this.init();
    }

    const pendingMsg: PendingMessage = {
      message,
      threadId,
      retryCount: 0,
      lastAttempt: Date.now(),
    };

    // Save to IndexedDB
    if (this.db !== null) {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const req = store.put(pendingMsg);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('IndexedDB put error'));
      });
    }

    // Update in-memory store
    this.pendingMessages.update((map) => {
      map.set(message.id, pendingMsg);
      return new Map(map);
    });
  }

  async removePendingMessage(messageId: string): Promise<void> {
    if (this.db === null) {
      return;
    }

    // Clear retry timer if exists
    const timer = this.retryTimers.get(messageId);
    if (typeof timer !== 'undefined') {
      clearTimeout(timer);
      this.retryTimers.delete(messageId);
    }

    // Remove from IndexedDB
    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(messageId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB delete error'));
    });

    // Update in-memory store
    this.pendingMessages.update((map) => {
      map.delete(messageId);
      return new Map(map);
    });
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    error?: string
  ): Promise<void> {
    if (status === MESSAGE_STATUS.SENT) {
      await this.removePendingMessage(messageId);
    } else if (status === MESSAGE_STATUS.FAILED) {
      this.pendingMessages.update((map) => {
        const pending = map.get(messageId);
        if (typeof pending !== 'undefined') {
          pending.error = error;
          pending.retryCount++;
          pending.lastAttempt = Date.now();
          map.set(messageId, pending);
        }
        return new Map(map);
      });
    }
  }

  scheduleRetry(
    messageId: string,
    retryFn: () => Promise<void>,
    delay: number = RETRY_DELAY
  ): void {
    // Clear existing timer
    const existingTimer = this.retryTimers.get(messageId);
    if (typeof existingTimer !== 'undefined') {
      clearTimeout(existingTimer);
    }

    // Schedule new retry
    const timer = setTimeout(() => {
      this.retryTimers.delete(messageId);
      void retryFn();
    }, delay);

    this.retryTimers.set(messageId, timer);
  }

  canRetry(messageId: string): boolean {
    let canretryMessage = false;
    this.pendingMessages.subscribe((map) => {
      const pending = map.get(messageId);
      if (typeof pending !== 'undefined') {
        canretryMessage = pending.retryCount < MAX_RETRIES;
      } else {
        canretryMessage = false;
      }
    })();
    return canretryMessage;
  }

  getPendingMessage(messageId: string): PendingMessage | undefined {
    let result: PendingMessage | undefined;
    this.pendingMessages.subscribe((map) => {
      result = map.get(messageId);
    })();
    return result;
  }

  async clearAll(): Promise<void> {
    if (this.db === null) {
      return;
    }

    // Clear all retry timers
    this.retryTimers.forEach((timer) => clearTimeout(timer));
    this.retryTimers.clear();

    // Clear IndexedDB
    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB clear error'));
    });

    // Clear in-memory store
    this.pendingMessages.set(new Map());
  }

  get pending(): Writable<Map<string, PendingMessage>> {
    return this.pendingMessages;
  }

  getTimeout(): number {
    return TIMEOUT_MS;
  }

  getMaxRetries(): number {
    return MAX_RETRIES;
  }
}

export const outboxService = new OutboxService();

