import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();
const sentEvents: Array<{ channel: string; args: unknown[] }> = [];

vi.mock('electron', () => {
  const ipcMain = {
    handle: (channel: string, fn: IpcHandler) => handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  } as any;

  const BrowserWindow = {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, ...args: unknown[]) => sentEvents.push({ channel, args }),
        },
      },
    ],
  } as any;

  const contextBridge = { exposeInMainWorld: vi.fn() };
  return { ipcMain, BrowserWindow, contextBridge };
});

// Import after mocks
import {
  registerThreadHandlers,
  unregisterThreadHandlers,
} from '../../../src-electron/ipc-handlers/thread-handler';

async function invoke(channel: string, ...args: unknown[]): Promise<any> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for ${channel}`);
  return await Promise.resolve(fn({}, ...args));
}

describe('thread IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
    sentEvents.length = 0;
    registerThreadHandlers();
  });

  afterEach(() => {
    unregisterThreadHandlers();
  });

  it('addUserPrompt creates a thread when id is null and broadcasts update', async () => {
    const res = await invoke('thread:addUserPrompt', null, 'hello', { title: 'T1' });
    expect(res.thread).toBeTruthy();
    expect(res.message.content).toBe('hello');
    expect(sentEvents.find((e) => e.channel === 'thread:updated')).toBeTruthy();
  });

  it('addAssistantResponse appends a message and broadcasts update', async () => {
    const created = await invoke('thread:create', { title: 'c', description: '', metadata: {} });
    const msg = await invoke('thread:addAssistantResponse', created.id, 'resp', 'm1');
    expect(msg.content).toBe('resp');
    expect(sentEvents.find((e) => e.channel === 'thread:updated')).toBeTruthy();
  });

  it('savePromptAndResponses stores prompt and responses and returns them', async () => {
    const out = await invoke(
      'thread:savePromptAndResponses',
      null,
      'Q',
      [{ text: 'A' }, { text: 'B', model: 'm2' }],
      { title: 'batch' },
    );
    expect(out.promptMessage.content).toBe('Q');
    expect(out.responseMessages).toHaveLength(2);
    expect(sentEvents.find((e) => e.channel === 'thread:updated')).toBeTruthy();
  });
});
