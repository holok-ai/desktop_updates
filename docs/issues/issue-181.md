## Description

Update the ChatService class to integrate FileToolsService and provide a unified interface for chat operations with file system tools enabled.

## Requirements

- Must instantiate FileToolsService in ChatService constructor
- Must provide chatWithFileTools() method that accepts callbacks for token streaming and tool use notifications
- Must check if provider supports tools before attempting tool-enabled chat
- Must fallback to regular chat() if provider doesn't support tools
- Must pass tool definitions from FileToolsService to provider's chatWithTools() method
- Must execute tools via FileToolsService when LLM requests them
- Must integrate with existing AuditService for logging
- Must provide setFileToolsWorkingDirectory() method to configure working directory

## Implementation Details

### ChatService Updates

\

## Design Notes

- The \ method automatically handles the tool execution lifecycle
- Graceful fallback to \ ensures backward compatibility with non-tool providers
- The \ callback enables UI notifications when the LLM uses a tool
- Integration with AuditService ensures all tool operations are logged
- Working directory can be configured per-conversation for scoped file access

## Reference

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

## Dependencies

- Depends on #179 (FileToolsService)
- Depends on #180 (IChatProvider Interface)

## Priority

Priority 1
