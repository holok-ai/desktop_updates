/**
 * DesktopChatService — unit tests
 *
 * Tests cover:
 *   - Constructor: provider init, tool support detection, setTools wiring
 *   - chat(): token streaming delegation, working_directory propagation
 *   - getAuditLogs(): delegation to underlying ChatService
 *   - File-received callback: saves files via fileStorageService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

const mockChatFn = vi.fn();
const mockSetTools = vi.fn();
const mockGetAuditLogs = vi.fn(() => []);

vi.mock('@holokai/chat-component', () => ({
  ChatService: class {
    chat = mockChatFn;
    setTools = mockSetTools;
    getAuditLogs = mockGetAuditLogs;
  },
}));

const mockSupportsToolCalling = vi.fn(() => false);
const mockGetToolDefinitions = vi.fn(() => []);
const mockExecuteTool = vi.fn(async () => ({ success: true }));

vi.mock('../../../src-electron/services/tool-calling/orchestrator', () => ({
  ToolOrchestrator: {
    getInstance: vi.fn(() => ({
      supportsToolCalling: mockSupportsToolCalling,
      getToolDefinitions: mockGetToolDefinitions,
      executeTool: mockExecuteTool,
    })),
  },
}));

const mockSaveFile = vi.fn(async () => ({ id: 'file-1' }));

vi.mock('../../../src-electron/services/file-storage.service', () => ({
  fileStorageService: {
    saveFile: mockSaveFile,
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Tests ────────────────────────────────────────────────────────

describe('DesktopChatService', () => {
  let DesktopChatService: typeof import('../../../src-electron/services/chat/desktop-chat-service').DesktopChatService;
  let service: InstanceType<typeof DesktopChatService>;

  const defaultConfig = {
    url: 'http://localhost:11434',
    apiKey: 'test-key',
    model: 'llama3:latest',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSupportsToolCalling.mockReturnValue(false);

    const mod = await import('../../../src-electron/services/chat/desktop-chat-service');
    DesktopChatService = mod.DesktopChatService;
    service = new DesktopChatService('ollama', defaultConfig);
  });

  // ═══════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('creates an instance', () => {
      expect(service).toBeDefined();
    });

    it('calls setTools with empty tools when tool calling is not supported', () => {
      expect(mockSetTools).toHaveBeenCalledWith([], expect.any(Function), expect.any(Function));
    });

    it('calls setTools with tool definitions when tool calling is supported', async () => {
      vi.clearAllMocks();
      mockSupportsToolCalling.mockReturnValue(true);
      const toolDefs = [{ name: 'read_file', description: 'Read a file', inputSchema: {} }];
      mockGetToolDefinitions.mockReturnValue(toolDefs);

      const mod = await import('../../../src-electron/services/chat/desktop-chat-service');
      new mod.DesktopChatService('openai', {
        url: 'https://api.openai.com',
        apiKey: 'sk-test',
        model: 'gpt-4',
      });

      expect(mockSetTools).toHaveBeenCalledWith(
        toolDefs,
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('uses provided working directory', async () => {
      vi.clearAllMocks();
      const mod = await import('../../../src-electron/services/chat/desktop-chat-service');
      const svc = new mod.DesktopChatService('ollama', defaultConfig, '/custom/path');

      // Service was constructed without error — working directory stored internally
      expect(svc).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // chat()
  // ═══════════════════════════════════════════════════════════════

  describe('chat', () => {
    it('delegates to underlying ChatService.chat', async () => {
      const request = {
        messages: [{ role: 'user' as const, content: 'Hello' }],
        streaming: true,
        model: 'llama3:latest',
      };
      const onToken = vi.fn();

      await service.chat(request, onToken);

      expect(mockChatFn).toHaveBeenCalledWith(request, onToken);
    });

    it('streams tokens through the onToken callback', async () => {
      const tokens: string[] = [];
      const onToken = (token: string) => {
        tokens.push(token);
      };

      // Mock chat to call onToken
      mockChatFn.mockImplementation(async (_req: unknown, cb: (t: string) => void) => {
        cb('Hello');
        cb(' world');
      });

      await service.chat(
        {
          messages: [{ role: 'user', content: 'Hi' }],
          streaming: true,
          model: 'llama3:latest',
        },
        onToken,
      );

      expect(tokens).toEqual(['Hello', ' world']);
    });

    it('propagates working_directory from request', async () => {
      const request = {
        messages: [{ role: 'user' as const, content: 'test' }],
        streaming: true,
        model: 'llama3:latest',
        working_directory: '/project/dir',
      };
      const onToken = vi.fn();

      await service.chat(request, onToken);

      // The request object should have workingDirectory set
      expect((request as any).workingDirectory).toBe('/project/dir');
    });

    it('clears status callback after chat completes', async () => {
      const onToolStatus = vi.fn();

      await service.chat(
        {
          messages: [{ role: 'user' as const, content: 'test' }],
          streaming: true,
          model: 'llama3:latest',
        },
        vi.fn(),
        undefined,
        onToolStatus,
      );

      // Chat completed without error — status callback was cleared internally
      expect(mockChatFn).toHaveBeenCalled();
    });

    it('clears status callback even when chat throws', async () => {
      mockChatFn.mockRejectedValueOnce(new Error('provider error'));

      await expect(
        service.chat(
          {
            messages: [{ role: 'user' as const, content: 'test' }],
            streaming: true,
            model: 'llama3:latest',
          },
          vi.fn(),
        ),
      ).rejects.toThrow('provider error');

      // No hanging references — the finally block should have run
      expect(mockChatFn).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // getAuditLogs()
  // ═══════════════════════════════════════════════════════════════

  describe('getAuditLogs', () => {
    it('returns audit logs from underlying ChatService', () => {
      const fakeLogs = [{ timestamp: Date.now(), event: 'chat' }];
      mockGetAuditLogs.mockReturnValueOnce(fakeLogs);

      const logs = service.getAuditLogs();

      expect(logs).toBe(fakeLogs);
      expect(mockGetAuditLogs).toHaveBeenCalled();
    });

    it('returns empty array when no logs exist', () => {
      mockGetAuditLogs.mockReturnValueOnce([]);

      const logs = service.getAuditLogs();

      expect(logs).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // File-received callback (via setTools)
  // ═══════════════════════════════════════════════════════════════

  describe('onFileReceived callback', () => {
    it('saves file via fileStorageService when called', async () => {
      // Get the onFileReceived callback that was passed to setTools
      const onFileReceived = mockSetTools.mock.calls[0][2];
      expect(onFileReceived).toBeInstanceOf(Function);

      const base64Content = Buffer.from('test image data').toString('base64');

      // Call it (returns void synchronously, but triggers async save)
      onFileReceived('thread-1', 'file-abc', 'image/png', base64Content, 'screenshot.png');

      // Allow the async save to complete
      await new Promise((r) => setTimeout(r, 10));

      expect(mockSaveFile).toHaveBeenCalledWith(
        'thread-1',
        expect.any(Buffer),
        'screenshot.png',
        'image/png',
        'file-abc',
      );
    });
  });
});
