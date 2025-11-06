import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { outboxService } from '$lib/services/outbox.service';
import type { Message } from '$lib/types/thread.type';

describe('OutboxService', () => {
  beforeEach(async () => {
    await outboxService.init();
    await outboxService.clearAll();
  });

  afterEach(async () => {
    await outboxService.clearAll();
  });

  it('should add pending message to outbox', async () => {
    const message: Message = {
      id: 'test-msg-1',
      role: 'user',
      content: 'Hello',
      createdAt: Date.now(),
      status: 'sending',
      clientMessageId: 'test-msg-1',
    };

    await outboxService.addPendingMessage(message, 'thread-1');

    const pending = outboxService.getPendingMessage('test-msg-1');
    expect(pending).toBeDefined();
    expect(pending?.message.content).toBe('Hello');
    expect(pending?.threadId).toBe('thread-1');
  });

  it('should remove pending message from outbox', async () => {
    const message: Message = {
      id: 'test-msg-2',
      role: 'user',
      content: 'Hello',
      createdAt: Date.now(),
      status: 'sending',
      clientMessageId: 'test-msg-2',
    };

    await outboxService.addPendingMessage(message, 'thread-1');
    await outboxService.removePendingMessage('test-msg-2');

    const pending = outboxService.getPendingMessage('test-msg-2');
    expect(pending).toBeUndefined();
  });

  it('should update message status to failed', async () => {
    const message: Message = {
      id: 'test-msg-3',
      role: 'user',
      content: 'Hello',
      createdAt: Date.now(),
      status: 'sending',
      clientMessageId: 'test-msg-3',
    };

    await outboxService.addPendingMessage(message, 'thread-1');
    await outboxService.updateMessageStatus('test-msg-3', 'failed', 'Network error');

    const pending = outboxService.getPendingMessage('test-msg-3');
    expect(pending?.error).toBe('Network error');
    expect(pending?.retryCount).toBe(1);
  });

  it('should schedule retry with delay', async () => {
    vi.useFakeTimers();
    const message: Message = {
      id: 'test-msg-4',
      role: 'user',
      content: 'Hello',
      createdAt: Date.now(),
      status: 'sending',
      clientMessageId: 'test-msg-4',
    };

    await outboxService.addPendingMessage(message, 'thread-1');

    const retryFn = vi.fn();
    outboxService.scheduleRetry('test-msg-4', retryFn, 1000);

    expect(retryFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(retryFn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should respect max retries limit', async () => {
    const message: Message = {
      id: 'test-msg-5',
      role: 'user',
      content: 'Hello',
      createdAt: Date.now(),
      status: 'sending',
      clientMessageId: 'test-msg-5',
      retryCount: 0,
    };

    await outboxService.addPendingMessage(message, 'thread-1');

    // Simulate max retries
    for (let i = 0; i < outboxService.getMaxRetries(); i++) {
      await outboxService.updateMessageStatus('test-msg-5', 'failed', 'Network error');
    }

    expect(outboxService.canRetry('test-msg-5')).toBe(false);
  });

  it('should allow retry within limit', async () => {
    const message: Message = {
      id: 'test-msg-6',
      role: 'user',
      content: 'Hello',
      createdAt: Date.now(),
      status: 'sending',
      clientMessageId: 'test-msg-6',
      retryCount: 0,
    };

    await outboxService.addPendingMessage(message, 'thread-1');
    await outboxService.updateMessageStatus('test-msg-6', 'failed', 'Network error');

    expect(outboxService.canRetry('test-msg-6')).toBe(true);
  });

  it('should clear all pending messages', async () => {
    const message1: Message = {
      id: 'test-msg-7',
      role: 'user',
      content: 'Hello',
      createdAt: Date.now(),
      status: 'sending',
      clientMessageId: 'test-msg-7',
    };

    const message2: Message = {
      id: 'test-msg-8',
      role: 'user',
      content: 'World',
      createdAt: Date.now(),
      status: 'sending',
      clientMessageId: 'test-msg-8',
    };

    await outboxService.addPendingMessage(message1, 'thread-1');
    await outboxService.addPendingMessage(message2, 'thread-1');
    await outboxService.clearAll();

    expect(outboxService.getPendingMessage('test-msg-7')).toBeUndefined();
    expect(outboxService.getPendingMessage('test-msg-8')).toBeUndefined();
  });
});

