import { FileToolsService } from './file-tools.service.js';
import type { ToolOrchestra, ToolExecutionContext } from './orchestrator-types.js';
import type { ToolDefinition, ToolResult } from './tool-types.js';
import type { ITool } from './tools/base-tool.js';
import { TOOL_FACTORIES } from './tools/tool-list.js';
import log from 'electron-log';

function extractInputHint(toolName: string, input: Record<string, unknown>): string {
  const label = toolName.replace(/_/g, ' ');

  let param: string | undefined;
  if (toolName === 'windows_shell' || toolName === 'unix_shell') {
    const command = typeof input.command === 'string' ? input.command : '';
    const args = typeof input.arguments === 'string' ? input.arguments : '';
    param = args ? `${command} ${args}` : command || undefined;
  } else {
    const primary = input.file_path ?? input.folder_path ?? input.path;
    param = typeof primary === 'string' ? primary : undefined;
  }

  if (!param) return label;
  const truncated = param.length > 60 ? param.slice(0, 57) + '…' : param;
  return `${label} (${truncated})`;
}

/**
 * Singleton Tool Orchestrator
 * Manages all tool execution with per-request context
 */
export class ToolOrchestrator implements ToolOrchestra {
  private static instance: ToolOrchestrator | null = null;
  private fileToolsService: FileToolsService;
  private tools: Map<string, ITool>;

  /**
   * Private constructor - use getInstance()
   */
  private constructor(allowedPaths?: string[]) {
    log.info('[ToolOrchestrator] Initializing singleton');

    // FileToolsService now manages only security state
    this.fileToolsService = new FileToolsService(allowedPaths);

    // Initialize tools once
    this.tools = new Map();
    const context = { service: this.fileToolsService };
    for (const factory of TOOL_FACTORIES) {
      const tool = factory(context);
      this.tools.set(tool.getName(), tool);
    }

    log.info(
      `[ToolOrchestrator] Initialized tools (${this.tools.size}):`,
      Array.from(this.tools.keys()).join(', '),
    );
  }

  /**
   * Get singleton instance
   * @param allowedPaths - Only used on first initialization
   */
  public static getInstance(allowedPaths?: string[]): ToolOrchestrator {
    if (!ToolOrchestrator.instance) {
      ToolOrchestrator.instance = new ToolOrchestrator(allowedPaths);
    }
    return ToolOrchestrator.instance;
  }

  /**
   * Reset singleton (for testing only)
   */
  public static resetInstance(): void {
    ToolOrchestrator.instance = null;
  }

  /**
   * Get all available tool definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  /**
   * Execute tool with provided execution context
   */
  async executeTool(
    name: string,
    input: Record<string, unknown>,
    executionContext: ToolExecutionContext,
  ): Promise<ToolResult> {
    log.info(
      '[ToolOrchestrator] Executing tool:',
      name,
      'with context:',
      JSON.stringify(executionContext),
    );

    const toolCallId = executionContext.currentToolCallId ?? '?';
    const inputHint = extractInputHint(name, input);

    const tool = this.tools.get(name);
    if (!tool) {
      const error = `Unknown tool: ${name}`;
      log.error('[ToolOrchestrator]', error);
      executionContext.toolUseCallback?.(name, input, { toolCallId, stage: 'error', error });
      return { success: false, error };
    }

    executionContext.toolUseCallback?.(name, input, {
      toolCallId,
      stage: 'in_progress',
      inputHint,
      message: `Running ${inputHint}`,
    });

    try {
      const result = await tool.execute(input, executionContext);
      if (result.success) {
        executionContext.toolUseCallback?.(name, input, { toolCallId, stage: 'complete', result });
      } else {
        executionContext.toolUseCallback?.(name, input, {
          toolCallId,
          stage: 'error',
          error: result.error,
        });
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error('[ToolOrchestrator] Tool execution threw:', name, error);
      executionContext.toolUseCallback?.(name, input, { toolCallId, stage: 'error', error });
      return { success: false, error };
    }
  }

  /**
   * Determines if a provider/model combination supports tool calling
   * @param provider - The provider type (e.g., 'claude', 'openai', 'ollama')
   * @param model - The model identifier
   * @returns true if tool calling is supported, false otherwise
   */
  supportsToolCalling(provider: string, model: string): boolean {
    // Handle Ollama - only certain models support tools
    if (provider.toLowerCase() === 'ollama') {
      // List of Ollama models that support tool calling
      const toolSupportedModels = [
        'qwen2.5:7b',
        'qwen3:latest',
        'llama3.2:latest',
        'devstral:latest',
        // Add more tool-supporting Ollama models here as needed
      ];

      return toolSupportedModels.some((supportedModel) =>
        model.toLowerCase().includes(supportedModel.toLowerCase()),
      );
    }

    // Claude and OpenAI support tools
    return true;
  }

  /**
   * Update allowed paths (affects all future tool executions)
   */
  setAllowedPaths(paths: string[]): void {
    this.fileToolsService.setAllowedPaths(paths);
  }

  /**
   * Get current allowed paths
   */
  getAllowedPaths(): string[] {
    return this.fileToolsService.getAllowedPaths();
  }

  /**
   * Add allowed paths to whitelist
   */
  addAllowedPaths(...paths: string[]): void {
    this.fileToolsService.addAllowedPaths(...paths);
  }

  /**
   * Remove allowed paths from whitelist
   */
  removeAllowedPaths(...paths: string[]): void {
    this.fileToolsService.removeAllowedPaths(...paths);
  }

  /**
   * Clear all allowed paths
   */
  clearAllowedPaths(): void {
    this.fileToolsService.clearAllowedPaths();
  }
}
