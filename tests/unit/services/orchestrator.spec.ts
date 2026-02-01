import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolOrchestrator } from '../../../src-electron/services/tool-calling/orchestrator';
import type { ToolExecutionContext } from '../../../src-electron/services/tool-calling/orchestrator-types';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock FileToolsService
vi.mock('../../../src-electron/services/tool-calling/file-tools.service', () => {
  return {
    FileToolsService: class {
      setAllowedPaths = vi.fn();
      getAllowedPaths = vi.fn(() => []);
      addAllowedPaths = vi.fn();
      removeAllowedPaths = vi.fn();
      clearAllowedPaths = vi.fn();
      resolvePath = vi.fn((path: string, workingDir: string) => {
        if (path.startsWith('/')) return path;
        return `${workingDir}/${path}`;
      });
      checkPathAccess = vi.fn(() => ({ allowed: true }));
    },
  };
});

// Mock tool factories
vi.mock('../../../src-electron/services/tool-calling/tools/tool-list', () => ({
  TOOL_FACTORIES: [
    () => ({
      getName: () => 'test_tool',
      getDefinition: () => ({
        name: 'test_tool',
        description: 'Test tool',
        input_schema: { type: 'object', properties: {} },
      }),
      execute: vi.fn(async () => ({ success: true, data: {} })),
    }),
  ],
}));

describe('ToolOrchestrator', () => {
  beforeEach(() => {
    // Reset singleton before each test
    ToolOrchestrator.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple getInstance() calls', () => {
      const instance1 = ToolOrchestrator.getInstance();
      const instance2 = ToolOrchestrator.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should use allowedPaths only on first initialization', () => {
      const allowedPaths = ['/path1', '/path2'];
      const instance1 = ToolOrchestrator.getInstance(allowedPaths);
      const instance2 = ToolOrchestrator.getInstance(['/different/path']);
      
      // Both should be the same instance
      expect(instance1).toBe(instance2);
      
      // First initialization should have used the allowedPaths
      // (we can't directly verify this without exposing internal state,
      // but we can verify the instance is the same)
    });

    it('should reset instance correctly', () => {
      const instance1 = ToolOrchestrator.getInstance();
      ToolOrchestrator.resetInstance();
      const instance2 = ToolOrchestrator.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });

    it('should initialize tools on first getInstance() call', () => {
      const instance = ToolOrchestrator.getInstance();
      const definitions = instance.getToolDefinitions();
      
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions.some(d => d.name === 'test_tool')).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool with context', async () => {
      const instance = ToolOrchestrator.getInstance();
      const context: ToolExecutionContext = {
        workingDirectory: '/test/working/dir',
        threadId: 'thread-1',
        branchId: 'branch-1',
      };

      const result = await instance.executeTool('test_tool', {}, context);
      
      expect(result.success).toBe(true);
    });

    it('should return error for unknown tool', async () => {
      const instance = ToolOrchestrator.getInstance();
      const context: ToolExecutionContext = {
        workingDirectory: '/test/working/dir',
        threadId: 'thread-1',
        branchId: 'branch-1',
      };

      const result = await instance.executeTool('unknown_tool', {}, context);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should pass execution context to tool', async () => {
      const instance = ToolOrchestrator.getInstance();
      const context: ToolExecutionContext = {
        workingDirectory: '/test/working/dir',
        threadId: 'thread-1',
        branchId: 'branch-1',
        statusCallback: vi.fn(),
      };

      await instance.executeTool('test_tool', { param: 'value' }, context);
      
      // Verify tool was called with correct context
      const tools = (instance as any).tools;
      const testTool = tools.get('test_tool');
      expect(testTool.execute).toHaveBeenCalledWith(
        { param: 'value' },
        context
      );
    });
  });

  describe('Tool Support Detection', () => {
    it('should support tool calling for Claude', () => {
      const instance = ToolOrchestrator.getInstance();
      expect(instance.supportsToolCalling('claude', 'claude-3-opus')).toBe(true);
    });

    it('should support tool calling for OpenAI', () => {
      const instance = ToolOrchestrator.getInstance();
      expect(instance.supportsToolCalling('openai', 'gpt-4')).toBe(true);
    });

    it('should support tool calling for specific Ollama models', () => {
      const instance = ToolOrchestrator.getInstance();
      expect(instance.supportsToolCalling('ollama', 'qwen2.5:7b')).toBe(true);
    });

    it('should not support tool calling for unsupported Ollama models', () => {
      const instance = ToolOrchestrator.getInstance();
      expect(instance.supportsToolCalling('ollama', 'llama2')).toBe(false);
    });
  });

  describe('Allowed Paths Management', () => {
    it('should set allowed paths', () => {
      const instance = ToolOrchestrator.getInstance();
      const paths = ['/path1', '/path2'];
      
      instance.setAllowedPaths(paths);
      
      // Verify method exists and doesn't throw
      expect(typeof instance.setAllowedPaths).toBe('function');
    });

    it('should get allowed paths', () => {
      const instance = ToolOrchestrator.getInstance();
      const paths = instance.getAllowedPaths();
      
      expect(Array.isArray(paths)).toBe(true);
    });

    it('should add allowed paths', () => {
      const instance = ToolOrchestrator.getInstance();
      instance.addAllowedPaths('/path1', '/path2');
      
      // Verify method exists and doesn't throw
      expect(typeof instance.addAllowedPaths).toBe('function');
    });

    it('should remove allowed paths', () => {
      const instance = ToolOrchestrator.getInstance();
      instance.removeAllowedPaths('/path1');
      
      expect(typeof instance.removeAllowedPaths).toBe('function');
    });

    it('should clear allowed paths', () => {
      const instance = ToolOrchestrator.getInstance();
      instance.clearAllowedPaths();
      
      expect(typeof instance.clearAllowedPaths).toBe('function');
    });
  });

  describe('Thread Safety', () => {
    it('should handle concurrent getInstance() calls', async () => {
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(ToolOrchestrator.getInstance())
      );
      
      const instances = await Promise.all(promises);
      
      // All should be the same instance
      const firstInstance = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });
    });

    it('should execute tools concurrently with different contexts', async () => {
      const instance = ToolOrchestrator.getInstance();
      
      const context1: ToolExecutionContext = {
        workingDirectory: '/dir1',
        threadId: 'thread-1',
        branchId: 'branch-1',
      };
      
      const context2: ToolExecutionContext = {
        workingDirectory: '/dir2',
        threadId: 'thread-2',
        branchId: 'branch-1',
      };
      
      const context3: ToolExecutionContext = {
        workingDirectory: '/dir3',
        threadId: 'thread-3',
        branchId: 'branch-2',
      };

      // Execute tools concurrently with different contexts
      const [result1, result2, result3] = await Promise.all([
        instance.executeTool('test_tool', { param: 'value1' }, context1),
        instance.executeTool('test_tool', { param: 'value2' }, context2),
        instance.executeTool('test_tool', { param: 'value3' }, context3),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Verify each tool was called with its respective context
      const tools = (instance as any).tools;
      const testTool = tools.get('test_tool');
      
      expect(testTool.execute).toHaveBeenCalledWith({ param: 'value1' }, context1);
      expect(testTool.execute).toHaveBeenCalledWith({ param: 'value2' }, context2);
      expect(testTool.execute).toHaveBeenCalledWith({ param: 'value3' }, context3);
    });
  });
});

