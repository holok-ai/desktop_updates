import { FileToolsService } from './file-tools.service.js';
import type { ToolOrchestra } from './orchestrator-types.js';
import type { ToolDefinition, ToolStatusCallback, ToolResult } from './tool-types.js';
import type { ITool } from './tools/base-tool.js';
import { TOOL_FACTORIES } from './tools/tool-list.js';
import log from 'electron-log';

/**
 * Tool orchestrator that manages tool execution
 * Wraps FileToolsService to provide the ToolOrchestra interface
 */
export class ToolOrchestrator implements ToolOrchestra {
  private fileToolsService: FileToolsService;
  private tools: Map<string, ITool>;

  constructor(workingDir?: string, allowedPaths?: string[]) {
    log.info('[ToolOrchestrator] Initializing', {
      workingDir,
      allowedPathsCount: allowedPaths?.length || 0
    });
    this.fileToolsService = new FileToolsService(workingDir, allowedPaths);

    // Initialize tools using factories
    this.tools = new Map();
    const context = { service: this.fileToolsService };
    for (const factory of TOOL_FACTORIES) {
      const tool = factory(context);
      this.tools.set(tool.getName(), tool);
    }

    log.info(`[ToolOrchestrator] Initialized tools (${this.tools.size}):`, Array.from(this.tools.keys()).join(', '));
  }

  /**
   * Get all available tool definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition());
  }

  /**
   * Execute a tool by name with input parameters
   */
  async executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    log.info('[ToolOrchestrator] Executing tool:', name, { input });

    const tool = this.tools.get(name);
    if (!tool) {
      const error = `Unknown tool: ${name}`;
      log.error('[ToolOrchestrator]', error);
      return {
        success: false,
        error,
      };
    }

    return await tool.execute(input);
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
        // Add more tool-supporting Ollama models here as needed
      ];

      return toolSupportedModels.some(supportedModel =>
        model.toLowerCase().includes(supportedModel.toLowerCase())
      );
    }

    // Claude and OpenAI support tools
    return true;
  }

  /**
   * Set working directory for file operations
   */
  setWorkingDirectory(dir: string): void {
    log.info('[ToolOrchestrator] Setting working directory:', dir);
    this.fileToolsService.setWorkingDirectory(dir);
  }

  /**
   * Set callback for tool status updates
   */
  setStatusCallback(callback: ToolStatusCallback | null): void {
    this.fileToolsService.setStatusCallback(callback);
  }

  /**
   * Get current working directory
   */
  getWorkingDirectory(): string {
    return this.fileToolsService.getWorkingDirectory();
  }

  /**
   * Set allowed paths for file access
   */
  setAllowedPaths(paths: string[]): void {
    this.fileToolsService.setAllowedPaths(paths);
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
   * Get current allowed paths
   */
  getAllowedPaths(): string[] {
    return this.fileToolsService.getAllowedPaths();
  }

  /**
   * Clear all allowed paths
   */
  clearAllowedPaths(): void {
    this.fileToolsService.clearAllowedPaths();
  }
}
