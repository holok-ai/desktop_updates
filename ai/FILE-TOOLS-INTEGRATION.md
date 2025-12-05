# File Tools Integration with ChatService

## Overview

Integrate file access tools (`read_folder`, `read_file`) with the existing ChatService to enable LLMs to access local files during conversations.

## Provider Priority

### Priority 1 (Immediate Implementation)

1. **OpenAI** (GPT-4, GPT-4 Turbo) - Full tool calling support
2. **Anthropic** (Claude 3.x) - Full tool calling support
3. **Ollama** (Local models) - Limited/manual tool handling
4. **Perplexity** (pplx-70b-online, pplx-7b-chat) - Tool calling support

### Priority 2 (Future Implementation)

1. **Google Gemini** (gemini-pro, gemini-ultra) - Tool calling support
2. **xAI** (Grok) - Tool calling support

---

## Architecture

### Current State

```
ChatService
├── ClaudeChatProvider (Anthropic)
├── OpenAIChatProvider (OpenAI)
└── OllamaChatProvider (Ollama)
```

### Target State

```
ChatService + FileToolsService
├── ClaudeChatProvider (with tool support)
├── OpenAIChatProvider (with tool support)
├── OllamaChatProvider (with manual tool handling)
├── PerplexityChatProvider (NEW - with tool support)
├── GeminiChatProvider (Priority 2)
└── XAIChatProvider (Priority 2)
```

---

## Tool Definitions

### Tool 1: `read_folder`

Lists files and subdirectories in a folder.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Path to folder (relative or absolute)"
    },
    "recursive": {
      "type": "boolean",
      "description": "List subdirectories recursively",
      "default": false
    },
    "max_depth": {
      "type": "integer",
      "description": "Maximum recursion depth",
      "default": 3
    },
    "include_hidden": {
      "type": "boolean",
      "description": "Include hidden files",
      "default": false
    },
    "filter_extensions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Filter by file extensions (e.g., [\".js\", \".ts\"])"
    }
  },
  "required": ["path"]
}
```

**Output:**

```json
{
  "success": true,
  "path": "/absolute/path/to/folder",
  "entries": [
    {
      "name": "file.ts",
      "path": "/absolute/path/to/folder/file.ts",
      "type": "file",
      "size": 2048,
      "modified": 1699564800000,
      "extension": ".ts"
    }
  ],
  "total_files": 5,
  "total_directories": 2
}
```

### Tool 2: `read_file`

Reads contents of a text file.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Path to file (relative or absolute)"
    },
    "encoding": {
      "type": "string",
      "enum": ["utf-8", "ascii", "latin1"],
      "default": "utf-8"
    },
    "start_line": {
      "type": "integer",
      "description": "Read from line N (1-indexed)"
    },
    "end_line": {
      "type": "integer",
      "description": "Read to line N (1-indexed)"
    }
  },
  "required": ["path"]
}
```

**Output:**

