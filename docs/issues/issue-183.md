## Description

Add tool calling support to ClaudeChatProvider using Anthropic SDK's native tool calling API. This enables Claude to use file system tools during conversations.

## Requirements

- Must implement supportsTools() returning true for Claude 3.x models
- Must implement chatWithTools() using Anthropic SDK's native tool calling
- Must handle both streaming and non-streaming modes with tools
- Must implement tool use loop: send request → receive tool_use → execute tool → send tool_result → continue
- Must extract tool uses from response.content array (filter by type === 'tool_use')
- Must format tool results as tool_result objects with tool_use_id reference
- Must append assistant message and tool results to conversation history before continuing
- Must exit loop when response contains no tool uses

## Complete Implementation

\\\

## Implementation Notes

- Claude's native tool calling returns tool_use blocks in response.content
- The tool use loop continues until no more tool uses are found
- Tool results must reference the tool_use_id from the original tool use
- Streaming mode still receives text tokens in real-time while processing tools
- Non-streaming mode sends the complete text response after filtering tool_use blocks

## Dependencies

- Depends on #179 (FileToolsService)
- Depends on #180 (IChatProvider Interface)
- Depends on #181 (ChatService Updates)

## Priority

Priority 1
