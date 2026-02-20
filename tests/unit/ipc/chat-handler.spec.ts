import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Chat IPC handlers', () => {
  let handlers: Record<string, Function> = {};

  beforeEach(async () => {
    handlers = {};
    vi.resetModules();

    // Mock electron to capture handlers registered via ipcMain.handle
    vi.doMock('electron', () => {
      return {
        app: {
          getVersion: () => '0.0.0-test',
          getPath: () => '/tmp',
          on: vi.fn(),
          whenReady: () => Promise.resolve(),
        },
        ipcMain: {
          handle: (channel: string, fn: Function) => {
            handlers[channel] = fn;
          },
          removeHandler: vi.fn(),
          on: vi.fn(),
        },
        BrowserWindow: class {
          static getAllWindows() {
            return [];
          }
        },
        Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
        dialog: { showMessageBox: vi.fn() },
        contextBridge: { exposeInMainWorld: vi.fn() },
        ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
      } as any;
    });

    // Mock @holokai/chat-component ChatService
    vi.doMock('@holokai/chat-component', () => {
      return {
        ChatService: class {
          async chat(_req: any, onToken?: (t: string) => void) {
            if (onToken) onToken('tok');
          }
          async chatWithOptions(_req: any, onToken?: (t: string) => void) {
            if (onToken) onToken('opt');
          }
          getAuditLogs() {
            return [{ requestId: 'r1' }];
          }
        },
      };
    });

    // Mock ToolOrchestrator
    vi.doMock('../../../src-electron/services/tool-calling/orchestrator', () => {
      return {
        ToolOrchestrator: {
          getInstance: vi.fn(() => ({
            getToolDefinitions: vi.fn(() => []),
            executeTool: vi.fn(async () => ({ success: true, data: {} })),
            supportsToolCalling: vi.fn(() => true),
            setAllowedPaths: vi.fn(),
            getAllowedPaths: vi.fn(() => []),
            addAllowedPaths: vi.fn(),
            removeAllowedPaths: vi.fn(),
            clearAllowedPaths: vi.fn(),
          })),
          resetInstance: vi.fn(),
        },
      };
    });

    // Mock settings-handler
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => {
      return {
        getSettingsService: vi.fn(() => ({
          getDirectoryWhitelist: vi.fn(() => []),
        })),
      };
    });

    // Mock electron-log
    vi.doMock('electron-log', () => ({
      default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    }));

    // Import module under test after mocks
    const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
    // Register handlers
    mod.registerChatHandlers();
  });

  it('registers chat handlers', () => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining([
        'chat:createProvider',
        'chat:send',
        'chat:getAuditLogs',
        'chat:destroyProvider',
        'chat:updateAllowedPaths',
      ]),
    );
  });

  it('createProvider success with threadId and then send streams tokens', async () => {
    // call createProvider with threadId (it's an async handler)
    const threadId = 'thread-1';
    const createRes = await handlers['chat:createProvider'](
      null,
      threadId,
      'ollama',
      {
        url: 'http://x',
        model: 'm',
        apiKey: 'k',
      },
      '/working/dir',
    );
    expect(createRes.success).toBe(true);

    // prepare fake event with sender.send spy
    const sent: any[] = [];
    const event = { sender: { send: (ch: string, data: any) => sent.push([ch, data]) } } as any;

    const sendRes = await handlers['chat:send'](event, threadId, { model: 'm', messages: [] });
    expect(sendRes.success).toBe(true);
    expect(sent.some(([ch]) => ch === 'chat:token')).toBe(true);
  });

  it('send throws when service not initialized for thread', async () => {
    // do not call createProvider - service not created for this thread
    const event = { sender: { send: () => {} } } as any;
    const threadId = 'non-existent-thread';

    await expect(
      handlers['chat:send'](event, threadId, { model: 'm', messages: [] }),
    ).rejects.toThrow();
  });

  it('should support multiple threads with different services', async () => {
    const threadId1 = 'thread-1';
    const threadId2 = 'thread-2';

    // Create provider for thread 1
    const createRes1 = await handlers['chat:createProvider'](
      null,
      threadId1,
      'ollama',
      { url: 'http://x', model: 'm', apiKey: 'k' },
      '/dir1',
    );
    expect(createRes1.success).toBe(true);

    // Create provider for thread 2
    const createRes2 = await handlers['chat:createProvider'](
      null,
      threadId2,
      'ollama',
      { url: 'http://x', model: 'm', apiKey: 'k' },
      '/dir2',
    );
    expect(createRes2.success).toBe(true);

    // Both threads should work independently
    const sent1: any[] = [];
    const sent2: any[] = [];
    const event1 = { sender: { send: (ch: string, data: any) => sent1.push([ch, data]) } } as any;
    const event2 = { sender: { send: (ch: string, data: any) => sent2.push([ch, data]) } } as any;

    const sendRes1 = await handlers['chat:send'](event1, threadId1, { model: 'm', messages: [] });
    const sendRes2 = await handlers['chat:send'](event2, threadId2, { model: 'm', messages: [] });

    expect(sendRes1.success).toBe(true);
    expect(sendRes2.success).toBe(true);
  });

  it('getAuditLogs returns logs when service present and destroyProvider clears service', async () => {
    const threadId = 'thread-1';
    // create provider (async)
    await handlers['chat:createProvider'](
      null,
      threadId,
      'ollama',
      {
        url: 'http://localhost',
        model: 'm',
        apiKey: 'k',
      },
      '/working/dir',
    );
    const logs = handlers['chat:getAuditLogs'](null, threadId);
    expect(Array.isArray(logs)).toBe(true);

    const destroyed = handlers['chat:destroyProvider'](null, threadId);
    expect(destroyed.success).toBe(true);

    // after destroy, send should throw for that thread
    const event = { sender: { send: () => {} } } as any;
    await expect(
      handlers['chat:send'](event, threadId, { model: 'm', messages: [] }),
    ).rejects.toThrow();
  });

  it('unregisterChatHandlers calls removeHandler for each channel', async () => {
    const electron = await import('electron');
    const removeSpy = electron.ipcMain.removeHandler as any;
    const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
    mod.unregisterChatHandlers();
    expect(removeSpy).toHaveBeenCalledWith('chat:createProvider');
    expect(removeSpy).toHaveBeenCalledWith('chat:send');
    expect(removeSpy).toHaveBeenCalledWith('chat:getAuditLogs');
    expect(removeSpy).toHaveBeenCalledWith('chat:destroyProvider');
    expect(removeSpy).toHaveBeenCalledWith('chat:updateAllowedPaths');
  });
});
