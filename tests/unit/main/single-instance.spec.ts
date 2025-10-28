import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSingleInstance } from './mocks/main-utils';

vi.mock('electron', () => {
  const app = {
    requestSingleInstanceLock: vi.fn(() => true),
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
  } as any;
  const contextBridge = { exposeInMainWorld: vi.fn() };
  const ipcRenderer = { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() };
  const safeStorage = { isEncryptionAvailable: vi.fn(() => false) };
  const BrowserWindow = { getAllWindows: () => [] };
  const ipcMain = { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() } as any;
  return { app, contextBridge, ipcRenderer, safeStorage, BrowserWindow, ipcMain };
});

describe('single instance lock behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not quit when got the lock', async () => {
    const app = { requestSingleInstanceLock: vi.fn(() => true) } as any;
    const res = checkSingleInstance(app);
    expect(res).toBe(true);
  });

  it('quits when lock not acquired', async () => {
    const app = { requestSingleInstanceLock: vi.fn(() => false), quit: vi.fn() } as any;
    const res = checkSingleInstance(app);
    expect(res).toBe(false);
  });
});
