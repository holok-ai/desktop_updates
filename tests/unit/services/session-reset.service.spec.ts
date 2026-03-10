import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearThreads = vi.fn();
const clearProjects = vi.fn();
const clearFavorites = vi.fn();

vi.mock('$lib/stores/thread.store', () => ({
  threads: {
    clearThreads,
  },
}));
vi.mock('$lib/stores/thread.store.ts', () => ({
  threads: {
    clearThreads,
  },
}));

vi.mock('$lib/stores/project.store', () => ({
  projects: {
    clearProjects,
  },
}));
vi.mock('$lib/stores/project.store.ts', () => ({
  projects: {
    clearProjects,
  },
}));

vi.mock('$lib/stores/favorite.store', () => ({
  favorites: {
    clearFavorites,
  },
}));
vi.mock('$lib/stores/favorite.store.ts', () => ({
  favorites: {
    clearFavorites,
  },
}));

describe('session-reset.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears all renderer session-scoped stores', async () => {
    const { resetRendererSessionState } = await import(
      '../../../src/lib/services/session-reset.service'
    );

    resetRendererSessionState();

    expect(clearThreads).toHaveBeenCalledOnce();
    expect(clearProjects).toHaveBeenCalledOnce();
    expect(clearFavorites).toHaveBeenCalledOnce();
  });
});
