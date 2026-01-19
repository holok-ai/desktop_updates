import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ChatRequest } from '../../../src-electron/services/chat/interfaces/ChatMessage';
import type { ToolUse } from '../../../src-electron/services/chat/interfaces/IChatProvider';
import type { ToolDefinition, ToolResult } from '../../../src-electron/services/tool-calling/file-tools.service';

// Mock FileToolsService
vi.mock('../../../src-electron/services/file-tools.service', () => {
  return {
    FileToolsService: class {
      private workingDir = '/test/dir';

      getToolDefinitions(): ToolDefinition[] {
        return [
          {
            name: 'read_folder',
            description: 'Read folder contents',
            input_schema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
              },
              required: ['path'],
            },
          },
        ];
      }

      async executeTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
        return {
          success: true,
          data: {
            path: input.path as string,
            entries: [],
            total_files: 0,
            total_directories: 0,
          },
        };
      }

      setWorkingDirectory(dir: string): void {
        this.workingDir = dir;
      }

      getWorkingDirectory(): string {
        return this.workingDir;
      }
    },
  };
});

// Mock ChatProviderFactory to return our test provider
vi.mock('../../../src-electron/services/chat/factories/ChatProviderFactory', () => {
  return {
    ChatProviderFactory: {
      createProvider: vi.fn(),
    },
    ProviderType: {
      OLLAMA: 'ollama',
      ANTHROPIC: 'anthropic',
      OPENAI: 'openai',
    },
  };
});