```json
{
  "success": true,
  "path": "/absolute/path/to/file.ts",
  "content": "file contents here...",
  "metadata": {
    "size": 2048,
    "lines": 45,
    "modified": 1699564800000,
    "encoding": "utf-8"
  },
  "truncated": false
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure

1. Create `FileToolsService` class
2. Extend `IChatProvider` interface with tool support
3. Update `ChatService` to integrate file tools

### Phase 2: Provider Implementation (Priority 1)

#### 2.1 Anthropic (Claude) - **Already Exists**

- Claude SDK supports tool calling natively
- Implement `chatWithTools()` method
- Handle tool use loop

#### 2.2 OpenAI (GPT-4) - **Already Exists**

- OpenAI SDK supports "function calling" (their term for tools)
- Implement `chatWithTools()` method
- Convert tool definitions to OpenAI format

#### 2.3 Ollama - **Already Exists**

- No native tool support
- Implement manual tool handling:
  1. Append tool descriptions to system prompt
  2. Parse model output for tool calls
  3. Execute tools and append results
  4. Continue conversation

#### 2.4 Perplexity - **NEW**

- Uses OpenAI-compatible API
- Create `PerplexityChatProvider`
- Similar implementation to OpenAI

### Phase 3: Provider Implementation (Priority 2)

#### 3.1 Google Gemini

- Create `GeminiChatProvider`
- Implement tool calling (similar to Claude/OpenAI)

#### 3.2 xAI (Grok)

- Create `XAIChatProvider`
- Implement based on xAI API documentation

---

## Detailed Implementation

### 1. FileToolsService

**Requirements:**

- Must provide tool definitions in a format compatible with LLM providers (Anthropic, OpenAI formats)
- Must execute tools by name and return structured success/error results
- Must resolve relative paths to absolute paths using a configurable working directory
- Must enforce security restrictions via path blacklist (system dirs, sensitive user data)
- Must validate file size limits before reading (max 10MB) and folder entry limits (max 1000 files)
- Must support text file detection based on file extension whitelist
- Must handle errors gracefully and return descriptive error messages
- Must support recursive directory traversal with configurable depth limits
- Must filter files by extension when requested

```typescript
// src-electron/services/file-tools.service.ts

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import log from 'electron-log';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class FileToolsService {
  private workingDirectory: string;
  private blacklistedPaths: Set<string>;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFolderFiles: number = 1000;

  constructor(workingDir?: string) {
    this.workingDirectory = workingDir || process.cwd();
    this.blacklistedPaths = this.initializeBlacklist();
  }

  public getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'read_folder',
        description:
          'List files and subdirectories in a folder on the local filesystem. Returns metadata including names, paths, types, sizes, and modification times.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the folder (can be relative to working directory or absolute)',
            },
            recursive: {
              type: 'boolean',
              description: 'If true, list subdirectories recursively. Default: false',
            },
            max_depth: {
              type: 'integer',
              description: 'Maximum recursion depth when recursive is true. Default: 3',
            },
            include_hidden: {
              type: 'boolean',
              description: 'Include hidden files (starting with .). Default: false',
            },
            filter_extensions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Only include files with these extensions (e.g., [".js", ".ts"])',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'read_file',
        description:
          'Read the contents of a text file from the local filesystem. Supports encoding options and line ranges for large files.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file (can be relative to working directory or absolute)',
            },
            encoding: {
              type: 'string',
              enum: ['utf-8', 'ascii', 'latin1'],
              description: 'Text encoding. Default: utf-8',
            },
            start_line: {
              type: 'integer',
              description: 'Read from this line number (1-indexed). Useful for large files.',
            },
            end_line: {
              type: 'integer',
              description: 'Read to this line number (1-indexed). Useful for large files.',
            },
          },
          required: ['path'],
        },
      },
    ];
  }

  public async executeTool(toolName: string, input: any): Promise<ToolResult> {
    log.info(`[FileTools] Executing: ${toolName}`, { input });

    try {
      switch (toolName) {
        case 'read_folder':
          return await this.readFolder(input);
        case 'read_file':
          return await this.readFile(input);
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      log.error(`[FileTools] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async readFolder(params: any): Promise<ToolResult> {
    const {
      path: userPath,
      recursive = false,
      max_depth = 3,
      include_hidden = false,
      filter_extensions,
    } = params;

    const resolvedPath = this.resolvePath(userPath);

    // Security check
    if (!this.isPathAllowed(resolvedPath)) {
      return {
        success: false,
        error: `ACCESS_DENIED: Path is restricted for security reasons`,
      };
    }

    // Check existence
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `PATH_NOT_FOUND: '${userPath}' does not exist`,
      };
    }

    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isDirectory()) {
      return {
        success: false,
        error: `NOT_A_DIRECTORY: '${userPath}' is not a directory`,
      };
    }

    // Read directory
    const entries = await this.readDirectoryRecursive(
      resolvedPath,
      recursive,
      max_depth,
      include_hidden,
      filter_extensions,
      0,
    );

    // Check file limit
    if (entries.length > this.maxFolderFiles) {
      return {
        success: false,
        error: `TOO_MANY_FILES: Folder contains ${entries.length} items (max: ${this.maxFolderFiles}). Be more specific or use filters.`,
      };
    }

    return {
      success: true,
      data: {
        path: resolvedPath,
        entries,
        total_files: entries.filter((e) => e.type === 'file').length,
        total_directories: entries.filter((e) => e.type === 'directory').length,
      },
    };
  }

  private async readFile(params: any): Promise<ToolResult> {
    const { path: userPath, encoding = 'utf-8', start_line, end_line } = params;

    const resolvedPath = this.resolvePath(userPath);

    // Security check
    if (!this.isPathAllowed(resolvedPath)) {
      return {
        success: false,
        error: `ACCESS_DENIED: Path is restricted for security reasons`,
      };
    }

    // Check existence
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `FILE_NOT_FOUND: '${userPath}' does not exist`,
      };
    }

    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isFile()) {
      return {
        success: false,
        error: `NOT_A_FILE: '${userPath}' is not a file`,
      };
    }

    // Check file size
    if (stats.size > this.maxFileSize && !start_line && !end_line) {
      return {
        success: false,
        error: `FILE_TOO_LARGE: File is ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${this.maxFileSize / 1024 / 1024}MB). Use start_line and end_line parameters.`,
      };
    }

    // Check if text file
    if (!this.isTextFile(resolvedPath)) {
      return {
        success: false,
        error: `NOT_TEXT_FILE: File appears to be binary`,
      };
    }

    // Read file
    let content = await fs.promises.readFile(resolvedPath, encoding);
    let truncated = false;

    // Handle line ranges
    if (start_line || end_line) {
      const lines = content.split('\n');
      const start = (start_line || 1) - 1;
      const end = end_line || lines.length;
      content = lines.slice(start, end).join('\n');
      truncated = start > 0 || end < lines.length;
    }

    return {
      success: true,
      data: {
        path: resolvedPath,
        content,
        metadata: {
          size: stats.size,
          lines: content.split('\n').length,
          modified: stats.mtimeMs,
          encoding,
        },
        truncated,
      },
    };
  }

  private async readDirectoryRecursive(
    dirPath: string,
    recursive: boolean,
    maxDepth: number,
    includeHidden: boolean,
    filterExtensions?: string[],
    currentDepth: number = 0,
  ): Promise<any[]> {
    const entries: any[] = [];
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (!includeHidden && item.name.startsWith('.')) continue;

      const itemPath = path.join(dirPath, item.name);
      const stats = await fs.promises.stat(itemPath);

      if (item.isDirectory()) {
        entries.push({
          name: item.name,
          path: itemPath,
          type: 'directory',
          size: 0,
          modified: stats.mtimeMs,
        });

        if (recursive && currentDepth < maxDepth) {
          const subEntries = await this.readDirectoryRecursive(
            itemPath,
            recursive,
            maxDepth,
            includeHidden,
            filterExtensions,
            currentDepth + 1,
          );
          entries.push(...subEntries);
        }
      } else if (item.isFile()) {
        const ext = path.extname(item.name);

        if (filterExtensions && filterExtensions.length > 0) {
          if (!filterExtensions.includes(ext)) continue;
        }

        entries.push({
          name: item.name,
          path: itemPath,
          type: 'file',
          size: stats.size,
          modified: stats.mtimeMs,
          extension: ext,
        });
      }
    }

    return entries;
  }

  private resolvePath(userPath: string): string {
    if (userPath.startsWith('~')) {
      userPath = path.join(app.getPath('home'), userPath.slice(1));
    }
    if (!path.isAbsolute(userPath)) {
      userPath = path.resolve(this.workingDirectory, userPath);
    }
    return path.normalize(userPath);
  }

  private isPathAllowed(absolutePath: string): boolean {
    for (const blacklisted of this.blacklistedPaths) {
      if (absolutePath.startsWith(blacklisted)) {
        return false;
      }
    }
    return true;
  }

  private isTextFile(filePath: string): boolean {
    const textExts = new Set([
      '.txt',
      '.md',
      '.json',
      '.js',
      '.ts',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.hpp',
      '.cs',
      '.css',
      '.html',
      '.xml',
      '.yaml',
      '.yml',
      '.toml',
      '.ini',
      '.conf',
      '.sh',
      '.bash',
      '.sql',
      '.go',
      '.rs',
      '.vue',
      '.svelte',
      '.log',
      '.env',
    ]);
    return textExts.has(path.extname(filePath).toLowerCase());
  }

  private initializeBlacklist(): Set<string> {
    const blacklist = new Set<string>();
    const home = app.getPath('home');

    // System directories
    if (process.platform === 'win32') {
      blacklist.add('C:\\Windows');
      blacklist.add('C:\\Program Files');
    } else {
      blacklist.add('/System');
      blacklist.add('/usr/bin');
      blacklist.add('/etc');
    }

    // Sensitive user directories
    blacklist.add(path.join(home, '.ssh'));
    blacklist.add(path.join(home, '.aws'));
    blacklist.add(path.join(home, '.gnupg'));

    return blacklist;
  }

  public setWorkingDirectory(dir: string): void {
    this.workingDirectory = dir;
  }

  public getWorkingDirectory(): string {
    return this.workingDirectory;
  }
}
```

### 2. Update IChatProvider Interface

**Requirements:**

- Must extend IChatProvider interface to include optional tool calling support
- Must define ToolUse interface with id, name, and input parameters
- Must define ToolResult interface for tool execution responses
- Must add supportsTools() method to indicate provider capability
- Must add optional chatWithTools() method for providers with native tool support
- Must maintain backward compatibility with existing chat() and chatWithOptions() methods

```typescript
// src-electron/services/chat/interfaces/IChatProvider.ts (additions)

import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface IChatProvider {
  chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;

  chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void>;

  /**
   * Check if provider supports tool calling
   */
  supportsTools(): boolean;

  /**
   * Send chat with tools enabled (optional - only for providers that support it)
   */
  chatWithTools?(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>,
  ): Promise<void>;
}
```

### 3. Update ChatService

**Requirements:**

- Must instantiate FileToolsService in ChatService constructor
- Must provide chatWithFileTools() method that accepts callbacks for token streaming and tool use notifications
- Must check if provider supports tools before attempting tool-enabled chat
- Must fallback to regular chat() if provider doesn't support tools
- Must pass tool definitions from FileToolsService to provider's chatWithTools() method
- Must execute tools via FileToolsService when LLM requests them
- Must integrate with existing AuditService for logging
- Must provide setFileToolsWorkingDirectory() method to configure working directory

```typescript
// src-electron/services/chat/ChatService.ts (additions)

import { FileToolsService } from '../file-tools.service.js';

export class ChatService {
  private provider: IChatProvider;
  private providerType: ProviderType;
  private config: ProviderConfig;
  private auditService: AuditService;
  private fileToolsService: FileToolsService;

  constructor(providerType: string, config: ProviderConfig, enableAudit: boolean = true) {
    // ... existing code ...
    this.fileToolsService = new FileToolsService();
  }

  /**
   * Send chat with file tools enabled
   */
  public async chatWithFileTools(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolName: string, input: any) => void,
  ): Promise<void> {
    // Check if provider supports tools
    if (!this.provider.supportsTools() || !this.provider.chatWithTools) {
      log.warn('[ChatService] Provider does not support tools, falling back to regular chat');
      return this.chat(request, onTokenReceived);
    }

    const tools = this.fileToolsService.getToolDefinitions();

    const handleToolUse = async (toolUse: ToolUse): Promise<ToolResult> => {
      if (onToolUse) {
        onToolUse(toolUse.name, toolUse.input);
      }
      return await this.fileToolsService.executeTool(toolUse.name, toolUse.input);
    };

    const { callback, complete } = this.auditService.createWrappedCallback(
      request,
      this.providerType,
      onTokenReceived,
    );

    try {
      await this.provider.chatWithTools(request, tools, callback, handleToolUse);
      complete();
    } catch (error) {
      complete(error);
      throw error;
    }
  }

  public setFileToolsWorkingDirectory(dir: string): void {
    this.fileToolsService.setFileToolsWorkingDirectory(dir);
  }
}
```

### 4. Provider Implementations

#### 4.1 Anthropic (Claude) - Priority 1

**Requirements:**

- Must implement supportsTools() returning true for Claude 3.x models
- Must implement chatWithTools() using Anthropic SDK's native tool calling
- Must handle both streaming and non-streaming modes with tools
- Must implement tool use loop: send request → receive tool_use → execute tool → send tool_result → continue
- Must extract tool uses from response.content array (filter by type === 'tool_use')
- Must format tool results as tool_result objects with tool_use_id reference
- Must append assistant message and tool results to conversation history before continuing
- Must exit loop when response contains no tool uses

```typescript
// src-electron/services/chat/providers/ClaudeChatProvider.ts (add method)

export class ClaudeChatProvider implements IChatProvider {
  // ... existing code ...

  public supportsTools(): boolean {
    return true;
  }

  public async chatWithTools(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const claudeRequest = ClaudeConverter.toClaudeRequest({ ...request, model: modelToUse });

    let messages = claudeRequest.messages;
    let response: any;

    // Tool use loop
    do {
      if (request.streaming !== false) {
        // Streaming with tools
        const stream = this.client.messages.stream({
          model: claudeRequest.model,
          messages,
          tools, // Pass tools to Claude
          max_tokens: 4096,
          stream: true,
        });

        stream.on('text', (text) => {
          if (onTokenReceived) onTokenReceived(text);
        });

        response = await stream.finalMessage();
      } else {
        // Non-streaming with tools
        response = await this.client.messages.create({
          model: claudeRequest.model,
          messages,
          tools,
          max_tokens: 4096,
          stream: false,
        });

        // Send full response at once
        if (onTokenReceived) {
          const textContent = response.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');
          onTokenReceived(textContent);
        }
      }

      // Check for tool uses
      const toolUses = response.content.filter((c: any) => c.type === 'tool_use');

      if (toolUses.length > 0 && onToolUse) {
        // Execute tools
        const toolResults = await Promise.all(
          toolUses.map(async (tu: any) => {
            const result = await onToolUse({
              id: tu.id,
              name: tu.name,
              input: tu.input,
            });

            return {
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result),
              is_error: !result.success,
            };
          }),
        );

        // Continue conversation with tool results
        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ];
      } else {
        // No more tools to use, exit loop
        break;
      }
    } while (true);
  }
}
```

#### 4.2 OpenAI - Priority 1

**Requirements:**

- Must implement supportsTools() returning true for GPT-4 models
- Must convert ToolDefinition format to OpenAI's "functions" format (different terminology)
- Must handle streaming mode by accumulating function_call chunks from delta objects
- Must handle non-streaming mode by reading function_call from message object
- Must implement tool use loop checking for finish_reason === 'function_call'
- Must parse function arguments from JSON string to object
- Must format tool results as 'function' role messages with function name and content
- Must append assistant message and function result to conversation before continuing

```typescript
// src-electron/services/chat/providers/OpenAIChatProvider.ts (add method)

export class OpenAIChatProvider implements IChatProvider {
  // ... existing code ...

  public supportsTools(): boolean {
    return true;
  }

  public async chatWithTools(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;

    // Convert tools to OpenAI format (they call it "functions")
    const functions = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }));

    let messages = request.messages;
    let response: any;

    // Tool use loop
    do {
      if (request.streaming !== false) {
        const stream = await this.client.chat.completions.create({
          model: modelToUse,
          messages,
          functions,
          stream: true,
        });

        let functionCall: any = null;

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            if (onTokenReceived) onTokenReceived(delta.content);
          }

          if (delta?.function_call) {
            if (!functionCall) {
              functionCall = { name: '', arguments: '' };
            }
            if (delta.function_call.name) {
              functionCall.name += delta.function_call.name;
            }
            if (delta.function_call.arguments) {
              functionCall.arguments += delta.function_call.arguments;
            }
          }
        }

        if (functionCall) {
          response = {
            choices: [
              {
                finish_reason: 'function_call',
                message: {
                  role: 'assistant',
                  function_call: functionCall,
                },
              },
            ],
          };
        } else {
          break;
        }
      } else {
        response = await this.client.chat.completions.create({
          model: modelToUse,
          messages,
          functions,
          stream: false,
        });

        if (onTokenReceived && response.choices[0].message.content) {
          onTokenReceived(response.choices[0].message.content);
        }
      }

      // Check for function call
      const functionCall = response.choices[0].message.function_call;

      if (functionCall && onToolUse) {
        const toolUse: ToolUse = {
          id: `call_${Date.now()}`,
          name: functionCall.name,
          input: JSON.parse(functionCall.arguments),
        };

        const result = await onToolUse(toolUse);

        // Add function call and result to messages
        messages = [
          ...messages,
          response.choices[0].message,
          {
            role: 'function',
            name: functionCall.name,
            content: JSON.stringify(result),
          },
        ];
      } else {
        break;
      }
    } while (true);
  }
}
```

#### 4.3 Ollama - Priority 1

**Requirements:**

- Must implement supportsTools() returning false (no native tool support)
- Must provide optional chatWithTools() method for manual tool handling
- Must append tool descriptions to system prompt in human-readable format
- Must instruct model to respond with JSON format when using tools
- Must call regular chat() method with modified system prompt
- Must not implement tool use loop (manual parsing would be required in future)
- Should be considered a fallback/basic implementation for local models

```typescript
// src-electron/services/chat/providers/OllamaChatProvider.ts (add method)

export class OllamaChatProvider implements IChatProvider {
  // ... existing code ...

  public supportsTools(): boolean {
    return false; // Ollama doesn't have native tool support
  }

  // Optional: Manual tool handling via system prompt
  public async chatWithTools(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>,
  ): Promise<void> {
    // Fallback: append tool descriptions to system prompt
    const toolDescriptions = tools
      .map(
        (t) =>
          `Tool: ${t.name}\nDescription: ${t.description}\nParameters: ${JSON.stringify(t.input_schema.properties)}`,
      )
      .join('\n\n');

    const systemPrompt = `You have access to the following tools:\n\n${toolDescriptions}\n\nTo use a tool, respond with JSON in this format: {"tool": "tool_name", "input": {...}}`;

    const modifiedMessages = [{ role: 'system', content: systemPrompt }, ...request.messages];

    // Call regular chat with modified messages
    return this.chat({ ...request, messages: modifiedMessages }, onTokenReceived);
  }
}
```

#### 4.4 Perplexity - Priority 1 (NEW)

**Requirements:**

- Must create new PerplexityChatProvider class implementing IChatProvider
- Must use OpenAI SDK with baseURL set to 'https://api.perplexity.ai'
- Must implement supportsTools() returning true (OpenAI-compatible API)
- Must implement chatWithTools() using same logic as OpenAI provider
- Must support pplx-70b-online and pplx-7b-chat models
- Must handle API key authentication via OpenAI client constructor
- Should reuse OpenAI implementation patterns for consistency

```typescript
// src-electron/services/chat/providers/PerplexityChatProvider.ts (NEW FILE)

import OpenAI from 'openai';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import type { ToolDefinition, ToolResult, ToolUse } from '../../file-tools.service.js';

export class PerplexityChatProvider implements IChatProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiEndpoint: string, apiKey: string, defaultModel: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: apiEndpoint || 'https://api.perplexity.ai',
      dangerouslyAllowBrowser: true,
    });
    this.defaultModel = defaultModel || 'pplx-70b-online';
  }

  public async chat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    // Similar to OpenAI implementation
    // Perplexity uses OpenAI-compatible API
  }

  public async chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    return this.chat(request, onTokenReceived);
  }

  public supportsTools(): boolean {
    return true; // Perplexity supports OpenAI-style function calling
  }

  public async chatWithTools(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>,
  ): Promise<void> {
    // Same implementation as OpenAI since Perplexity is OpenAI-compatible
    // ... (copy OpenAI chatWithTools implementation)
  }
}
```

### 5. Update ChatProviderFactory

**Requirements:**

- Must add PERPLEXITY to ProviderType enum
- Must add GEMINI and XAI to ProviderType enum for Priority 2
- Must add case for ProviderType.PERPLEXITY in createProvider() switch statement
- Must instantiate PerplexityChatProvider with correct config parameters
- Must maintain existing provider instantiation logic
- Must throw error for unsupported provider types

```typescript
// src-electron/services/chat/factories/ChatProviderFactory.ts (additions)

import { PerplexityChatProvider } from '../providers/PerplexityChatProvider.js';

export enum ProviderType {
  CLAUDE = 'claude',
  OPENAI = 'openai',
  OLLAMA = 'ollama',
  PERPLEXITY = 'perplexity', // NEW
  // Priority 2:
  GEMINI = 'gemini',
  XAI = 'xai',
}

export class ChatProviderFactory {
  static createProvider(providerType: ProviderType, config: ProviderConfig): IChatProvider {
    switch (providerType) {
      case ProviderType.CLAUDE:
        return new ClaudeChatProvider(config.apiEndpoint, config.apiKey, config.model);
      case ProviderType.OPENAI:
        return new OpenAIChatProvider(config.apiEndpoint, config.apiKey, config.model);
      case ProviderType.OLLAMA:
        return new OllamaChatProvider(config.apiEndpoint, config.model);
      case ProviderType.PERPLEXITY:
        return new PerplexityChatProvider(config.apiEndpoint, config.apiKey, config.model);
      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }
}
```

### 6. IPC Handler Updates

**Requirements:**

- Must add new 'chat:sendWithFileTools' IPC handler
- Must accept ChatRequest and optional workingDirectory parameter
- Must validate chatService is initialized before proceeding
- Must call chatService.setFileToolsWorkingDirectory() if working directory provided
- Must call chatService.chatWithFileTools() with token and tool use callbacks
- Must send 'chat:token' events to renderer for streaming tokens
- Must send 'chat:toolUse' events to renderer when tools are executed
- Must return success/error result structure
- Must log all operations and errors

```typescript
// src-electron/ipc-handlers/chat-handler.ts (add handler)

ipcMain.handle(
  'chat:sendWithFileTools',
  async (
    event: IpcMainInvokeEvent,
    request: ChatRequest,
    workingDirectory?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    log.info('[IPC] chat:sendWithFileTools called');

    if (!chatService) {
      throw new Error('Chat service not initialized');
    }

    try {
      if (workingDirectory) {
        chatService.setFileToolsWorkingDirectory(workingDirectory);
      }

      await chatService.chatWithFileTools(
        request,
        (token: string) => {
          event.sender.send('chat:token', token);
        },
        (toolName: string, input: any) => {
          event.sender.send('chat:toolUse', { toolName, input });
        },
      );

      return { success: true };
    } catch (error) {
      log.error('[IPC] Error in chatWithFileTools:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);
```

---

## Testing Strategy

### Unit Tests

- [ ] FileToolsService.readFolder() - various scenarios
- [ ] FileToolsService.readFile() - encoding, line ranges
- [ ] Path security validation
- [ ] Blacklist enforcement

### Integration Tests

- [ ] Anthropic with file tools
- [ ] OpenAI with file tools
- [ ] Ollama with manual tools
- [ ] Perplexity with file tools

### E2E Tests

- [ ] User: "What files are in src/lib/services?"
- [ ] User: "Show me auth.service.ts"
- [ ] User: "Analyze all TypeScript files"

---

## API Keys & Configuration

```typescript
// Example provider configs
const configs = {
  anthropic: {
    apiEndpoint: 'https://api.anthropic.com',
    apiKey: 'sk-ant-...',
    model: 'claude-3-5-sonnet-20241022',
  },
  openai: {
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: 'sk-...',
    model: 'gpt-4-turbo-preview',
  },
  ollama: {
    apiEndpoint: 'http://localhost:11434',
    model: 'llama3:latest',
  },
  perplexity: {
    apiEndpoint: 'https://api.perplexity.ai',
    apiKey: 'pplx-...',
    model: 'pplx-70b-online',
  },
};
```

---

## Security Checklist

- [ ] Path validation and normalization
- [ ] Blacklist enforcement
- [ ] File size limits
- [ ] File type validation (text only)
- [ ] Audit logging
- [ ] Error handling
- [ ] User notifications for tool use
