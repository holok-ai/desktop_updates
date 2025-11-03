import { describe, it, expect, beforeEach } from 'vitest';
import { mokuService } from '../../../src-electron/services/moku.service';

describe('ModelsService (in-memory)', () => {
  beforeEach(async () => {
    // ensure fresh seeded state
    await mokuService.refreshFromMoku();
  });

  it('lists available models', async () => {
    const list = await mokuService.listAvailableModelsForUser();
    expect(Array.isArray(list)).toBe(true);
    expect(list.every((m) => m.available)).toBe(true);
  });

  it('can get a model by provider and id', async () => {
    const all = await mokuService.listModelsForUser();
    expect(all.length).toBeGreaterThan(0);
    const sample = all[0];
    const got = await mokuService.getModel(sample.provider, sample.id);
    expect(got).toBeTruthy();
    expect(got?.id).toBe(sample.id);
  });
});
