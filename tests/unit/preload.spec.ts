import { describe, it, expect, vi } from 'vitest';

// We'll import the preload module under a mocked electron where contextBridge is observed
const sent = new Map<string, unknown>();

vi.mock('electron', () => {
  const ipcRenderer = {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  };

  const contextBridge = {
    exposeInMainWorld: (name: string, obj: unknown) => {
      // capture the exposed API for assertions
      // @ts-ignore
      sent.set(name, obj);
    },
  };

  return { contextBridge, ipcRenderer };
});

describe('preload wiring', () => {
  it('exposes electronAPI on contextBridge', async () => {
    // import the preload after mocks are setup
    await import('../../src-electron/preload');
    // @ts-ignore
    const exposed = sent.get('electronAPI');
    expect(exposed).toBeTruthy();
    // check top-level groups exist
    // @ts-ignore
    expect(exposed.auth).toBeTruthy();
    // @ts-ignore
    expect(exposed.thread).toBeTruthy();
    // @ts-ignore
    expect(exposed.settings).toBeTruthy();
    // @ts-ignore
    expect(exposed.log).toBeTruthy();
  });
});
