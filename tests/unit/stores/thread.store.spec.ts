import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { threads } from '$lib/stores/thread.store';
import type { Thread } from 'src-electron/preload';

const baseThread = (id: string): Thread => ({
  id,
  title: `t-${id}`,
  description: '',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
});

describe('thread.store', () => {
  beforeEach(() => {
    threads.setThreads([]);
  });

  it('sets all threads', () => {
    const list = [baseThread('1'), baseThread('2')];
    threads.setThreads(list);
    expect(get(threads)).toEqual(list);
  });

  it('adds a thread', () => {
    const t = baseThread('1');
    threads.addThread(t);
    expect(get(threads)).toEqual([t]);
  });

  it('updates a thread by id', () => {
    const t1 = baseThread('1');
    const t2 = baseThread('2');
    threads.setThreads([t1, t2]);
    const updated = { ...t2, title: 'updated' };
    threads.updateThread(updated);
    expect(get(threads)).toEqual([t1, updated]);
  });

  it('deletes a thread by id', () => {
    const t1 = baseThread('1');
    const t2 = baseThread('2');
    threads.setThreads([t1, t2]);
    threads.deleteThread('1');
    expect(get(threads)).toEqual([t2]);
  });
});
