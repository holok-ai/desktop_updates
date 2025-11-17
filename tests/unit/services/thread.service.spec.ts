import { describe, it, expect, beforeEach, vi } from 'vitest';
import { threadService } from '$lib/services/thread.service';
import { threads } from '$lib/stores/thread.store';
import type { Thread } from 'src-electron/preload';

const sample = (id: string): Thread => ({
  id,
  title: `t-${id}`,
  description: '',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
});

describe('thread.service', () => {
  beforeEach(() => {
    threads.setThreads([]);
  });

  it('getAll fetches from electronAPI and updates store', async () => {
    const list = [sample('1'), sample('2')];
    const spy = vi.spyOn(window.electronAPI.thread, 'getAll').mockResolvedValue(list);
    const result = await threadService.getAll();
    expect(result).toEqual(list);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('getAll accepts optional options parameter', async () => {
    const list = [sample('1'), sample('2')];
    const spy = vi.spyOn(window.electronAPI.thread, 'getAll').mockResolvedValue(list);
    const options = { includeProjectOnly: true };
    const result = await threadService.getAll(options);
    expect(result).toEqual(list);
    expect(spy).toHaveBeenCalledWith(options);
  });

  it('create delegates to electronAPI', async () => {
    const data = { title: 'x', description: '', status: 'active', metadata: {} } as Omit<
      Thread,
      'id' | 'createdAt' | 'updatedAt'
    >;
    const created = sample('9');
    const spy = vi.spyOn(window.electronAPI.thread, 'create').mockResolvedValue(created);
    const result = await threadService.create(data);
    expect(result).toEqual(created);
    expect(spy).toHaveBeenCalledWith(data);
  });

  it('update delegates to electronAPI', async () => {
    const updated = sample('1');
    const spy = vi.spyOn(window.electronAPI.thread, 'update').mockResolvedValue(updated);
    const result = await threadService.update('1', { title: 'new' });
    expect(result).toEqual(updated);
    expect(spy).toHaveBeenCalledWith('1', { title: 'new' });
  });

  it('delete delegates to electronAPI', async () => {
    const spy = vi.spyOn(window.electronAPI.thread, 'delete').mockResolvedValue(true);
    const ok = await threadService.delete('1');
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledWith('1');
  });
});
