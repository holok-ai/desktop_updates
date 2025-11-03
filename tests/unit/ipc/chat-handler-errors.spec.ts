import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Chat IPC handlers - error branches', () => {
  let handlers: Record<string, Function> = {};

  beforeEach(async () => {
    handlers = {};
    vi.resetModules();

    // Capture ipcMain.handle registrations
    vi.doMock(
      'electron',
      () =>
        ({
          app: {
            getVersion: () => '0.0.0-test',
            getPath: () => '/tmp',
            on: vi.fn(),
            whenReady: () => Promise.resolve(),
          },
          ipcMain: {
            handle: (c: string, f: Function) => {
              handlers[c] = f;
            },
            removeHandler: vi.fn(),
            on: vi.fn(),
          },
          BrowserWindow: class {},
          Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
          dialog: { showMessageBox: vi.fn() },
          contextBridge: { exposeInMainWorld: vi.fn() },
          ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
        }) as any,
    );
  });

  it('createProvider returns error when ChatService constructor throws', async () => {
    // Mock ChatService to throw on construction
    vi.doMock('../../../src-electron/services/chat/ChatService.js', () => ({
      ChatService: class {
        constructor() {
          throw new Error('ctor fail');
        }
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
    mod.registerChatHandlers();

    const res = handlers['chat:createProvider'](null, 'x', {});
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/ctor fail/);
  });

  it('chat:send returns error object when chat throws', async () => {
    // Mock ChatService.chat to throw
    vi.doMock('../../../src-electron/services/chat/ChatService.js', () => ({
      ChatService: class {
        constructor() {}
        async chat() {
          throw new Error('chat fail');
        }
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
    mod.registerChatHandlers();

    // initialize service
    handlers['chat:createProvider'](null, 'x', {});

    const event = { sender: { send: vi.fn() } } as any;
    const res = await handlers['chat:send'](event, { model: 'm', messages: [] });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/chat fail/);
  });

  it('chat:sendWithOptions returns error object when provider errors', async () => {
    vi.doMock('../../../src-electron/services/chat/ChatService.js', () => ({
      ChatService: class {
        constructor() {}
        async chatWithOptions() {
          throw new Error('options fail');
        }
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
    mod.registerChatHandlers();
    handlers['chat:createProvider'](null, 'x', {});

    const event = { sender: { send: vi.fn() } } as any;
    const res = await handlers['chat:sendWithOptions'](event, {
      model: 'm',
      messages: [],
      options: {},
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/options fail/);
  });

  it('chat:getAuditLogs throws when getAuditLogs throws', async () => {
    vi.doMock('../../../src-electron/services/chat/ChatService.js', () => ({
      ChatService: class {
        constructor() {}
        getAuditLogs() {
          throw new Error('logs fail');
        }
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
    mod.registerChatHandlers();
    handlers['chat:createProvider'](null, 'x', {});

    expect(() => handlers['chat:getAuditLogs']()).toThrow(/logs fail/);
  });
});
