import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolOrchestrator } from '../../../src-electron/services/tool-calling/orchestrator';
import { DesktopChatService } from '../../../src-electron/services/chat/desktop-chat-service';
import type { ToolExecutionContext } from '../../../src-electron/services/tool-calling/orchestrator-types';
import type { ProviderConfig } from '@holokai/chat-component';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock ChatService from @holokai/chat-component
vi.mock('@holokai/chat-component', async () => {
  const actual = await vi.importActual('@holokai/chat-component');
  return {
    ...actual,
    ChatService: class {
      chat = vi.fn(async () => {});
      getAuditLogs = vi.fn(() => []);
    },
  };
});

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

// Mock tool factories to return a simple test tool
vi.mock('../../../src-electron/services/tool-calling/tools/tool-list', () => ({
  TOOL_FACTORIES: [
    () => ({
      getName: () => 'test_tool',
      getDefinition: () => ({
        name: 'test_tool',
        description: 'Test tool',
        input_schema: { type: 'object', properties: {} },
      }),
      execute: vi.fn(async (input: any, context: ToolExecutionContext) => {
        // Return the working directory to verify context isolation
        return {
          success: true,
          data: {
            workingDirectory: context.workingDirectory,
            threadId: context.threadId,
            branchId: context.branchId,
            input,
          },
        };
      }),
    }),
  ],
}));

describe('Multi-Thread Tools Integration', () => {
  beforeEach(() => {
    ToolOrchestrator.resetInstance();
  });

  describe('Multiple Chat Services with Different Working Directories', () => {
    it('should create 2+ chat services with different working directories', () => {
      const config: ProviderConfig = {
        model: 'test-model',
        apiKey: 'test-key',
      };

      const service1 = new DesktopChatService('ollama', config, '/working/dir1');
      const service2 = new DesktopChatService('ollama', config, '/working/dir2');
      const service3 = new DesktopChatService('ollama', config, '/working/dir3');

      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
      expect(service3).toBeDefined();

      // All should use the same singleton orchestrator
      const orchestrator1 = ToolOrchestrator.getInstance();
      const orchestrator2 = ToolOrchestrator.getInstance();
      expect(orchestrator1).toBe(orchestrator2);
    });

    it('should maintain separate working directories per service', () => {
      const config: ProviderConfig = {
        model: 'test-model',
        apiKey: 'test-key',
      };

      const service1 = new DesktopChatService('ollama', config, '/dir1');
      const service2 = new DesktopChatService('ollama', config, '/dir2');

      // Each service should have its own thread context with different working directory
      const context1 = (service1 as any).threadContext;
      const context2 = (service2 as any).threadContext;

      expect(context1.workingDirectory).toBe('/dir1');
      expect(context2.workingDirectory).toBe('/dir2');
    });
  });

  describe('Concurrent Tool Execution', () => {
    it('should execute tools concurrently from different threads', async () => {
      const orchestrator = ToolOrchestrator.getInstance();

      const context1: ToolExecutionContext = {
        workingDirectory: '/thread1/working/dir',
        threadId: 'thread-1',
        branchId: 'branch-1',
      };

      const context2: ToolExecutionContext = {
        workingDirectory: '/thread2/working/dir',
        threadId: 'thread-2',
        branchId: 'branch-1',
      };

      const context3: ToolExecutionContext = {
        workingDirectory: '/thread3/working/dir',
        threadId: 'thread-3',
        branchId: 'branch-2',
      };

      // Execute tools concurrently
      const [result1, result2, result3] = await Promise.all([
        orchestrator.executeTool('test_tool', { task: 'task1' }, context1),
        orchestrator.executeTool('test_tool', { task: 'task2' }, context2),
        orchestrator.executeTool('test_tool', { task: 'task3' }, context3),
      ]);

      // Verify all executed successfully
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Verify context isolation - each result should have its own working directory
      expect(result1.data.workingDirectory).toBe('/thread1/working/dir');
      expect(result2.data.workingDirectory).toBe('/thread2/working/dir');
      expect(result3.data.workingDirectory).toBe('/thread3/working/dir');

      // Verify thread IDs are preserved
      expect(result1.data.threadId).toBe('thread-1');
      expect(result2.data.threadId).toBe('thread-2');
      expect(result3.data.threadId).toBe('thread-3');
    });

    it('should handle concurrent executions with same tool but different contexts', async () => {
      const orchestrator = ToolOrchestrator.getInstance();

      const contexts = Array.from({ length: 10 }, (_, i) => ({
        workingDirectory: `/dir${i}`,
        threadId: `thread-${i}`,
        branchId: 'branch-1',
      }));

      const results = await Promise.all(
        contexts.map(context =>
          orchestrator.executeTool('test_tool', { index: contexts.indexOf(context) }, context)
        )
      );

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.workingDirectory).toBe(`/dir${index}`);
        expect(result.data.threadId).toBe(`thread-${index}`);
      });
    });
  });

  describe('Context Isolation', () => {
    it('should verify context isolation between threads', async () => {
      const orchestrator = ToolOrchestrator.getInstance();

      const contextA: ToolExecutionContext = {
        workingDirectory: '/project-a',
        threadId: 'thread-a',
        branchId: 'branch-1',
      };

      const contextB: ToolExecutionContext = {
        workingDirectory: '/project-b',
        threadId: 'thread-b',
        branchId: 'branch-1',
      };

      // Execute tool for thread A
      const resultA = await orchestrator.executeTool('test_tool', { file: 'file-a.txt' }, contextA);

      // Execute tool for thread B (should not affect thread A's context)
      const resultB = await orchestrator.executeTool('test_tool', { file: 'file-b.txt' }, contextB);

      // Verify contexts remain isolated
      expect(resultA.data.workingDirectory).toBe('/project-a');
      expect(resultA.data.threadId).toBe('thread-a');
      expect(resultA.data.input.file).toBe('file-a.txt');

      expect(resultB.data.workingDirectory).toBe('/project-b');
      expect(resultB.data.threadId).toBe('thread-b');
      expect(resultB.data.input.file).toBe('file-b.txt');

      // Verify no cross-contamination
      expect(resultA.data.workingDirectory).not.toBe(resultB.data.workingDirectory);
      expect(resultA.data.threadId).not.toBe(resultB.data.threadId);
    });

    it('should maintain context isolation across multiple concurrent executions', async () => {
      const orchestrator = ToolOrchestrator.getInstance();

      // Create multiple contexts with different working directories
      const contexts = [
        { workingDirectory: '/home/user/project1', threadId: 't1', branchId: 'b1' },
        { workingDirectory: '/home/user/project2', threadId: 't2', branchId: 'b1' },
        { workingDirectory: '/home/user/project3', threadId: 't3', branchId: 'b2' },
      ];

      // Execute all concurrently
      const results = await Promise.all(
        contexts.map((ctx, idx) =>
          orchestrator.executeTool('test_tool', { project: idx }, ctx as ToolExecutionContext)
        )
      );

      // Verify each result maintains its own context
      results.forEach((result, idx) => {
        expect(result.success).toBe(true);
        expect(result.data.workingDirectory).toBe(contexts[idx].workingDirectory);
        expect(result.data.threadId).toBe(contexts[idx].threadId);
        expect(result.data.branchId).toBe(contexts[idx].branchId);
      });
    });
  });
});
