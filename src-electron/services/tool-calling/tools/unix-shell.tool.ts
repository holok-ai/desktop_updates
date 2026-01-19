/**
 * Unix Shell Tool
 * Executes allowed Unix/Linux/macOS shell commands
 */

import type { ITool, ToolContext } from './base-tool.js';
import type { ToolDefinition, ToolResult, ShellResult } from '../tool-types.js';
import { execSync } from 'child_process';
import log from 'electron-log';

// Whitelist of allowed commands
const ALLOWED_COMMANDS = [
  'ls',
  'cat',
  'echo',
  'pwd',
  'cd',
  'tree',
  'grep',
  'find',
  'which',
  'uname',
  'hostname',
  'ifconfig',
  'ip',
  'ping',
  'traceroute',
  'nslookup',
  'dig',
  'ps',
  'whoami',
  'git',
  'gh',
  'slack',
];

export class UnixShellTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'unix_shell';
  }

  getDefinition(): ToolDefinition {
    return {
      name: 'unix_shell',
      description:
        'Execute Unix/Linux/macOS shell commands. Only specific whitelisted commands are allowed for security. Returns the command output as a string.',
      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: `The Unix shell command to execute. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`,
          },
          arguments: {
            type: 'string',
            description: 'Arguments to pass to the command (e.g., "-la" for ls, "/etc/hosts" for cat)',
          },
        },
        required: ['command'],
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const command = params.command as string;
    const args = (params.arguments as string) || '';

    log.info('[UnixShellTool] Execute called', { command, arguments: args });

    // Validate command is in allowlist
    if (!command || !ALLOWED_COMMANDS.includes(command.toLowerCase())) {
      const error = `Command '${command}' is not allowed. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`;
      log.error('[UnixShellTool]', error);
      return {
        success: false,
        error,
      };
    }

    try {
      // Construct full command
      const fullCommand = args ? `${command} ${args}` : command;

      log.info('[UnixShellTool] Executing command:', fullCommand);

      // Execute command synchronously with timeout
      const output = execSync(fullCommand, {
        encoding: 'utf8',
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB max output
        shell: '/bin/sh',
      });

      log.info('[UnixShellTool] Command executed successfully', {
        command,
        outputLength: output.length,
      });

      const result: ShellResult = {
        command,
        arguments: args,
        output: output.trim(),
      };

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error executing command';
      log.error('[UnixShellTool] Command execution failed:', {
        command,
        error: errorMessage,
      });

      return {
        success: false,
        error: `Command execution failed: ${errorMessage}`,
      };
    }
  }
}

export function createUnixShellTool(context: ToolContext): UnixShellTool {
  return new UnixShellTool(context);
}
