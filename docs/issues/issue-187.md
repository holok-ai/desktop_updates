## Description

Add a new IPC handler to enable file tools functionality from the renderer process. This handler allows the frontend to send chat requests with file system access enabled.

## Requirements

- Must add new 'chat:sendWithFileTools' IPC handler
- Must accept ChatRequest and optional workingDirectory parameter
- Must validate chatService is initialized before proceeding
- Must call chatService.setFileToolsWorkingDirectory() if working directory provided
- Must call chatService.chatWithFileTools() with token and tool use callbacks
- Must send 'chat:token' events to renderer for streaming tokens
- Must send 'chat:toolUse' events to renderer when tools are executed
- Must return success/error result structure
- Must log all operations and errors

## Complete Implementation

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

## Implementation Notes

- The handler follows the same pattern as existing 'chat:send' and 'chat:sendWithOptions' handlers
- Working directory is optional - if not provided, defaults to process.cwd()
- Token streaming uses the existing 'chat:token' event channel
- Tool use notifications use a new 'chat:toolUse' event channel
- Error handling follows existing IPC patterns with structured success/error response
- The handler validates chatService exists before proceeding

## Additional Work Needed

### Preload API Updates

The preload script needs to expose this new handler:

```typescript
// src-electron/preload.ts (add to electronAPI)
chatWithFileTools: (request: ChatRequest, workingDirectory?: string) =>
  ipcRenderer.invoke('chat:sendWithFileTools', request, workingDirectory);
```

### Frontend Service Updates

The frontend chat service needs to call this new API and handle tool use events:

```typescript
// Listen for tool use events
window.electronAPI.onChatToolUse((data: { toolName: string; input: any }) => {
  // Show UI notification that a tool is being used
});
```

## Dependencies

- Depends on #179 (FileToolsService)
- Depends on #180 (IChatProvider Interface)
- Depends on #181 (ChatService Updates)

## Priority

Priority 1
