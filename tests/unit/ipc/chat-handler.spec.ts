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

    // Default ChatService mock - tests will override behavior as needed
    vi.doMock('../../../src-electron/services/chat/ChatService.js', () => {
      return {
        ChatService: class {
          constructor(_type: string, _cfg: any, _audit: boolean) {}
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
        'chat:sendWithOptions',
        'chat:getAuditLogs',
        'chat:destroy',
      ]),
    );
  });

  it('createProvider success and then send streams tokens', async () => {
    // call createProvider
    const createRes = handlers['chat:createProvider'](null, 'ollama', {
      url: 'http://x',
      model: 'm',
      apiKey: 'k',
    });
    expect(createRes.success).toBe(true);

    // prepare fake event with sender.send spy
    const sent: any[] = [];
    const event = { sender: { send: (ch: string, t: string) => sent.push([ch, t]) } } as any;

    const sendRes = await handlers['chat:send'](event, { model: 'm', messages: [] });
    expect(sendRes.success).toBe(true);
    expect(sent).toEqual([['chat:token', 'tok']]);
  });

  it('send throws when service not initialized', async () => {
    // do not call createProvider - new module instance has chatService null
    // Create a fresh module to get clean state
    vi.resetModules();
    handlers = {};
    // re-mock electron to capture handlers
    vi.doMock(
      'electron',
      () =>
        ({
          ipcMain: {
            handle: (c: string, f: Function) => {
              handlers[c] = f;
            },
            removeHandler: vi.fn(),
            on: vi.fn(),
          },
          app: { getVersion: () => '0' },
          BrowserWindow: class {},
          Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
          dialog: { showMessageBox: vi.fn() },
          contextBridge: { exposeInMainWorld: vi.fn() },
          ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
        }) as any,
    );
    // Mock ChatService module with constructor but will not be instantiated
    vi.doMock('../../../src-electron/services/chat/ChatService.js', () => ({
      ChatService: class {},
    }));
    const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
    mod.registerChatHandlers();

    await expect(
      handlers['chat:send']({ sender: { send: () => {} } } as any, { model: 'm', messages: [] }),
    ).rejects.toThrow();
  });

  it('getAuditLogs returns logs when service present and destroy clears service', async () => {
    // create provider
    handlers['chat:createProvider'](null, 'ollama', {
      url: 'http://localhost',
      model: 'm',
      apiKey: 'k',
    });
    const logs = handlers['chat:getAuditLogs']();
    expect(Array.isArray(logs)).toBe(true);

    const destroyed = handlers['chat:destroy']();
    expect(destroyed.success).toBe(true);

    // after destroy, getAuditLogs should throw
    await expect(() => handlers['chat:getAuditLogs']()).toThrow();
  });

  it('unregisterChatHandlers calls removeHandler for each channel', async () => {
    const electron = await import('electron');
    const removeSpy = electron.ipcMain.removeHandler as any;
    const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
    mod.unregisterChatHandlers();
    expect(removeSpy).toHaveBeenCalledWith('chat:createProvider');
    expect(removeSpy).toHaveBeenCalledWith('chat:send');
    expect(removeSpy).toHaveBeenCalledWith('chat:sendWithOptions');
    expect(removeSpy).toHaveBeenCalledWith('chat:getAuditLogs');
    expect(removeSpy).toHaveBeenCalledWith('chat:destroy');
  });
});
