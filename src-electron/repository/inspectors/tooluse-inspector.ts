import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

type ToolUseEntry = { id?: string; name: string; status: 'complete' | 'error' };

type ChatCompletionChunk = {
  object?: string;
  choices?: unknown[];
};

/**
 * Handles all tool-use related transformations for loaded thread messages.
 *
 * 1. **Filter streaming chunks** — removes or hides `chat.completion.chunk`
 *    messages that were persisted during streaming.
 *
 * 2. **Backfill tool uses from follow-up requests** — for providers like
 *    OpenAI Chat Completions where the tool call data isn't stored in
 *    `response_raw` (the "done" message has `choices: []`), the tool calls
 *    ARE recorded in the next request's `raw_request.messages[]` as an
 *    assistant entry with `tool_calls`. This pass finds those and attaches
 *    them to the preceding assistant message that has no `toolUses`.
 *
 * 3. **Correlate tool result errors** — scans user messages' rawData for
 *    `tool_result` blocks (Claude) and `tool` role entries (OpenAI) that
 *    indicate failure, then marks the matching tool_use as 'error'.
 */
export class ToolUseInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    // Pass 1: filter/hide streaming chunks
    const filtered = this.filterStreamingChunks(messages);

    // Pass 2: backfill tool uses from follow-up request rawData
    this.backfillToolUsesFromRequests(filtered);

    // Pass 3: correlate tool result errors
    this.correlateToolResultErrors(filtered);

    return filtered;
  }

  // ── Pass 1: Filter streaming chunks ──────────────────────────────────

  private filterStreamingChunks(messages: Message[]): Message[] {
    let removedCount = 0;
    let hiddenCount = 0;

    const filtered = messages.filter((message) => {
      const chunk = this.parseChunk(message.content);
      if (!chunk) {
        return true;
      }

      const choices = chunk.choices;
      if (!Array.isArray(choices)) {
        return true;
      }

      if (choices.length === 0) {
        removedCount += 1;
        return false;
      }

      message.isHidden = true;
      hiddenCount += 1;
      return true;
    });

    if (removedCount > 0 || hiddenCount > 0) {
      log.info('[ToolUseInspector] Filtered tool-use chunks:', {
        removedCount,
        hiddenCount,
      });
    }

    return filtered;
  }

  private parseChunk(content: string): ChatCompletionChunk | null {
    if (typeof content !== 'string') return null;

    const trimmed = content.trim();
    if (!trimmed.startsWith('{')) return null;

    try {
      const parsed = JSON.parse(trimmed) as ChatCompletionChunk;
      if (parsed?.object !== 'chat.completion.chunk') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  // ── Pass 2: Backfill tool uses from follow-up requests ───────────────

  /**
   * OpenAI Chat Completions streaming doesn't persist tool_call data in
   * `response_raw` — the final "done" chunk has `choices: []`.
   *
   * However, when the server sends the tool result back as a follow-up
   * request, the `raw_request.messages[]` array contains the assistant's
   * message with `tool_calls: [{ id, type, function: { name, arguments } }]`.
   *
   * This pass scans non-assistant messages for such entries and attaches
   * the tool uses to the nearest prior assistant message (on the same
   * branch) that has no `toolUses` yet.
   */
  private backfillToolUsesFromRequests(messages: Message[]): void {
    let backfilledCount = 0;

    for (const msg of messages) {
      if (msg.role === 'assistant') continue;

      const rawMessages = this.getRawMessages(msg);
      if (!rawMessages) continue;

      for (const entry of rawMessages) {
        if (!entry || typeof entry !== 'object') continue;
        const rec = entry as Record<string, unknown>;

        if (rec.role !== 'assistant') continue;
        const toolCalls = rec.tool_calls;
        if (!Array.isArray(toolCalls) || toolCalls.length === 0) continue;

        const extracted = this.extractToolCallsFromEntry(toolCalls);
        if (extracted.length === 0) continue;

        // Find the nearest prior assistant message on the same branch
        // that has no toolUses (or whose toolUses are empty)
        const target = this.findAssistantWithoutTools(messages, msg);
        if (target) {
          target.toolUses = extracted;
          backfilledCount += extracted.length;
        }
      }
    }

    if (backfilledCount > 0) {
      log.info('[ToolUseInspector] Backfilled tool uses from requests:', backfilledCount);
    }
  }

  /**
   * Extract `rawData.messages` array from a message's rawData.
   */
  private getRawMessages(msg: Message): unknown[] | null {
    const rawData = msg.rawData;
    if (!rawData || typeof rawData !== 'object') return null;

    const data = rawData as Record<string, unknown>;
    const rawMessages = data.messages;
    if (!Array.isArray(rawMessages)) return null;

    return rawMessages as unknown[];
  }

  /**
   * Parse OpenAI-format tool_calls entries:
   * `[{ id, type: "function", function: { name, arguments } }]`
   */
  private extractToolCallsFromEntry(toolCalls: unknown[]): ToolUseEntry[] {
    const results: ToolUseEntry[] = [];
    for (const tc of toolCalls) {
      if (!tc || typeof tc !== 'object') continue;
      const call = tc as Record<string, unknown>;
      const fn = call.function;
      if (!fn || typeof fn !== 'object') continue;
      const fnName = (fn as Record<string, unknown>).name;
      if (typeof fnName === 'string' && fnName.length > 0) {
        results.push({
          id: typeof call.id === 'string' ? call.id : undefined,
          name: fnName,
          status: 'complete',
        });
      }
    }
    return results;
  }

  /**
   * Walk backwards from `anchor` to find the nearest assistant message
   * (by createdAt) that has no toolUses.
   */
  private findAssistantWithoutTools(messages: Message[], anchor: Message): Message | null {
    let best: Message | null = null;
    for (const m of messages) {
      if (m.role !== 'assistant') continue;
      if (m.createdAt >= anchor.createdAt) continue;
      if (m.toolUses && m.toolUses.length > 0) continue;
      if (!best || m.createdAt > best.createdAt) {
        best = m;
      }
    }
    return best;
  }

  // ── Pass 3: Correlate tool result errors ─────────────────────────────

  /**
   * Scans non-assistant messages' rawData for tool result blocks that
   * indicate failure, then marks the matching tool_use as 'error'.
   *
   * Supports:
   * - Claude: `tool_result` blocks with `is_error`, `success: false`, etc.
   * - OpenAI: `tool` role entries with error indicators in content.
   */
  private correlateToolResultErrors(messages: Message[]): void {
    // Build a map from tool_use id → tool entry for quick lookup
    const toolById = new Map<string, ToolUseEntry>();
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.toolUses) continue;
      for (const tool of msg.toolUses) {
        if (tool.id) {
          toolById.set(tool.id, tool);
        }
      }
    }
    if (toolById.size === 0) return;

    // Scan user/system messages for tool_result blocks in their rawData
    for (const msg of messages) {
      if (msg.role === 'assistant') continue;

      const rawMessages = this.getRawMessages(msg);
      if (!rawMessages) continue;

      for (const entry of rawMessages) {
        if (!entry || typeof entry !== 'object') continue;
        const rec = entry as Record<string, unknown>;

        // Claude: role: user, content is array of tool_result blocks
        if (Array.isArray(rec.content)) {
          for (const block of rec.content) {
            if (!block || typeof block !== 'object') continue;
            this.checkToolResult(block as Record<string, unknown>, toolById);
          }
        }

        // OpenAI: role: tool, tool_call_id references the tool call
        if (rec.role === 'tool' && typeof rec.tool_call_id === 'string') {
          this.checkOpenAIToolResult(rec, toolById);
        }
      }
    }
  }

  /**
   * Claude tool_result error detection.
   */
  private checkToolResult(
    block: Record<string, unknown>,
    toolById: Map<string, ToolUseEntry>,
  ): void {
    if (block.type !== 'tool_result') return;

    const toolUseId = block.tool_use_id;
    if (typeof toolUseId !== 'string') return;

    const tool = toolById.get(toolUseId);
    if (!tool) return;

    if (block.is_error === true) {
      tool.status = 'error';
      return;
    }

    this.checkContentForError(block.content, tool);
  }

  /**
   * OpenAI tool result error detection.
   * OpenAI uses `{ role: "tool", tool_call_id: "<id>", content: "<json>" }`.
   */
  private checkOpenAIToolResult(
    rec: Record<string, unknown>,
    toolById: Map<string, ToolUseEntry>,
  ): void {
    const toolCallId = rec.tool_call_id as string;
    const tool = toolById.get(toolCallId);
    if (!tool) return;

    this.checkContentForError(rec.content, tool);
  }

  /**
   * Shared content error check for both Claude and OpenAI tool results.
   */
  private checkContentForError(content: unknown, tool: ToolUseEntry): void {
    if (typeof content !== 'string') return;

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (parsed.success === false || typeof parsed.error === 'string') {
        tool.status = 'error';
      }
    } catch {
      const lower = content.toLowerCase();
      if (lower.includes('error') || lower.includes('access_denied') || lower.includes('failed')) {
        tool.status = 'error';
      }
    }
  }
}