// Mock AuditService
vi.mock('../../../src-electron/services/chat/audit/AuditService', () => {
  return {
    AuditService: {
      getInstance: vi.fn(() => ({
        createWrappedCallback: vi.fn((request, providerType, callback) => ({
          callback,
          complete: vi.fn(),
        })),
        getAuditLogs: vi.fn(() => []),
      })),
    },
  };
});

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ChatService - File Tools Integration (unit)', () => {
  let ChatService: typeof import('../../../src-electron/services/chat/ChatService').ChatService;
  let ChatProviderFactory: any;
  let service: InstanceType<typeof ChatService>;
  let mockProvider: any;

  beforeEach(async () => {
    // Import the factory mock
    const factoryMod = await import(
      '../../../src-electron/services/chat/factories/ChatProviderFactory'
    );
    ChatProviderFactory = factoryMod.ChatProviderFactory;

    // Create a mock provider that supports tools
    mockProvider = {
      chat: vi.fn(async (request: ChatRequest, onTokenReceived?: (token: string) => void) => {
        if (onTokenReceived) {
          onTokenReceived('Response token');
        }
      }),
      chatWithOptions: vi.fn(async (request: any, onTokenReceived?: (token: string) => void) => {
        if (onTokenReceived) {
          onTokenReceived('Response token');
        }
      }),
      supportsTools: vi.fn(() => true),
      chatWithTools: vi.fn(
        async (
          request: ChatRequest,
          tools: ToolDefinition[],
          onTokenReceived?: (token: string) => void,
          onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>,
        ) => {
          if (onTokenReceived) {
            onTokenReceived('Using tools: ');
          }
          // Simulate LLM requesting a tool
          if (onToolUse) {
            const result = await onToolUse({
              id: 'tool-call-1',
              name: 'read_folder',
              input: { path: '/test/path' },
            });
            if (onTokenReceived && result.success) {
              onTokenReceived('Tool executed successfully');
            }
          }
        },
      ),
    };

    // Set up the factory to return our mock provider
    ChatProviderFactory.createProvider.mockReturnValue(mockProvider);

    // Import ChatService after mocking
    const mod = await import('../../../src-electron/services/chat/ChatService');
    ChatService = mod.ChatService;
    service = new ChatService(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'test-key',
        model: 'llama3:latest',
      },
      false,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create ChatService instance with FileToolsService', () => {
    expect(service).toBeDefined();
  });

  it('should call chatWithTools when provider supports tools', async () => {
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'List files in /test/path' }],
      streaming: true,
      model: 'llama3:latest',
    };

    let receivedTokens = '';
    const onTokenReceived = (token: string): void => {
      receivedTokens += token;
    };

    const toolUseCalls: Array<{
      toolName: string;
      input: unknown;
      notification?: unknown;
    }> = [];
    const onToolUse = (
      toolName: string,
      input: unknown,
      notification?: { stage: 'start' | 'complete'; toolCallId: string; result?: ToolResult },
    ): void => {
      toolUseCalls.push({ toolName, input, notification });
    };

    await service.chatWithFileTools(request, onTokenReceived, onToolUse);

    expect(mockProvider.supportsTools).toHaveBeenCalled();
    expect(mockProvider.chatWithTools).toHaveBeenCalled();
    expect(receivedTokens).toContain('Using tools');

    // Expect two notifications: start and complete
    expect(toolUseCalls).toHaveLength(2);
    expect(toolUseCalls[0].toolName).toBe('read_folder');
    expect((toolUseCalls[0].notification as any).stage).toBe('start');
    expect(toolUseCalls[1].toolName).toBe('read_folder');
    expect((toolUseCalls[1].notification as any).stage).toBe('complete');
    expect((toolUseCalls[1].notification as any).result?.success).toBe(true);
  });

  it('should return friendly message when provider does not support tools', async () => {
    // Create a provider without tool support
    const nonToolProvider = {
      chat: vi.fn(async (request: ChatRequest, onTokenReceived?: (token: string) => void) => {
        if (onTokenReceived) {
          onTokenReceived('Regular response');
        }
      }),
      chatWithOptions: vi.fn(),
      supportsTools: vi.fn(() => false),
      getToolSupportError: vi.fn(
        () =>
          'This model does not support tool calling. Please use a model like GPT-4, Claude, or Llama 3 70B for tasks requiring file operations.',
      ),
    };

    ChatProviderFactory.createProvider.mockReturnValue(nonToolProvider);

    // Create new service with non-tool provider
    const serviceNoTools = new ChatService(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'test-key',
        model: 'llama3:latest',
      },
      false,
    );

    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      streaming: true,
      model: 'llama3:latest',
    };

    let receivedTokens = '';
    const onTokenReceived = (token: string): void => {
      receivedTokens += token;
    };

    await serviceNoTools.chatWithFileTools(request, onTokenReceived);

    expect(nonToolProvider.supportsTools).toHaveBeenCalled();
    // Should NOT call regular chat - instead returns friendly message
    expect(nonToolProvider.chat).not.toHaveBeenCalled();
    expect(receivedTokens).toContain('does not support tool calling');
  });

  it('should fallback when provider does not have chatWithTools method', async () => {
    // Create a provider that claims to support tools but doesn't have the method
    const incompleteProvider = {
      chat: vi.fn(async (request: ChatRequest, onTokenReceived?: (token: string) => void) => {
        if (onTokenReceived) {
          onTokenReceived('Fallback response');
        }
      }),
      chatWithOptions: vi.fn(),
      supportsTools: vi.fn(() => true),
      getToolSupportError: vi.fn(() => 'Tool calling not available for this model.'),
      // chatWithTools is missing
    };

    ChatProviderFactory.createProvider.mockReturnValue(incompleteProvider);

    const serviceIncomplete = new ChatService(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'test-key',
        model: 'llama3:latest',
      },
      false,
    );

    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      streaming: true,
      model: 'llama3:latest',
    };

    let receivedTokens = '';
    await serviceIncomplete.chatWithFileTools(request, (token) => {
      receivedTokens += token;
    });

    // Should NOT call regular chat - instead returns friendly message
    expect(incompleteProvider.chat).not.toHaveBeenCalled();
    expect(receivedTokens).toContain('Tool calling not available');
  });

  it('should set working directory for file tools', () => {
    const testDir = '/custom/work/dir';
    service.setFileToolsWorkingDirectory(testDir);
    // The mock implementation should have set the working directory
    expect(() => service.setFileToolsWorkingDirectory(testDir)).not.toThrow();
  });

  it('should handle errors in chatWithFileTools', async () => {
    // Create a provider that throws an error
    const errorProvider = {
      chat: vi.fn(),
      chatWithOptions: vi.fn(),
      supportsTools: vi.fn(() => true),
      chatWithTools: vi.fn(async () => {
        throw new Error('Test error');
      }),
    };

    ChatProviderFactory.createProvider.mockReturnValue(errorProvider);

    const errorService = new ChatService(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'test-key',
        model: 'llama3:latest',
      },
      false,
    );

    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      streaming: true,
      model: 'llama3:latest',
    };

    await expect(errorService.chatWithFileTools(request)).rejects.toThrow('Test error');
  });

  it('should pass tool definitions from FileToolsService to provider', async () => {
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      streaming: true,
      model: 'llama3:latest',
    };

    await service.chatWithFileTools(request);

    expect(mockProvider.chatWithTools).toHaveBeenCalled();
    const callArgs = mockProvider.chatWithTools.mock.calls[0];
    const tools = callArgs[1] as ToolDefinition[];
    expect(tools).toBeDefined();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBe('read_folder');
  });
});
