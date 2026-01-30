/**
 * Windows Shell Tool
 * Executes allowed Windows command prompt commands
 */

import type { ITool, ToolContext } from './base-tool.js';
import type { ToolDefinition, ToolResult, ShellResult } from '../tool-types.js';
import { execSync } from 'child_process';
import log from 'electron-log';

// Whitelist of allowed commands
const ALLOWED_COMMANDS = [
  'dir',
  'del',
  'move',
  'rename',
  'type',
  'echo',
  'cd',
  'tree',
  'findstr',
  'where',
  'ver',
  'hostname',
  'ipconfig',
  'ping',
  'tracert',
  'nslookup',
  'systeminfo',
  'tasklist',
  'whoami',
  'git',
  'gh',
  'slack',
];

export class WindowsShellTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'windows_shell';
  }

  getDefinition(): ToolDefinition {
    return {
      name: 'windows_shell',
      description:
        'Execute Windows command prompt commands. Only specific whitelisted commands are allowed for security. Returns the command output as a string.',
      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: `The Windows command to execute. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`,
          },
          arguments: {
            type: 'string',
            description: 'Arguments to pass to the command (e.g., "/s /b" for dir, "C:" for cd)',
          },
        },
        required: ['command'],
      },
    };
  }

  execute(params: Record<string, unknown>): Promise<ToolResult> {
    const command = params.command as string;
    const args = (params.arguments as string) || '';

    log.info('[WindowsShellTool] Execute called', { command, arguments: args });

    // Validate command is in allowlist
    if (!command || !ALLOWED_COMMANDS.includes(command.toLowerCase())) {
      const error = `Command '${command}' is not allowed. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`;
      log.error('[WindowsShellTool]', error);
      return Promise.resolve({
        success: false,
        error,
      });
    }

    try {
      // Construct full command
      const fullCommand = args ? `${command} ${args}` : command;

      log.info('[WindowsShellTool] Executing command:', fullCommand);

      // Execute command synchronously with timeout
      const output = execSync(fullCommand, {
        encoding: 'utf8',
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB max output
        windowsHide: true,
      });

      log.info('[WindowsShellTool] Command executed successfully', {
        command,
        outputLength: output.length,
      });

      const result: ShellResult = {
        command,
        arguments: args,
        output: output.trim(),
      };

      return Promise.resolve({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error executing command';
      log.error('[WindowsShellTool] Command execution failed:', {
        command,
        error: errorMessage,
      });

      return Promise.resolve({
        success: false,
        error: `Command execution failed: ${errorMessage}`,
      });
    }
  }
}

export function createWindowsShellTool(context: ToolContext): WindowsShellTool {
  return new WindowsShellTool(context);
}
