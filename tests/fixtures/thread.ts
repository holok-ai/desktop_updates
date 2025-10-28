import type { Thread } from 'src-electron/preload';

export const sampleThread = (overrides: Partial<Thread> = {}): Thread => ({
  id: 'thread-' + Math.random().toString(36).slice(2),
  title: 'Sample',
  description: 'Sample thread',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...overrides,
});

export const sampleThreadInput = () => ({
  title: 'Sample',
  description: 'Sample thread',
  status: 'active' as const,
  metadata: {},
});
