var Yo = Object.defineProperty;
var zo = (t, e, n) => e in t ? Yo(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var w = (t, e, n) => zo(t, typeof e != "symbol" ? e + "" : e, n);
import { Ollama as Zn } from "ollama/browser";
import jn, { AzureOpenAI as Xo } from "openai";
import Qo from "@anthropic-ai/sdk";
class yt {
  /**
   * Convert internal ChatRequest to Ollama-specific format
   */
  static toOllamaRequest(e) {
    const n = e.messages.filter((a) => a.role !== "system"), o = e.system ? [{ role: "system", content: e.system }, ...n.map((a) => ({ role: a.role, content: a.content }))] : n.map((a) => ({ role: a.role, content: a.content })), i = {
      model: e.model,
      messages: o,
      stream: e.streaming !== !1
    };
    return (e.temperature !== void 0 || e.maxTokens !== void 0 || e.topP !== void 0 || e.frequencyPenalty !== void 0 || e.presencePenalty !== void 0 || e.stop !== void 0 || e.thread_id !== void 0 || e.branch_id !== void 0) && (i.options = {}, e.temperature !== void 0 && (i.options.temperature = e.temperature), e.maxTokens !== void 0 && (i.options.num_predict = e.maxTokens), e.topP !== void 0 && (i.options.top_p = e.topP), e.frequencyPenalty !== void 0 && (i.options.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (i.options.presence_penalty = e.presencePenalty), e.stop !== void 0 && (i.options.stop = e.stop), e.thread_id !== void 0 && (i.thread_id = e.thread_id), e.branch_id !== void 0 && (i.branch_id = e.branch_id)), e.responseFormat && (i.format = e.responseFormat), i;
  }
}
const te = class te {
  /**
   * Sets the iteration value in a branch ID string
   * Format: row.lane.chat (3 parts) or row.lane.chat.iteration (4 parts)
   *
   * @param branchId - Current branch ID string (e.g., "1.0.1" or "1.0.1.5")
   * @param iteration - Iteration number (0-9) to set
   * @returns New branch ID with iteration set
   */
  static setBranchIteration(e, n) {
    if (!e)
      return e;
    const o = e.split(".");
    return o.length === 3 ? `${e}.${n}` : o.length === 4 ? (o[3] = n.toString(), o.join(".")) : e;
  }
  /**
   * Generic tool loop handler that works with any provider via the ProviderToolHandler interface
   * Manages the iteration loop, thread context, and tool execution flow
   *
   * @param handler - Provider-specific tool handler implementation
   * @param model - Model identifier
   * @param initialMessages - Initial conversation messages
   * @param tools - Tool definitions in provider-specific format
   * @param originalRequest - Original chat request with potential thread_id
   * @param onToolUse - Callback to execute tools
   * @param onTokenReceived - Optional callback for streaming tokens
   * @param shouldStream - Whether to use streaming mode
   */
  static async handleToolLoop(e, n, o, i, r, a, u, c = !1) {
    var d = r.branch_id !== void 0 ? r.branch_id : "";
    console.log("[ChatProviderUtils] handleToolLoop starting", {
      model: n,
      initialMessagesCount: o.length,
      toolsCount: i.length,
      originalThreadId: r.thread_id,
      originalBranchId: d,
      shouldStream: c,
      hasOnTokenReceived: !!u,
      maxIterations: te.MAX_TOOL_ITERATIONS
    });
    let f = o;
    for (let p = 0; p < te.MAX_TOOL_ITERATIONS; p++) {
      console.log("[ChatProviderUtils] handleToolLoop - Starting iteration", {
        iteration: p,
        currentMessagesCount: f.length
      }), d = te.setBranchIteration(d, p);
      const m = {};
      r.thread_id && (m.thread_id = r.thread_id), d && (m.branch_id = d), console.log("[ChatProviderUtils] handleToolLoop - Thread context for iteration", {
        iteration: p,
        threadContext: m
      });
      const h = "setTokenCallback" in e && typeof e.setTokenCallback == "function";
      h ? (console.log("[ChatProviderUtils] handleToolLoop - Setting token callback"), e.setTokenCallback(u)) : console.log("[ChatProviderUtils] handleToolLoop - Handler does not support streaming callback"), console.log("[ChatProviderUtils] handleToolLoop - Making request to handler");
      const g = await e.makeRequest(
        n,
        f,
        i,
        m,
        c
      );
      console.log("[ChatProviderUtils] handleToolLoop - Request completed", {
        iteration: p,
        hasResponse: !!g
      });
      const T = !c || !h;
      if (console.log("[ChatProviderUtils] handleToolLoop - Text content handling", {
        iteration: p,
        shouldSendTextContent: T,
        hasStreamingCallback: h,
        shouldStream: c
      }), T) {
        const _ = e.extractTextContent(g);
        console.log("[ChatProviderUtils] handleToolLoop - Extracted text content", {
          iteration: p,
          hasTextContent: !!_,
          textContentLength: (_ == null ? void 0 : _.length) || 0,
          textPreview: (_ == null ? void 0 : _.substring(0, 100)) + "...",
          willCallOnTokenReceived: !!(_ && u)
        }), _ && u && u(_);
      }
      console.log("[ChatProviderUtils] handleToolLoop - Extracting tool uses");
      const y = e.extractToolUses(g);
      console.log("[ChatProviderUtils] handleToolLoop - Tool uses extracted", {
        iteration: p,
        toolUsesCount: y.length,
        toolUses: y.map((_) => ({ id: _.id, name: _.name, inputKeys: Object.keys(_.input) }))
      });
      const E = g ? g.stop_reason : void 0;
      if (E === "tool_use" && y.length === 0 && (console.warn('[ChatProviderUtils] handleToolLoop - MISMATCH: stop_reason="tool_use" but no tool_use blocks found in content', {
        iteration: p,
        stopReason: E,
        responseId: g.id,
        contentBlocks: g.content
      }), console.warn("[ChatProviderUtils] handleToolLoop - This may indicate a proxy is modifying Claude responses")), y.length === 0) {
        console.log("[ChatProviderUtils] handleToolLoop - No tool uses found, ending loop", {
          iteration: p,
          stopReason: E
        });
        return;
      }
      console.log("[ChatProviderUtils] handleToolLoop - Executing tools", {
        iteration: p,
        toolUsesCount: y.length
      });
      const v = [];
      for (const _ of y) {
        console.log("[ChatProviderUtils] handleToolLoop - Executing tool", {
          iteration: p,
          toolId: _.id,
          toolName: _.name,
          inputKeys: Object.keys(_.input)
        });
        const C = await a(_);
        console.log("[ChatProviderUtils] handleToolLoop - Tool execution completed", {
          iteration: p,
          toolId: _.id,
          toolName: _.name,
          resultSuccess: C == null ? void 0 : C.success,
          hasResultData: !!(C != null && C.data),
          hasResultError: !!(C != null && C.error)
        }), v.push(C);
      }
      const S = e.formatToolResults(y, v);
      f = e.appendMessages(f, g, S), console.log("[ChatProviderUtils] handleToolLoop - Iteration complete, continuing loop", {
        iteration: p,
        newMessagesCount: f.length
      }), console.log(`[ChatProviderUtils] Messages array (${f.length} messages):`), f.forEach((_, C) => {
        const A = _.content && _.content.length > 50 ? _.content.substring(0, 50) + "..." : _.content, R = [];
        _.tool_calls && R.push(`tool_calls: ${_.tool_calls.length}`), _.tool_call_id && R.push(`tool_call_id: ${_.tool_call_id}`);
        const N = R.length > 0 ? " | " + R.join(", ") : "";
        console.log(`  [${C}] {role: '${_.role}', content: ${JSON.stringify(A)}}${N}`);
      }), console.log("[ChatProviderUtils] ⟳ Calling LLM again with tool results (iteration " + (p + 1) + ")");
    }
    throw console.error("[ChatProviderUtils] handleToolLoop - Maximum iterations exceeded", {
      maxIterations: te.MAX_TOOL_ITERATIONS
    }), new Error("Tool loop exceeded maximum iterations");
  }
};
/**
 * Maximum number of tool calling iterations to prevent infinite loops
 */
w(te, "MAX_TOOL_ITERATIONS", 10);
let Z = te;
class Zo {
  constructor(e) {
    w(this, "onTokenReceived");
    this.ollama = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, n, o, i, r) {
    var a;
    if (console.log("[OllamaToolHandler] makeRequest called", {
      model: e,
      shouldStream: r,
      toolsCount: o.length,
      messagesCount: n.length,
      threadContext: i
    }), r) {
      console.log("[OllamaToolHandler] Using streaming mode");
      const u = await this.ollama.chat({
        ...i,
        model: e,
        messages: n,
        tools: o,
        stream: !0
      });
      let c = null, d = 0;
      for await (const f of u) {
        d++;
        const p = (a = f.message) == null ? void 0 : a.content;
        p && this.onTokenReceived && this.onTokenReceived(p), c = f;
      }
      return console.log("[OllamaToolHandler] Stream complete", {
        chunkCount: d,
        hasFinalMessage: !!c,
        finalMessageKeys: c ? Object.keys(c) : []
      }), c;
    } else {
      console.log("[OllamaToolHandler] Using non-streaming mode");
      const u = await this.ollama.chat({
        ...i,
        model: e,
        messages: n,
        tools: o,
        stream: !1
      });
      return console.log("[OllamaToolHandler] Non-streaming response received", {
        hasResponse: !!u,
        responseKeys: u ? Object.keys(u) : []
      }), u;
    }
  }
  extractToolUses(e) {
    const n = this.extractToolCalls(e.message);
    return console.log("[OllamaToolHandler] extractToolUses", {
      hasMessage: !!e.message,
      toolCallsCount: n.length,
      toolCalls: n.map((o) => ({ id: o.id, name: o.name }))
    }), n.map((o) => ({
      id: o.id,
      name: o.name,
      input: this.parseToolArguments(o.arguments)
    }));
  }
  extractTextContent(e) {
    var o;
    const n = ((o = e.message) == null ? void 0 : o.content) || null;
    return console.log("[OllamaToolHandler] extractTextContent", {
      hasContent: !!n,
      contentLength: (n == null ? void 0 : n.length) || 0
    }), n;
  }
  formatToolResults(e, n) {
    return e.map((o, i) => ({
      id: o.id,
      result: JSON.stringify(n[i])
    }));
  }
  appendMessages(e, n, o) {
    var r, a;
    console.log("[OllamaToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length,
      hasResponseMessage: !!n.message
    });
    const i = [
      ...e,
      {
        role: "assistant",
        content: ((r = n.message) == null ? void 0 : r.content) || "",
        tool_calls: ((a = n.message) == null ? void 0 : a.tool_calls) || []
      }
    ];
    for (const u of o)
      i.push({
        role: "tool",
        content: u.result
      });
    return console.log("[OllamaToolHandler] appendMessages complete", {
      newMessagesCount: i.length
    }), i;
  }
  /**
   * Extract tool calls from Ollama message
   */
  extractToolCalls(e) {
    return !(e != null && e.tool_calls) || !Array.isArray(e.tool_calls) ? [] : e.tool_calls.map((n, o) => {
      var i, r;
      return {
        id: n.id || `tool_${o}`,
        name: ((i = n.function) == null ? void 0 : i.name) || n.name || "",
        arguments: ((r = n.function) == null ? void 0 : r.arguments) || n.arguments || {}
      };
    });
  }
  /**
   * Parse tool arguments from various formats
   */
  parseToolArguments(e) {
    if (!e)
      return {};
    if (typeof e == "string")
      try {
        return JSON.parse(e);
      } catch {
        return { value: e };
      }
    return typeof e == "object" ? e : { value: e };
  }
}
class jo {
  constructor(e, n, o) {
    w(this, "ollama");
    w(this, "defaultModel");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "toolHandler");
    this.ollama = new Zn({ host: e, headers: {
      "X-api-key": n
    } }), this.defaultModel = o, console.log(`OllamaChatProvider initialized with endpoint ${e} and model ${o}`);
  }
  setTools(e = [], n, o) {
    this.tools = e, this.onToolUse = n, this.toolHandler = new Zo(this.ollama);
  }
  /**
   * Send a chat request to Ollama
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    var a, u;
    if (this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, n);
      return;
    }
    const o = e.model || this.defaultModel, i = { ...e, model: o }, r = yt.toOllamaRequest(i);
    try {
      if (r.stream) {
        const c = await this.ollama.chat(r);
        for await (const d of c) {
          const f = (a = d.message) == null ? void 0 : a.content;
          f && n && n(f);
        }
      } else {
        const d = (u = (await this.ollama.chat(r)).message) == null ? void 0 : u.content;
        d && n && n(d);
      }
    } catch (c) {
      throw console.error("Error in Ollama API call:", c), c;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, n) {
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const o = e.model || this.defaultModel, i = { ...e, model: o }, r = yt.toOllamaRequest(i), a = this.convertToolsToOllamaFormat(this.tools);
    try {
      await Z.handleToolLoop(
        this.toolHandler,
        r.model,
        r.messages || [],
        a,
        e,
        this.onToolUse,
        n,
        e.streaming !== !1
      );
    } catch (u) {
      throw console.error("[OllamaChatProvider] Tool-enabled chat failed:", u), u;
    }
  }
  /**
   * Convert ToolDefinition to Ollama's tools format
   */
  convertToolsToOllamaFormat(e) {
    return e.map((n) => ({
      type: "function",
      function: {
        name: n.name,
        description: n.description,
        parameters: n.input_schema
      }
    }));
  }
  /**
   * Extract tool calls from Ollama response
   */
  extractToolCalls(e) {
    return !e.tool_calls || !Array.isArray(e.tool_calls) ? [] : e.tool_calls.map((n, o) => ({
      id: `call_${Date.now()}_${o}`,
      name: n.function.name,
      arguments: n.function.arguments
    }));
  }
  /**
   * Parse tool arguments from string or object
   * Ollama returns arguments as an object, while other providers return a JSON string
   */
  parseToolArguments(e) {
    if (!e)
      return {};
    if (typeof e == "object" && !Array.isArray(e))
      return e;
    if (typeof e == "string")
      try {
        const n = JSON.parse(e);
        return n && typeof n == "object" && !Array.isArray(n) ? n : {};
      } catch (n) {
        return console.warn("[OllamaChatProvider] Failed to parse tool arguments", { error: n, raw: e }), {};
      }
    return {};
  }
}
class Oe {
  /**
   * Map internal message format to OpenAI's ChatCompletionMessageParam
   */
  static mapMessage(e, n = !1) {
    const i = ["system", "user", "assistant", "function", "tool"].includes(e.role) ? e.role : "user", r = !!e.tool_calls, a = e.content !== void 0 && e.content !== null;
    return {
      role: i,
      // Type cast to satisfy TypeScript
      ...a ? { content: e.content } : n && i === "assistant" && r && !a ? { content: "" } : {},
      ...e.tool_calls ? { tool_calls: e.tool_calls } : {},
      ...e.tool_call_id ? { tool_call_id: e.tool_call_id } : {}
    };
  }
  /**
   * Convert internal ChatRequest to OpenAI-specific format
   */
  static toOpenAIRequest(e, n) {
    if (e) {
      let o;
      if (n.system) {
        const r = n.messages.filter((a) => a.role !== "system");
        o = [
          { role: "system", content: n.system },
          ...r.map((a) => a.type === "function_call_output" ? a : this.mapMessage(a, !0))
        ];
      } else
        o = n.messages.map((r) => r.type === "function_call_output" ? r : this.mapMessage(r, !0));
      const i = {
        model: n.model,
        input: o,
        // Responses API uses 'input' not 'messages'
        stream: n.streaming !== !1
      };
      if (n.maxTokens !== void 0 && (i.max_output_tokens = n.maxTokens), n.thread_id !== void 0 && (i.thread_id = n.thread_id), n.branch_id !== void 0 && (i.branch_id = n.branch_id), n.tools !== void 0) {
        const r = n.tools;
        i.tools = r.map((a) => {
          const u = {
            type: "function",
            name: a.function.name,
            description: a.function.description,
            parameters: {
              ...a.function.parameters,
              additionalProperties: !1
            }
          };
          return a.function.strict !== void 0 && (u.strict = a.function.strict), u;
        });
      }
      return i;
    } else {
      let o;
      if (n.system) {
        const r = n.messages.filter((a) => a.role !== "system");
        o = [
          { role: "system", content: n.system },
          ...r.map((a) => this.mapMessage(a, !1))
        ];
      } else
        o = n.messages.map((r) => this.mapMessage(r, !1));
      const i = {
        model: n.model,
        messages: o,
        stream: n.streaming !== !1
      };
      return n.temperature !== void 0 && (i.temperature = n.temperature), n.maxTokens !== void 0 && (i.max_completion_tokens = n.maxTokens), n.topP !== void 0 && (i.top_p = n.topP), n.frequencyPenalty !== void 0 && (i.frequency_penalty = n.frequencyPenalty), n.presencePenalty !== void 0 && (i.presence_penalty = n.presencePenalty), n.stop !== void 0 && (i.stop = n.stop), n.responseFormat !== void 0 && (i.response_format = n.responseFormat), n.thread_id !== void 0 && (i.thread_id = n.thread_id), n.branch_id !== void 0 && (i.branch_id = n.branch_id), n.tools !== void 0 && (i.tools = n.tools), n.responseFormat !== void 0 && (i.response_format = {
        type: "json_schema",
        json_schema: {
          name: "schema_name",
          schema: n.responseFormat,
          strict: !0
        }
      }), i;
    }
  }
}
class ye {
  constructor(e) {
    w(this, "lastResponseId");
    this.client = e;
  }
  /**
   * Convert Responses API function_call outputs to ChatCompletion format
   * This allows the tool handler to process them using the standard interface
   */
  convertFunctionCallsToCompletion(e, n) {
    const o = e.map((i) => ({
      id: i.call_id,
      type: "function",
      function: {
        name: i.name,
        arguments: i.arguments
      }
    }));
    return {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1e3),
      model: n,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: o
        },
        finish_reason: "tool_calls",
        logprobs: null
      }]
    };
  }
  /**
   * DEPRECATED: Old text-based parsing (no longer needed)
   * Responses API returns structured function_call outputs
   */
  parseToolCallFromText_UNUSED(e, n) {
    if (!e) return null;
    let o = null;
    try {
      o = JSON.parse(e.trim());
    } catch {
      const u = e.match(/^\s*(\{[^]*?\})\s*[\s\S]*/);
      if (u && u[1])
        try {
          o = JSON.parse(u[1]);
        } catch {
          let d = 0, f = -1;
          const p = e.trim();
          if (p[0] === "{") {
            for (let m = 0; m < p.length; m++)
              if (p[m] === "{" ? d++ : p[m] === "}" && d--, d === 0) {
                f = m + 1;
                break;
              }
            if (f > 0)
              try {
                o = JSON.parse(p.substring(0, f));
              } catch {
              }
          }
        }
    }
    if (!o) return null;
    let i = null, r = {};
    if (o.name && typeof o.name == "string" && o.arguments && typeof o.arguments == "object")
      i = o.name, r = o.arguments;
    else if (o.tool && typeof o.tool == "string") {
      i = o.tool;
      const { tool: a, ...u } = o;
      r = u;
    }
    return i ? (console.log("[ResponsesHandler] Successfully parsed tool call:", {
      toolName: i,
      argumentsKeys: Object.keys(r)
    }), {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1e3),
      model: n,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: `call_${Date.now()}`,
            type: "function",
            function: {
              name: i,
              arguments: JSON.stringify(r)
            }
          }]
        },
        finish_reason: "tool_calls",
        logprobs: null
      }]
    }) : null;
  }
  /* ORIGINAL IMPLEMENTATION FROM OpenAIChatProvider.chat() - PRESERVED FOR REFERENCE
  
      if (isResponse) {
          // Handle Responses API streaming (different event structure)
          const stream = await this.client.responses.create(openaiRequest) as any;
  
          for await (const streamEvent of stream) {
              // Handle top-level text_delta events (not wrapped)
              if (streamEvent.type === 'text_delta') {
                  if (streamEvent.text && onTokenReceived) {
                      onTokenReceived(streamEvent.text);
                  }
                  continue;
              }
  
              // Handle done event (stream completion)
              if (streamEvent.type === 'done') {
                  break;
              }
  
              // Events may be wrapped: { type: "stream_event", event: {...} }
              const event = streamEvent.event || streamEvent;
  
              if (event.type === 'response.content_part.added') {
                  // Content part added - extract initial text
                  const part = event.part;
                  if (part?.type === 'output_text' && part.text) {
                      if (onTokenReceived) {
                          onTokenReceived(part.text);
                      }
                  }
              } else if (event.type === 'response.output_text.delta') {
                  // Handle output text deltas (wrapped events)
                  if (event.delta && onTokenReceived) {
                      onTokenReceived(event.delta);
                  }
              } else if (event.type === 'response.content_part.delta') {
                  // Handle incremental content deltas (older format)
                  const delta = event.delta;
                  if (delta?.text && onTokenReceived) {
                      onTokenReceived(delta.text);
                  }
              } else if (event.type === 'response.output_item.done') {
                  // Item completed - check for any remaining content
                  const item = event.item;
                  if (item?.type === 'message' && item.content && Array.isArray(item.content)) {
                      for (const contentPart of item.content) {
                          if (contentPart.type === 'output_text' && contentPart.text) {
                              if (onTokenReceived) {
                                  onTokenReceived(contentPart.text);
                              }
                          }
                      }
                  }
              }
          }
      }
  
      END ORIGINAL IMPLEMENTATION */
  /**
   * Handle streaming Responses API request
   * Responses API has a different event structure than Chat Completions
   * Returns ChatCompletion if tool calls are detected, void otherwise
   */
  async chatStreaming(e, n, o) {
    var i, r, a;
    try {
      this.lastResponseId && (e.previous_response_id = this.lastResponseId), console.log("[ResponsesHandler] Streaming - Calling API with request:", {
        model: e.model,
        hasInput: !!e.input,
        inputCount: (i = e.input) == null ? void 0 : i.length,
        hasPreviousResponseId: !!e.previous_response_id,
        stream: e.stream
      });
      const u = await this.client.responses.create(e);
      let c = 0, d = "", f = [], p;
      for await (const m of u) {
        if (c++, (r = m.response) != null && r.id && (p = m.response.id), m.type === "text_delta") {
          m.text && o && (d += m.text, o(m.text));
          continue;
        }
        if (m.type === "done") {
          m.response && (p = m.response.id, f = ((a = m.response.output) == null ? void 0 : a.filter((g) => g.type === "function_call")) || []);
          break;
        }
        const h = m.event || m;
        if (h.type === "response.content_part.added") {
          const g = h.part;
          (g == null ? void 0 : g.type) === "output_text" && g.text && (d += g.text, o && o(g.text));
        } else if (h.type === "response.output_text.delta")
          h.delta && o && (d += h.delta, o(h.delta));
        else if (h.type === "response.content_part.delta") {
          const g = h.delta;
          g != null && g.text && o && (d += g.text, o(g.text));
        } else if (h.type === "response.output_item.done") {
          const g = h.item;
          if ((g == null ? void 0 : g.type) === "function_call")
            f.push(g);
          else if ((g == null ? void 0 : g.type) === "message" && g.content && Array.isArray(g.content))
            for (const T of g.content)
              T.type === "output_text" && T.text && (d += T.text, o && o(T.text));
        }
      }
      return p && (this.lastResponseId = p), console.log("[ResponsesHandler] Stream complete", {
        chunkCount: c,
        accumulatedTextLength: d.length,
        functionCallsCount: f.length,
        responseId: p
      }), f.length > 0 ? (console.log("[ResponsesHandler] Detected function calls in stream:", {
        count: f.length,
        calls: f.map((m) => ({ name: m.name, call_id: m.call_id }))
      }), this.convertFunctionCallsToCompletion(f, e.model)) : void 0;
    } catch (u) {
      throw console.error("[ResponsesHandler] Streaming request failed:", u), u;
    }
  }
  /**
   * Handle non-streaming Responses API request
   * Returns ChatCompletion if tool calls are detected, void otherwise
   */
  async chatNonStreaming(e, n, o) {
    var i, r, a, u, c;
    try {
      this.lastResponseId && (e.previous_response_id = this.lastResponseId), console.log("[ResponsesHandler] Non-streaming - Calling API with request:", {
        model: e.model,
        hasInput: !!e.input,
        inputCount: (i = e.input) == null ? void 0 : i.length,
        hasPreviousResponseId: !!e.previous_response_id,
        stream: e.stream
      }), console.log("[ResponsesHandler] ===== FULL REQUEST OBJECT ====="), console.log(JSON.stringify(e, null, 2)), console.log("[ResponsesHandler] ===== END REQUEST =====");
      const d = await this.client.responses.create(e);
      this.lastResponseId = d.id, console.log("[ResponsesHandler] ===== FULL RESPONSE OBJECT ====="), console.log(JSON.stringify(d, null, 2)), console.log("[ResponsesHandler] ===== END RESPONSE ====="), console.log("[ResponsesHandler] Response summary:", {
        responseId: d.id,
        hasOutput: !!d.output,
        outputLength: (r = d.output) == null ? void 0 : r.length,
        outputTypes: (a = d.output) == null ? void 0 : a.map((g) => g.type)
      });
      const f = ((u = d.output) == null ? void 0 : u.filter((g) => g.type === "function_call")) || [];
      if (f.length > 0)
        return console.log("[ResponsesHandler] Detected function calls:", {
          count: f.length,
          calls: f.map((g) => ({ name: g.name, call_id: g.call_id }))
        }), this.convertFunctionCallsToCompletion(f, e.model);
      const p = ((c = d.output) == null ? void 0 : c.filter((g) => g.type === "message")) || [], m = [];
      for (const g of p)
        if (g.content)
          for (const T of g.content)
            T.type === "output_text" && T.text && m.push(T.text);
      const h = m.join(`

`);
      console.log("[ResponsesHandler] Extracted text content:", {
        contentLength: h == null ? void 0 : h.length,
        contentPreview: h == null ? void 0 : h.substring(0, 100)
      }), h && o && o(h);
      return;
    } catch (d) {
      throw console.error("[ResponsesHandler] Non-streaming request failed:", d), d;
    }
  }
}
class ei {
  constructor(e, n) {
    w(this, "onTokenReceived");
    this.client = e, this.chatHandler = n;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, n, o, i, r) {
    return r ? await this.makeStreamingRequest(e, n, o, i) : await this.makeNonStreamingRequest(e, n, o, i);
  }
  extractToolUses(e) {
    var o, i, r;
    if (!e || !e.choices)
      return [];
    const n = e.choices[0];
    if ((n == null ? void 0 : n.finish_reason) === "tool_calls" || (o = n == null ? void 0 : n.message) != null && o.tool_calls) {
      const a = (i = n == null ? void 0 : n.message) == null ? void 0 : i.tool_calls;
      if (a && a.length > 0)
        return a.map((c) => ({
          id: c.id,
          name: c.function.name,
          input: this.parseToolArguments(c.function.arguments)
        }));
    }
    if ((n == null ? void 0 : n.finish_reason) === "function_call") {
      const a = (r = n == null ? void 0 : n.message) == null ? void 0 : r.function_call;
      if (a)
        return [{
          id: `call_${Date.now()}`,
          name: a.name,
          input: this.parseToolArguments(a.arguments || "{}")
        }];
    }
    return [];
  }
  extractTextContent(e) {
    var o, i;
    return !e || !e.choices ? null : ((i = (o = e.choices[0]) == null ? void 0 : o.message) == null ? void 0 : i.content) || null;
  }
  formatToolResults(e, n) {
    return this.chatHandler instanceof ye ? e.map((i, r) => ({
      type: "function_call_output",
      call_id: i.id,
      output: JSON.stringify(n[r])
    })) : e.map((i, r) => ({
      role: "tool",
      tool_call_id: i.id,
      content: JSON.stringify(n[r])
    }));
  }
  appendMessages(e, n, o) {
    const i = this.chatHandler instanceof ye;
    if (!n || !n.choices || !n.choices[0])
      return [...e, ...o];
    if (i)
      return o;
    {
      const r = n.choices[0].message.content, a = n.choices[0].message.tool_calls, u = {
        role: "assistant",
        ...r ? { content: r } : {},
        ...a ? { tool_calls: a } : {}
      };
      return [
        ...e,
        u,
        ...o
      ];
    }
  }
  /**
   * Make a streaming request to OpenAI API
   */
  async makeStreamingRequest(e, n, o, i) {
    try {
      const r = Date.now(), a = {
        ...i,
        model: e,
        messages: n,
        // Keep as internal ChatMessage[] format
        tools: o,
        streaming: !0
      }, u = this.chatHandler instanceof ye, c = Oe.toOpenAIRequest(u, a), d = await this.chatHandler.chatStreaming(
        c,
        e,
        this.onTokenReceived
      ), f = Date.now() - r;
      return d;
    } catch (r) {
      throw console.log({
        error: r,
        errorMessage: r instanceof Error ? r.message : String(r),
        errorStack: r instanceof Error ? r.stack : void 0
      }), r;
    }
  }
  /**
   * Make a non-streaming request to OpenAI API
   */
  async makeNonStreamingRequest(e, n, o, i) {
    try {
      const r = Date.now(), a = {
        ...i,
        model: e,
        messages: n,
        // Keep as internal ChatMessage[] format
        tools: o,
        streaming: !1
      }, u = this.chatHandler instanceof ye, c = Oe.toOpenAIRequest(u, a), d = await this.chatHandler.chatNonStreaming(
        c,
        e,
        this.onTokenReceived
      ), f = Date.now() - r;
      return d;
    } catch (r) {
      throw console.log({
        error: r,
        errorMessage: r instanceof Error ? r.message : String(r),
        errorStack: r instanceof Error ? r.stack : void 0
      }), r;
    }
  }
  /**
   * Parse tool arguments from string
   */
  parseToolArguments(e) {
    if (!e)
      return {};
    try {
      const n = JSON.parse(e);
      return n && typeof n == "object" && !Array.isArray(n) ? n : {};
    } catch (n) {
      return console.log({ error: n }), {};
    }
  }
}
class ti {
  constructor(e) {
    this.client = e;
  }
  /**
   * Handle streaming Chat Completions request
   */
  async chatStreaming(e, n, o) {
    var i, r, a, u;
    try {
      const c = await this.client.chat.completions.create(e);
      let d = "", f = [], p = null, m = 0;
      for await (const h of c) {
        m++;
        const g = h.choices[0], T = g == null ? void 0 : g.delta;
        if (T != null && T.content && (d += T.content, o && o(T.content)), T != null && T.tool_calls)
          for (const y of T.tool_calls) {
            const E = y.index;
            f[E] ? (y.id && (f[E].id += y.id), (a = y.function) != null && a.name && (f[E].function.name += y.function.name), (u = y.function) != null && u.arguments && (f[E].function.arguments += y.function.arguments)) : f[E] = {
              id: y.id || "",
              type: "function",
              function: {
                name: ((i = y.function) == null ? void 0 : i.name) || "",
                arguments: ((r = y.function) == null ? void 0 : r.arguments) || ""
              }
            };
          }
        g != null && g.finish_reason && (p = g.finish_reason);
      }
      return console.log("[ChatCompletionsHandler] Stream complete", {
        chunkCount: m,
        accumulatedContentLength: d.length,
        toolCallsCount: f.length,
        finishReason: p
      }), {
        choices: [
          {
            finish_reason: p || "stop",
            message: {
              role: "assistant",
              content: d || null,
              tool_calls: f.length > 0 ? f : void 0
            },
            index: 0,
            logprobs: null
          }
        ],
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1e3),
        model: n
      };
    } catch (c) {
      throw console.error("[ChatCompletionsHandler] Streaming request failed:", c), c;
    }
  }
  /**
   * Handle non-streaming Chat Completions request
   */
  async chatNonStreaming(e, n, o) {
    var i, r, a, u;
    try {
      console.log("[ChatCompletionsHandler] Calling API with request:", {
        model: e.model,
        hasMessages: !!e.messages,
        messagesCount: (i = e.messages) == null ? void 0 : i.length,
        hasTools: !!e.tools,
        stream: e.stream
      });
      const c = await this.client.chat.completions.create(e);
      if (console.log("[ChatCompletionsHandler] Response received:", {
        hasResponse: !!c,
        hasChoices: !!(c != null && c.choices),
        choicesCount: (r = c == null ? void 0 : c.choices) == null ? void 0 : r.length,
        responseKeys: c ? Object.keys(c) : []
      }), !(c != null && c.choices))
        throw console.error("[ChatCompletionsHandler] Invalid response structure:", c), new Error("Response missing choices array");
      const d = ((u = (a = c.choices[0]) == null ? void 0 : a.message) == null ? void 0 : u.content) || "";
      return d && o && o(d), c;
    } catch (c) {
      throw console.error("[ChatCompletionsHandler] Non-streaming request failed:", c), c;
    }
  }
}
class ni {
  /**
   * Create the appropriate handler based on endpoint type
   */
  static create(e, n) {
    return n === "RESPONSE" ? new ye(e) : new ti(e);
  }
}
class eo {
  constructor(e, n, o) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "toolHandler");
    w(this, "chatHandler");
    w(this, "endpointType", "CHAT");
    this.client = new jn({ apiKey: n, baseURL: e, dangerouslyAllowBrowser: !0 }), this.defaultModel = o || "gpt-5.2-chat-latest";
  }
  setTools(e = [], n, o) {
    this.tools = e, this.onToolUse = n;
  }
  /**
   * Determines the appropriate endpoint type based on the model name
   * @param modelName - The OpenAI model name
   * @returns The endpoint type (CHAT or RESPONSE)
   */
  getEndpointType(e) {
    const n = e.toLowerCase();
    return n.startsWith("gpt-5") || n.includes("-pro") || n.includes("-reasoning") || n.startsWith("o") ? "RESPONSE" : n.includes("-chat") || n.startsWith("gpt-4") || n.startsWith("gpt-3.5") || n.startsWith("chatgpt") ? "CHAT" : "RESPONSE";
  }
  /**
   * Send a chat request to OpenAI
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    this.endpointType = this.getEndpointType(e.model);
    const o = this.endpointType === "RESPONSE";
    if (this.chatHandler = ni.create(this.client, this.endpointType), console.log(`OpenAI Chat Provider | model: ${e.model || this.defaultModel} | streaming: ${e.streaming !== !1} | hasTools: ${this.tools.length > 0} | toolCount: ${this.tools.length}`), this.tools.length > 0 && this.onToolUse) {
      this.toolHandler || (this.toolHandler = new ei(this.client, this.chatHandler)), await this.chatWithTools(e, n);
      return;
    }
    const i = e.model || this.defaultModel, r = Oe.toOpenAIRequest(o, { ...e, model: i });
    try {
      if (e.streaming !== !1) {
        const a = await this.chatHandler.chatStreaming(r, i, n);
      } else {
        const a = await this.chatHandler.chatNonStreaming(r, i, n);
      }
    } catch (a) {
      throw console.error("Error in OpenAI API call:", a), a;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, n) {
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    try {
      const o = this.endpointType === "RESPONSE", i = e.model || this.defaultModel, r = this.convertToolsToOpenAIFormat(this.tools);
      await Z.handleToolLoop(
        this.toolHandler,
        e.model,
        e.messages,
        r,
        e,
        this.onToolUse,
        n,
        e.streaming !== !1
      );
    } catch (o) {
      throw o;
    }
  }
  /**
   * Convert ToolDefinition to OpenAI's tools format (new API)
   */
  convertToolsToOpenAIFormat(e) {
    return e.map((n) => ({
      type: "function",
      function: {
        name: n.name,
        description: n.description,
        parameters: n.input_schema
      }
    }));
  }
}
class Tt {
  /**
   * Map internal message role to Claude's expected format
   */
  static mapRole(e) {
    switch (e.toLowerCase()) {
      case "assistant":
        return "assistant";
      case "user":
      default:
        return "user";
    }
  }
  /**
   * Convert internal ChatMessage to Claude's MessageParam format
   */
  static mapMessage(e) {
    return {
      role: this.mapRole(e.role),
      content: e.content
    };
  }
  /**
   * Convert internal ChatRequest to Claude-specific format
   */
  static toClaudeRequest(e) {
    const n = e.messages.filter((i) => i.role !== "system"), o = {
      model: e.model,
      messages: n.map((i) => this.mapMessage(i)),
      stream: e.streaming !== !1
    };
    if (e.system) {
      let i = e.system;
      if (e.responseFormat) {
        const r = `

You must respond with valid JSON that matches this exact schema:
\`\`\`json
${JSON.stringify(e.responseFormat, null, 2)}
\`\`\`

Respond only with the JSON, no other text.`;
        i += r;
      }
      o.system = i;
    }
    return e.temperature !== void 0 && (o.temperature = e.temperature), e.maxTokens !== void 0 ? o.max_tokens = e.maxTokens : o.max_tokens = 64e3, e.topP !== void 0 && (o.top_p = e.topP), e.stop !== void 0 && (o.stop_sequences = e.stop), e.thread_id !== void 0 && (o.thread_id = e.thread_id), e.branch_id !== void 0 && (o.branch_id = e.branch_id), o;
  }
}
class oi {
  constructor(e) {
    w(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   * This is called before each tool loop iteration to update the callback
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, n, o, i, r) {
    return r ? await this.makeStreamingRequest(e, n, o, i) : await this.makeNonStreamingRequest(e, n, o, i);
  }
  extractToolUses(e) {
    console.log("[ClaudeToolHandler] extractToolUses - Full response", {
      responseId: e.id,
      model: e.model,
      stopReason: e.stop_reason,
      contentBlocks: e.content.map((o) => ({
        type: o.type,
        ...o.type === "tool_use" ? {
          id: o.id,
          name: o.name,
          input: o.input
        } : {},
        ...o.type === "text" ? {
          text: o.text.substring(0, 100) + "..."
        } : {}
      }))
    });
    const n = this.extractToolUseBlocks(e.content);
    return console.log("[ClaudeToolHandler] extractToolUses - Extracted tools", {
      contentBlocksCount: e.content.length,
      toolUseBlocksCount: n.length,
      toolUses: n.map((o) => ({
        id: o.id,
        name: o.name,
        inputKeys: Object.keys(o.input)
      }))
    }), n.map((o) => ({
      id: o.id,
      name: o.name,
      input: o.input
    }));
  }
  extractTextContent(e) {
    const n = e.content.filter((o) => o.type === "text").map((o) => o.text).join("");
    return console.log("[ClaudeToolHandler] extractTextContent", {
      hasContent: !!n,
      contentLength: (n == null ? void 0 : n.length) || 0
    }), n || null;
  }
  formatToolResults(e, n) {
    return e.map((o, i) => {
      const r = n[i];
      return {
        type: "tool_result",
        tool_use_id: o.id,
        content: JSON.stringify({
          success: (r == null ? void 0 : r.success) ?? !1,
          data: (r == null ? void 0 : r.data) ?? null,
          error: (r == null ? void 0 : r.error) ?? null
        })
      };
    });
  }
  appendMessages(e, n, o) {
    const i = {
      role: "assistant",
      content: n.content
    }, r = {
      role: "user",
      content: o
    };
    return [
      ...e,
      i,
      r
    ];
  }
  /**
   * Make a streaming request to Claude API
   * Streams text tokens in real-time while collecting the final message for tool extraction
   */
  async makeStreamingRequest(e, n, o, i) {
    var r, a;
    console.log("[ClaudeToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: n.length,
      toolsCount: o.length,
      threadContext: i
    });
    try {
      const u = Date.now();
      let c = 0, d = 0;
      const f = {
        model: e,
        messages: n,
        tools: o,
        max_tokens: 4096,
        ...i
      };
      console.log("[ClaudeToolHandler] Creating stream with params", {
        model: e,
        messagesCount: n.length,
        toolsCount: o.length,
        threadContext: i,
        max_tokens: 4096,
        fullParams: JSON.stringify(f, null, 2).substring(0, 500)
      });
      let p;
      try {
        p = this.client.messages.stream(f), console.log("[ClaudeToolHandler] Stream object created successfully", {
          baseURL: this.client.baseURL,
          hasApiKey: !!this.client.apiKey
        });
      } catch (y) {
        throw console.error("[ClaudeToolHandler] Failed to create stream", {
          error: y,
          errorMessage: y instanceof Error ? y.message : String(y)
        }), y;
      }
      p = p.on("connect", () => {
        console.log("[ClaudeToolHandler] Stream connect event");
      }).on("text", (y) => {
        c++, console.log("[ClaudeToolHandler] Stream text event", {
          tokenCount: c,
          textLength: y.length,
          textPreview: y.substring(0, 50)
        }), this.onTokenReceived && this.onTokenReceived(y);
      }).on("contentBlock", (y) => {
        d++, console.log("[ClaudeToolHandler] Stream contentBlock event", {
          contentBlockCount: d,
          blockType: y.type,
          ...y.type === "tool_use" ? {
            toolId: y.id,
            toolName: y.name
          } : {}
        });
      }).on("message", (y) => {
        console.log("[ClaudeToolHandler] Stream message event", {
          messageId: y.id,
          stopReason: y.stop_reason,
          contentBlocksCount: y.content.length,
          contentTypes: y.content.map((E) => E.type)
        });
      }).on("error", (y) => {
        console.error("[ClaudeToolHandler] Stream error event", {
          error: y,
          errorMessage: y instanceof Error ? y.message : String(y)
        });
      }), console.log("[ClaudeToolHandler] Stream started, waiting for final message");
      const m = 3e4, h = new Promise((y, E) => {
        setTimeout(() => E(new Error(`Stream timeout after ${m}ms`)), m);
      }), g = await Promise.race([
        p.finalMessage(),
        h
      ]), T = Date.now() - u;
      return console.log("[ClaudeToolHandler] makeStreamingRequest complete", {
        duration: `${T}ms`,
        hasMessage: !!g,
        responseId: g.id,
        model: g.model,
        stopReason: g.stop_reason,
        contentBlocksCount: ((r = g.content) == null ? void 0 : r.length) || 0,
        contentBlockTypes: ((a = g.content) == null ? void 0 : a.map((y) => y.type)) || [],
        totalTokensStreamed: c,
        usage: g.usage
      }), g;
    } catch (u) {
      throw console.error("[ClaudeToolHandler] makeStreamingRequest failed", {
        error: u,
        errorMessage: u instanceof Error ? u.message : String(u),
        errorStack: u instanceof Error ? u.stack : void 0
      }), u;
    }
  }
  /**
   * Make a non-streaming request to Claude API
   */
  async makeNonStreamingRequest(e, n, o, i) {
    var r, a;
    try {
      const u = Date.now(), c = await this.client.messages.create({
        model: e,
        messages: n,
        tools: o,
        max_tokens: 4096,
        stream: !1,
        ...i
      }), d = Date.now() - u;
      return console.log("[ClaudeToolHandler] makeNonStreamingRequest response received", {
        duration: `${d}ms`,
        hasResponse: !!c,
        responseId: c.id,
        model: c.model,
        stopReason: c.stop_reason,
        contentBlocksCount: ((r = c.content) == null ? void 0 : r.length) || 0,
        contentBlockTypes: ((a = c.content) == null ? void 0 : a.map((f) => f.type)) || [],
        usage: c.usage
      }), c;
    } catch (u) {
      throw console.error("[ClaudeToolHandler] makeNonStreamingRequest failed", {
        error: u,
        errorMessage: u instanceof Error ? u.message : String(u),
        errorStack: u instanceof Error ? u.stack : void 0
      }), u;
    }
  }
  /**
   * Extract tool_use blocks from response content
   */
  extractToolUseBlocks(e) {
    return e.filter((n) => n.type === "tool_use");
  }
}
class ii {
  constructor(e, n, o) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "toolHandler");
    this.client = new Qo({
      apiKey: n,
      dangerouslyAllowBrowser: !0
    }), e && (this.client.baseURL = e), this.defaultModel = o || "claude-3-opus-20240229", console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}`);
  }
  setTools(e = [], n, o) {
    this.tools = e, this.onToolUse = n, this.toolHandler = new oi(this.client);
  }
  /**
   * Send a chat request to Claude
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    if (this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, n);
      return;
    }
    const o = e.model || this.defaultModel, i = Tt.toClaudeRequest({ ...e, model: o });
    try {
      if (e.streaming !== !1)
        await this.client.messages.stream(i).on("text", (a) => {
          n && n(a);
        }).finalMessage();
      else {
        const r = await this.client.messages.create(i);
        if (r.content && r.content.length > 0) {
          const a = r.content.filter((u) => u.type === "text").map((u) => u.text).join("");
          n && n(a);
        }
      }
    } catch (r) {
      throw console.error("Error in Claude API call:", r), r;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, n) {
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const o = e.model || this.defaultModel, i = Tt.toClaudeRequest({ ...e, model: o }), r = this.convertToolsToClaudeFormat(this.tools);
    try {
      await Z.handleToolLoop(
        this.toolHandler,
        i.model,
        i.messages,
        r,
        e,
        this.onToolUse,
        n,
        !1
      );
    } catch (a) {
      throw console.error("[ClaudeChatProvider] Tool-enabled chat failed:", a), a;
    }
  }
  /**
   * Convert ToolDefinition to Claude's tool format
   */
  convertToolsToClaudeFormat(e) {
    return e.map((n) => ({
      name: n.name,
      description: n.description,
      input_schema: n.input_schema
    }));
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
let si, ri;
function li() {
  return {
    geminiUrl: si,
    vertexUrl: ri
  };
}
function ai(t, e, n, o) {
  var i, r;
  if (!(t != null && t.baseUrl)) {
    const a = li();
    return e ? (i = a.vertexUrl) !== null && i !== void 0 ? i : n : (r = a.geminiUrl) !== null && r !== void 0 ? r : o;
  }
  return t.baseUrl;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class X {
}
function I(t, e) {
  const n = /\{([^}]+)\}/g;
  return t.replace(n, (o, i) => {
    if (Object.prototype.hasOwnProperty.call(e, i)) {
      const r = e[i];
      return r != null ? String(r) : "";
    } else
      throw new Error(`Key '${i}' not found in valueMap.`);
  });
}
function l(t, e, n) {
  for (let r = 0; r < e.length - 1; r++) {
    const a = e[r];
    if (a.endsWith("[]")) {
      const u = a.slice(0, -2);
      if (!(u in t))
        if (Array.isArray(n))
          t[u] = Array.from({ length: n.length }, () => ({}));
        else
          throw new Error(`Value must be a list given an array path ${a}`);
      if (Array.isArray(t[u])) {
        const c = t[u];
        if (Array.isArray(n))
          for (let d = 0; d < c.length; d++) {
            const f = c[d];
            l(f, e.slice(r + 1), n[d]);
          }
        else
          for (const d of c)
            l(d, e.slice(r + 1), n);
      }
      return;
    } else if (a.endsWith("[0]")) {
      const u = a.slice(0, -3);
      u in t || (t[u] = [{}]);
      const c = t[u];
      l(c[0], e.slice(r + 1), n);
      return;
    }
    (!t[a] || typeof t[a] != "object") && (t[a] = {}), t = t[a];
  }
  const o = e[e.length - 1], i = t[o];
  if (i !== void 0) {
    if (!n || typeof n == "object" && Object.keys(n).length === 0 || n === i)
      return;
    if (typeof i == "object" && typeof n == "object" && i !== null && n !== null)
      Object.assign(i, n);
    else
      throw new Error(`Cannot set value for an existing key. Key: ${o}`);
  } else
    o === "_self" && typeof n == "object" && n !== null && !Array.isArray(n) ? Object.assign(t, n) : t[o] = n;
}
function s(t, e, n = void 0) {
  try {
    if (e.length === 1 && e[0] === "_self")
      return t;
    for (let o = 0; o < e.length; o++) {
      if (typeof t != "object" || t === null)
        return n;
      const i = e[o];
      if (i.endsWith("[]")) {
        const r = i.slice(0, -2);
        if (r in t) {
          const a = t[r];
          return Array.isArray(a) ? a.map((u) => s(u, e.slice(o + 1), n)) : n;
        } else
          return n;
      } else
        t = t[i];
    }
    return t;
  } catch (o) {
    if (o instanceof TypeError)
      return n;
    throw o;
  }
}
function ui(t, e) {
  for (const [n, o] of Object.entries(e)) {
    const i = n.split("."), r = o.split("."), a = /* @__PURE__ */ new Set();
    let u = -1;
    for (let c = 0; c < i.length; c++)
      if (i[c] === "*") {
        u = c;
        break;
      }
    if (u !== -1 && r.length > u)
      for (let c = u; c < r.length; c++) {
        const d = r[c];
        d !== "*" && !d.endsWith("[]") && !d.endsWith("[0]") && a.add(d);
      }
    $e(t, i, r, 0, a);
  }
}
function $e(t, e, n, o, i) {
  if (o >= e.length || typeof t != "object" || t === null)
    return;
  const r = e[o];
  if (r.endsWith("[]")) {
    const a = r.slice(0, -2), u = t;
    if (a in u && Array.isArray(u[a]))
      for (const c of u[a])
        $e(c, e, n, o + 1, i);
  } else if (r === "*") {
    if (typeof t == "object" && t !== null && !Array.isArray(t)) {
      const a = t, u = Object.keys(a).filter((d) => !d.startsWith("_") && !i.has(d)), c = {};
      for (const d of u)
        c[d] = a[d];
      for (const [d, f] of Object.entries(c)) {
        const p = [];
        for (const m of n.slice(o))
          m === "*" ? p.push(d) : p.push(m);
        l(a, p, f);
      }
      for (const d of u)
        delete a[d];
    }
  } else {
    const a = t;
    r in a && $e(a[r], e, n, o + 1, i);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function lt(t) {
  if (typeof t != "string")
    throw new Error("fromImageBytes must be a string");
  return t;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function di(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  n != null && l(e, ["operationName"], n);
  const o = s(t, ["resourceName"]);
  return o != null && l(e, ["_url", "resourceName"], o), e;
}
function ci(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, [
    "response",
    "generateVideoResponse"
  ]);
  return a != null && l(e, ["response"], pi(a)), e;
}
function fi(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], mi(a)), e;
}
function pi(t) {
  const e = {}, n = s(t, [
    "generatedSamples"
  ]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((a) => hi(a))), l(e, ["generatedVideos"], r);
  }
  const o = s(t, [
    "raiMediaFilteredCount"
  ]);
  o != null && l(e, ["raiMediaFilteredCount"], o);
  const i = s(t, [
    "raiMediaFilteredReasons"
  ]);
  return i != null && l(e, ["raiMediaFilteredReasons"], i), e;
}
function mi(t) {
  const e = {}, n = s(t, ["videos"]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((a) => gi(a))), l(e, ["generatedVideos"], r);
  }
  const o = s(t, [
    "raiMediaFilteredCount"
  ]);
  o != null && l(e, ["raiMediaFilteredCount"], o);
  const i = s(t, [
    "raiMediaFilteredReasons"
  ]);
  return i != null && l(e, ["raiMediaFilteredReasons"], i), e;
}
function hi(t) {
  const e = {}, n = s(t, ["video"]);
  return n != null && l(e, ["video"], Si(n)), e;
}
function gi(t) {
  const e = {}, n = s(t, ["_self"]);
  return n != null && l(e, ["video"], Ii(n)), e;
}
function yi(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  return n != null && l(e, ["_url", "operationName"], n), e;
}
function Ti(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  return n != null && l(e, ["_url", "operationName"], n), e;
}
function _i(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], Ci(a)), e;
}
function Ci(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(t, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function to(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], Ei(a)), e;
}
function Ei(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(t, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function Si(t) {
  const e = {}, n = s(t, ["uri"]);
  n != null && l(e, ["uri"], n);
  const o = s(t, ["encodedVideo"]);
  o != null && l(e, ["videoBytes"], lt(o));
  const i = s(t, ["encoding"]);
  return i != null && l(e, ["mimeType"], i), e;
}
function Ii(t) {
  const e = {}, n = s(t, ["gcsUri"]);
  n != null && l(e, ["uri"], n);
  const o = s(t, [
    "bytesBase64Encoded"
  ]);
  o != null && l(e, ["videoBytes"], lt(o));
  const i = s(t, ["mimeType"]);
  return i != null && l(e, ["mimeType"], i), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var _t;
(function(t) {
  t.OUTCOME_UNSPECIFIED = "OUTCOME_UNSPECIFIED", t.OUTCOME_OK = "OUTCOME_OK", t.OUTCOME_FAILED = "OUTCOME_FAILED", t.OUTCOME_DEADLINE_EXCEEDED = "OUTCOME_DEADLINE_EXCEEDED";
})(_t || (_t = {}));
var Ct;
(function(t) {
  t.LANGUAGE_UNSPECIFIED = "LANGUAGE_UNSPECIFIED", t.PYTHON = "PYTHON";
})(Ct || (Ct = {}));
var Et;
(function(t) {
  t.SCHEDULING_UNSPECIFIED = "SCHEDULING_UNSPECIFIED", t.SILENT = "SILENT", t.WHEN_IDLE = "WHEN_IDLE", t.INTERRUPT = "INTERRUPT";
})(Et || (Et = {}));
var q;
(function(t) {
  t.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", t.STRING = "STRING", t.NUMBER = "NUMBER", t.INTEGER = "INTEGER", t.BOOLEAN = "BOOLEAN", t.ARRAY = "ARRAY", t.OBJECT = "OBJECT", t.NULL = "NULL";
})(q || (q = {}));
var St;
(function(t) {
  t.API_SPEC_UNSPECIFIED = "API_SPEC_UNSPECIFIED", t.SIMPLE_SEARCH = "SIMPLE_SEARCH", t.ELASTIC_SEARCH = "ELASTIC_SEARCH";
})(St || (St = {}));
var It;
(function(t) {
  t.AUTH_TYPE_UNSPECIFIED = "AUTH_TYPE_UNSPECIFIED", t.NO_AUTH = "NO_AUTH", t.API_KEY_AUTH = "API_KEY_AUTH", t.HTTP_BASIC_AUTH = "HTTP_BASIC_AUTH", t.GOOGLE_SERVICE_ACCOUNT_AUTH = "GOOGLE_SERVICE_ACCOUNT_AUTH", t.OAUTH = "OAUTH", t.OIDC_AUTH = "OIDC_AUTH";
})(It || (It = {}));
var vt;
(function(t) {
  t.HTTP_IN_UNSPECIFIED = "HTTP_IN_UNSPECIFIED", t.HTTP_IN_QUERY = "HTTP_IN_QUERY", t.HTTP_IN_HEADER = "HTTP_IN_HEADER", t.HTTP_IN_PATH = "HTTP_IN_PATH", t.HTTP_IN_BODY = "HTTP_IN_BODY", t.HTTP_IN_COOKIE = "HTTP_IN_COOKIE";
})(vt || (vt = {}));
var At;
(function(t) {
  t.PHISH_BLOCK_THRESHOLD_UNSPECIFIED = "PHISH_BLOCK_THRESHOLD_UNSPECIFIED", t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_HIGH_AND_ABOVE = "BLOCK_HIGH_AND_ABOVE", t.BLOCK_HIGHER_AND_ABOVE = "BLOCK_HIGHER_AND_ABOVE", t.BLOCK_VERY_HIGH_AND_ABOVE = "BLOCK_VERY_HIGH_AND_ABOVE", t.BLOCK_ONLY_EXTREMELY_HIGH = "BLOCK_ONLY_EXTREMELY_HIGH";
})(At || (At = {}));
var Rt;
(function(t) {
  t.UNSPECIFIED = "UNSPECIFIED", t.BLOCKING = "BLOCKING", t.NON_BLOCKING = "NON_BLOCKING";
})(Rt || (Rt = {}));
var Pt;
(function(t) {
  t.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", t.MODE_DYNAMIC = "MODE_DYNAMIC";
})(Pt || (Pt = {}));
var wt;
(function(t) {
  t.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", t.AUTO = "AUTO", t.ANY = "ANY", t.NONE = "NONE", t.VALIDATED = "VALIDATED";
})(wt || (wt = {}));
var Mt;
(function(t) {
  t.THINKING_LEVEL_UNSPECIFIED = "THINKING_LEVEL_UNSPECIFIED", t.LOW = "LOW", t.MEDIUM = "MEDIUM", t.HIGH = "HIGH", t.MINIMAL = "MINIMAL";
})(Mt || (Mt = {}));
var Nt;
(function(t) {
  t.HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED", t.HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT", t.HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH", t.HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT", t.HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT", t.HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY", t.HARM_CATEGORY_IMAGE_HATE = "HARM_CATEGORY_IMAGE_HATE", t.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT = "HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT", t.HARM_CATEGORY_IMAGE_HARASSMENT = "HARM_CATEGORY_IMAGE_HARASSMENT", t.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT = "HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT", t.HARM_CATEGORY_JAILBREAK = "HARM_CATEGORY_JAILBREAK";
})(Nt || (Nt = {}));
var xt;
(function(t) {
  t.HARM_BLOCK_METHOD_UNSPECIFIED = "HARM_BLOCK_METHOD_UNSPECIFIED", t.SEVERITY = "SEVERITY", t.PROBABILITY = "PROBABILITY";
})(xt || (xt = {}));
var Dt;
(function(t) {
  t.HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED", t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", t.BLOCK_NONE = "BLOCK_NONE", t.OFF = "OFF";
})(Dt || (Dt = {}));
var Ut;
(function(t) {
  t.FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED", t.STOP = "STOP", t.MAX_TOKENS = "MAX_TOKENS", t.SAFETY = "SAFETY", t.RECITATION = "RECITATION", t.LANGUAGE = "LANGUAGE", t.OTHER = "OTHER", t.BLOCKLIST = "BLOCKLIST", t.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", t.SPII = "SPII", t.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", t.IMAGE_SAFETY = "IMAGE_SAFETY", t.UNEXPECTED_TOOL_CALL = "UNEXPECTED_TOOL_CALL", t.IMAGE_PROHIBITED_CONTENT = "IMAGE_PROHIBITED_CONTENT", t.NO_IMAGE = "NO_IMAGE", t.IMAGE_RECITATION = "IMAGE_RECITATION", t.IMAGE_OTHER = "IMAGE_OTHER";
})(Ut || (Ut = {}));
var kt;
(function(t) {
  t.HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED", t.NEGLIGIBLE = "NEGLIGIBLE", t.LOW = "LOW", t.MEDIUM = "MEDIUM", t.HIGH = "HIGH";
})(kt || (kt = {}));
var Lt;
(function(t) {
  t.HARM_SEVERITY_UNSPECIFIED = "HARM_SEVERITY_UNSPECIFIED", t.HARM_SEVERITY_NEGLIGIBLE = "HARM_SEVERITY_NEGLIGIBLE", t.HARM_SEVERITY_LOW = "HARM_SEVERITY_LOW", t.HARM_SEVERITY_MEDIUM = "HARM_SEVERITY_MEDIUM", t.HARM_SEVERITY_HIGH = "HARM_SEVERITY_HIGH";
})(Lt || (Lt = {}));
var Ft;
(function(t) {
  t.URL_RETRIEVAL_STATUS_UNSPECIFIED = "URL_RETRIEVAL_STATUS_UNSPECIFIED", t.URL_RETRIEVAL_STATUS_SUCCESS = "URL_RETRIEVAL_STATUS_SUCCESS", t.URL_RETRIEVAL_STATUS_ERROR = "URL_RETRIEVAL_STATUS_ERROR", t.URL_RETRIEVAL_STATUS_PAYWALL = "URL_RETRIEVAL_STATUS_PAYWALL", t.URL_RETRIEVAL_STATUS_UNSAFE = "URL_RETRIEVAL_STATUS_UNSAFE";
})(Ft || (Ft = {}));
var Gt;
(function(t) {
  t.BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED", t.SAFETY = "SAFETY", t.OTHER = "OTHER", t.BLOCKLIST = "BLOCKLIST", t.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", t.IMAGE_SAFETY = "IMAGE_SAFETY", t.MODEL_ARMOR = "MODEL_ARMOR", t.JAILBREAK = "JAILBREAK";
})(Gt || (Gt = {}));
var Ht;
(function(t) {
  t.TRAFFIC_TYPE_UNSPECIFIED = "TRAFFIC_TYPE_UNSPECIFIED", t.ON_DEMAND = "ON_DEMAND", t.PROVISIONED_THROUGHPUT = "PROVISIONED_THROUGHPUT";
})(Ht || (Ht = {}));
var we;
(function(t) {
  t.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", t.TEXT = "TEXT", t.IMAGE = "IMAGE", t.AUDIO = "AUDIO";
})(we || (we = {}));
var Vt;
(function(t) {
  t.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", t.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", t.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", t.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH";
})(Vt || (Vt = {}));
var bt;
(function(t) {
  t.TUNING_MODE_UNSPECIFIED = "TUNING_MODE_UNSPECIFIED", t.TUNING_MODE_FULL = "TUNING_MODE_FULL", t.TUNING_MODE_PEFT_ADAPTER = "TUNING_MODE_PEFT_ADAPTER";
})(bt || (bt = {}));
var qt;
(function(t) {
  t.ADAPTER_SIZE_UNSPECIFIED = "ADAPTER_SIZE_UNSPECIFIED", t.ADAPTER_SIZE_ONE = "ADAPTER_SIZE_ONE", t.ADAPTER_SIZE_TWO = "ADAPTER_SIZE_TWO", t.ADAPTER_SIZE_FOUR = "ADAPTER_SIZE_FOUR", t.ADAPTER_SIZE_EIGHT = "ADAPTER_SIZE_EIGHT", t.ADAPTER_SIZE_SIXTEEN = "ADAPTER_SIZE_SIXTEEN", t.ADAPTER_SIZE_THIRTY_TWO = "ADAPTER_SIZE_THIRTY_TWO";
})(qt || (qt = {}));
var We;
(function(t) {
  t.JOB_STATE_UNSPECIFIED = "JOB_STATE_UNSPECIFIED", t.JOB_STATE_QUEUED = "JOB_STATE_QUEUED", t.JOB_STATE_PENDING = "JOB_STATE_PENDING", t.JOB_STATE_RUNNING = "JOB_STATE_RUNNING", t.JOB_STATE_SUCCEEDED = "JOB_STATE_SUCCEEDED", t.JOB_STATE_FAILED = "JOB_STATE_FAILED", t.JOB_STATE_CANCELLING = "JOB_STATE_CANCELLING", t.JOB_STATE_CANCELLED = "JOB_STATE_CANCELLED", t.JOB_STATE_PAUSED = "JOB_STATE_PAUSED", t.JOB_STATE_EXPIRED = "JOB_STATE_EXPIRED", t.JOB_STATE_UPDATING = "JOB_STATE_UPDATING", t.JOB_STATE_PARTIALLY_SUCCEEDED = "JOB_STATE_PARTIALLY_SUCCEEDED";
})(We || (We = {}));
var Bt;
(function(t) {
  t.TUNING_TASK_UNSPECIFIED = "TUNING_TASK_UNSPECIFIED", t.TUNING_TASK_I2V = "TUNING_TASK_I2V", t.TUNING_TASK_T2V = "TUNING_TASK_T2V", t.TUNING_TASK_R2V = "TUNING_TASK_R2V";
})(Bt || (Bt = {}));
var Jt;
(function(t) {
  t.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", t.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", t.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", t.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH", t.MEDIA_RESOLUTION_ULTRA_HIGH = "MEDIA_RESOLUTION_ULTRA_HIGH";
})(Jt || (Jt = {}));
var Ke;
(function(t) {
  t.COLLECTION = "COLLECTION";
})(Ke || (Ke = {}));
var Ot;
(function(t) {
  t.FEATURE_SELECTION_PREFERENCE_UNSPECIFIED = "FEATURE_SELECTION_PREFERENCE_UNSPECIFIED", t.PRIORITIZE_QUALITY = "PRIORITIZE_QUALITY", t.BALANCED = "BALANCED", t.PRIORITIZE_COST = "PRIORITIZE_COST";
})(Ot || (Ot = {}));
var $t;
(function(t) {
  t.ENVIRONMENT_UNSPECIFIED = "ENVIRONMENT_UNSPECIFIED", t.ENVIRONMENT_BROWSER = "ENVIRONMENT_BROWSER";
})($t || ($t = {}));
var Wt;
(function(t) {
  t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", t.BLOCK_NONE = "BLOCK_NONE";
})(Wt || (Wt = {}));
var Kt;
(function(t) {
  t.DONT_ALLOW = "DONT_ALLOW", t.ALLOW_ADULT = "ALLOW_ADULT", t.ALLOW_ALL = "ALLOW_ALL";
})(Kt || (Kt = {}));
var Yt;
(function(t) {
  t.auto = "auto", t.en = "en", t.ja = "ja", t.ko = "ko", t.hi = "hi", t.zh = "zh", t.pt = "pt", t.es = "es";
})(Yt || (Yt = {}));
var zt;
(function(t) {
  t.MASK_MODE_DEFAULT = "MASK_MODE_DEFAULT", t.MASK_MODE_USER_PROVIDED = "MASK_MODE_USER_PROVIDED", t.MASK_MODE_BACKGROUND = "MASK_MODE_BACKGROUND", t.MASK_MODE_FOREGROUND = "MASK_MODE_FOREGROUND", t.MASK_MODE_SEMANTIC = "MASK_MODE_SEMANTIC";
})(zt || (zt = {}));
var Xt;
(function(t) {
  t.CONTROL_TYPE_DEFAULT = "CONTROL_TYPE_DEFAULT", t.CONTROL_TYPE_CANNY = "CONTROL_TYPE_CANNY", t.CONTROL_TYPE_SCRIBBLE = "CONTROL_TYPE_SCRIBBLE", t.CONTROL_TYPE_FACE_MESH = "CONTROL_TYPE_FACE_MESH";
})(Xt || (Xt = {}));
var Qt;
(function(t) {
  t.SUBJECT_TYPE_DEFAULT = "SUBJECT_TYPE_DEFAULT", t.SUBJECT_TYPE_PERSON = "SUBJECT_TYPE_PERSON", t.SUBJECT_TYPE_ANIMAL = "SUBJECT_TYPE_ANIMAL", t.SUBJECT_TYPE_PRODUCT = "SUBJECT_TYPE_PRODUCT";
})(Qt || (Qt = {}));
var Zt;
(function(t) {
  t.EDIT_MODE_DEFAULT = "EDIT_MODE_DEFAULT", t.EDIT_MODE_INPAINT_REMOVAL = "EDIT_MODE_INPAINT_REMOVAL", t.EDIT_MODE_INPAINT_INSERTION = "EDIT_MODE_INPAINT_INSERTION", t.EDIT_MODE_OUTPAINT = "EDIT_MODE_OUTPAINT", t.EDIT_MODE_CONTROLLED_EDITING = "EDIT_MODE_CONTROLLED_EDITING", t.EDIT_MODE_STYLE = "EDIT_MODE_STYLE", t.EDIT_MODE_BGSWAP = "EDIT_MODE_BGSWAP", t.EDIT_MODE_PRODUCT_IMAGE = "EDIT_MODE_PRODUCT_IMAGE";
})(Zt || (Zt = {}));
var jt;
(function(t) {
  t.FOREGROUND = "FOREGROUND", t.BACKGROUND = "BACKGROUND", t.PROMPT = "PROMPT", t.SEMANTIC = "SEMANTIC", t.INTERACTIVE = "INTERACTIVE";
})(jt || (jt = {}));
var en;
(function(t) {
  t.ASSET = "ASSET", t.STYLE = "STYLE";
})(en || (en = {}));
var tn;
(function(t) {
  t.INSERT = "INSERT", t.REMOVE = "REMOVE", t.REMOVE_STATIC = "REMOVE_STATIC", t.OUTPAINT = "OUTPAINT";
})(tn || (tn = {}));
var nn;
(function(t) {
  t.OPTIMIZED = "OPTIMIZED", t.LOSSLESS = "LOSSLESS";
})(nn || (nn = {}));
var on;
(function(t) {
  t.SUPERVISED_FINE_TUNING = "SUPERVISED_FINE_TUNING", t.PREFERENCE_TUNING = "PREFERENCE_TUNING", t.DISTILLATION = "DISTILLATION";
})(on || (on = {}));
var sn;
(function(t) {
  t.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", t.STATE_PENDING = "STATE_PENDING", t.STATE_ACTIVE = "STATE_ACTIVE", t.STATE_FAILED = "STATE_FAILED";
})(sn || (sn = {}));
var rn;
(function(t) {
  t.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", t.PROCESSING = "PROCESSING", t.ACTIVE = "ACTIVE", t.FAILED = "FAILED";
})(rn || (rn = {}));
var ln;
(function(t) {
  t.SOURCE_UNSPECIFIED = "SOURCE_UNSPECIFIED", t.UPLOADED = "UPLOADED", t.GENERATED = "GENERATED", t.REGISTERED = "REGISTERED";
})(ln || (ln = {}));
var an;
(function(t) {
  t.TURN_COMPLETE_REASON_UNSPECIFIED = "TURN_COMPLETE_REASON_UNSPECIFIED", t.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", t.RESPONSE_REJECTED = "RESPONSE_REJECTED", t.NEED_MORE_INPUT = "NEED_MORE_INPUT";
})(an || (an = {}));
var un;
(function(t) {
  t.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", t.TEXT = "TEXT", t.IMAGE = "IMAGE", t.VIDEO = "VIDEO", t.AUDIO = "AUDIO", t.DOCUMENT = "DOCUMENT";
})(un || (un = {}));
var dn;
(function(t) {
  t.VAD_SIGNAL_TYPE_UNSPECIFIED = "VAD_SIGNAL_TYPE_UNSPECIFIED", t.VAD_SIGNAL_TYPE_SOS = "VAD_SIGNAL_TYPE_SOS", t.VAD_SIGNAL_TYPE_EOS = "VAD_SIGNAL_TYPE_EOS";
})(dn || (dn = {}));
var cn;
(function(t) {
  t.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", t.ACTIVITY_START = "ACTIVITY_START", t.ACTIVITY_END = "ACTIVITY_END";
})(cn || (cn = {}));
var fn;
(function(t) {
  t.START_SENSITIVITY_UNSPECIFIED = "START_SENSITIVITY_UNSPECIFIED", t.START_SENSITIVITY_HIGH = "START_SENSITIVITY_HIGH", t.START_SENSITIVITY_LOW = "START_SENSITIVITY_LOW";
})(fn || (fn = {}));
var pn;
(function(t) {
  t.END_SENSITIVITY_UNSPECIFIED = "END_SENSITIVITY_UNSPECIFIED", t.END_SENSITIVITY_HIGH = "END_SENSITIVITY_HIGH", t.END_SENSITIVITY_LOW = "END_SENSITIVITY_LOW";
})(pn || (pn = {}));
var mn;
(function(t) {
  t.ACTIVITY_HANDLING_UNSPECIFIED = "ACTIVITY_HANDLING_UNSPECIFIED", t.START_OF_ACTIVITY_INTERRUPTS = "START_OF_ACTIVITY_INTERRUPTS", t.NO_INTERRUPTION = "NO_INTERRUPTION";
})(mn || (mn = {}));
var hn;
(function(t) {
  t.TURN_COVERAGE_UNSPECIFIED = "TURN_COVERAGE_UNSPECIFIED", t.TURN_INCLUDES_ONLY_ACTIVITY = "TURN_INCLUDES_ONLY_ACTIVITY", t.TURN_INCLUDES_ALL_INPUT = "TURN_INCLUDES_ALL_INPUT";
})(hn || (hn = {}));
var gn;
(function(t) {
  t.SCALE_UNSPECIFIED = "SCALE_UNSPECIFIED", t.C_MAJOR_A_MINOR = "C_MAJOR_A_MINOR", t.D_FLAT_MAJOR_B_FLAT_MINOR = "D_FLAT_MAJOR_B_FLAT_MINOR", t.D_MAJOR_B_MINOR = "D_MAJOR_B_MINOR", t.E_FLAT_MAJOR_C_MINOR = "E_FLAT_MAJOR_C_MINOR", t.E_MAJOR_D_FLAT_MINOR = "E_MAJOR_D_FLAT_MINOR", t.F_MAJOR_D_MINOR = "F_MAJOR_D_MINOR", t.G_FLAT_MAJOR_E_FLAT_MINOR = "G_FLAT_MAJOR_E_FLAT_MINOR", t.G_MAJOR_E_MINOR = "G_MAJOR_E_MINOR", t.A_FLAT_MAJOR_F_MINOR = "A_FLAT_MAJOR_F_MINOR", t.A_MAJOR_G_FLAT_MINOR = "A_MAJOR_G_FLAT_MINOR", t.B_FLAT_MAJOR_G_MINOR = "B_FLAT_MAJOR_G_MINOR", t.B_MAJOR_A_FLAT_MINOR = "B_MAJOR_A_FLAT_MINOR";
})(gn || (gn = {}));
var yn;
(function(t) {
  t.MUSIC_GENERATION_MODE_UNSPECIFIED = "MUSIC_GENERATION_MODE_UNSPECIFIED", t.QUALITY = "QUALITY", t.DIVERSITY = "DIVERSITY", t.VOCALIZATION = "VOCALIZATION";
})(yn || (yn = {}));
var le;
(function(t) {
  t.PLAYBACK_CONTROL_UNSPECIFIED = "PLAYBACK_CONTROL_UNSPECIFIED", t.PLAY = "PLAY", t.PAUSE = "PAUSE", t.STOP = "STOP", t.RESET_CONTEXT = "RESET_CONTEXT";
})(le || (le = {}));
class Ye {
  constructor(e) {
    const n = {};
    for (const o of e.headers.entries())
      n[o[0]] = o[1];
    this.headers = n, this.responseInternal = e;
  }
  json() {
    return this.responseInternal.json();
  }
}
class he {
  /**
   * Returns the concatenation of all text parts from the first candidate in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the text from the first
   * one will be returned.
   * If there are non-text parts in the response, the concatenation of all text
   * parts will be returned, and a warning will be logged.
   * If there are thought parts in the response, the concatenation of all text
   * parts excluding the thought parts will be returned.
   *
   * @example
   * ```ts
   * const response = await ai.models.generateContent({
   *   model: 'gemini-2.0-flash',
   *   contents:
   *     'Why is the sky blue?',
   * });
   *
   * console.debug(response.text);
   * ```
   */
  get text() {
    var e, n, o, i, r, a, u, c;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning text from the first one.");
    let d = "", f = !1;
    const p = [];
    for (const m of (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) !== null && c !== void 0 ? c : []) {
      for (const [h, g] of Object.entries(m))
        h !== "text" && h !== "thought" && h !== "thoughtSignature" && (g !== null || g !== void 0) && p.push(h);
      if (typeof m.text == "string") {
        if (typeof m.thought == "boolean" && m.thought)
          continue;
        f = !0, d += m.text;
      }
    }
    return p.length > 0 && console.warn(`there are non-text parts ${p} in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.`), f ? d : void 0;
  }
  /**
   * Returns the concatenation of all inline data parts from the first candidate
   * in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the inline data from the
   * first one will be returned. If there are non-inline data parts in the
   * response, the concatenation of all inline data parts will be returned, and
   * a warning will be logged.
   */
  get data() {
    var e, n, o, i, r, a, u, c;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning data from the first one.");
    let d = "";
    const f = [];
    for (const p of (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) !== null && c !== void 0 ? c : []) {
      for (const [m, h] of Object.entries(p))
        m !== "inlineData" && (h !== null || h !== void 0) && f.push(m);
      p.inlineData && typeof p.inlineData.data == "string" && (d += atob(p.inlineData.data));
    }
    return f.length > 0 && console.warn(`there are non-data parts ${f} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), d.length > 0 ? btoa(d) : void 0;
  }
  /**
   * Returns the function calls from the first candidate in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the function calls from
   * the first one will be returned.
   * If there are no function calls in the response, undefined will be returned.
   *
   * @example
   * ```ts
   * const controlLightFunctionDeclaration: FunctionDeclaration = {
   *   name: 'controlLight',
   *   parameters: {
   *   type: Type.OBJECT,
   *   description: 'Set the brightness and color temperature of a room light.',
   *   properties: {
   *     brightness: {
   *       type: Type.NUMBER,
   *       description:
   *         'Light level from 0 to 100. Zero is off and 100 is full brightness.',
   *     },
   *     colorTemperature: {
   *       type: Type.STRING,
   *       description:
   *         'Color temperature of the light fixture which can be `daylight`, `cool` or `warm`.',
   *     },
   *   },
   *   required: ['brightness', 'colorTemperature'],
   *  };
   *  const response = await ai.models.generateContent({
   *     model: 'gemini-2.0-flash',
   *     contents: 'Dim the lights so the room feels cozy and warm.',
   *     config: {
   *       tools: [{functionDeclarations: [controlLightFunctionDeclaration]}],
   *       toolConfig: {
   *         functionCallingConfig: {
   *           mode: FunctionCallingConfigMode.ANY,
   *           allowedFunctionNames: ['controlLight'],
   *         },
   *       },
   *     },
   *   });
   *  console.debug(JSON.stringify(response.functionCalls));
   * ```
   */
  get functionCalls() {
    var e, n, o, i, r, a, u, c;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning function calls from the first one.");
    const d = (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) === null || c === void 0 ? void 0 : c.filter((f) => f.functionCall).map((f) => f.functionCall).filter((f) => f !== void 0);
    if ((d == null ? void 0 : d.length) !== 0)
      return d;
  }
  /**
   * Returns the first executable code from the first candidate in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the executable code from
   * the first one will be returned.
   * If there are no executable code in the response, undefined will be
   * returned.
   *
   * @example
   * ```ts
   * const response = await ai.models.generateContent({
   *   model: 'gemini-2.0-flash',
   *   contents:
   *     'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.'
   *   config: {
   *     tools: [{codeExecution: {}}],
   *   },
   * });
   *
   * console.debug(response.executableCode);
   * ```
   */
  get executableCode() {
    var e, n, o, i, r, a, u, c, d;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning executable code from the first one.");
    const f = (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) === null || c === void 0 ? void 0 : c.filter((p) => p.executableCode).map((p) => p.executableCode).filter((p) => p !== void 0);
    if ((f == null ? void 0 : f.length) !== 0)
      return (d = f == null ? void 0 : f[0]) === null || d === void 0 ? void 0 : d.code;
  }
  /**
   * Returns the first code execution result from the first candidate in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the code execution result from
   * the first one will be returned.
   * If there are no code execution result in the response, undefined will be returned.
   *
   * @example
   * ```ts
   * const response = await ai.models.generateContent({
   *   model: 'gemini-2.0-flash',
   *   contents:
   *     'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.'
   *   config: {
   *     tools: [{codeExecution: {}}],
   *   },
   * });
   *
   * console.debug(response.codeExecutionResult);
   * ```
   */
  get codeExecutionResult() {
    var e, n, o, i, r, a, u, c, d;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning code execution result from the first one.");
    const f = (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) === null || c === void 0 ? void 0 : c.filter((p) => p.codeExecutionResult).map((p) => p.codeExecutionResult).filter((p) => p !== void 0);
    if ((f == null ? void 0 : f.length) !== 0)
      return (d = f == null ? void 0 : f[0]) === null || d === void 0 ? void 0 : d.output;
  }
}
class Tn {
}
class _n {
}
class vi {
}
class Ai {
}
class Ri {
}
class Pi {
}
class Cn {
}
class En {
}
class Sn {
}
class wi {
}
class Me {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new Me();
    let i;
    const r = e;
    return n ? i = fi(r) : i = ci(r), Object.assign(o, i), o;
  }
}
class In {
}
class vn {
}
class An {
}
class Rn {
}
class Mi {
}
class Ni {
}
class xi {
}
class at {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new at(), r = _i(e);
    return Object.assign(o, r), o;
  }
}
class Di {
}
class Ui {
}
class ki {
}
class Li {
}
class Pn {
}
class Fi {
  /**
   * Returns the concatenation of all text parts from the server content if present.
   *
   * @remarks
   * If there are non-text parts in the response, the concatenation of all text
   * parts will be returned, and a warning will be logged.
   */
  get text() {
    var e, n, o;
    let i = "", r = !1;
    const a = [];
    for (const u of (o = (n = (e = this.serverContent) === null || e === void 0 ? void 0 : e.modelTurn) === null || n === void 0 ? void 0 : n.parts) !== null && o !== void 0 ? o : []) {
      for (const [c, d] of Object.entries(u))
        c !== "text" && c !== "thought" && d !== null && a.push(c);
      if (typeof u.text == "string") {
        if (typeof u.thought == "boolean" && u.thought)
          continue;
        r = !0, i += u.text;
      }
    }
    return a.length > 0 && console.warn(`there are non-text parts ${a} in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.`), r ? i : void 0;
  }
  /**
   * Returns the concatenation of all inline data parts from the server content if present.
   *
   * @remarks
   * If there are non-inline data parts in the
   * response, the concatenation of all inline data parts will be returned, and
   * a warning will be logged.
   */
  get data() {
    var e, n, o;
    let i = "";
    const r = [];
    for (const a of (o = (n = (e = this.serverContent) === null || e === void 0 ? void 0 : e.modelTurn) === null || n === void 0 ? void 0 : n.parts) !== null && o !== void 0 ? o : []) {
      for (const [u, c] of Object.entries(a))
        u !== "inlineData" && c !== null && r.push(u);
      a.inlineData && typeof a.inlineData.data == "string" && (i += atob(a.inlineData.data));
    }
    return r.length > 0 && console.warn(`there are non-data parts ${r} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), i.length > 0 ? btoa(i) : void 0;
  }
}
class Gi {
  /**
   * Returns the first audio chunk from the server content, if present.
   *
   * @remarks
   * If there are no audio chunks in the response, undefined will be returned.
   */
  get audioChunk() {
    if (this.serverContent && this.serverContent.audioChunks && this.serverContent.audioChunks.length > 0)
      return this.serverContent.audioChunks[0];
  }
}
class ut {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new ut(), r = to(e);
    return Object.assign(o, r), o;
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function D(t, e) {
  if (!e || typeof e != "string")
    throw new Error("model is required and must be a string");
  if (e.includes("..") || e.includes("?") || e.includes("&"))
    throw new Error("invalid model parameter");
  if (t.isVertexAI()) {
    if (e.startsWith("publishers/") || e.startsWith("projects/") || e.startsWith("models/"))
      return e;
    if (e.indexOf("/") >= 0) {
      const n = e.split("/", 2);
      return `publishers/${n[0]}/models/${n[1]}`;
    } else
      return `publishers/google/models/${e}`;
  } else
    return e.startsWith("models/") || e.startsWith("tunedModels/") ? e : `models/${e}`;
}
function no(t, e) {
  const n = D(t, e);
  return n ? n.startsWith("publishers/") && t.isVertexAI() ? `projects/${t.getProject()}/locations/${t.getLocation()}/${n}` : n.startsWith("models/") && t.isVertexAI() ? `projects/${t.getProject()}/locations/${t.getLocation()}/publishers/google/${n}` : n : "";
}
function oo(t) {
  return Array.isArray(t) ? t.map((e) => Ne(e)) : [Ne(t)];
}
function Ne(t) {
  if (typeof t == "object" && t !== null)
    return t;
  throw new Error(`Could not parse input as Blob. Unsupported blob type: ${typeof t}`);
}
function io(t) {
  const e = Ne(t);
  if (e.mimeType && e.mimeType.startsWith("image/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function so(t) {
  const e = Ne(t);
  if (e.mimeType && e.mimeType.startsWith("audio/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function wn(t) {
  if (t == null)
    throw new Error("PartUnion is required");
  if (typeof t == "object")
    return t;
  if (typeof t == "string")
    return { text: t };
  throw new Error(`Unsupported part type: ${typeof t}`);
}
function ro(t) {
  if (t == null || Array.isArray(t) && t.length === 0)
    throw new Error("PartListUnion is required");
  return Array.isArray(t) ? t.map((e) => wn(e)) : [wn(t)];
}
function ze(t) {
  return t != null && typeof t == "object" && "parts" in t && Array.isArray(t.parts);
}
function Mn(t) {
  return t != null && typeof t == "object" && "functionCall" in t;
}
function Nn(t) {
  return t != null && typeof t == "object" && "functionResponse" in t;
}
function H(t) {
  if (t == null)
    throw new Error("ContentUnion is required");
  return ze(t) ? t : {
    role: "user",
    parts: ro(t)
  };
}
function dt(t, e) {
  if (!e)
    return [];
  if (t.isVertexAI() && Array.isArray(e))
    return e.flatMap((n) => {
      const o = H(n);
      return o.parts && o.parts.length > 0 && o.parts[0].text !== void 0 ? [o.parts[0].text] : [];
    });
  if (t.isVertexAI()) {
    const n = H(e);
    return n.parts && n.parts.length > 0 && n.parts[0].text !== void 0 ? [n.parts[0].text] : [];
  }
  return Array.isArray(e) ? e.map((n) => H(n)) : [H(e)];
}
function B(t) {
  if (t == null || Array.isArray(t) && t.length === 0)
    throw new Error("contents are required");
  if (!Array.isArray(t)) {
    if (Mn(t) || Nn(t))
      throw new Error("To specify functionCall or functionResponse parts, please wrap them in a Content object, specifying the role for them");
    return [H(t)];
  }
  const e = [], n = [], o = ze(t[0]);
  for (const i of t) {
    const r = ze(i);
    if (r != o)
      throw new Error("Mixing Content and Parts is not supported, please group the parts into a the appropriate Content objects and specify the roles for them");
    if (r)
      e.push(i);
    else {
      if (Mn(i) || Nn(i))
        throw new Error("To specify functionCall or functionResponse parts, please wrap them, and any other parts, in Content objects as appropriate, specifying the role for them");
      n.push(i);
    }
  }
  return o || e.push({ role: "user", parts: ro(n) }), e;
}
function Hi(t, e) {
  t.includes("null") && (e.nullable = !0);
  const n = t.filter((o) => o !== "null");
  if (n.length === 1)
    e.type = Object.values(q).includes(n[0].toUpperCase()) ? n[0].toUpperCase() : q.TYPE_UNSPECIFIED;
  else {
    e.anyOf = [];
    for (const o of n)
      e.anyOf.push({
        type: Object.values(q).includes(o.toUpperCase()) ? o.toUpperCase() : q.TYPE_UNSPECIFIED
      });
  }
}
function ue(t) {
  const e = {}, n = ["items"], o = ["anyOf"], i = ["properties"];
  if (t.type && t.anyOf)
    throw new Error("type and anyOf cannot be both populated.");
  const r = t.anyOf;
  r != null && r.length == 2 && (r[0].type === "null" ? (e.nullable = !0, t = r[1]) : r[1].type === "null" && (e.nullable = !0, t = r[0])), t.type instanceof Array && Hi(t.type, e);
  for (const [a, u] of Object.entries(t))
    if (u != null)
      if (a == "type") {
        if (u === "null")
          throw new Error("type: null can not be the only possible type for the field.");
        if (u instanceof Array)
          continue;
        e.type = Object.values(q).includes(u.toUpperCase()) ? u.toUpperCase() : q.TYPE_UNSPECIFIED;
      } else if (n.includes(a))
        e[a] = ue(u);
      else if (o.includes(a)) {
        const c = [];
        for (const d of u) {
          if (d.type == "null") {
            e.nullable = !0;
            continue;
          }
          c.push(ue(d));
        }
        e[a] = c;
      } else if (i.includes(a)) {
        const c = {};
        for (const [d, f] of Object.entries(u))
          c[d] = ue(f);
        e[a] = c;
      } else {
        if (a === "additionalProperties")
          continue;
        e[a] = u;
      }
  return e;
}
function ct(t) {
  return ue(t);
}
function ft(t) {
  if (typeof t == "object")
    return t;
  if (typeof t == "string")
    return {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: t
        }
      }
    };
  throw new Error(`Unsupported speechConfig type: ${typeof t}`);
}
function pt(t) {
  if ("multiSpeakerVoiceConfig" in t)
    throw new Error("multiSpeakerVoiceConfig is not supported in the live API.");
  return t;
}
function ce(t) {
  if (t.functionDeclarations)
    for (const e of t.functionDeclarations)
      e.parameters && (Object.keys(e.parameters).includes("$schema") ? e.parametersJsonSchema || (e.parametersJsonSchema = e.parameters, delete e.parameters) : e.parameters = ue(e.parameters)), e.response && (Object.keys(e.response).includes("$schema") ? e.responseJsonSchema || (e.responseJsonSchema = e.response, delete e.response) : e.response = ue(e.response));
  return t;
}
function fe(t) {
  if (t == null)
    throw new Error("tools is required");
  if (!Array.isArray(t))
    throw new Error("tools is required and must be an array of Tools");
  const e = [];
  for (const n of t)
    e.push(n);
  return e;
}
function Vi(t, e, n, o = 1) {
  const i = !e.startsWith(`${n}/`) && e.split("/").length === o;
  return t.isVertexAI() ? e.startsWith("projects/") ? e : e.startsWith("locations/") ? `projects/${t.getProject()}/${e}` : e.startsWith(`${n}/`) ? `projects/${t.getProject()}/locations/${t.getLocation()}/${e}` : i ? `projects/${t.getProject()}/locations/${t.getLocation()}/${n}/${e}` : e : i ? `${n}/${e}` : e;
}
function Q(t, e) {
  if (typeof e != "string")
    throw new Error("name must be a string");
  return Vi(t, e, "cachedContents");
}
function lo(t) {
  switch (t) {
    case "STATE_UNSPECIFIED":
      return "JOB_STATE_UNSPECIFIED";
    case "CREATING":
      return "JOB_STATE_RUNNING";
    case "ACTIVE":
      return "JOB_STATE_SUCCEEDED";
    case "FAILED":
      return "JOB_STATE_FAILED";
    default:
      return t;
  }
}
function j(t) {
  return lt(t);
}
function bi(t) {
  return t != null && typeof t == "object" && "name" in t;
}
function qi(t) {
  return t != null && typeof t == "object" && "video" in t;
}
function Bi(t) {
  return t != null && typeof t == "object" && "uri" in t;
}
function ao(t) {
  var e;
  let n;
  if (bi(t) && (n = t.name), !(Bi(t) && (n = t.uri, n === void 0)) && !(qi(t) && (n = (e = t.video) === null || e === void 0 ? void 0 : e.uri, n === void 0))) {
    if (typeof t == "string" && (n = t), n === void 0)
      throw new Error("Could not extract file name from the provided input.");
    if (n.startsWith("https://")) {
      const i = n.split("files/")[1].match(/[a-z0-9]+/);
      if (i === null)
        throw new Error(`Could not extract file name from URI ${n}`);
      n = i[0];
    } else n.startsWith("files/") && (n = n.split("files/")[1]);
    return n;
  }
}
function uo(t, e) {
  let n;
  return t.isVertexAI() ? n = e ? "publishers/google/models" : "models" : n = e ? "models" : "tunedModels", n;
}
function co(t) {
  for (const e of ["models", "tunedModels", "publisherModels"])
    if (Ji(t, e))
      return t[e];
  return [];
}
function Ji(t, e) {
  return t !== null && typeof t == "object" && e in t;
}
function Oi(t, e = {}) {
  const n = t, o = {
    name: n.name,
    description: n.description,
    parametersJsonSchema: n.inputSchema
  };
  return n.outputSchema && (o.responseJsonSchema = n.outputSchema), e.behavior && (o.behavior = e.behavior), {
    functionDeclarations: [
      o
    ]
  };
}
function $i(t, e = {}) {
  const n = [], o = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = i.name;
    if (o.has(r))
      throw new Error(`Duplicate function name ${r} found in MCP tools. Please ensure function names are unique.`);
    o.add(r);
    const a = Oi(i, e);
    a.functionDeclarations && n.push(...a.functionDeclarations);
  }
  return { functionDeclarations: n };
}
function fo(t, e) {
  let n;
  if (typeof e == "string")
    if (t.isVertexAI())
      if (e.startsWith("gs://"))
        n = { format: "jsonl", gcsUri: [e] };
      else if (e.startsWith("bq://"))
        n = { format: "bigquery", bigqueryUri: e };
      else
        throw new Error(`Unsupported string source for Vertex AI: ${e}`);
    else if (e.startsWith("files/"))
      n = { fileName: e };
    else
      throw new Error(`Unsupported string source for Gemini API: ${e}`);
  else if (Array.isArray(e)) {
    if (t.isVertexAI())
      throw new Error("InlinedRequest[] is not supported in Vertex AI.");
    n = { inlinedRequests: e };
  } else
    n = e;
  const o = [n.gcsUri, n.bigqueryUri].filter(Boolean).length, i = [
    n.inlinedRequests,
    n.fileName
  ].filter(Boolean).length;
  if (t.isVertexAI()) {
    if (i > 0 || o !== 1)
      throw new Error("Exactly one of `gcsUri` or `bigqueryUri` must be set for Vertex AI.");
  } else if (o > 0 || i !== 1)
    throw new Error("Exactly one of `inlinedRequests`, `fileName`, must be set for Gemini API.");
  return n;
}
function Wi(t) {
  if (typeof t != "string")
    return t;
  const e = t;
  if (e.startsWith("gs://"))
    return {
      format: "jsonl",
      gcsUri: e
    };
  if (e.startsWith("bq://"))
    return {
      format: "bigquery",
      bigqueryUri: e
    };
  throw new Error(`Unsupported destination: ${e}`);
}
function po(t) {
  if (typeof t != "object" || t === null)
    return {};
  const e = t, n = e.inlinedResponses;
  if (typeof n != "object" || n === null)
    return t;
  const i = n.inlinedResponses;
  if (!Array.isArray(i) || i.length === 0)
    return t;
  let r = !1;
  for (const a of i) {
    if (typeof a != "object" || a === null)
      continue;
    const c = a.response;
    if (typeof c != "object" || c === null)
      continue;
    if (c.embedding !== void 0) {
      r = !0;
      break;
    }
  }
  return r && (e.inlinedEmbedContentResponses = e.inlinedResponses, delete e.inlinedResponses), t;
}
function pe(t, e) {
  const n = e;
  if (!t.isVertexAI()) {
    if (/batches\/[^/]+$/.test(n))
      return n.split("/").pop();
    throw new Error(`Invalid batch job name: ${n}.`);
  }
  if (/^projects\/[^/]+\/locations\/[^/]+\/batchPredictionJobs\/[^/]+$/.test(n))
    return n.split("/").pop();
  if (/^\d+$/.test(n))
    return n;
  throw new Error(`Invalid batch job name: ${n}.`);
}
function mo(t) {
  const e = t;
  return e === "BATCH_STATE_UNSPECIFIED" ? "JOB_STATE_UNSPECIFIED" : e === "BATCH_STATE_PENDING" ? "JOB_STATE_PENDING" : e === "BATCH_STATE_RUNNING" ? "JOB_STATE_RUNNING" : e === "BATCH_STATE_SUCCEEDED" ? "JOB_STATE_SUCCEEDED" : e === "BATCH_STATE_FAILED" ? "JOB_STATE_FAILED" : e === "BATCH_STATE_CANCELLED" ? "JOB_STATE_CANCELLED" : e === "BATCH_STATE_EXPIRED" ? "JOB_STATE_EXPIRED" : e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Ki(t) {
  const e = {}, n = s(t, ["responsesFile"]);
  n != null && l(e, ["fileName"], n);
  const o = s(t, [
    "inlinedResponses",
    "inlinedResponses"
  ]);
  if (o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => Ps(a))), l(e, ["inlinedResponses"], r);
  }
  const i = s(t, [
    "inlinedEmbedContentResponses",
    "inlinedResponses"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["inlinedEmbedContentResponses"], r);
  }
  return e;
}
function Yi(t) {
  const e = {}, n = s(t, ["predictionsFormat"]);
  n != null && l(e, ["format"], n);
  const o = s(t, [
    "gcsDestination",
    "outputUriPrefix"
  ]);
  o != null && l(e, ["gcsUri"], o);
  const i = s(t, [
    "bigqueryDestination",
    "outputUri"
  ]);
  return i != null && l(e, ["bigqueryUri"], i), e;
}
function zi(t) {
  const e = {}, n = s(t, ["format"]);
  n != null && l(e, ["predictionsFormat"], n);
  const o = s(t, ["gcsUri"]);
  o != null && l(e, ["gcsDestination", "outputUriPrefix"], o);
  const i = s(t, ["bigqueryUri"]);
  if (i != null && l(e, ["bigqueryDestination", "outputUri"], i), s(t, ["fileName"]) !== void 0)
    throw new Error("fileName parameter is not supported in Vertex AI.");
  if (s(t, ["inlinedResponses"]) !== void 0)
    throw new Error("inlinedResponses parameter is not supported in Vertex AI.");
  if (s(t, ["inlinedEmbedContentResponses"]) !== void 0)
    throw new Error("inlinedEmbedContentResponses parameter is not supported in Vertex AI.");
  return e;
}
function Ae(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, [
    "metadata",
    "displayName"
  ]);
  o != null && l(e, ["displayName"], o);
  const i = s(t, ["metadata", "state"]);
  i != null && l(e, ["state"], mo(i));
  const r = s(t, [
    "metadata",
    "createTime"
  ]);
  r != null && l(e, ["createTime"], r);
  const a = s(t, [
    "metadata",
    "endTime"
  ]);
  a != null && l(e, ["endTime"], a);
  const u = s(t, [
    "metadata",
    "updateTime"
  ]);
  u != null && l(e, ["updateTime"], u);
  const c = s(t, ["metadata", "model"]);
  c != null && l(e, ["model"], c);
  const d = s(t, ["metadata", "output"]);
  return d != null && l(e, ["dest"], Ki(po(d))), e;
}
function Xe(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["displayName"]);
  o != null && l(e, ["displayName"], o);
  const i = s(t, ["state"]);
  i != null && l(e, ["state"], mo(i));
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["createTime"]);
  a != null && l(e, ["createTime"], a);
  const u = s(t, ["startTime"]);
  u != null && l(e, ["startTime"], u);
  const c = s(t, ["endTime"]);
  c != null && l(e, ["endTime"], c);
  const d = s(t, ["updateTime"]);
  d != null && l(e, ["updateTime"], d);
  const f = s(t, ["model"]);
  f != null && l(e, ["model"], f);
  const p = s(t, ["inputConfig"]);
  p != null && l(e, ["src"], Xi(p));
  const m = s(t, ["outputConfig"]);
  m != null && l(e, ["dest"], Yi(po(m)));
  const h = s(t, [
    "completionStats"
  ]);
  return h != null && l(e, ["completionStats"], h), e;
}
function Xi(t) {
  const e = {}, n = s(t, ["instancesFormat"]);
  n != null && l(e, ["format"], n);
  const o = s(t, ["gcsSource", "uris"]);
  o != null && l(e, ["gcsUri"], o);
  const i = s(t, [
    "bigquerySource",
    "inputUri"
  ]);
  return i != null && l(e, ["bigqueryUri"], i), e;
}
function Qi(t, e) {
  const n = {};
  if (s(e, ["format"]) !== void 0)
    throw new Error("format parameter is not supported in Gemini API.");
  if (s(e, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  if (s(e, ["bigqueryUri"]) !== void 0)
    throw new Error("bigqueryUri parameter is not supported in Gemini API.");
  const o = s(e, ["fileName"]);
  o != null && l(n, ["fileName"], o);
  const i = s(e, [
    "inlinedRequests"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Rs(t, a))), l(n, ["requests", "requests"], r);
  }
  return n;
}
function Zi(t) {
  const e = {}, n = s(t, ["format"]);
  n != null && l(e, ["instancesFormat"], n);
  const o = s(t, ["gcsUri"]);
  o != null && l(e, ["gcsSource", "uris"], o);
  const i = s(t, ["bigqueryUri"]);
  if (i != null && l(e, ["bigquerySource", "inputUri"], i), s(t, ["fileName"]) !== void 0)
    throw new Error("fileName parameter is not supported in Vertex AI.");
  if (s(t, ["inlinedRequests"]) !== void 0)
    throw new Error("inlinedRequests parameter is not supported in Vertex AI.");
  return e;
}
function ji(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && l(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function es(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], pe(t, o)), n;
}
function ts(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], pe(t, o)), n;
}
function ns(t) {
  const e = {}, n = s(t, ["content"]);
  n != null && l(e, ["content"], n);
  const o = s(t, [
    "citationMetadata"
  ]);
  o != null && l(e, ["citationMetadata"], os(o));
  const i = s(t, ["tokenCount"]);
  i != null && l(e, ["tokenCount"], i);
  const r = s(t, ["finishReason"]);
  r != null && l(e, ["finishReason"], r);
  const a = s(t, ["avgLogprobs"]);
  a != null && l(e, ["avgLogprobs"], a);
  const u = s(t, [
    "groundingMetadata"
  ]);
  u != null && l(e, ["groundingMetadata"], u);
  const c = s(t, ["index"]);
  c != null && l(e, ["index"], c);
  const d = s(t, [
    "logprobsResult"
  ]);
  d != null && l(e, ["logprobsResult"], d);
  const f = s(t, [
    "safetyRatings"
  ]);
  if (f != null) {
    let m = f;
    Array.isArray(m) && (m = m.map((h) => h)), l(e, ["safetyRatings"], m);
  }
  const p = s(t, [
    "urlContextMetadata"
  ]);
  return p != null && l(e, ["urlContextMetadata"], p), e;
}
function os(t) {
  const e = {}, n = s(t, ["citationSources"]);
  if (n != null) {
    let o = n;
    Array.isArray(o) && (o = o.map((i) => i)), l(e, ["citations"], o);
  }
  return e;
}
function ho(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => ks(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function is(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  if (e !== void 0 && o != null && l(e, ["batch", "displayName"], o), s(t, ["dest"]) !== void 0)
    throw new Error("dest parameter is not supported in Gemini API.");
  return n;
}
function ss(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  e !== void 0 && o != null && l(e, ["displayName"], o);
  const i = s(t, ["dest"]);
  return e !== void 0 && i != null && l(e, ["outputConfig"], zi(Wi(i))), n;
}
function xn(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["_url", "model"], D(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["batch", "inputConfig"], Qi(t, fo(t, i)));
  const r = s(e, ["config"]);
  return r != null && is(r, n), n;
}
function rs(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], D(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["inputConfig"], Zi(fo(t, i)));
  const r = s(e, ["config"]);
  return r != null && ss(r, n), n;
}
function ls(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  return e !== void 0 && o != null && l(e, ["batch", "displayName"], o), n;
}
function as(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["_url", "model"], D(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["batch", "inputConfig"], hs(t, i));
  const r = s(e, ["config"]);
  return r != null && ls(r, n), n;
}
function us(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], pe(t, o)), n;
}
function ds(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], pe(t, o)), n;
}
function cs(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["name"]);
  o != null && l(e, ["name"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  return r != null && l(e, ["error"], r), e;
}
function fs(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["name"]);
  o != null && l(e, ["name"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  return r != null && l(e, ["error"], r), e;
}
function ps(t, e) {
  const n = {}, o = s(e, ["contents"]);
  if (o != null) {
    let r = dt(t, o);
    Array.isArray(r) && (r = r.map((a) => a)), l(n, ["requests[]", "request", "content"], r);
  }
  const i = s(e, ["config"]);
  return i != null && (l(n, ["_self"], ms(i, n)), ui(n, { "requests[].*": "requests[].request.*" })), n;
}
function ms(t, e) {
  const n = {}, o = s(t, ["taskType"]);
  e !== void 0 && o != null && l(e, ["requests[]", "taskType"], o);
  const i = s(t, ["title"]);
  e !== void 0 && i != null && l(e, ["requests[]", "title"], i);
  const r = s(t, [
    "outputDimensionality"
  ]);
  if (e !== void 0 && r != null && l(e, ["requests[]", "outputDimensionality"], r), s(t, ["mimeType"]) !== void 0)
    throw new Error("mimeType parameter is not supported in Gemini API.");
  if (s(t, ["autoTruncate"]) !== void 0)
    throw new Error("autoTruncate parameter is not supported in Gemini API.");
  return n;
}
function hs(t, e) {
  const n = {}, o = s(e, ["fileName"]);
  o != null && l(n, ["file_name"], o);
  const i = s(e, [
    "inlinedRequests"
  ]);
  return i != null && l(n, ["requests"], ps(t, i)), n;
}
function gs(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function ys(t) {
  const e = {}, n = s(t, ["id"]);
  n != null && l(e, ["id"], n);
  const o = s(t, ["args"]);
  o != null && l(e, ["args"], o);
  const i = s(t, ["name"]);
  if (i != null && l(e, ["name"], i), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Ts(t) {
  const e = {}, n = s(t, [
    "allowedFunctionNames"
  ]);
  n != null && l(e, ["allowedFunctionNames"], n);
  const o = s(t, ["mode"]);
  if (o != null && l(e, ["mode"], o), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return e;
}
function _s(t, e, n) {
  const o = {}, i = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && i != null && l(n, ["systemInstruction"], ho(H(i)));
  const r = s(e, ["temperature"]);
  r != null && l(o, ["temperature"], r);
  const a = s(e, ["topP"]);
  a != null && l(o, ["topP"], a);
  const u = s(e, ["topK"]);
  u != null && l(o, ["topK"], u);
  const c = s(e, [
    "candidateCount"
  ]);
  c != null && l(o, ["candidateCount"], c);
  const d = s(e, [
    "maxOutputTokens"
  ]);
  d != null && l(o, ["maxOutputTokens"], d);
  const f = s(e, [
    "stopSequences"
  ]);
  f != null && l(o, ["stopSequences"], f);
  const p = s(e, [
    "responseLogprobs"
  ]);
  p != null && l(o, ["responseLogprobs"], p);
  const m = s(e, ["logprobs"]);
  m != null && l(o, ["logprobs"], m);
  const h = s(e, [
    "presencePenalty"
  ]);
  h != null && l(o, ["presencePenalty"], h);
  const g = s(e, [
    "frequencyPenalty"
  ]);
  g != null && l(o, ["frequencyPenalty"], g);
  const T = s(e, ["seed"]);
  T != null && l(o, ["seed"], T);
  const y = s(e, [
    "responseMimeType"
  ]);
  y != null && l(o, ["responseMimeType"], y);
  const E = s(e, [
    "responseSchema"
  ]);
  E != null && l(o, ["responseSchema"], ct(E));
  const v = s(e, [
    "responseJsonSchema"
  ]);
  if (v != null && l(o, ["responseJsonSchema"], v), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const S = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && S != null) {
    let k = S;
    Array.isArray(k) && (k = k.map((L) => Ls(L))), l(n, ["safetySettings"], k);
  }
  const _ = s(e, ["tools"]);
  if (n !== void 0 && _ != null) {
    let k = fe(_);
    Array.isArray(k) && (k = k.map((L) => Gs(ce(L)))), l(n, ["tools"], k);
  }
  const C = s(e, ["toolConfig"]);
  if (n !== void 0 && C != null && l(n, ["toolConfig"], Fs(C)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const A = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && A != null && l(n, ["cachedContent"], Q(t, A));
  const R = s(e, [
    "responseModalities"
  ]);
  R != null && l(o, ["responseModalities"], R);
  const N = s(e, [
    "mediaResolution"
  ]);
  N != null && l(o, ["mediaResolution"], N);
  const P = s(e, ["speechConfig"]);
  if (P != null && l(o, ["speechConfig"], ft(P)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const x = s(e, [
    "thinkingConfig"
  ]);
  x != null && l(o, ["thinkingConfig"], x);
  const U = s(e, ["imageConfig"]);
  U != null && l(o, ["imageConfig"], As(U));
  const F = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (F != null && l(o, ["enableEnhancedCivicAnswers"], F), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return o;
}
function Cs(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["candidates"]);
  if (o != null) {
    let c = o;
    Array.isArray(c) && (c = c.map((d) => ns(d))), l(e, ["candidates"], c);
  }
  const i = s(t, ["modelVersion"]);
  i != null && l(e, ["modelVersion"], i);
  const r = s(t, [
    "promptFeedback"
  ]);
  r != null && l(e, ["promptFeedback"], r);
  const a = s(t, ["responseId"]);
  a != null && l(e, ["responseId"], a);
  const u = s(t, [
    "usageMetadata"
  ]);
  return u != null && l(e, ["usageMetadata"], u), e;
}
function Es(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], pe(t, o)), n;
}
function Ss(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], pe(t, o)), n;
}
function Is(t) {
  const e = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const n = s(t, ["enableWidget"]);
  return n != null && l(e, ["enableWidget"], n), e;
}
function vs(t) {
  const e = {};
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const n = s(t, [
    "timeRangeFilter"
  ]);
  return n != null && l(e, ["timeRangeFilter"], n), e;
}
function As(t) {
  const e = {}, n = s(t, ["aspectRatio"]);
  n != null && l(e, ["aspectRatio"], n);
  const o = s(t, ["imageSize"]);
  if (o != null && l(e, ["imageSize"], o), s(t, ["personGeneration"]) !== void 0)
    throw new Error("personGeneration parameter is not supported in Gemini API.");
  if (s(t, ["outputMimeType"]) !== void 0)
    throw new Error("outputMimeType parameter is not supported in Gemini API.");
  if (s(t, ["outputCompressionQuality"]) !== void 0)
    throw new Error("outputCompressionQuality parameter is not supported in Gemini API.");
  return e;
}
function Rs(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["request", "model"], D(t, o));
  const i = s(e, ["contents"]);
  if (i != null) {
    let u = B(i);
    Array.isArray(u) && (u = u.map((c) => ho(c))), l(n, ["request", "contents"], u);
  }
  const r = s(e, ["metadata"]);
  r != null && l(n, ["metadata"], r);
  const a = s(e, ["config"]);
  return a != null && l(n, ["request", "generationConfig"], _s(t, a, s(n, ["request"], {}))), n;
}
function Ps(t) {
  const e = {}, n = s(t, ["response"]);
  n != null && l(e, ["response"], Cs(n));
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["error"]);
  return i != null && l(e, ["error"], i), e;
}
function ws(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  if (e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), s(t, ["filter"]) !== void 0)
    throw new Error("filter parameter is not supported in Gemini API.");
  return n;
}
function Ms(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  e !== void 0 && i != null && l(e, ["_query", "pageToken"], i);
  const r = s(t, ["filter"]);
  return e !== void 0 && r != null && l(e, ["_query", "filter"], r), n;
}
function Ns(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && ws(n, e), e;
}
function xs(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Ms(n, e), e;
}
function Ds(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(t, ["operations"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Ae(a))), l(e, ["batchJobs"], r);
  }
  return e;
}
function Us(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(t, [
    "batchPredictionJobs"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Xe(a))), l(e, ["batchJobs"], r);
  }
  return e;
}
function ks(t) {
  const e = {}, n = s(t, [
    "mediaResolution"
  ]);
  n != null && l(e, ["mediaResolution"], n);
  const o = s(t, [
    "codeExecutionResult"
  ]);
  o != null && l(e, ["codeExecutionResult"], o);
  const i = s(t, [
    "executableCode"
  ]);
  i != null && l(e, ["executableCode"], i);
  const r = s(t, ["fileData"]);
  r != null && l(e, ["fileData"], gs(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], ys(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(t, ["inlineData"]);
  c != null && l(e, ["inlineData"], ji(c));
  const d = s(t, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(t, ["thought"]);
  f != null && l(e, ["thought"], f);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && l(e, ["thoughtSignature"], p);
  const m = s(t, [
    "videoMetadata"
  ]);
  return m != null && l(e, ["videoMetadata"], m), e;
}
function Ls(t) {
  const e = {}, n = s(t, ["category"]);
  if (n != null && l(e, ["category"], n), s(t, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const o = s(t, ["threshold"]);
  return o != null && l(e, ["threshold"], o), e;
}
function Fs(t) {
  const e = {}, n = s(t, [
    "retrievalConfig"
  ]);
  n != null && l(e, ["retrievalConfig"], n);
  const o = s(t, [
    "functionCallingConfig"
  ]);
  return o != null && l(e, ["functionCallingConfig"], Ts(o)), e;
}
function Gs(t) {
  const e = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(t, ["computerUse"]);
  n != null && l(e, ["computerUse"], n);
  const o = s(t, ["fileSearch"]);
  o != null && l(e, ["fileSearch"], o);
  const i = s(t, [
    "codeExecution"
  ]);
  if (i != null && l(e, ["codeExecution"], i), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const r = s(t, [
    "functionDeclarations"
  ]);
  if (r != null) {
    let f = r;
    Array.isArray(f) && (f = f.map((p) => p)), l(e, ["functionDeclarations"], f);
  }
  const a = s(t, ["googleMaps"]);
  a != null && l(e, ["googleMaps"], Is(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], vs(u));
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(t, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var z;
(function(t) {
  t.PAGED_ITEM_BATCH_JOBS = "batchJobs", t.PAGED_ITEM_MODELS = "models", t.PAGED_ITEM_TUNING_JOBS = "tuningJobs", t.PAGED_ITEM_FILES = "files", t.PAGED_ITEM_CACHED_CONTENTS = "cachedContents", t.PAGED_ITEM_FILE_SEARCH_STORES = "fileSearchStores", t.PAGED_ITEM_DOCUMENTS = "documents";
})(z || (z = {}));
class oe {
  constructor(e, n, o, i) {
    this.pageInternal = [], this.paramsInternal = {}, this.requestInternal = n, this.init(e, o, i);
  }
  init(e, n, o) {
    var i, r;
    this.nameInternal = e, this.pageInternal = n[this.nameInternal] || [], this.sdkHttpResponseInternal = n == null ? void 0 : n.sdkHttpResponse, this.idxInternal = 0;
    let a = { config: {} };
    !o || Object.keys(o).length === 0 ? a = { config: {} } : typeof o == "object" ? a = Object.assign({}, o) : a = o, a.config && (a.config.pageToken = n.nextPageToken), this.paramsInternal = a, this.pageInternalSize = (r = (i = a.config) === null || i === void 0 ? void 0 : i.pageSize) !== null && r !== void 0 ? r : this.pageInternal.length;
  }
  initNextPage(e) {
    this.init(this.nameInternal, e, this.paramsInternal);
  }
  /**
   * Returns the current page, which is a list of items.
   *
   * @remarks
   * The first page is retrieved when the pager is created. The returned list of
   * items could be a subset of the entire list.
   */
  get page() {
    return this.pageInternal;
  }
  /**
   * Returns the type of paged item (for example, ``batch_jobs``).
   */
  get name() {
    return this.nameInternal;
  }
  /**
   * Returns the length of the page fetched each time by this pager.
   *
   * @remarks
   * The number of items in the page is less than or equal to the page length.
   */
  get pageSize() {
    return this.pageInternalSize;
  }
  /**
   * Returns the headers of the API response.
   */
  get sdkHttpResponse() {
    return this.sdkHttpResponseInternal;
  }
  /**
   * Returns the parameters when making the API request for the next page.
   *
   * @remarks
   * Parameters contain a set of optional configs that can be
   * used to customize the API request. For example, the `pageToken` parameter
   * contains the token to request the next page.
   */
  get params() {
    return this.paramsInternal;
  }
  /**
   * Returns the total number of items in the current page.
   */
  get pageLength() {
    return this.pageInternal.length;
  }
  /**
   * Returns the item at the given index.
   */
  getItem(e) {
    return this.pageInternal[e];
  }
  /**
   * Returns an async iterator that support iterating through all items
   * retrieved from the API.
   *
   * @remarks
   * The iterator will automatically fetch the next page if there are more items
   * to fetch from the API.
   *
   * @example
   *
   * ```ts
   * const pager = await ai.files.list({config: {pageSize: 10}});
   * for await (const file of pager) {
   *   console.log(file.name);
   * }
   * ```
   */
  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        if (this.idxInternal >= this.pageLength)
          if (this.hasNextPage())
            await this.nextPage();
          else
            return { value: void 0, done: !0 };
        const e = this.getItem(this.idxInternal);
        return this.idxInternal += 1, { value: e, done: !1 };
      },
      return: async () => ({ value: void 0, done: !0 })
    };
  }
  /**
   * Fetches the next page of items. This makes a new API request.
   *
   * @throws {Error} If there are no more pages to fetch.
   *
   * @example
   *
   * ```ts
   * const pager = await ai.files.list({config: {pageSize: 10}});
   * let page = pager.page;
   * while (true) {
   *   for (const file of page) {
   *     console.log(file.name);
   *   }
   *   if (!pager.hasNextPage()) {
   *     break;
   *   }
   *   page = await pager.nextPage();
   * }
   * ```
   */
  async nextPage() {
    if (!this.hasNextPage())
      throw new Error("No more pages to fetch.");
    const e = await this.requestInternal(this.params);
    return this.initNextPage(e), this.page;
  }
  /**
   * Returns true if there are more pages to fetch from the API.
   */
  hasNextPage() {
    var e;
    return ((e = this.params.config) === null || e === void 0 ? void 0 : e.pageToken) !== void 0;
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Hs extends X {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new oe(z.PAGED_ITEM_BATCH_JOBS, (o) => this.listInternal(o), await this.listInternal(n), n), this.create = async (n) => (this.apiClient.isVertexAI() && (n.config = this.formatDestination(n.src, n.config)), this.createInternal(n)), this.createEmbeddings = async (n) => {
      if (console.warn("batches.createEmbeddings() is experimental and may change without notice."), this.apiClient.isVertexAI())
        throw new Error("Vertex AI does not support batches.createEmbeddings.");
      return this.createEmbeddingsInternal(n);
    };
  }
  // Helper function to handle inlined generate content requests
  createInlinedGenerateContentRequest(e) {
    const n = xn(
      this.apiClient,
      // Use instance apiClient
      e
    ), o = n._url, i = I("{model}:batchGenerateContent", o), u = n.batch.inputConfig.requests, c = u.requests, d = [];
    for (const f of c) {
      const p = Object.assign({}, f);
      if (p.systemInstruction) {
        const m = p.systemInstruction;
        delete p.systemInstruction;
        const h = p.request;
        h.systemInstruction = m, p.request = h;
      }
      d.push(p);
    }
    return u.requests = d, delete n.config, delete n._url, delete n._query, { path: i, body: n };
  }
  // Helper function to get the first GCS URI
  getGcsUri(e) {
    if (typeof e == "string")
      return e.startsWith("gs://") ? e : void 0;
    if (!Array.isArray(e) && e.gcsUri && e.gcsUri.length > 0)
      return e.gcsUri[0];
  }
  // Helper function to get the BigQuery URI
  getBigqueryUri(e) {
    if (typeof e == "string")
      return e.startsWith("bq://") ? e : void 0;
    if (!Array.isArray(e))
      return e.bigqueryUri;
  }
  // Function to format the destination configuration for Vertex AI
  formatDestination(e, n) {
    const o = n ? Object.assign({}, n) : {}, i = Date.now().toString();
    if (o.displayName || (o.displayName = `genaiBatchJob_${i}`), o.dest === void 0) {
      const r = this.getGcsUri(e), a = this.getBigqueryUri(e);
      if (r)
        r.endsWith(".jsonl") ? o.dest = `${r.slice(0, -6)}/dest` : o.dest = `${r}_dest_${i}`;
      else if (a)
        o.dest = `${a}_dest_${i}`;
      else
        throw new Error("Unsupported source for Vertex AI: No GCS or BigQuery URI found.");
    }
    return o;
  }
  /**
   * Internal method to create batch job.
   *
   * @param params - The parameters for create batch job request.
   * @return The created batch job.
   *
   */
  async createInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = rs(this.apiClient, e);
      return u = I("batchPredictionJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Xe(f));
    } else {
      const d = xn(this.apiClient, e);
      return u = I("{model}:batchGenerateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ae(f));
    }
  }
  /**
   * Internal method to create batch job.
   *
   * @param params - The parameters for create batch job request.
   * @return The created batch job.
   *
   */
  async createEmbeddingsInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = as(this.apiClient, e);
      return r = I("{model}:asyncBatchEmbedContent", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => Ae(c));
    }
  }
  /**
   * Gets batch job configurations.
   *
   * @param params - The parameters for the get request.
   * @return The batch job.
   *
   * @example
   * ```ts
   * await ai.batches.get({name: '...'}); // The server-generated resource name.
   * ```
   */
  async get(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Ss(this.apiClient, e);
      return u = I("batchPredictionJobs/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Xe(f));
    } else {
      const d = Es(this.apiClient, e);
      return u = I("batches/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ae(f));
    }
  }
  /**
   * Cancels a batch job.
   *
   * @param params - The parameters for the cancel request.
   * @return The empty response returned by the API.
   *
   * @example
   * ```ts
   * await ai.batches.cancel({name: '...'}); // The server-generated resource name.
   * ```
   */
  async cancel(e) {
    var n, o, i, r;
    let a = "", u = {};
    if (this.apiClient.isVertexAI()) {
      const c = ts(this.apiClient, e);
      a = I("batchPredictionJobs/{name}:cancel", c._url), u = c._query, delete c._url, delete c._query, await this.apiClient.request({
        path: a,
        queryParams: u,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    } else {
      const c = es(this.apiClient, e);
      a = I("batches/{name}:cancel", c._url), u = c._query, delete c._url, delete c._query, await this.apiClient.request({
        path: a,
        queryParams: u,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      });
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = xs(e);
      return u = I("batchPredictionJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Us(f), m = new Pn();
        return Object.assign(m, p), m;
      });
    } else {
      const d = Ns(e);
      return u = I("batches", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Ds(f), m = new Pn();
        return Object.assign(m, p), m;
      });
    }
  }
  /**
   * Deletes a batch job.
   *
   * @param params - The parameters for the delete request.
   * @return The empty response returned by the API.
   *
   * @example
   * ```ts
   * await ai.batches.delete({name: '...'}); // The server-generated resource name.
   * ```
   */
  async delete(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = ds(this.apiClient, e);
      return u = I("batchPredictionJobs/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => fs(f));
    } else {
      const d = us(this.apiClient, e);
      return u = I("batches/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => cs(f));
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Vs(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && l(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Dn(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => ar(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function bs(t, e) {
  const n = {}, o = s(t, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(t, ["expireTime"]);
  e !== void 0 && i != null && l(e, ["expireTime"], i);
  const r = s(t, ["displayName"]);
  e !== void 0 && r != null && l(e, ["displayName"], r);
  const a = s(t, ["contents"]);
  if (e !== void 0 && a != null) {
    let f = B(a);
    Array.isArray(f) && (f = f.map((p) => Dn(p))), l(e, ["contents"], f);
  }
  const u = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && u != null && l(e, ["systemInstruction"], Dn(H(u)));
  const c = s(t, ["tools"]);
  if (e !== void 0 && c != null) {
    let f = c;
    Array.isArray(f) && (f = f.map((p) => dr(p))), l(e, ["tools"], f);
  }
  const d = s(t, ["toolConfig"]);
  if (e !== void 0 && d != null && l(e, ["toolConfig"], ur(d)), s(t, ["kmsKeyName"]) !== void 0)
    throw new Error("kmsKeyName parameter is not supported in Gemini API.");
  return n;
}
function qs(t, e) {
  const n = {}, o = s(t, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(t, ["expireTime"]);
  e !== void 0 && i != null && l(e, ["expireTime"], i);
  const r = s(t, ["displayName"]);
  e !== void 0 && r != null && l(e, ["displayName"], r);
  const a = s(t, ["contents"]);
  if (e !== void 0 && a != null) {
    let p = B(a);
    Array.isArray(p) && (p = p.map((m) => m)), l(e, ["contents"], p);
  }
  const u = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && u != null && l(e, ["systemInstruction"], H(u));
  const c = s(t, ["tools"]);
  if (e !== void 0 && c != null) {
    let p = c;
    Array.isArray(p) && (p = p.map((m) => cr(m))), l(e, ["tools"], p);
  }
  const d = s(t, ["toolConfig"]);
  e !== void 0 && d != null && l(e, ["toolConfig"], d);
  const f = s(t, ["kmsKeyName"]);
  return e !== void 0 && f != null && l(e, ["encryption_spec", "kmsKeyName"], f), n;
}
function Bs(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], no(t, o));
  const i = s(e, ["config"]);
  return i != null && bs(i, n), n;
}
function Js(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], no(t, o));
  const i = s(e, ["config"]);
  return i != null && qs(i, n), n;
}
function Os(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], Q(t, o)), n;
}
function $s(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], Q(t, o)), n;
}
function Ws(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function Ks(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function Ys(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function zs(t) {
  const e = {}, n = s(t, ["id"]);
  n != null && l(e, ["id"], n);
  const o = s(t, ["args"]);
  o != null && l(e, ["args"], o);
  const i = s(t, ["name"]);
  if (i != null && l(e, ["name"], i), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Xs(t) {
  const e = {}, n = s(t, [
    "allowedFunctionNames"
  ]);
  n != null && l(e, ["allowedFunctionNames"], n);
  const o = s(t, ["mode"]);
  if (o != null && l(e, ["mode"], o), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return e;
}
function Qs(t) {
  const e = {}, n = s(t, ["description"]);
  n != null && l(e, ["description"], n);
  const o = s(t, ["name"]);
  o != null && l(e, ["name"], o);
  const i = s(t, ["parameters"]);
  i != null && l(e, ["parameters"], i);
  const r = s(t, [
    "parametersJsonSchema"
  ]);
  r != null && l(e, ["parametersJsonSchema"], r);
  const a = s(t, ["response"]);
  a != null && l(e, ["response"], a);
  const u = s(t, [
    "responseJsonSchema"
  ]);
  if (u != null && l(e, ["responseJsonSchema"], u), s(t, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return e;
}
function Zs(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], Q(t, o)), n;
}
function js(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], Q(t, o)), n;
}
function er(t) {
  const e = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const n = s(t, ["enableWidget"]);
  return n != null && l(e, ["enableWidget"], n), e;
}
function tr(t) {
  const e = {};
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const n = s(t, [
    "timeRangeFilter"
  ]);
  return n != null && l(e, ["timeRangeFilter"], n), e;
}
function nr(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function or(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function ir(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && nr(n, e), e;
}
function sr(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && or(n, e), e;
}
function rr(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(t, [
    "cachedContents"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["cachedContents"], r);
  }
  return e;
}
function lr(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(t, [
    "cachedContents"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["cachedContents"], r);
  }
  return e;
}
function ar(t) {
  const e = {}, n = s(t, [
    "mediaResolution"
  ]);
  n != null && l(e, ["mediaResolution"], n);
  const o = s(t, [
    "codeExecutionResult"
  ]);
  o != null && l(e, ["codeExecutionResult"], o);
  const i = s(t, [
    "executableCode"
  ]);
  i != null && l(e, ["executableCode"], i);
  const r = s(t, ["fileData"]);
  r != null && l(e, ["fileData"], Ys(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], zs(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(t, ["inlineData"]);
  c != null && l(e, ["inlineData"], Vs(c));
  const d = s(t, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(t, ["thought"]);
  f != null && l(e, ["thought"], f);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && l(e, ["thoughtSignature"], p);
  const m = s(t, [
    "videoMetadata"
  ]);
  return m != null && l(e, ["videoMetadata"], m), e;
}
function ur(t) {
  const e = {}, n = s(t, [
    "retrievalConfig"
  ]);
  n != null && l(e, ["retrievalConfig"], n);
  const o = s(t, [
    "functionCallingConfig"
  ]);
  return o != null && l(e, ["functionCallingConfig"], Xs(o)), e;
}
function dr(t) {
  const e = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(t, ["computerUse"]);
  n != null && l(e, ["computerUse"], n);
  const o = s(t, ["fileSearch"]);
  o != null && l(e, ["fileSearch"], o);
  const i = s(t, [
    "codeExecution"
  ]);
  if (i != null && l(e, ["codeExecution"], i), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const r = s(t, [
    "functionDeclarations"
  ]);
  if (r != null) {
    let f = r;
    Array.isArray(f) && (f = f.map((p) => p)), l(e, ["functionDeclarations"], f);
  }
  const a = s(t, ["googleMaps"]);
  a != null && l(e, ["googleMaps"], er(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], tr(u));
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(t, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
function cr(t) {
  const e = {}, n = s(t, ["retrieval"]);
  n != null && l(e, ["retrieval"], n);
  const o = s(t, ["computerUse"]);
  if (o != null && l(e, ["computerUse"], o), s(t, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const i = s(t, [
    "codeExecution"
  ]);
  i != null && l(e, ["codeExecution"], i);
  const r = s(t, [
    "enterpriseWebSearch"
  ]);
  r != null && l(e, ["enterpriseWebSearch"], r);
  const a = s(t, [
    "functionDeclarations"
  ]);
  if (a != null) {
    let p = a;
    Array.isArray(p) && (p = p.map((m) => Qs(m))), l(e, ["functionDeclarations"], p);
  }
  const u = s(t, ["googleMaps"]);
  u != null && l(e, ["googleMaps"], u);
  const c = s(t, ["googleSearch"]);
  c != null && l(e, ["googleSearch"], c);
  const d = s(t, [
    "googleSearchRetrieval"
  ]);
  d != null && l(e, ["googleSearchRetrieval"], d);
  const f = s(t, ["urlContext"]);
  return f != null && l(e, ["urlContext"], f), e;
}
function fr(t, e) {
  const n = {}, o = s(t, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(t, ["expireTime"]);
  return e !== void 0 && i != null && l(e, ["expireTime"], i), n;
}
function pr(t, e) {
  const n = {}, o = s(t, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(t, ["expireTime"]);
  return e !== void 0 && i != null && l(e, ["expireTime"], i), n;
}
function mr(t, e) {
  const n = {}, o = s(e, ["name"]);
  o != null && l(n, ["_url", "name"], Q(t, o));
  const i = s(e, ["config"]);
  return i != null && fr(i, n), n;
}
function hr(t, e) {
  const n = {}, o = s(e, ["name"]);
  o != null && l(n, ["_url", "name"], Q(t, o));
  const i = s(e, ["config"]);
  return i != null && pr(i, n), n;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class gr extends X {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new oe(z.PAGED_ITEM_CACHED_CONTENTS, (o) => this.listInternal(o), await this.listInternal(n), n);
  }
  /**
   * Creates a cached contents resource.
   *
   * @remarks
   * Context caching is only supported for specific models. See [Gemini
   * Developer API reference](https://ai.google.dev/gemini-api/docs/caching?lang=node/context-cac)
   * and [Vertex AI reference](https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview#supported_models)
   * for more information.
   *
   * @param params - The parameters for the create request.
   * @return The created cached content.
   *
   * @example
   * ```ts
   * const contents = ...; // Initialize the content to cache.
   * const response = await ai.caches.create({
   *   model: 'gemini-2.0-flash-001',
   *   config: {
   *    'contents': contents,
   *    'displayName': 'test cache',
   *    'systemInstruction': 'What is the sum of the two pdfs?',
   *    'ttl': '86400s',
   *  }
   * });
   * ```
   */
  async create(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Js(this.apiClient, e);
      return u = I("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const d = Bs(this.apiClient, e);
      return u = I("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    }
  }
  /**
   * Gets cached content configurations.
   *
   * @param params - The parameters for the get request.
   * @return The cached content.
   *
   * @example
   * ```ts
   * await ai.caches.get({name: '...'}); // The server-generated resource name.
   * ```
   */
  async get(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = js(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const d = Zs(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    }
  }
  /**
   * Deletes cached content.
   *
   * @param params - The parameters for the delete request.
   * @return The empty response returned by the API.
   *
   * @example
   * ```ts
   * await ai.caches.delete({name: '...'}); // The server-generated resource name.
   * ```
   */
  async delete(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = $s(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Ks(f), m = new An();
        return Object.assign(m, p), m;
      });
    } else {
      const d = Os(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Ws(f), m = new An();
        return Object.assign(m, p), m;
      });
    }
  }
  /**
   * Updates cached content configurations.
   *
   * @param params - The parameters for the update request.
   * @return The updated cached content.
   *
   * @example
   * ```ts
   * const response = await ai.caches.update({
   *   name: '...',  // The server-generated resource name.
   *   config: {'ttl': '7600s'}
   * });
   * ```
   */
  async update(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = hr(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const d = mr(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = sr(e);
      return u = I("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = lr(f), m = new Rn();
        return Object.assign(m, p), m;
      });
    } else {
      const d = ir(e);
      return u = I("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = rr(f), m = new Rn();
        return Object.assign(m, p), m;
      });
    }
  }
}
function xe(t, e) {
  var n = {};
  for (var o in t) Object.prototype.hasOwnProperty.call(t, o) && e.indexOf(o) < 0 && (n[o] = t[o]);
  if (t != null && typeof Object.getOwnPropertySymbols == "function")
    for (var i = 0, o = Object.getOwnPropertySymbols(t); i < o.length; i++)
      e.indexOf(o[i]) < 0 && Object.prototype.propertyIsEnumerable.call(t, o[i]) && (n[o[i]] = t[o[i]]);
  return n;
}
function Un(t) {
  var e = typeof Symbol == "function" && Symbol.iterator, n = e && t[e], o = 0;
  if (n) return n.call(t);
  if (t && typeof t.length == "number") return {
    next: function() {
      return t && o >= t.length && (t = void 0), { value: t && t[o++], done: !t };
    }
  };
  throw new TypeError(e ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function M(t) {
  return this instanceof M ? (this.v = t, this) : new M(t);
}
function O(t, e, n) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var o = n.apply(t, e || []), i, r = [];
  return i = Object.create((typeof AsyncIterator == "function" ? AsyncIterator : Object).prototype), u("next"), u("throw"), u("return", a), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function a(h) {
    return function(g) {
      return Promise.resolve(g).then(h, p);
    };
  }
  function u(h, g) {
    o[h] && (i[h] = function(T) {
      return new Promise(function(y, E) {
        r.push([h, T, y, E]) > 1 || c(h, T);
      });
    }, g && (i[h] = g(i[h])));
  }
  function c(h, g) {
    try {
      d(o[h](g));
    } catch (T) {
      m(r[0][3], T);
    }
  }
  function d(h) {
    h.value instanceof M ? Promise.resolve(h.value.v).then(f, p) : m(r[0][2], h);
  }
  function f(h) {
    c("next", h);
  }
  function p(h) {
    c("throw", h);
  }
  function m(h, g) {
    h(g), r.shift(), r.length && c(r[0][0], r[0][1]);
  }
}
function $(t) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var e = t[Symbol.asyncIterator], n;
  return e ? e.call(t) : (t = typeof Un == "function" ? Un(t) : t[Symbol.iterator](), n = {}, o("next"), o("throw"), o("return"), n[Symbol.asyncIterator] = function() {
    return this;
  }, n);
  function o(r) {
    n[r] = t[r] && function(a) {
      return new Promise(function(u, c) {
        a = t[r](a), i(u, c, a.done, a.value);
      });
    };
  }
  function i(r, a, u, c) {
    Promise.resolve(c).then(function(d) {
      r({ value: d, done: u });
    }, a);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function yr(t) {
  var e;
  if (t.candidates == null || t.candidates.length === 0)
    return !1;
  const n = (e = t.candidates[0]) === null || e === void 0 ? void 0 : e.content;
  return n === void 0 ? !1 : go(n);
}
function go(t) {
  if (t.parts === void 0 || t.parts.length === 0)
    return !1;
  for (const e of t.parts)
    if (e === void 0 || Object.keys(e).length === 0)
      return !1;
  return !0;
}
function Tr(t) {
  if (t.length !== 0) {
    for (const e of t)
      if (e.role !== "user" && e.role !== "model")
        throw new Error(`Role must be user or model, but got ${e.role}.`);
  }
}
function kn(t) {
  if (t === void 0 || t.length === 0)
    return [];
  const e = [], n = t.length;
  let o = 0;
  for (; o < n; )
    if (t[o].role === "user")
      e.push(t[o]), o++;
    else {
      const i = [];
      let r = !0;
      for (; o < n && t[o].role === "model"; )
        i.push(t[o]), r && !go(t[o]) && (r = !1), o++;
      r ? e.push(...i) : e.pop();
    }
  return e;
}
class _r {
  constructor(e, n) {
    this.modelsModule = e, this.apiClient = n;
  }
  /**
   * Creates a new chat session.
   *
   * @remarks
   * The config in the params will be used for all requests within the chat
   * session unless overridden by a per-request `config` in
   * @see {@link types.SendMessageParameters#config}.
   *
   * @param params - Parameters for creating a chat session.
   * @returns A new chat session.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({
   *   model: 'gemini-2.0-flash'
   *   config: {
   *     temperature: 0.5,
   *     maxOutputTokens: 1024,
   *   }
   * });
   * ```
   */
  create(e) {
    return new Cr(
      this.apiClient,
      this.modelsModule,
      e.model,
      e.config,
      // Deep copy the history to avoid mutating the history outside of the
      // chat session.
      structuredClone(e.history)
    );
  }
}
class Cr {
  constructor(e, n, o, i = {}, r = []) {
    this.apiClient = e, this.modelsModule = n, this.model = o, this.config = i, this.history = r, this.sendPromise = Promise.resolve(), Tr(r);
  }
  /**
   * Sends a message to the model and returns the response.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessageStream} for streaming method.
   * @param params - parameters for sending messages within a chat session.
   * @returns The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessage({
   *   message: 'Why is the sky blue?'
   * });
   * console.log(response.text);
   * ```
   */
  async sendMessage(e) {
    var n;
    await this.sendPromise;
    const o = H(e.message), i = this.modelsModule.generateContent({
      model: this.model,
      contents: this.getHistory(!0).concat(o),
      config: (n = e.config) !== null && n !== void 0 ? n : this.config
    });
    return this.sendPromise = (async () => {
      var r, a, u;
      const c = await i, d = (a = (r = c.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content, f = c.automaticFunctionCallingHistory, p = this.getHistory(!0).length;
      let m = [];
      f != null && (m = (u = f.slice(p)) !== null && u !== void 0 ? u : []);
      const h = d ? [d] : [];
      this.recordHistory(o, h, m);
    })(), await this.sendPromise.catch(() => {
      this.sendPromise = Promise.resolve();
    }), i;
  }
  /**
   * Sends a message to the model and returns the response in chunks.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessage} for non-streaming method.
   * @param params - parameters for sending the message.
   * @return The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessageStream({
   *   message: 'Why is the sky blue?'
   * });
   * for await (const chunk of response) {
   *   console.log(chunk.text);
   * }
   * ```
   */
  async sendMessageStream(e) {
    var n;
    await this.sendPromise;
    const o = H(e.message), i = this.modelsModule.generateContentStream({
      model: this.model,
      contents: this.getHistory(!0).concat(o),
      config: (n = e.config) !== null && n !== void 0 ? n : this.config
    });
    this.sendPromise = i.then(() => {
    }).catch(() => {
    });
    const r = await i;
    return this.processStreamResponse(r, o);
  }
  /**
   * Returns the chat history.
   *
   * @remarks
   * The history is a list of contents alternating between user and model.
   *
   * There are two types of history:
   * - The `curated history` contains only the valid turns between user and
   * model, which will be included in the subsequent requests sent to the model.
   * - The `comprehensive history` contains all turns, including invalid or
   *   empty model outputs, providing a complete record of the history.
   *
   * The history is updated after receiving the response from the model,
   * for streaming response, it means receiving the last chunk of the response.
   *
   * The `comprehensive history` is returned by default. To get the `curated
   * history`, set the `curated` parameter to `true`.
   *
   * @param curated - whether to return the curated history or the comprehensive
   *     history.
   * @return History contents alternating between user and model for the entire
   *     chat session.
   */
  getHistory(e = !1) {
    const n = e ? kn(this.history) : this.history;
    return structuredClone(n);
  }
  processStreamResponse(e, n) {
    return O(this, arguments, function* () {
      var i, r, a, u, c, d;
      const f = [];
      try {
        for (var p = !0, m = $(e), h; h = yield M(m.next()), i = h.done, !i; p = !0) {
          u = h.value, p = !1;
          const g = u;
          if (yr(g)) {
            const T = (d = (c = g.candidates) === null || c === void 0 ? void 0 : c[0]) === null || d === void 0 ? void 0 : d.content;
            T !== void 0 && f.push(T);
          }
          yield yield M(g);
        }
      } catch (g) {
        r = { error: g };
      } finally {
        try {
          !p && !i && (a = m.return) && (yield M(a.call(m)));
        } finally {
          if (r) throw r.error;
        }
      }
      this.recordHistory(n, f);
    });
  }
  recordHistory(e, n, o) {
    let i = [];
    n.length > 0 && n.every((r) => r.role !== void 0) ? i = n : i.push({
      role: "model",
      parts: []
    }), o && o.length > 0 ? this.history.push(...kn(o)) : this.history.push(e), this.history.push(...i);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class _e extends Error {
  constructor(e) {
    super(e.message), this.name = "ApiError", this.status = e.status, Object.setPrototypeOf(this, _e.prototype);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Er(t) {
  const e = {}, n = s(t, ["file"]);
  return n != null && l(e, ["file"], n), e;
}
function Sr(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function Ir(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "file"], ao(n)), e;
}
function vr(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function Ar(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "file"], ao(n)), e;
}
function Rr(t) {
  const e = {}, n = s(t, ["uris"]);
  return n != null && l(e, ["uris"], n), e;
}
function Pr(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function wr(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Pr(n, e), e;
}
function Mr(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(t, ["files"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["files"], r);
  }
  return e;
}
function Nr(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["files"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => r)), l(e, ["files"], i);
  }
  return e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class xr extends X {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new oe(z.PAGED_ITEM_FILES, (o) => this.listInternal(o), await this.listInternal(n), n);
  }
  /**
   * Uploads a file asynchronously to the Gemini API.
   * This method is not available in Vertex AI.
   * Supported upload sources:
   * - Node.js: File path (string) or Blob object.
   * - Browser: Blob object (e.g., File).
   *
   * @remarks
   * The `mimeType` can be specified in the `config` parameter. If omitted:
   *  - For file path (string) inputs, the `mimeType` will be inferred from the
   *     file extension.
   *  - For Blob object inputs, the `mimeType` will be set to the Blob's `type`
   *     property.
   * Somex eamples for file extension to mimeType mapping:
   * .txt -> text/plain
   * .json -> application/json
   * .jpg  -> image/jpeg
   * .png -> image/png
   * .mp3 -> audio/mpeg
   * .mp4 -> video/mp4
   *
   * This section can contain multiple paragraphs and code examples.
   *
   * @param params - Optional parameters specified in the
   *        `types.UploadFileParameters` interface.
   *         @see {@link types.UploadFileParameters#config} for the optional
   *         config in the parameters.
   * @return A promise that resolves to a `types.File` object.
   * @throws An error if called on a Vertex AI client.
   * @throws An error if the `mimeType` is not provided and can not be inferred,
   * the `mimeType` can be provided in the `params.config` parameter.
   * @throws An error occurs if a suitable upload location cannot be established.
   *
   * @example
   * The following code uploads a file to Gemini API.
   *
   * ```ts
   * const file = await ai.files.upload({file: 'file.txt', config: {
   *   mimeType: 'text/plain',
   * }});
   * console.log(file.name);
   * ```
   */
  async upload(e) {
    if (this.apiClient.isVertexAI())
      throw new Error("Vertex AI does not support uploading files. You can share files through a GCS bucket.");
    return this.apiClient.uploadFile(e.file, e.config).then((n) => n);
  }
  /**
   * Downloads a remotely stored file asynchronously to a location specified in
   * the `params` object. This method only works on Node environment, to
   * download files in the browser, use a browser compliant method like an <a>
   * tag.
   *
   * @param params - The parameters for the download request.
   *
   * @example
   * The following code downloads an example file named "files/mehozpxf877d" as
   * "file.txt".
   *
   * ```ts
   * await ai.files.download({file: file.name, downloadPath: 'file.txt'});
   * ```
   */
  async download(e) {
    await this.apiClient.downloadFile(e);
  }
  /**
   * Registers Google Cloud Storage files for use with the API.
   * This method is only available in Node.js environments.
   */
  async registerFiles(e) {
    throw new Error("registerFiles is only supported in Node.js environments.");
  }
  async _registerFiles(e) {
    return this.registerFilesInternal(e);
  }
  async listInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = wr(e);
      return r = I("files", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = Mr(c), f = new Di();
        return Object.assign(f, d), f;
      });
    }
  }
  async createInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Er(e);
      return r = I("upload/v1beta/files", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Sr(c), f = new Ui();
        return Object.assign(f, d), f;
      });
    }
  }
  /**
   * Retrieves the file information from the service.
   *
   * @param params - The parameters for the get request
   * @return The Promise that resolves to the types.File object requested.
   *
   * @example
   * ```ts
   * const config: GetFileParameters = {
   *   name: fileName,
   * };
   * file = await ai.files.get(config);
   * console.log(file.name);
   * ```
   */
  async get(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Ar(e);
      return r = I("files/{file}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => c);
    }
  }
  /**
   * Deletes a remotely stored file.
   *
   * @param params - The parameters for the delete request.
   * @return The DeleteFileResponse, the response for the delete method.
   *
   * @example
   * The following code deletes an example file named "files/mehozpxf877d".
   *
   * ```ts
   * await ai.files.delete({name: file.name});
   * ```
   */
  async delete(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Ir(e);
      return r = I("files/{file}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = vr(c), f = new ki();
        return Object.assign(f, d), f;
      });
    }
  }
  async registerFilesInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Rr(e);
      return r = I("files:register", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Nr(c), f = new Li();
        return Object.assign(f, d), f;
      });
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Re(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && l(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Dr(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => Yr(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function Ur(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function kr(t) {
  const e = {}, n = s(t, ["id"]);
  n != null && l(e, ["id"], n);
  const o = s(t, ["args"]);
  o != null && l(e, ["args"], o);
  const i = s(t, ["name"]);
  if (i != null && l(e, ["name"], i), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Lr(t) {
  const e = {}, n = s(t, ["description"]);
  n != null && l(e, ["description"], n);
  const o = s(t, ["name"]);
  o != null && l(e, ["name"], o);
  const i = s(t, ["parameters"]);
  i != null && l(e, ["parameters"], i);
  const r = s(t, [
    "parametersJsonSchema"
  ]);
  r != null && l(e, ["parametersJsonSchema"], r);
  const a = s(t, ["response"]);
  a != null && l(e, ["response"], a);
  const u = s(t, [
    "responseJsonSchema"
  ]);
  if (u != null && l(e, ["responseJsonSchema"], u), s(t, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return e;
}
function Fr(t) {
  const e = {}, n = s(t, [
    "modelSelectionConfig"
  ]);
  n != null && l(e, ["modelConfig"], n);
  const o = s(t, [
    "responseJsonSchema"
  ]);
  o != null && l(e, ["responseJsonSchema"], o);
  const i = s(t, [
    "audioTimestamp"
  ]);
  i != null && l(e, ["audioTimestamp"], i);
  const r = s(t, [
    "candidateCount"
  ]);
  r != null && l(e, ["candidateCount"], r);
  const a = s(t, [
    "enableAffectiveDialog"
  ]);
  a != null && l(e, ["enableAffectiveDialog"], a);
  const u = s(t, [
    "frequencyPenalty"
  ]);
  u != null && l(e, ["frequencyPenalty"], u);
  const c = s(t, ["logprobs"]);
  c != null && l(e, ["logprobs"], c);
  const d = s(t, [
    "maxOutputTokens"
  ]);
  d != null && l(e, ["maxOutputTokens"], d);
  const f = s(t, [
    "mediaResolution"
  ]);
  f != null && l(e, ["mediaResolution"], f);
  const p = s(t, [
    "presencePenalty"
  ]);
  p != null && l(e, ["presencePenalty"], p);
  const m = s(t, [
    "responseLogprobs"
  ]);
  m != null && l(e, ["responseLogprobs"], m);
  const h = s(t, [
    "responseMimeType"
  ]);
  h != null && l(e, ["responseMimeType"], h);
  const g = s(t, [
    "responseModalities"
  ]);
  g != null && l(e, ["responseModalities"], g);
  const T = s(t, [
    "responseSchema"
  ]);
  T != null && l(e, ["responseSchema"], T);
  const y = s(t, [
    "routingConfig"
  ]);
  y != null && l(e, ["routingConfig"], y);
  const E = s(t, ["seed"]);
  E != null && l(e, ["seed"], E);
  const v = s(t, ["speechConfig"]);
  v != null && l(e, ["speechConfig"], v);
  const S = s(t, [
    "stopSequences"
  ]);
  S != null && l(e, ["stopSequences"], S);
  const _ = s(t, ["temperature"]);
  _ != null && l(e, ["temperature"], _);
  const C = s(t, [
    "thinkingConfig"
  ]);
  C != null && l(e, ["thinkingConfig"], C);
  const A = s(t, ["topK"]);
  A != null && l(e, ["topK"], A);
  const R = s(t, ["topP"]);
  if (R != null && l(e, ["topP"], R), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return e;
}
function Gr(t) {
  const e = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const n = s(t, ["enableWidget"]);
  return n != null && l(e, ["enableWidget"], n), e;
}
function Hr(t) {
  const e = {};
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const n = s(t, [
    "timeRangeFilter"
  ]);
  return n != null && l(e, ["timeRangeFilter"], n), e;
}
function Vr(t, e) {
  const n = {}, o = s(t, [
    "generationConfig"
  ]);
  e !== void 0 && o != null && l(e, ["setup", "generationConfig"], o);
  const i = s(t, [
    "responseModalities"
  ]);
  e !== void 0 && i != null && l(e, ["setup", "generationConfig", "responseModalities"], i);
  const r = s(t, ["temperature"]);
  e !== void 0 && r != null && l(e, ["setup", "generationConfig", "temperature"], r);
  const a = s(t, ["topP"]);
  e !== void 0 && a != null && l(e, ["setup", "generationConfig", "topP"], a);
  const u = s(t, ["topK"]);
  e !== void 0 && u != null && l(e, ["setup", "generationConfig", "topK"], u);
  const c = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], c);
  const d = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "mediaResolution"], d);
  const f = s(t, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], pt(p));
  const m = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "thinkingConfig"], m);
  const h = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], h);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], Dr(H(g)));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let A = fe(T);
    Array.isArray(A) && (A = A.map((R) => Xr(ce(R)))), l(e, ["setup", "tools"], A);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], zr(y));
  const E = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "inputAudioTranscription"], E);
  const v = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && v != null && l(e, ["setup", "outputAudioTranscription"], v);
  const S = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "realtimeInputConfig"], S);
  const _ = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && _ != null && l(e, ["setup", "contextWindowCompression"], _);
  const C = s(t, ["proactivity"]);
  if (e !== void 0 && C != null && l(e, ["setup", "proactivity"], C), s(t, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return n;
}
function br(t, e) {
  const n = {}, o = s(t, [
    "generationConfig"
  ]);
  e !== void 0 && o != null && l(e, ["setup", "generationConfig"], Fr(o));
  const i = s(t, [
    "responseModalities"
  ]);
  e !== void 0 && i != null && l(e, ["setup", "generationConfig", "responseModalities"], i);
  const r = s(t, ["temperature"]);
  e !== void 0 && r != null && l(e, ["setup", "generationConfig", "temperature"], r);
  const a = s(t, ["topP"]);
  e !== void 0 && a != null && l(e, ["setup", "generationConfig", "topP"], a);
  const u = s(t, ["topK"]);
  e !== void 0 && u != null && l(e, ["setup", "generationConfig", "topK"], u);
  const c = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], c);
  const d = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "mediaResolution"], d);
  const f = s(t, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], pt(p));
  const m = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "thinkingConfig"], m);
  const h = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], h);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], H(g));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let R = fe(T);
    Array.isArray(R) && (R = R.map((N) => Qr(ce(N)))), l(e, ["setup", "tools"], R);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], y);
  const E = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "inputAudioTranscription"], E);
  const v = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && v != null && l(e, ["setup", "outputAudioTranscription"], v);
  const S = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "realtimeInputConfig"], S);
  const _ = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && _ != null && l(e, ["setup", "contextWindowCompression"], _);
  const C = s(t, ["proactivity"]);
  e !== void 0 && C != null && l(e, ["setup", "proactivity"], C);
  const A = s(t, [
    "explicitVadSignal"
  ]);
  return e !== void 0 && A != null && l(e, ["setup", "explicitVadSignal"], A), n;
}
function qr(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["setup", "model"], D(t, o));
  const i = s(e, ["config"]);
  return i != null && l(n, ["config"], Vr(i, n)), n;
}
function Br(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["setup", "model"], D(t, o));
  const i = s(e, ["config"]);
  return i != null && l(n, ["config"], br(i, n)), n;
}
function Jr(t) {
  const e = {}, n = s(t, [
    "musicGenerationConfig"
  ]);
  return n != null && l(e, ["musicGenerationConfig"], n), e;
}
function Or(t) {
  const e = {}, n = s(t, [
    "weightedPrompts"
  ]);
  if (n != null) {
    let o = n;
    Array.isArray(o) && (o = o.map((i) => i)), l(e, ["weightedPrompts"], o);
  }
  return e;
}
function $r(t) {
  const e = {}, n = s(t, ["media"]);
  if (n != null) {
    let d = oo(n);
    Array.isArray(d) && (d = d.map((f) => Re(f))), l(e, ["mediaChunks"], d);
  }
  const o = s(t, ["audio"]);
  o != null && l(e, ["audio"], Re(so(o)));
  const i = s(t, [
    "audioStreamEnd"
  ]);
  i != null && l(e, ["audioStreamEnd"], i);
  const r = s(t, ["video"]);
  r != null && l(e, ["video"], Re(io(r)));
  const a = s(t, ["text"]);
  a != null && l(e, ["text"], a);
  const u = s(t, [
    "activityStart"
  ]);
  u != null && l(e, ["activityStart"], u);
  const c = s(t, ["activityEnd"]);
  return c != null && l(e, ["activityEnd"], c), e;
}
function Wr(t) {
  const e = {}, n = s(t, ["media"]);
  if (n != null) {
    let d = oo(n);
    Array.isArray(d) && (d = d.map((f) => f)), l(e, ["mediaChunks"], d);
  }
  const o = s(t, ["audio"]);
  o != null && l(e, ["audio"], so(o));
  const i = s(t, [
    "audioStreamEnd"
  ]);
  i != null && l(e, ["audioStreamEnd"], i);
  const r = s(t, ["video"]);
  r != null && l(e, ["video"], io(r));
  const a = s(t, ["text"]);
  a != null && l(e, ["text"], a);
  const u = s(t, [
    "activityStart"
  ]);
  u != null && l(e, ["activityStart"], u);
  const c = s(t, ["activityEnd"]);
  return c != null && l(e, ["activityEnd"], c), e;
}
function Kr(t) {
  const e = {}, n = s(t, [
    "setupComplete"
  ]);
  n != null && l(e, ["setupComplete"], n);
  const o = s(t, [
    "serverContent"
  ]);
  o != null && l(e, ["serverContent"], o);
  const i = s(t, ["toolCall"]);
  i != null && l(e, ["toolCall"], i);
  const r = s(t, [
    "toolCallCancellation"
  ]);
  r != null && l(e, ["toolCallCancellation"], r);
  const a = s(t, [
    "usageMetadata"
  ]);
  a != null && l(e, ["usageMetadata"], Zr(a));
  const u = s(t, ["goAway"]);
  u != null && l(e, ["goAway"], u);
  const c = s(t, [
    "sessionResumptionUpdate"
  ]);
  c != null && l(e, ["sessionResumptionUpdate"], c);
  const d = s(t, [
    "voiceActivityDetectionSignal"
  ]);
  d != null && l(e, ["voiceActivityDetectionSignal"], d);
  const f = s(t, [
    "voiceActivity"
  ]);
  return f != null && l(e, ["voiceActivity"], jr(f)), e;
}
function Yr(t) {
  const e = {}, n = s(t, [
    "mediaResolution"
  ]);
  n != null && l(e, ["mediaResolution"], n);
  const o = s(t, [
    "codeExecutionResult"
  ]);
  o != null && l(e, ["codeExecutionResult"], o);
  const i = s(t, [
    "executableCode"
  ]);
  i != null && l(e, ["executableCode"], i);
  const r = s(t, ["fileData"]);
  r != null && l(e, ["fileData"], Ur(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], kr(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(t, ["inlineData"]);
  c != null && l(e, ["inlineData"], Re(c));
  const d = s(t, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(t, ["thought"]);
  f != null && l(e, ["thought"], f);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && l(e, ["thoughtSignature"], p);
  const m = s(t, [
    "videoMetadata"
  ]);
  return m != null && l(e, ["videoMetadata"], m), e;
}
function zr(t) {
  const e = {}, n = s(t, ["handle"]);
  if (n != null && l(e, ["handle"], n), s(t, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return e;
}
function Xr(t) {
  const e = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(t, ["computerUse"]);
  n != null && l(e, ["computerUse"], n);
  const o = s(t, ["fileSearch"]);
  o != null && l(e, ["fileSearch"], o);
  const i = s(t, [
    "codeExecution"
  ]);
  if (i != null && l(e, ["codeExecution"], i), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const r = s(t, [
    "functionDeclarations"
  ]);
  if (r != null) {
    let f = r;
    Array.isArray(f) && (f = f.map((p) => p)), l(e, ["functionDeclarations"], f);
  }
  const a = s(t, ["googleMaps"]);
  a != null && l(e, ["googleMaps"], Gr(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Hr(u));
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(t, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
function Qr(t) {
  const e = {}, n = s(t, ["retrieval"]);
  n != null && l(e, ["retrieval"], n);
  const o = s(t, ["computerUse"]);
  if (o != null && l(e, ["computerUse"], o), s(t, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const i = s(t, [
    "codeExecution"
  ]);
  i != null && l(e, ["codeExecution"], i);
  const r = s(t, [
    "enterpriseWebSearch"
  ]);
  r != null && l(e, ["enterpriseWebSearch"], r);
  const a = s(t, [
    "functionDeclarations"
  ]);
  if (a != null) {
    let p = a;
    Array.isArray(p) && (p = p.map((m) => Lr(m))), l(e, ["functionDeclarations"], p);
  }
  const u = s(t, ["googleMaps"]);
  u != null && l(e, ["googleMaps"], u);
  const c = s(t, ["googleSearch"]);
  c != null && l(e, ["googleSearch"], c);
  const d = s(t, [
    "googleSearchRetrieval"
  ]);
  d != null && l(e, ["googleSearchRetrieval"], d);
  const f = s(t, ["urlContext"]);
  return f != null && l(e, ["urlContext"], f), e;
}
function Zr(t) {
  const e = {}, n = s(t, [
    "promptTokenCount"
  ]);
  n != null && l(e, ["promptTokenCount"], n);
  const o = s(t, [
    "cachedContentTokenCount"
  ]);
  o != null && l(e, ["cachedContentTokenCount"], o);
  const i = s(t, [
    "candidatesTokenCount"
  ]);
  i != null && l(e, ["responseTokenCount"], i);
  const r = s(t, [
    "toolUsePromptTokenCount"
  ]);
  r != null && l(e, ["toolUsePromptTokenCount"], r);
  const a = s(t, [
    "thoughtsTokenCount"
  ]);
  a != null && l(e, ["thoughtsTokenCount"], a);
  const u = s(t, [
    "totalTokenCount"
  ]);
  u != null && l(e, ["totalTokenCount"], u);
  const c = s(t, [
    "promptTokensDetails"
  ]);
  if (c != null) {
    let h = c;
    Array.isArray(h) && (h = h.map((g) => g)), l(e, ["promptTokensDetails"], h);
  }
  const d = s(t, [
    "cacheTokensDetails"
  ]);
  if (d != null) {
    let h = d;
    Array.isArray(h) && (h = h.map((g) => g)), l(e, ["cacheTokensDetails"], h);
  }
  const f = s(t, [
    "candidatesTokensDetails"
  ]);
  if (f != null) {
    let h = f;
    Array.isArray(h) && (h = h.map((g) => g)), l(e, ["responseTokensDetails"], h);
  }
  const p = s(t, [
    "toolUsePromptTokensDetails"
  ]);
  if (p != null) {
    let h = p;
    Array.isArray(h) && (h = h.map((g) => g)), l(e, ["toolUsePromptTokensDetails"], h);
  }
  const m = s(t, ["trafficType"]);
  return m != null && l(e, ["trafficType"], m), e;
}
function jr(t) {
  const e = {}, n = s(t, ["type"]);
  return n != null && l(e, ["voiceActivityType"], n), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function el(t, e) {
  const n = {}, o = s(t, ["data"]);
  if (o != null && l(n, ["data"], o), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(t, ["mimeType"]);
  return i != null && l(n, ["mimeType"], i), n;
}
function tl(t, e) {
  const n = {}, o = s(t, ["content"]);
  o != null && l(n, ["content"], o);
  const i = s(t, [
    "citationMetadata"
  ]);
  i != null && l(n, ["citationMetadata"], nl(i));
  const r = s(t, ["tokenCount"]);
  r != null && l(n, ["tokenCount"], r);
  const a = s(t, ["finishReason"]);
  a != null && l(n, ["finishReason"], a);
  const u = s(t, ["avgLogprobs"]);
  u != null && l(n, ["avgLogprobs"], u);
  const c = s(t, [
    "groundingMetadata"
  ]);
  c != null && l(n, ["groundingMetadata"], c);
  const d = s(t, ["index"]);
  d != null && l(n, ["index"], d);
  const f = s(t, [
    "logprobsResult"
  ]);
  f != null && l(n, ["logprobsResult"], f);
  const p = s(t, [
    "safetyRatings"
  ]);
  if (p != null) {
    let h = p;
    Array.isArray(h) && (h = h.map((g) => g)), l(n, ["safetyRatings"], h);
  }
  const m = s(t, [
    "urlContextMetadata"
  ]);
  return m != null && l(n, ["urlContextMetadata"], m), n;
}
function nl(t, e) {
  const n = {}, o = s(t, ["citationSources"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => r)), l(n, ["citations"], i);
  }
  return n;
}
function ol(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let a = B(r);
    Array.isArray(a) && (a = a.map((u) => u)), l(o, ["contents"], a);
  }
  return o;
}
function il(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["tokensInfo"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(n, ["tokensInfo"], r);
  }
  return n;
}
function sl(t, e) {
  const n = {}, o = s(t, ["values"]);
  o != null && l(n, ["values"], o);
  const i = s(t, ["statistics"]);
  return i != null && l(n, ["statistics"], rl(i)), n;
}
function rl(t, e) {
  const n = {}, o = s(t, ["truncated"]);
  o != null && l(n, ["truncated"], o);
  const i = s(t, ["token_count"]);
  return i != null && l(n, ["tokenCount"], i), n;
}
function ke(t, e) {
  const n = {}, o = s(t, ["parts"]);
  if (o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => ha(a))), l(n, ["parts"], r);
  }
  const i = s(t, ["role"]);
  return i != null && l(n, ["role"], i), n;
}
function ll(t, e) {
  const n = {}, o = s(t, ["controlType"]);
  o != null && l(n, ["controlType"], o);
  const i = s(t, [
    "enableControlImageComputation"
  ]);
  return i != null && l(n, ["computeControl"], i), n;
}
function al(t, e) {
  const n = {};
  if (s(t, ["systemInstruction"]) !== void 0)
    throw new Error("systemInstruction parameter is not supported in Gemini API.");
  if (s(t, ["tools"]) !== void 0)
    throw new Error("tools parameter is not supported in Gemini API.");
  if (s(t, ["generationConfig"]) !== void 0)
    throw new Error("generationConfig parameter is not supported in Gemini API.");
  return n;
}
function ul(t, e, n) {
  const o = {}, i = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && i != null && l(e, ["systemInstruction"], H(i));
  const r = s(t, ["tools"]);
  if (e !== void 0 && r != null) {
    let u = r;
    Array.isArray(u) && (u = u.map((c) => Co(c))), l(e, ["tools"], u);
  }
  const a = s(t, [
    "generationConfig"
  ]);
  return e !== void 0 && a != null && l(e, ["generationConfig"], ea(a)), o;
}
function dl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = B(r);
    Array.isArray(u) && (u = u.map((c) => ke(c))), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && al(a), o;
}
function cl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = B(r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && ul(a, o), o;
}
function fl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["totalTokens"]);
  i != null && l(n, ["totalTokens"], i);
  const r = s(t, [
    "cachedContentTokenCount"
  ]);
  return r != null && l(n, ["cachedContentTokenCount"], r), n;
}
function pl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["totalTokens"]);
  return i != null && l(n, ["totalTokens"], i), n;
}
function ml(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], D(t, i)), o;
}
function hl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], D(t, i)), o;
}
function gl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  return o != null && l(n, ["sdkHttpResponse"], o), n;
}
function yl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  return o != null && l(n, ["sdkHttpResponse"], o), n;
}
function Tl(t, e, n) {
  const o = {}, i = s(t, ["outputGcsUri"]);
  e !== void 0 && i != null && l(e, ["parameters", "storageUri"], i);
  const r = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && r != null && l(e, ["parameters", "negativePrompt"], r);
  const a = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "sampleCount"], a);
  const u = s(t, ["aspectRatio"]);
  e !== void 0 && u != null && l(e, ["parameters", "aspectRatio"], u);
  const c = s(t, [
    "guidanceScale"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "guidanceScale"], c);
  const d = s(t, ["seed"]);
  e !== void 0 && d != null && l(e, ["parameters", "seed"], d);
  const f = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && f != null && l(e, ["parameters", "safetySetting"], f);
  const p = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "personGeneration"], p);
  const m = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "includeSafetyAttributes"], m);
  const h = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "includeRaiReason"], h);
  const g = s(t, ["language"]);
  e !== void 0 && g != null && l(e, ["parameters", "language"], g);
  const T = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && T != null && l(e, ["parameters", "outputOptions", "mimeType"], T);
  const y = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && y != null && l(e, ["parameters", "outputOptions", "compressionQuality"], y);
  const E = s(t, ["addWatermark"]);
  e !== void 0 && E != null && l(e, ["parameters", "addWatermark"], E);
  const v = s(t, ["labels"]);
  e !== void 0 && v != null && l(e, ["labels"], v);
  const S = s(t, ["editMode"]);
  e !== void 0 && S != null && l(e, ["parameters", "editMode"], S);
  const _ = s(t, ["baseSteps"]);
  return e !== void 0 && _ != null && l(e, ["parameters", "editConfig", "baseSteps"], _), o;
}
function _l(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, [
    "referenceImages"
  ]);
  if (a != null) {
    let c = a;
    Array.isArray(c) && (c = c.map((d) => Ea(d))), l(o, ["instances[0]", "referenceImages"], c);
  }
  const u = s(e, ["config"]);
  return u != null && Tl(u, o), o;
}
function Cl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Le(a))), l(n, ["generatedImages"], r);
  }
  return n;
}
function El(t, e, n) {
  const o = {}, i = s(t, ["taskType"]);
  e !== void 0 && i != null && l(e, ["requests[]", "taskType"], i);
  const r = s(t, ["title"]);
  e !== void 0 && r != null && l(e, ["requests[]", "title"], r);
  const a = s(t, [
    "outputDimensionality"
  ]);
  if (e !== void 0 && a != null && l(e, ["requests[]", "outputDimensionality"], a), s(t, ["mimeType"]) !== void 0)
    throw new Error("mimeType parameter is not supported in Gemini API.");
  if (s(t, ["autoTruncate"]) !== void 0)
    throw new Error("autoTruncate parameter is not supported in Gemini API.");
  return o;
}
function Sl(t, e, n) {
  const o = {}, i = s(t, ["taskType"]);
  e !== void 0 && i != null && l(e, ["instances[]", "task_type"], i);
  const r = s(t, ["title"]);
  e !== void 0 && r != null && l(e, ["instances[]", "title"], r);
  const a = s(t, [
    "outputDimensionality"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "outputDimensionality"], a);
  const u = s(t, ["mimeType"]);
  e !== void 0 && u != null && l(e, ["instances[]", "mimeType"], u);
  const c = s(t, ["autoTruncate"]);
  return e !== void 0 && c != null && l(e, ["parameters", "autoTruncate"], c), o;
}
function Il(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let c = dt(t, r);
    Array.isArray(c) && (c = c.map((d) => d)), l(o, ["requests[]", "content"], c);
  }
  const a = s(e, ["config"]);
  a != null && El(a, o);
  const u = s(e, ["model"]);
  return u !== void 0 && l(o, ["requests[]", "model"], D(t, u)), o;
}
function vl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = dt(t, r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["instances[]", "content"], u);
  }
  const a = s(e, ["config"]);
  return a != null && Sl(a, o), o;
}
function Al(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["embeddings"]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => u)), l(n, ["embeddings"], a);
  }
  const r = s(t, ["metadata"]);
  return r != null && l(n, ["metadata"], r), n;
}
function Rl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions[]",
    "embeddings"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => sl(u))), l(n, ["embeddings"], a);
  }
  const r = s(t, ["metadata"]);
  return r != null && l(n, ["metadata"], r), n;
}
function Pl(t, e) {
  const n = {}, o = s(t, ["endpoint"]);
  o != null && l(n, ["name"], o);
  const i = s(t, [
    "deployedModelId"
  ]);
  return i != null && l(n, ["deployedModelId"], i), n;
}
function wl(t, e) {
  const n = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["fileUri"]);
  o != null && l(n, ["fileUri"], o);
  const i = s(t, ["mimeType"]);
  return i != null && l(n, ["mimeType"], i), n;
}
function Ml(t, e) {
  const n = {}, o = s(t, ["id"]);
  o != null && l(n, ["id"], o);
  const i = s(t, ["args"]);
  i != null && l(n, ["args"], i);
  const r = s(t, ["name"]);
  if (r != null && l(n, ["name"], r), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return n;
}
function Nl(t, e) {
  const n = {}, o = s(t, [
    "allowedFunctionNames"
  ]);
  o != null && l(n, ["allowedFunctionNames"], o);
  const i = s(t, ["mode"]);
  if (i != null && l(n, ["mode"], i), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return n;
}
function xl(t, e) {
  const n = {}, o = s(t, ["description"]);
  o != null && l(n, ["description"], o);
  const i = s(t, ["name"]);
  i != null && l(n, ["name"], i);
  const r = s(t, ["parameters"]);
  r != null && l(n, ["parameters"], r);
  const a = s(t, [
    "parametersJsonSchema"
  ]);
  a != null && l(n, ["parametersJsonSchema"], a);
  const u = s(t, ["response"]);
  u != null && l(n, ["response"], u);
  const c = s(t, [
    "responseJsonSchema"
  ]);
  if (c != null && l(n, ["responseJsonSchema"], c), s(t, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return n;
}
function Dl(t, e, n, o) {
  const i = {}, r = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && r != null && l(n, ["systemInstruction"], ke(H(r)));
  const a = s(e, ["temperature"]);
  a != null && l(i, ["temperature"], a);
  const u = s(e, ["topP"]);
  u != null && l(i, ["topP"], u);
  const c = s(e, ["topK"]);
  c != null && l(i, ["topK"], c);
  const d = s(e, [
    "candidateCount"
  ]);
  d != null && l(i, ["candidateCount"], d);
  const f = s(e, [
    "maxOutputTokens"
  ]);
  f != null && l(i, ["maxOutputTokens"], f);
  const p = s(e, [
    "stopSequences"
  ]);
  p != null && l(i, ["stopSequences"], p);
  const m = s(e, [
    "responseLogprobs"
  ]);
  m != null && l(i, ["responseLogprobs"], m);
  const h = s(e, ["logprobs"]);
  h != null && l(i, ["logprobs"], h);
  const g = s(e, [
    "presencePenalty"
  ]);
  g != null && l(i, ["presencePenalty"], g);
  const T = s(e, [
    "frequencyPenalty"
  ]);
  T != null && l(i, ["frequencyPenalty"], T);
  const y = s(e, ["seed"]);
  y != null && l(i, ["seed"], y);
  const E = s(e, [
    "responseMimeType"
  ]);
  E != null && l(i, ["responseMimeType"], E);
  const v = s(e, [
    "responseSchema"
  ]);
  v != null && l(i, ["responseSchema"], ct(v));
  const S = s(e, [
    "responseJsonSchema"
  ]);
  if (S != null && l(i, ["responseJsonSchema"], S), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const _ = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && _ != null) {
    let L = _;
    Array.isArray(L) && (L = L.map((K) => Sa(K))), l(n, ["safetySettings"], L);
  }
  const C = s(e, ["tools"]);
  if (n !== void 0 && C != null) {
    let L = fe(C);
    Array.isArray(L) && (L = L.map((K) => Ma(ce(K)))), l(n, ["tools"], L);
  }
  const A = s(e, ["toolConfig"]);
  if (n !== void 0 && A != null && l(n, ["toolConfig"], wa(A)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const R = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && R != null && l(n, ["cachedContent"], Q(t, R));
  const N = s(e, [
    "responseModalities"
  ]);
  N != null && l(i, ["responseModalities"], N);
  const P = s(e, [
    "mediaResolution"
  ]);
  P != null && l(i, ["mediaResolution"], P);
  const x = s(e, ["speechConfig"]);
  if (x != null && l(i, ["speechConfig"], ft(x)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const U = s(e, [
    "thinkingConfig"
  ]);
  U != null && l(i, ["thinkingConfig"], U);
  const F = s(e, ["imageConfig"]);
  F != null && l(i, ["imageConfig"], sa(F));
  const k = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (k != null && l(i, ["enableEnhancedCivicAnswers"], k), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return i;
}
function Ul(t, e, n, o) {
  const i = {}, r = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && r != null && l(n, ["systemInstruction"], H(r));
  const a = s(e, ["temperature"]);
  a != null && l(i, ["temperature"], a);
  const u = s(e, ["topP"]);
  u != null && l(i, ["topP"], u);
  const c = s(e, ["topK"]);
  c != null && l(i, ["topK"], c);
  const d = s(e, [
    "candidateCount"
  ]);
  d != null && l(i, ["candidateCount"], d);
  const f = s(e, [
    "maxOutputTokens"
  ]);
  f != null && l(i, ["maxOutputTokens"], f);
  const p = s(e, [
    "stopSequences"
  ]);
  p != null && l(i, ["stopSequences"], p);
  const m = s(e, [
    "responseLogprobs"
  ]);
  m != null && l(i, ["responseLogprobs"], m);
  const h = s(e, ["logprobs"]);
  h != null && l(i, ["logprobs"], h);
  const g = s(e, [
    "presencePenalty"
  ]);
  g != null && l(i, ["presencePenalty"], g);
  const T = s(e, [
    "frequencyPenalty"
  ]);
  T != null && l(i, ["frequencyPenalty"], T);
  const y = s(e, ["seed"]);
  y != null && l(i, ["seed"], y);
  const E = s(e, [
    "responseMimeType"
  ]);
  E != null && l(i, ["responseMimeType"], E);
  const v = s(e, [
    "responseSchema"
  ]);
  v != null && l(i, ["responseSchema"], ct(v));
  const S = s(e, [
    "responseJsonSchema"
  ]);
  S != null && l(i, ["responseJsonSchema"], S);
  const _ = s(e, [
    "routingConfig"
  ]);
  _ != null && l(i, ["routingConfig"], _);
  const C = s(e, [
    "modelSelectionConfig"
  ]);
  C != null && l(i, ["modelConfig"], C);
  const A = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && A != null) {
    let Y = A;
    Array.isArray(Y) && (Y = Y.map((be) => be)), l(n, ["safetySettings"], Y);
  }
  const R = s(e, ["tools"]);
  if (n !== void 0 && R != null) {
    let Y = fe(R);
    Array.isArray(Y) && (Y = Y.map((be) => Co(ce(be)))), l(n, ["tools"], Y);
  }
  const N = s(e, ["toolConfig"]);
  n !== void 0 && N != null && l(n, ["toolConfig"], N);
  const P = s(e, ["labels"]);
  n !== void 0 && P != null && l(n, ["labels"], P);
  const x = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && x != null && l(n, ["cachedContent"], Q(t, x));
  const U = s(e, [
    "responseModalities"
  ]);
  U != null && l(i, ["responseModalities"], U);
  const F = s(e, [
    "mediaResolution"
  ]);
  F != null && l(i, ["mediaResolution"], F);
  const k = s(e, ["speechConfig"]);
  k != null && l(i, ["speechConfig"], ft(k));
  const L = s(e, [
    "audioTimestamp"
  ]);
  L != null && l(i, ["audioTimestamp"], L);
  const K = s(e, [
    "thinkingConfig"
  ]);
  K != null && l(i, ["thinkingConfig"], K);
  const me = s(e, ["imageConfig"]);
  if (me != null && l(i, ["imageConfig"], ra(me)), s(e, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  const ie = s(e, [
    "modelArmorConfig"
  ]);
  return n !== void 0 && ie != null && l(n, ["modelArmorConfig"], ie), i;
}
function Ln(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = B(r);
    Array.isArray(u) && (u = u.map((c) => ke(c))), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && l(o, ["generationConfig"], Dl(t, a, o)), o;
}
function Fn(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = B(r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && l(o, ["generationConfig"], Ul(t, a, o)), o;
}
function Gn(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["candidates"]);
  if (i != null) {
    let d = i;
    Array.isArray(d) && (d = d.map((f) => tl(f))), l(n, ["candidates"], d);
  }
  const r = s(t, ["modelVersion"]);
  r != null && l(n, ["modelVersion"], r);
  const a = s(t, [
    "promptFeedback"
  ]);
  a != null && l(n, ["promptFeedback"], a);
  const u = s(t, ["responseId"]);
  u != null && l(n, ["responseId"], u);
  const c = s(t, [
    "usageMetadata"
  ]);
  return c != null && l(n, ["usageMetadata"], c), n;
}
function Hn(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["candidates"]);
  if (i != null) {
    let f = i;
    Array.isArray(f) && (f = f.map((p) => p)), l(n, ["candidates"], f);
  }
  const r = s(t, ["createTime"]);
  r != null && l(n, ["createTime"], r);
  const a = s(t, ["modelVersion"]);
  a != null && l(n, ["modelVersion"], a);
  const u = s(t, [
    "promptFeedback"
  ]);
  u != null && l(n, ["promptFeedback"], u);
  const c = s(t, ["responseId"]);
  c != null && l(n, ["responseId"], c);
  const d = s(t, [
    "usageMetadata"
  ]);
  return d != null && l(n, ["usageMetadata"], d), n;
}
function kl(t, e, n) {
  const o = {};
  if (s(t, ["outputGcsUri"]) !== void 0)
    throw new Error("outputGcsUri parameter is not supported in Gemini API.");
  if (s(t, ["negativePrompt"]) !== void 0)
    throw new Error("negativePrompt parameter is not supported in Gemini API.");
  const i = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && i != null && l(e, ["parameters", "sampleCount"], i);
  const r = s(t, ["aspectRatio"]);
  e !== void 0 && r != null && l(e, ["parameters", "aspectRatio"], r);
  const a = s(t, [
    "guidanceScale"
  ]);
  if (e !== void 0 && a != null && l(e, ["parameters", "guidanceScale"], a), s(t, ["seed"]) !== void 0)
    throw new Error("seed parameter is not supported in Gemini API.");
  const u = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && u != null && l(e, ["parameters", "safetySetting"], u);
  const c = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "personGeneration"], c);
  const d = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "includeSafetyAttributes"], d);
  const f = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && f != null && l(e, ["parameters", "includeRaiReason"], f);
  const p = s(t, ["language"]);
  e !== void 0 && p != null && l(e, ["parameters", "language"], p);
  const m = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "outputOptions", "mimeType"], m);
  const h = s(t, [
    "outputCompressionQuality"
  ]);
  if (e !== void 0 && h != null && l(e, ["parameters", "outputOptions", "compressionQuality"], h), s(t, ["addWatermark"]) !== void 0)
    throw new Error("addWatermark parameter is not supported in Gemini API.");
  if (s(t, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const g = s(t, ["imageSize"]);
  if (e !== void 0 && g != null && l(e, ["parameters", "sampleImageSize"], g), s(t, ["enhancePrompt"]) !== void 0)
    throw new Error("enhancePrompt parameter is not supported in Gemini API.");
  return o;
}
function Ll(t, e, n) {
  const o = {}, i = s(t, ["outputGcsUri"]);
  e !== void 0 && i != null && l(e, ["parameters", "storageUri"], i);
  const r = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && r != null && l(e, ["parameters", "negativePrompt"], r);
  const a = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "sampleCount"], a);
  const u = s(t, ["aspectRatio"]);
  e !== void 0 && u != null && l(e, ["parameters", "aspectRatio"], u);
  const c = s(t, [
    "guidanceScale"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "guidanceScale"], c);
  const d = s(t, ["seed"]);
  e !== void 0 && d != null && l(e, ["parameters", "seed"], d);
  const f = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && f != null && l(e, ["parameters", "safetySetting"], f);
  const p = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "personGeneration"], p);
  const m = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "includeSafetyAttributes"], m);
  const h = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "includeRaiReason"], h);
  const g = s(t, ["language"]);
  e !== void 0 && g != null && l(e, ["parameters", "language"], g);
  const T = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && T != null && l(e, ["parameters", "outputOptions", "mimeType"], T);
  const y = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && y != null && l(e, ["parameters", "outputOptions", "compressionQuality"], y);
  const E = s(t, ["addWatermark"]);
  e !== void 0 && E != null && l(e, ["parameters", "addWatermark"], E);
  const v = s(t, ["labels"]);
  e !== void 0 && v != null && l(e, ["labels"], v);
  const S = s(t, ["imageSize"]);
  e !== void 0 && S != null && l(e, ["parameters", "sampleImageSize"], S);
  const _ = s(t, [
    "enhancePrompt"
  ]);
  return e !== void 0 && _ != null && l(e, ["parameters", "enhancePrompt"], _), o;
}
function Fl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["config"]);
  return a != null && kl(a, o), o;
}
function Gl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["config"]);
  return a != null && Ll(a, o), o;
}
function Hl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => Xl(u))), l(n, ["generatedImages"], a);
  }
  const r = s(t, [
    "positivePromptSafetyAttributes"
  ]);
  return r != null && l(n, ["positivePromptSafetyAttributes"], To(r)), n;
}
function Vl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => Le(u))), l(n, ["generatedImages"], a);
  }
  const r = s(t, [
    "positivePromptSafetyAttributes"
  ]);
  return r != null && l(n, ["positivePromptSafetyAttributes"], _o(r)), n;
}
function bl(t, e, n) {
  const o = {}, i = s(t, [
    "numberOfVideos"
  ]);
  if (e !== void 0 && i != null && l(e, ["parameters", "sampleCount"], i), s(t, ["outputGcsUri"]) !== void 0)
    throw new Error("outputGcsUri parameter is not supported in Gemini API.");
  if (s(t, ["fps"]) !== void 0)
    throw new Error("fps parameter is not supported in Gemini API.");
  const r = s(t, [
    "durationSeconds"
  ]);
  if (e !== void 0 && r != null && l(e, ["parameters", "durationSeconds"], r), s(t, ["seed"]) !== void 0)
    throw new Error("seed parameter is not supported in Gemini API.");
  const a = s(t, ["aspectRatio"]);
  e !== void 0 && a != null && l(e, ["parameters", "aspectRatio"], a);
  const u = s(t, ["resolution"]);
  e !== void 0 && u != null && l(e, ["parameters", "resolution"], u);
  const c = s(t, [
    "personGeneration"
  ]);
  if (e !== void 0 && c != null && l(e, ["parameters", "personGeneration"], c), s(t, ["pubsubTopic"]) !== void 0)
    throw new Error("pubsubTopic parameter is not supported in Gemini API.");
  const d = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "negativePrompt"], d);
  const f = s(t, [
    "enhancePrompt"
  ]);
  if (e !== void 0 && f != null && l(e, ["parameters", "enhancePrompt"], f), s(t, ["generateAudio"]) !== void 0)
    throw new Error("generateAudio parameter is not supported in Gemini API.");
  const p = s(t, ["lastFrame"]);
  e !== void 0 && p != null && l(e, ["instances[0]", "lastFrame"], Fe(p));
  const m = s(t, [
    "referenceImages"
  ]);
  if (e !== void 0 && m != null) {
    let h = m;
    Array.isArray(h) && (h = h.map((g) => Ba(g))), l(e, ["instances[0]", "referenceImages"], h);
  }
  if (s(t, ["mask"]) !== void 0)
    throw new Error("mask parameter is not supported in Gemini API.");
  if (s(t, ["compressionQuality"]) !== void 0)
    throw new Error("compressionQuality parameter is not supported in Gemini API.");
  return o;
}
function ql(t, e, n) {
  const o = {}, i = s(t, [
    "numberOfVideos"
  ]);
  e !== void 0 && i != null && l(e, ["parameters", "sampleCount"], i);
  const r = s(t, ["outputGcsUri"]);
  e !== void 0 && r != null && l(e, ["parameters", "storageUri"], r);
  const a = s(t, ["fps"]);
  e !== void 0 && a != null && l(e, ["parameters", "fps"], a);
  const u = s(t, [
    "durationSeconds"
  ]);
  e !== void 0 && u != null && l(e, ["parameters", "durationSeconds"], u);
  const c = s(t, ["seed"]);
  e !== void 0 && c != null && l(e, ["parameters", "seed"], c);
  const d = s(t, ["aspectRatio"]);
  e !== void 0 && d != null && l(e, ["parameters", "aspectRatio"], d);
  const f = s(t, ["resolution"]);
  e !== void 0 && f != null && l(e, ["parameters", "resolution"], f);
  const p = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "personGeneration"], p);
  const m = s(t, ["pubsubTopic"]);
  e !== void 0 && m != null && l(e, ["parameters", "pubsubTopic"], m);
  const h = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "negativePrompt"], h);
  const g = s(t, [
    "enhancePrompt"
  ]);
  e !== void 0 && g != null && l(e, ["parameters", "enhancePrompt"], g);
  const T = s(t, [
    "generateAudio"
  ]);
  e !== void 0 && T != null && l(e, ["parameters", "generateAudio"], T);
  const y = s(t, ["lastFrame"]);
  e !== void 0 && y != null && l(e, ["instances[0]", "lastFrame"], W(y));
  const E = s(t, [
    "referenceImages"
  ]);
  if (e !== void 0 && E != null) {
    let _ = E;
    Array.isArray(_) && (_ = _.map((C) => Ja(C))), l(e, ["instances[0]", "referenceImages"], _);
  }
  const v = s(t, ["mask"]);
  e !== void 0 && v != null && l(e, ["instances[0]", "mask"], qa(v));
  const S = s(t, [
    "compressionQuality"
  ]);
  return e !== void 0 && S != null && l(e, ["parameters", "compressionQuality"], S), o;
}
function Bl(t, e) {
  const n = {}, o = s(t, ["name"]);
  o != null && l(n, ["name"], o);
  const i = s(t, ["metadata"]);
  i != null && l(n, ["metadata"], i);
  const r = s(t, ["done"]);
  r != null && l(n, ["done"], r);
  const a = s(t, ["error"]);
  a != null && l(n, ["error"], a);
  const u = s(t, [
    "response",
    "generateVideoResponse"
  ]);
  return u != null && l(n, ["response"], Wl(u)), n;
}
function Jl(t, e) {
  const n = {}, o = s(t, ["name"]);
  o != null && l(n, ["name"], o);
  const i = s(t, ["metadata"]);
  i != null && l(n, ["metadata"], i);
  const r = s(t, ["done"]);
  r != null && l(n, ["done"], r);
  const a = s(t, ["error"]);
  a != null && l(n, ["error"], a);
  const u = s(t, ["response"]);
  return u != null && l(n, ["response"], Kl(u)), n;
}
function Ol(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["image"]);
  a != null && l(o, ["instances[0]", "image"], Fe(a));
  const u = s(e, ["video"]);
  u != null && l(o, ["instances[0]", "video"], Eo(u));
  const c = s(e, ["source"]);
  c != null && Yl(c, o);
  const d = s(e, ["config"]);
  return d != null && bl(d, o), o;
}
function $l(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["image"]);
  a != null && l(o, ["instances[0]", "image"], W(a));
  const u = s(e, ["video"]);
  u != null && l(o, ["instances[0]", "video"], So(u));
  const c = s(e, ["source"]);
  c != null && zl(c, o);
  const d = s(e, ["config"]);
  return d != null && ql(d, o), o;
}
function Wl(t, e) {
  const n = {}, o = s(t, [
    "generatedSamples"
  ]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((u) => Zl(u))), l(n, ["generatedVideos"], a);
  }
  const i = s(t, [
    "raiMediaFilteredCount"
  ]);
  i != null && l(n, ["raiMediaFilteredCount"], i);
  const r = s(t, [
    "raiMediaFilteredReasons"
  ]);
  return r != null && l(n, ["raiMediaFilteredReasons"], r), n;
}
function Kl(t, e) {
  const n = {}, o = s(t, ["videos"]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((u) => jl(u))), l(n, ["generatedVideos"], a);
  }
  const i = s(t, [
    "raiMediaFilteredCount"
  ]);
  i != null && l(n, ["raiMediaFilteredCount"], i);
  const r = s(t, [
    "raiMediaFilteredReasons"
  ]);
  return r != null && l(n, ["raiMediaFilteredReasons"], r), n;
}
function Yl(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], Fe(r));
  const a = s(t, ["video"]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "video"], Eo(a)), o;
}
function zl(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], W(r));
  const a = s(t, ["video"]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "video"], So(a)), o;
}
function Xl(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["image"], la(o));
  const i = s(t, [
    "raiFilteredReason"
  ]);
  i != null && l(n, ["raiFilteredReason"], i);
  const r = s(t, ["_self"]);
  return r != null && l(n, ["safetyAttributes"], To(r)), n;
}
function Le(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["image"], yo(o));
  const i = s(t, [
    "raiFilteredReason"
  ]);
  i != null && l(n, ["raiFilteredReason"], i);
  const r = s(t, ["_self"]);
  r != null && l(n, ["safetyAttributes"], _o(r));
  const a = s(t, ["prompt"]);
  return a != null && l(n, ["enhancedPrompt"], a), n;
}
function Ql(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["mask"], yo(o));
  const i = s(t, ["labels"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(n, ["labels"], r);
  }
  return n;
}
function Zl(t, e) {
  const n = {}, o = s(t, ["video"]);
  return o != null && l(n, ["video"], Va(o)), n;
}
function jl(t, e) {
  const n = {}, o = s(t, ["_self"]);
  return o != null && l(n, ["video"], ba(o)), n;
}
function ea(t, e) {
  const n = {}, o = s(t, [
    "modelSelectionConfig"
  ]);
  o != null && l(n, ["modelConfig"], o);
  const i = s(t, [
    "responseJsonSchema"
  ]);
  i != null && l(n, ["responseJsonSchema"], i);
  const r = s(t, [
    "audioTimestamp"
  ]);
  r != null && l(n, ["audioTimestamp"], r);
  const a = s(t, [
    "candidateCount"
  ]);
  a != null && l(n, ["candidateCount"], a);
  const u = s(t, [
    "enableAffectiveDialog"
  ]);
  u != null && l(n, ["enableAffectiveDialog"], u);
  const c = s(t, [
    "frequencyPenalty"
  ]);
  c != null && l(n, ["frequencyPenalty"], c);
  const d = s(t, ["logprobs"]);
  d != null && l(n, ["logprobs"], d);
  const f = s(t, [
    "maxOutputTokens"
  ]);
  f != null && l(n, ["maxOutputTokens"], f);
  const p = s(t, [
    "mediaResolution"
  ]);
  p != null && l(n, ["mediaResolution"], p);
  const m = s(t, [
    "presencePenalty"
  ]);
  m != null && l(n, ["presencePenalty"], m);
  const h = s(t, [
    "responseLogprobs"
  ]);
  h != null && l(n, ["responseLogprobs"], h);
  const g = s(t, [
    "responseMimeType"
  ]);
  g != null && l(n, ["responseMimeType"], g);
  const T = s(t, [
    "responseModalities"
  ]);
  T != null && l(n, ["responseModalities"], T);
  const y = s(t, [
    "responseSchema"
  ]);
  y != null && l(n, ["responseSchema"], y);
  const E = s(t, [
    "routingConfig"
  ]);
  E != null && l(n, ["routingConfig"], E);
  const v = s(t, ["seed"]);
  v != null && l(n, ["seed"], v);
  const S = s(t, ["speechConfig"]);
  S != null && l(n, ["speechConfig"], S);
  const _ = s(t, [
    "stopSequences"
  ]);
  _ != null && l(n, ["stopSequences"], _);
  const C = s(t, ["temperature"]);
  C != null && l(n, ["temperature"], C);
  const A = s(t, [
    "thinkingConfig"
  ]);
  A != null && l(n, ["thinkingConfig"], A);
  const R = s(t, ["topK"]);
  R != null && l(n, ["topK"], R);
  const N = s(t, ["topP"]);
  if (N != null && l(n, ["topP"], N), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return n;
}
function ta(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], D(t, i)), o;
}
function na(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], D(t, i)), o;
}
function oa(t, e) {
  const n = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const o = s(t, ["enableWidget"]);
  return o != null && l(n, ["enableWidget"], o), n;
}
function ia(t, e) {
  const n = {};
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const o = s(t, [
    "timeRangeFilter"
  ]);
  return o != null && l(n, ["timeRangeFilter"], o), n;
}
function sa(t, e) {
  const n = {}, o = s(t, ["aspectRatio"]);
  o != null && l(n, ["aspectRatio"], o);
  const i = s(t, ["imageSize"]);
  if (i != null && l(n, ["imageSize"], i), s(t, ["personGeneration"]) !== void 0)
    throw new Error("personGeneration parameter is not supported in Gemini API.");
  if (s(t, ["outputMimeType"]) !== void 0)
    throw new Error("outputMimeType parameter is not supported in Gemini API.");
  if (s(t, ["outputCompressionQuality"]) !== void 0)
    throw new Error("outputCompressionQuality parameter is not supported in Gemini API.");
  return n;
}
function ra(t, e) {
  const n = {}, o = s(t, ["aspectRatio"]);
  o != null && l(n, ["aspectRatio"], o);
  const i = s(t, ["imageSize"]);
  i != null && l(n, ["imageSize"], i);
  const r = s(t, [
    "personGeneration"
  ]);
  r != null && l(n, ["personGeneration"], r);
  const a = s(t, [
    "outputMimeType"
  ]);
  a != null && l(n, ["imageOutputOptions", "mimeType"], a);
  const u = s(t, [
    "outputCompressionQuality"
  ]);
  return u != null && l(n, ["imageOutputOptions", "compressionQuality"], u), n;
}
function la(t, e) {
  const n = {}, o = s(t, [
    "bytesBase64Encoded"
  ]);
  o != null && l(n, ["imageBytes"], j(o));
  const i = s(t, ["mimeType"]);
  return i != null && l(n, ["mimeType"], i), n;
}
function yo(t, e) {
  const n = {}, o = s(t, ["gcsUri"]);
  o != null && l(n, ["gcsUri"], o);
  const i = s(t, [
    "bytesBase64Encoded"
  ]);
  i != null && l(n, ["imageBytes"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["mimeType"], r), n;
}
function Fe(t, e) {
  const n = {};
  if (s(t, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  const o = s(t, ["imageBytes"]);
  o != null && l(n, ["bytesBase64Encoded"], j(o));
  const i = s(t, ["mimeType"]);
  return i != null && l(n, ["mimeType"], i), n;
}
function W(t, e) {
  const n = {}, o = s(t, ["gcsUri"]);
  o != null && l(n, ["gcsUri"], o);
  const i = s(t, ["imageBytes"]);
  i != null && l(n, ["bytesBase64Encoded"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["mimeType"], r), n;
}
function aa(t, e, n, o) {
  const i = {}, r = s(e, ["pageSize"]);
  n !== void 0 && r != null && l(n, ["_query", "pageSize"], r);
  const a = s(e, ["pageToken"]);
  n !== void 0 && a != null && l(n, ["_query", "pageToken"], a);
  const u = s(e, ["filter"]);
  n !== void 0 && u != null && l(n, ["_query", "filter"], u);
  const c = s(e, ["queryBase"]);
  return n !== void 0 && c != null && l(n, ["_url", "models_url"], uo(t, c)), i;
}
function ua(t, e, n, o) {
  const i = {}, r = s(e, ["pageSize"]);
  n !== void 0 && r != null && l(n, ["_query", "pageSize"], r);
  const a = s(e, ["pageToken"]);
  n !== void 0 && a != null && l(n, ["_query", "pageToken"], a);
  const u = s(e, ["filter"]);
  n !== void 0 && u != null && l(n, ["_query", "filter"], u);
  const c = s(e, ["queryBase"]);
  return n !== void 0 && c != null && l(n, ["_url", "models_url"], uo(t, c)), i;
}
function da(t, e, n) {
  const o = {}, i = s(e, ["config"]);
  return i != null && aa(t, i, o), o;
}
function ca(t, e, n) {
  const o = {}, i = s(e, ["config"]);
  return i != null && ua(t, i, o), o;
}
function fa(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && l(n, ["nextPageToken"], i);
  const r = s(t, ["_self"]);
  if (r != null) {
    let a = co(r);
    Array.isArray(a) && (a = a.map((u) => Qe(u))), l(n, ["models"], a);
  }
  return n;
}
function pa(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && l(n, ["nextPageToken"], i);
  const r = s(t, ["_self"]);
  if (r != null) {
    let a = co(r);
    Array.isArray(a) && (a = a.map((u) => Ze(u))), l(n, ["models"], a);
  }
  return n;
}
function ma(t, e) {
  const n = {}, o = s(t, ["maskMode"]);
  o != null && l(n, ["maskMode"], o);
  const i = s(t, [
    "segmentationClasses"
  ]);
  i != null && l(n, ["maskClasses"], i);
  const r = s(t, ["maskDilation"]);
  return r != null && l(n, ["dilation"], r), n;
}
function Qe(t, e) {
  const n = {}, o = s(t, ["name"]);
  o != null && l(n, ["name"], o);
  const i = s(t, ["displayName"]);
  i != null && l(n, ["displayName"], i);
  const r = s(t, ["description"]);
  r != null && l(n, ["description"], r);
  const a = s(t, ["version"]);
  a != null && l(n, ["version"], a);
  const u = s(t, ["_self"]);
  u != null && l(n, ["tunedModelInfo"], Na(u));
  const c = s(t, [
    "inputTokenLimit"
  ]);
  c != null && l(n, ["inputTokenLimit"], c);
  const d = s(t, [
    "outputTokenLimit"
  ]);
  d != null && l(n, ["outputTokenLimit"], d);
  const f = s(t, [
    "supportedGenerationMethods"
  ]);
  f != null && l(n, ["supportedActions"], f);
  const p = s(t, ["temperature"]);
  p != null && l(n, ["temperature"], p);
  const m = s(t, [
    "maxTemperature"
  ]);
  m != null && l(n, ["maxTemperature"], m);
  const h = s(t, ["topP"]);
  h != null && l(n, ["topP"], h);
  const g = s(t, ["topK"]);
  g != null && l(n, ["topK"], g);
  const T = s(t, ["thinking"]);
  return T != null && l(n, ["thinking"], T), n;
}
function Ze(t, e) {
  const n = {}, o = s(t, ["name"]);
  o != null && l(n, ["name"], o);
  const i = s(t, ["displayName"]);
  i != null && l(n, ["displayName"], i);
  const r = s(t, ["description"]);
  r != null && l(n, ["description"], r);
  const a = s(t, ["versionId"]);
  a != null && l(n, ["version"], a);
  const u = s(t, ["deployedModels"]);
  if (u != null) {
    let m = u;
    Array.isArray(m) && (m = m.map((h) => Pl(h))), l(n, ["endpoints"], m);
  }
  const c = s(t, ["labels"]);
  c != null && l(n, ["labels"], c);
  const d = s(t, ["_self"]);
  d != null && l(n, ["tunedModelInfo"], xa(d));
  const f = s(t, [
    "defaultCheckpointId"
  ]);
  f != null && l(n, ["defaultCheckpointId"], f);
  const p = s(t, ["checkpoints"]);
  if (p != null) {
    let m = p;
    Array.isArray(m) && (m = m.map((h) => h)), l(n, ["checkpoints"], m);
  }
  return n;
}
function ha(t, e) {
  const n = {}, o = s(t, [
    "mediaResolution"
  ]);
  o != null && l(n, ["mediaResolution"], o);
  const i = s(t, [
    "codeExecutionResult"
  ]);
  i != null && l(n, ["codeExecutionResult"], i);
  const r = s(t, [
    "executableCode"
  ]);
  r != null && l(n, ["executableCode"], r);
  const a = s(t, ["fileData"]);
  a != null && l(n, ["fileData"], wl(a));
  const u = s(t, ["functionCall"]);
  u != null && l(n, ["functionCall"], Ml(u));
  const c = s(t, [
    "functionResponse"
  ]);
  c != null && l(n, ["functionResponse"], c);
  const d = s(t, ["inlineData"]);
  d != null && l(n, ["inlineData"], el(d));
  const f = s(t, ["text"]);
  f != null && l(n, ["text"], f);
  const p = s(t, ["thought"]);
  p != null && l(n, ["thought"], p);
  const m = s(t, [
    "thoughtSignature"
  ]);
  m != null && l(n, ["thoughtSignature"], m);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && l(n, ["videoMetadata"], h), n;
}
function ga(t, e) {
  const n = {}, o = s(t, ["productImage"]);
  return o != null && l(n, ["image"], W(o)), n;
}
function ya(t, e, n) {
  const o = {}, i = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && i != null && l(e, ["parameters", "sampleCount"], i);
  const r = s(t, ["baseSteps"]);
  e !== void 0 && r != null && l(e, ["parameters", "baseSteps"], r);
  const a = s(t, ["outputGcsUri"]);
  e !== void 0 && a != null && l(e, ["parameters", "storageUri"], a);
  const u = s(t, ["seed"]);
  e !== void 0 && u != null && l(e, ["parameters", "seed"], u);
  const c = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "safetySetting"], c);
  const d = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "personGeneration"], d);
  const f = s(t, ["addWatermark"]);
  e !== void 0 && f != null && l(e, ["parameters", "addWatermark"], f);
  const p = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "outputOptions", "mimeType"], p);
  const m = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "outputOptions", "compressionQuality"], m);
  const h = s(t, [
    "enhancePrompt"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "enhancePrompt"], h);
  const g = s(t, ["labels"]);
  return e !== void 0 && g != null && l(e, ["labels"], g), o;
}
function Ta(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["source"]);
  r != null && Ca(r, o);
  const a = s(e, ["config"]);
  return a != null && ya(a, o), o;
}
function _a(t, e) {
  const n = {}, o = s(t, [
    "predictions"
  ]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => Le(r))), l(n, ["generatedImages"], i);
  }
  return n;
}
function Ca(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["personImage"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "personImage", "image"], W(r));
  const a = s(t, [
    "productImages"
  ]);
  if (e !== void 0 && a != null) {
    let u = a;
    Array.isArray(u) && (u = u.map((c) => ga(c))), l(e, ["instances[0]", "productImages"], u);
  }
  return o;
}
function Ea(t, e) {
  const n = {}, o = s(t, [
    "referenceImage"
  ]);
  o != null && l(n, ["referenceImage"], W(o));
  const i = s(t, ["referenceId"]);
  i != null && l(n, ["referenceId"], i);
  const r = s(t, [
    "referenceType"
  ]);
  r != null && l(n, ["referenceType"], r);
  const a = s(t, [
    "maskImageConfig"
  ]);
  a != null && l(n, ["maskImageConfig"], ma(a));
  const u = s(t, [
    "controlImageConfig"
  ]);
  u != null && l(n, ["controlImageConfig"], ll(u));
  const c = s(t, [
    "styleImageConfig"
  ]);
  c != null && l(n, ["styleImageConfig"], c);
  const d = s(t, [
    "subjectImageConfig"
  ]);
  return d != null && l(n, ["subjectImageConfig"], d), n;
}
function To(t, e) {
  const n = {}, o = s(t, [
    "safetyAttributes",
    "categories"
  ]);
  o != null && l(n, ["categories"], o);
  const i = s(t, [
    "safetyAttributes",
    "scores"
  ]);
  i != null && l(n, ["scores"], i);
  const r = s(t, ["contentType"]);
  return r != null && l(n, ["contentType"], r), n;
}
function _o(t, e) {
  const n = {}, o = s(t, [
    "safetyAttributes",
    "categories"
  ]);
  o != null && l(n, ["categories"], o);
  const i = s(t, [
    "safetyAttributes",
    "scores"
  ]);
  i != null && l(n, ["scores"], i);
  const r = s(t, ["contentType"]);
  return r != null && l(n, ["contentType"], r), n;
}
function Sa(t, e) {
  const n = {}, o = s(t, ["category"]);
  if (o != null && l(n, ["category"], o), s(t, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const i = s(t, ["threshold"]);
  return i != null && l(n, ["threshold"], i), n;
}
function Ia(t, e) {
  const n = {}, o = s(t, ["image"]);
  return o != null && l(n, ["image"], W(o)), n;
}
function va(t, e, n) {
  const o = {}, i = s(t, ["mode"]);
  e !== void 0 && i != null && l(e, ["parameters", "mode"], i);
  const r = s(t, [
    "maxPredictions"
  ]);
  e !== void 0 && r != null && l(e, ["parameters", "maxPredictions"], r);
  const a = s(t, [
    "confidenceThreshold"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "confidenceThreshold"], a);
  const u = s(t, ["maskDilation"]);
  e !== void 0 && u != null && l(e, ["parameters", "maskDilation"], u);
  const c = s(t, [
    "binaryColorThreshold"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "binaryColorThreshold"], c);
  const d = s(t, ["labels"]);
  return e !== void 0 && d != null && l(e, ["labels"], d), o;
}
function Aa(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["source"]);
  r != null && Pa(r, o);
  const a = s(e, ["config"]);
  return a != null && va(a, o), o;
}
function Ra(t, e) {
  const n = {}, o = s(t, ["predictions"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => Ql(r))), l(n, ["generatedMasks"], i);
  }
  return n;
}
function Pa(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], W(r));
  const a = s(t, [
    "scribbleImage"
  ]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "scribble"], Ia(a)), o;
}
function wa(t, e) {
  const n = {}, o = s(t, [
    "retrievalConfig"
  ]);
  o != null && l(n, ["retrievalConfig"], o);
  const i = s(t, [
    "functionCallingConfig"
  ]);
  return i != null && l(n, ["functionCallingConfig"], Nl(i)), n;
}
function Ma(t, e) {
  const n = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const o = s(t, ["computerUse"]);
  o != null && l(n, ["computerUse"], o);
  const i = s(t, ["fileSearch"]);
  i != null && l(n, ["fileSearch"], i);
  const r = s(t, [
    "codeExecution"
  ]);
  if (r != null && l(n, ["codeExecution"], r), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const a = s(t, [
    "functionDeclarations"
  ]);
  if (a != null) {
    let p = a;
    Array.isArray(p) && (p = p.map((m) => m)), l(n, ["functionDeclarations"], p);
  }
  const u = s(t, ["googleMaps"]);
  u != null && l(n, ["googleMaps"], oa(u));
  const c = s(t, ["googleSearch"]);
  c != null && l(n, ["googleSearch"], ia(c));
  const d = s(t, [
    "googleSearchRetrieval"
  ]);
  d != null && l(n, ["googleSearchRetrieval"], d);
  const f = s(t, ["urlContext"]);
  return f != null && l(n, ["urlContext"], f), n;
}
function Co(t, e) {
  const n = {}, o = s(t, ["retrieval"]);
  o != null && l(n, ["retrieval"], o);
  const i = s(t, ["computerUse"]);
  if (i != null && l(n, ["computerUse"], i), s(t, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const r = s(t, [
    "codeExecution"
  ]);
  r != null && l(n, ["codeExecution"], r);
  const a = s(t, [
    "enterpriseWebSearch"
  ]);
  a != null && l(n, ["enterpriseWebSearch"], a);
  const u = s(t, [
    "functionDeclarations"
  ]);
  if (u != null) {
    let m = u;
    Array.isArray(m) && (m = m.map((h) => xl(h))), l(n, ["functionDeclarations"], m);
  }
  const c = s(t, ["googleMaps"]);
  c != null && l(n, ["googleMaps"], c);
  const d = s(t, ["googleSearch"]);
  d != null && l(n, ["googleSearch"], d);
  const f = s(t, [
    "googleSearchRetrieval"
  ]);
  f != null && l(n, ["googleSearchRetrieval"], f);
  const p = s(t, ["urlContext"]);
  return p != null && l(n, ["urlContext"], p), n;
}
function Na(t, e) {
  const n = {}, o = s(t, ["baseModel"]);
  o != null && l(n, ["baseModel"], o);
  const i = s(t, ["createTime"]);
  i != null && l(n, ["createTime"], i);
  const r = s(t, ["updateTime"]);
  return r != null && l(n, ["updateTime"], r), n;
}
function xa(t, e) {
  const n = {}, o = s(t, [
    "labels",
    "google-vertex-llm-tuning-base-model-id"
  ]);
  o != null && l(n, ["baseModel"], o);
  const i = s(t, ["createTime"]);
  i != null && l(n, ["createTime"], i);
  const r = s(t, ["updateTime"]);
  return r != null && l(n, ["updateTime"], r), n;
}
function Da(t, e, n) {
  const o = {}, i = s(t, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(t, ["description"]);
  e !== void 0 && r != null && l(e, ["description"], r);
  const a = s(t, [
    "defaultCheckpointId"
  ]);
  return e !== void 0 && a != null && l(e, ["defaultCheckpointId"], a), o;
}
function Ua(t, e, n) {
  const o = {}, i = s(t, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(t, ["description"]);
  e !== void 0 && r != null && l(e, ["description"], r);
  const a = s(t, [
    "defaultCheckpointId"
  ]);
  return e !== void 0 && a != null && l(e, ["defaultCheckpointId"], a), o;
}
function ka(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "name"], D(t, i));
  const r = s(e, ["config"]);
  return r != null && Da(r, o), o;
}
function La(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["config"]);
  return r != null && Ua(r, o), o;
}
function Fa(t, e, n) {
  const o = {}, i = s(t, ["outputGcsUri"]);
  e !== void 0 && i != null && l(e, ["parameters", "storageUri"], i);
  const r = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && r != null && l(e, ["parameters", "safetySetting"], r);
  const a = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "personGeneration"], a);
  const u = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && u != null && l(e, ["parameters", "includeRaiReason"], u);
  const c = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "outputOptions", "mimeType"], c);
  const d = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "outputOptions", "compressionQuality"], d);
  const f = s(t, [
    "enhanceInputImage"
  ]);
  e !== void 0 && f != null && l(e, ["parameters", "upscaleConfig", "enhanceInputImage"], f);
  const p = s(t, [
    "imagePreservationFactor"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "upscaleConfig", "imagePreservationFactor"], p);
  const m = s(t, ["labels"]);
  e !== void 0 && m != null && l(e, ["labels"], m);
  const h = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "sampleCount"], h);
  const g = s(t, ["mode"]);
  return e !== void 0 && g != null && l(e, ["parameters", "mode"], g), o;
}
function Ga(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["image"]);
  r != null && l(o, ["instances[0]", "image"], W(r));
  const a = s(e, [
    "upscaleFactor"
  ]);
  a != null && l(o, ["parameters", "upscaleConfig", "upscaleFactor"], a);
  const u = s(e, ["config"]);
  return u != null && Fa(u, o), o;
}
function Ha(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Le(a))), l(n, ["generatedImages"], r);
  }
  return n;
}
function Va(t, e) {
  const n = {}, o = s(t, ["uri"]);
  o != null && l(n, ["uri"], o);
  const i = s(t, ["encodedVideo"]);
  i != null && l(n, ["videoBytes"], j(i));
  const r = s(t, ["encoding"]);
  return r != null && l(n, ["mimeType"], r), n;
}
function ba(t, e) {
  const n = {}, o = s(t, ["gcsUri"]);
  o != null && l(n, ["uri"], o);
  const i = s(t, [
    "bytesBase64Encoded"
  ]);
  i != null && l(n, ["videoBytes"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["mimeType"], r), n;
}
function qa(t, e) {
  const n = {}, o = s(t, ["image"]);
  o != null && l(n, ["_self"], W(o));
  const i = s(t, ["maskMode"]);
  return i != null && l(n, ["maskMode"], i), n;
}
function Ba(t, e) {
  const n = {}, o = s(t, ["image"]);
  o != null && l(n, ["image"], Fe(o));
  const i = s(t, [
    "referenceType"
  ]);
  return i != null && l(n, ["referenceType"], i), n;
}
function Ja(t, e) {
  const n = {}, o = s(t, ["image"]);
  o != null && l(n, ["image"], W(o));
  const i = s(t, [
    "referenceType"
  ]);
  return i != null && l(n, ["referenceType"], i), n;
}
function Eo(t, e) {
  const n = {}, o = s(t, ["uri"]);
  o != null && l(n, ["uri"], o);
  const i = s(t, ["videoBytes"]);
  i != null && l(n, ["encodedVideo"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["encoding"], r), n;
}
function So(t, e) {
  const n = {}, o = s(t, ["uri"]);
  o != null && l(n, ["gcsUri"], o);
  const i = s(t, ["videoBytes"]);
  i != null && l(n, ["bytesBase64Encoded"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["mimeType"], r), n;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Oa(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  return e !== void 0 && o != null && l(e, ["displayName"], o), n;
}
function $a(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Oa(n, e), e;
}
function Wa(t, e) {
  const n = {}, o = s(t, ["force"]);
  return e !== void 0 && o != null && l(e, ["_query", "force"], o), n;
}
function Ka(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["_url", "name"], n);
  const o = s(t, ["config"]);
  return o != null && Wa(o, e), e;
}
function Ya(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "name"], n), e;
}
function za(t, e) {
  const n = {}, o = s(t, [
    "customMetadata"
  ]);
  if (e !== void 0 && o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["customMetadata"], r);
  }
  const i = s(t, [
    "chunkingConfig"
  ]);
  return e !== void 0 && i != null && l(e, ["chunkingConfig"], i), n;
}
function Xa(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], Za(a)), e;
}
function Qa(t) {
  const e = {}, n = s(t, [
    "fileSearchStoreName"
  ]);
  n != null && l(e, ["_url", "file_search_store_name"], n);
  const o = s(t, ["fileName"]);
  o != null && l(e, ["fileName"], o);
  const i = s(t, ["config"]);
  return i != null && za(i, e), e;
}
function Za(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(t, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function ja(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function eu(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && ja(n, e), e;
}
function tu(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(t, [
    "fileSearchStores"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["fileSearchStores"], r);
  }
  return e;
}
function Io(t, e) {
  const n = {}, o = s(t, ["mimeType"]);
  e !== void 0 && o != null && l(e, ["mimeType"], o);
  const i = s(t, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(t, [
    "customMetadata"
  ]);
  if (e !== void 0 && r != null) {
    let u = r;
    Array.isArray(u) && (u = u.map((c) => c)), l(e, ["customMetadata"], u);
  }
  const a = s(t, [
    "chunkingConfig"
  ]);
  return e !== void 0 && a != null && l(e, ["chunkingConfig"], a), n;
}
function nu(t) {
  const e = {}, n = s(t, [
    "fileSearchStoreName"
  ]);
  n != null && l(e, ["_url", "file_search_store_name"], n);
  const o = s(t, ["config"]);
  return o != null && Io(o, e), e;
}
function ou(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const iu = "Content-Type", su = "X-Server-Timeout", ru = "User-Agent", je = "x-goog-api-client", lu = "1.40.0", au = `google-genai-sdk/${lu}`, uu = "v1beta1", du = "v1beta";
class cu {
  constructor(e) {
    var n, o, i;
    this.clientOptions = Object.assign({}, e), this.customBaseUrl = (n = e.httpOptions) === null || n === void 0 ? void 0 : n.baseUrl, this.clientOptions.vertexai && (this.clientOptions.project && this.clientOptions.location ? this.clientOptions.apiKey = void 0 : this.clientOptions.apiKey && (this.clientOptions.project = void 0, this.clientOptions.location = void 0));
    const r = {};
    if (this.clientOptions.vertexai) {
      if (!this.clientOptions.location && !this.clientOptions.apiKey && !this.customBaseUrl && (this.clientOptions.location = "global"), !(this.clientOptions.project && this.clientOptions.location || this.clientOptions.apiKey) && !this.customBaseUrl)
        throw new Error("Authentication is not set up. Please provide either a project and location, or an API key, or a custom base URL.");
      const u = e.project && e.location || !!e.apiKey;
      this.customBaseUrl && !u ? (r.baseUrl = this.customBaseUrl, this.clientOptions.project = void 0, this.clientOptions.location = void 0) : this.clientOptions.apiKey || this.clientOptions.location === "global" ? r.baseUrl = "https://aiplatform.googleapis.com/" : this.clientOptions.project && this.clientOptions.location && (r.baseUrl = `https://${this.clientOptions.location}-aiplatform.googleapis.com/`), r.apiVersion = (o = this.clientOptions.apiVersion) !== null && o !== void 0 ? o : uu;
    } else {
      if (!this.clientOptions.apiKey)
        throw new _e({
          message: "API key must be set when using the Gemini API.",
          status: 403
        });
      r.apiVersion = (i = this.clientOptions.apiVersion) !== null && i !== void 0 ? i : du, r.baseUrl = "https://generativelanguage.googleapis.com/";
    }
    r.headers = this.getDefaultHeaders(), this.clientOptions.httpOptions = r, e.httpOptions && (this.clientOptions.httpOptions = this.patchHttpOptions(r, e.httpOptions));
  }
  isVertexAI() {
    var e;
    return (e = this.clientOptions.vertexai) !== null && e !== void 0 ? e : !1;
  }
  getProject() {
    return this.clientOptions.project;
  }
  getLocation() {
    return this.clientOptions.location;
  }
  getCustomBaseUrl() {
    return this.customBaseUrl;
  }
  async getAuthHeaders() {
    const e = new Headers();
    return await this.clientOptions.auth.addAuthHeaders(e), e;
  }
  getApiVersion() {
    if (this.clientOptions.httpOptions && this.clientOptions.httpOptions.apiVersion !== void 0)
      return this.clientOptions.httpOptions.apiVersion;
    throw new Error("API version is not set.");
  }
  getBaseUrl() {
    if (this.clientOptions.httpOptions && this.clientOptions.httpOptions.baseUrl !== void 0)
      return this.clientOptions.httpOptions.baseUrl;
    throw new Error("Base URL is not set.");
  }
  getRequestUrl() {
    return this.getRequestUrlInternal(this.clientOptions.httpOptions);
  }
  getHeaders() {
    if (this.clientOptions.httpOptions && this.clientOptions.httpOptions.headers !== void 0)
      return this.clientOptions.httpOptions.headers;
    throw new Error("Headers are not set.");
  }
  getRequestUrlInternal(e) {
    if (!e || e.baseUrl === void 0 || e.apiVersion === void 0)
      throw new Error("HTTP options are not correctly set.");
    const o = [e.baseUrl.endsWith("/") ? e.baseUrl.slice(0, -1) : e.baseUrl];
    return e.apiVersion && e.apiVersion !== "" && o.push(e.apiVersion), o.join("/");
  }
  getBaseResourcePath() {
    return `projects/${this.clientOptions.project}/locations/${this.clientOptions.location}`;
  }
  getApiKey() {
    return this.clientOptions.apiKey;
  }
  getWebsocketBaseUrl() {
    const e = this.getBaseUrl(), n = new URL(e);
    return n.protocol = n.protocol == "http:" ? "ws" : "wss", n.toString();
  }
  setBaseUrl(e) {
    if (this.clientOptions.httpOptions)
      this.clientOptions.httpOptions.baseUrl = e;
    else
      throw new Error("HTTP options are not correctly set.");
  }
  constructUrl(e, n, o) {
    const i = [this.getRequestUrlInternal(n)];
    return o && i.push(this.getBaseResourcePath()), e !== "" && i.push(e), new URL(`${i.join("/")}`);
  }
  shouldPrependVertexProjectPath(e, n) {
    return !(n.baseUrl && n.baseUrlResourceScope === Ke.COLLECTION || this.clientOptions.apiKey || !this.clientOptions.vertexai || e.path.startsWith("projects/") || e.httpMethod === "GET" && e.path.startsWith("publishers/google/models"));
  }
  async request(e) {
    let n = this.clientOptions.httpOptions;
    e.httpOptions && (n = this.patchHttpOptions(this.clientOptions.httpOptions, e.httpOptions));
    const o = this.shouldPrependVertexProjectPath(e, n), i = this.constructUrl(e.path, n, o);
    if (e.queryParams)
      for (const [a, u] of Object.entries(e.queryParams))
        i.searchParams.append(a, String(u));
    let r = {};
    if (e.httpMethod === "GET") {
      if (e.body && e.body !== "{}")
        throw new Error("Request body should be empty for GET request, but got non empty request body");
    } else
      r.body = e.body;
    return r = await this.includeExtraHttpOptionsToRequestInit(r, n, i.toString(), e.abortSignal), this.unaryApiCall(i, r, e.httpMethod);
  }
  patchHttpOptions(e, n) {
    const o = JSON.parse(JSON.stringify(e));
    for (const [i, r] of Object.entries(n))
      typeof r == "object" ? o[i] = Object.assign(Object.assign({}, o[i]), r) : r !== void 0 && (o[i] = r);
    return o;
  }
  async requestStream(e) {
    let n = this.clientOptions.httpOptions;
    e.httpOptions && (n = this.patchHttpOptions(this.clientOptions.httpOptions, e.httpOptions));
    const o = this.shouldPrependVertexProjectPath(e, n), i = this.constructUrl(e.path, n, o);
    (!i.searchParams.has("alt") || i.searchParams.get("alt") !== "sse") && i.searchParams.set("alt", "sse");
    let r = {};
    return r.body = e.body, r = await this.includeExtraHttpOptionsToRequestInit(r, n, i.toString(), e.abortSignal), this.streamApiCall(i, r, e.httpMethod);
  }
  async includeExtraHttpOptionsToRequestInit(e, n, o, i) {
    if (n && n.timeout || i) {
      const r = new AbortController(), a = r.signal;
      if (n.timeout && (n == null ? void 0 : n.timeout) > 0) {
        const u = setTimeout(() => r.abort(), n.timeout);
        u && typeof u.unref == "function" && u.unref();
      }
      i && i.addEventListener("abort", () => {
        r.abort();
      }), e.signal = a;
    }
    return n && n.extraBody !== null && fu(e, n.extraBody), e.headers = await this.getHeadersInternal(n, o), e;
  }
  async unaryApiCall(e, n, o) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, n), { method: o })).then(async (i) => (await Vn(i), new Ye(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  async streamApiCall(e, n, o) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, n), { method: o })).then(async (i) => (await Vn(i), this.processStreamResponse(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  processStreamResponse(e) {
    return O(this, arguments, function* () {
      var o;
      const i = (o = e == null ? void 0 : e.body) === null || o === void 0 ? void 0 : o.getReader(), r = new TextDecoder("utf-8");
      if (!i)
        throw new Error("Response body is empty");
      try {
        let a = "";
        const u = "data:", c = [`

`, "\r\r", `\r
\r
`];
        for (; ; ) {
          const { done: d, value: f } = yield M(i.read());
          if (d) {
            if (a.trim().length > 0)
              throw new Error("Incomplete JSON segment at the end");
            break;
          }
          const p = r.decode(f, { stream: !0 });
          try {
            const g = JSON.parse(p);
            if ("error" in g) {
              const T = JSON.parse(JSON.stringify(g.error)), y = T.status, E = T.code, v = `got status: ${y}. ${JSON.stringify(g)}`;
              if (E >= 400 && E < 600)
                throw new _e({
                  message: v,
                  status: E
                });
            }
          } catch (g) {
            if (g.name === "ApiError")
              throw g;
          }
          a += p;
          let m = -1, h = 0;
          for (; ; ) {
            m = -1, h = 0;
            for (const y of c) {
              const E = a.indexOf(y);
              E !== -1 && (m === -1 || E < m) && (m = E, h = y.length);
            }
            if (m === -1)
              break;
            const g = a.substring(0, m);
            a = a.substring(m + h);
            const T = g.trim();
            if (T.startsWith(u)) {
              const y = T.substring(u.length).trim();
              try {
                const E = new Response(y, {
                  headers: e == null ? void 0 : e.headers,
                  status: e == null ? void 0 : e.status,
                  statusText: e == null ? void 0 : e.statusText
                });
                yield yield M(new Ye(E));
              } catch (E) {
                throw new Error(`exception parsing stream chunk ${y}. ${E}`);
              }
            }
          }
        }
      } finally {
        i.releaseLock();
      }
    });
  }
  async apiCall(e, n) {
    return fetch(e, n).catch((o) => {
      throw new Error(`exception ${o} sending request`);
    });
  }
  getDefaultHeaders() {
    const e = {}, n = au + " " + this.clientOptions.userAgentExtra;
    return e[ru] = n, e[je] = n, e[iu] = "application/json", e;
  }
  async getHeadersInternal(e, n) {
    const o = new Headers();
    if (e && e.headers) {
      for (const [i, r] of Object.entries(e.headers))
        o.append(i, r);
      e.timeout && e.timeout > 0 && o.append(su, String(Math.ceil(e.timeout / 1e3)));
    }
    return await this.clientOptions.auth.addAuthHeaders(o, n), o;
  }
  getFileName(e) {
    var n;
    let o = "";
    return typeof e == "string" && (o = e.replace(/[/\\]+$/, ""), o = (n = o.split(/[/\\]/).pop()) !== null && n !== void 0 ? n : ""), o;
  }
  /**
   * Uploads a file asynchronously using Gemini API only, this is not supported
   * in Vertex AI.
   *
   * @param file The string path to the file to be uploaded or a Blob object.
   * @param config Optional parameters specified in the `UploadFileConfig`
   *     interface. @see {@link types.UploadFileConfig}
   * @return A promise that resolves to a `File` object.
   * @throws An error if called on a Vertex AI client.
   * @throws An error if the `mimeType` is not provided and can not be inferred,
   */
  async uploadFile(e, n) {
    var o;
    const i = {};
    n != null && (i.mimeType = n.mimeType, i.name = n.name, i.displayName = n.displayName), i.name && !i.name.startsWith("files/") && (i.name = `files/${i.name}`);
    const r = this.clientOptions.uploader, a = await r.stat(e);
    i.sizeBytes = String(a.size);
    const u = (o = n == null ? void 0 : n.mimeType) !== null && o !== void 0 ? o : a.type;
    if (u === void 0 || u === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    i.mimeType = u;
    const c = {
      file: i
    }, d = this.getFileName(e), f = I("upload/v1beta/files", c._url), p = await this.fetchUploadUrl(f, i.sizeBytes, i.mimeType, d, c, n == null ? void 0 : n.httpOptions);
    return r.upload(e, p, this);
  }
  /**
   * Uploads a file to a given file search store asynchronously using Gemini API only, this is not supported
   * in Vertex AI.
   *
   * @param fileSearchStoreName The name of the file search store to upload the file to.
   * @param file The string path to the file to be uploaded or a Blob object.
   * @param config Optional parameters specified in the `UploadFileConfig`
   *     interface. @see {@link UploadFileConfig}
   * @return A promise that resolves to a `File` object.
   * @throws An error if called on a Vertex AI client.
   * @throws An error if the `mimeType` is not provided and can not be inferred,
   */
  async uploadFileToFileSearchStore(e, n, o) {
    var i;
    const r = this.clientOptions.uploader, a = await r.stat(n), u = String(a.size), c = (i = o == null ? void 0 : o.mimeType) !== null && i !== void 0 ? i : a.type;
    if (c === void 0 || c === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    const d = `upload/v1beta/${e}:uploadToFileSearchStore`, f = this.getFileName(n), p = {};
    o != null && Io(o, p);
    const m = await this.fetchUploadUrl(d, u, c, f, p, o == null ? void 0 : o.httpOptions);
    return r.uploadToFileSearchStore(n, m, this);
  }
  /**
   * Downloads a file asynchronously to the specified path.
   *
   * @params params - The parameters for the download request, see {@link
   * types.DownloadFileParameters}
   */
  async downloadFile(e) {
    await this.clientOptions.downloader.download(e, this);
  }
  async fetchUploadUrl(e, n, o, i, r, a) {
    var u;
    let c = {};
    a ? c = a : c = {
      apiVersion: "",
      // api-version is set in the path.
      headers: Object.assign({ "Content-Type": "application/json", "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": `${n}`, "X-Goog-Upload-Header-Content-Type": `${o}` }, i ? { "X-Goog-Upload-File-Name": i } : {})
    };
    const d = await this.request({
      path: e,
      body: JSON.stringify(r),
      httpMethod: "POST",
      httpOptions: c
    });
    if (!d || !(d != null && d.headers))
      throw new Error("Server did not return an HttpResponse or the returned HttpResponse did not have headers.");
    const f = (u = d == null ? void 0 : d.headers) === null || u === void 0 ? void 0 : u["x-goog-upload-url"];
    if (f === void 0)
      throw new Error("Failed to get upload url. Server did not return the x-google-upload-url in the headers");
    return f;
  }
}
async function Vn(t) {
  var e;
  if (t === void 0)
    throw new Error("response is undefined");
  if (!t.ok) {
    const n = t.status;
    let o;
    !((e = t.headers.get("content-type")) === null || e === void 0) && e.includes("application/json") ? o = await t.json() : o = {
      error: {
        message: await t.text(),
        code: t.status,
        status: t.statusText
      }
    };
    const i = JSON.stringify(o);
    throw n >= 400 && n < 600 ? new _e({
      message: i,
      status: n
    }) : new Error(i);
  }
}
function fu(t, e) {
  if (!e || Object.keys(e).length === 0)
    return;
  if (t.body instanceof Blob) {
    console.warn("includeExtraBodyToRequestInit: extraBody provided but current request body is a Blob. extraBody will be ignored as merging is not supported for Blob bodies.");
    return;
  }
  let n = {};
  if (typeof t.body == "string" && t.body.length > 0)
    try {
      const r = JSON.parse(t.body);
      if (typeof r == "object" && r !== null && !Array.isArray(r))
        n = r;
      else {
        console.warn("includeExtraBodyToRequestInit: Original request body is valid JSON but not a non-array object. Skip applying extraBody to the request body.");
        return;
      }
    } catch {
      console.warn("includeExtraBodyToRequestInit: Original request body is not valid JSON. Skip applying extraBody to the request body.");
      return;
    }
  function o(r, a) {
    const u = Object.assign({}, r);
    for (const c in a)
      if (Object.prototype.hasOwnProperty.call(a, c)) {
        const d = a[c], f = u[c];
        d && typeof d == "object" && !Array.isArray(d) && f && typeof f == "object" && !Array.isArray(f) ? u[c] = o(f, d) : (f && d && typeof f != typeof d && console.warn(`includeExtraBodyToRequestInit:deepMerge: Type mismatch for key "${c}". Original type: ${typeof f}, New type: ${typeof d}. Overwriting.`), u[c] = d);
      }
    return u;
  }
  const i = o(n, e);
  t.body = JSON.stringify(i);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const pu = "mcp_used/unknown";
let mu = !1;
function vo(t) {
  for (const e of t)
    if (hu(e) || typeof e == "object" && "inputSchema" in e)
      return !0;
  return mu;
}
function Ao(t) {
  var e;
  const n = (e = t[je]) !== null && e !== void 0 ? e : "";
  t[je] = (n + ` ${pu}`).trimStart();
}
function hu(t) {
  return t !== null && typeof t == "object" && t instanceof mt;
}
function gu(t) {
  return O(this, arguments, function* (n, o = 100) {
    let i, r = 0;
    for (; r < o; ) {
      const a = yield M(n.listTools({ cursor: i }));
      for (const u of a.tools)
        yield yield M(u), r++;
      if (!a.nextCursor)
        break;
      i = a.nextCursor;
    }
  });
}
class mt {
  constructor(e = [], n) {
    this.mcpTools = [], this.functionNameToMcpClient = {}, this.mcpClients = e, this.config = n;
  }
  /**
   * Creates a McpCallableTool.
   */
  static create(e, n) {
    return new mt(e, n);
  }
  /**
   * Validates the function names are not duplicate and initialize the function
   * name to MCP client mapping.
   *
   * @throws {Error} if the MCP tools from the MCP clients have duplicate tool
   *     names.
   */
  async initialize() {
    var e, n, o, i;
    if (this.mcpTools.length > 0)
      return;
    const r = {}, a = [];
    for (const f of this.mcpClients)
      try {
        for (var u = !0, c = (n = void 0, $(gu(f))), d; d = await c.next(), e = d.done, !e; u = !0) {
          i = d.value, u = !1;
          const p = i;
          a.push(p);
          const m = p.name;
          if (r[m])
            throw new Error(`Duplicate function name ${m} found in MCP tools. Please ensure function names are unique.`);
          r[m] = f;
        }
      } catch (p) {
        n = { error: p };
      } finally {
        try {
          !u && !e && (o = c.return) && await o.call(c);
        } finally {
          if (n) throw n.error;
        }
      }
    this.mcpTools = a, this.functionNameToMcpClient = r;
  }
  async tool() {
    return await this.initialize(), $i(this.mcpTools, this.config);
  }
  async callTool(e) {
    await this.initialize();
    const n = [];
    for (const o of e)
      if (o.name in this.functionNameToMcpClient) {
        const i = this.functionNameToMcpClient[o.name];
        let r;
        this.config.timeout && (r = {
          timeout: this.config.timeout
        });
        const a = await i.callTool(
          {
            name: o.name,
            arguments: o.args
          },
          // Set the result schema to undefined to allow MCP to rely on the
          // default schema.
          void 0,
          r
        );
        n.push({
          functionResponse: {
            name: o.name,
            response: a.isError ? { error: a } : a
          }
        });
      }
    return n;
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
async function yu(t, e, n) {
  const o = new Gi();
  let i;
  n.data instanceof Blob ? i = JSON.parse(await n.data.text()) : i = JSON.parse(n.data), Object.assign(o, i), e(o);
}
class Tu {
  constructor(e, n, o) {
    this.apiClient = e, this.auth = n, this.webSocketFactory = o;
  }
  /**
       Establishes a connection to the specified model and returns a
       LiveMusicSession object representing that connection.
  
       @experimental
  
       @remarks
  
       @param params - The parameters for establishing a connection to the model.
       @return A live session.
  
       @example
       ```ts
       let model = 'models/lyria-realtime-exp';
       const session = await ai.live.music.connect({
         model: model,
         callbacks: {
           onmessage: (e: MessageEvent) => {
             console.log('Received message from the server: %s\n', debug(e.data));
           },
           onerror: (e: ErrorEvent) => {
             console.log('Error occurred: %s\n', debug(e.error));
           },
           onclose: (e: CloseEvent) => {
             console.log('Connection closed.');
           },
         },
       });
       ```
      */
  async connect(e) {
    var n, o;
    if (this.apiClient.isVertexAI())
      throw new Error("Live music is not supported for Vertex AI.");
    console.warn("Live music generation is experimental and may change in future versions.");
    const i = this.apiClient.getWebsocketBaseUrl(), r = this.apiClient.getApiVersion(), a = Eu(this.apiClient.getDefaultHeaders()), u = this.apiClient.getApiKey(), c = `${i}/ws/google.ai.generativelanguage.${r}.GenerativeService.BidiGenerateMusic?key=${u}`;
    let d = () => {
    };
    const f = new Promise((S) => {
      d = S;
    }), p = e.callbacks, m = function() {
      d({});
    }, h = this.apiClient, g = {
      onopen: m,
      onmessage: (S) => {
        yu(h, p.onmessage, S);
      },
      onerror: (n = p == null ? void 0 : p.onerror) !== null && n !== void 0 ? n : function(S) {
      },
      onclose: (o = p == null ? void 0 : p.onclose) !== null && o !== void 0 ? o : function(S) {
      }
    }, T = this.webSocketFactory.create(c, Cu(a), g);
    T.connect(), await f;
    const v = { setup: { model: D(this.apiClient, e.model) } };
    return T.send(JSON.stringify(v)), new _u(T, this.apiClient);
  }
}
class _u {
  constructor(e, n) {
    this.conn = e, this.apiClient = n;
  }
  /**
      Sets inputs to steer music generation. Updates the session's current
      weighted prompts.
  
      @param params - Contains one property, `weightedPrompts`.
  
        - `weightedPrompts` to send to the model; weights are normalized to
          sum to 1.0.
  
      @experimental
     */
  async setWeightedPrompts(e) {
    if (!e.weightedPrompts || Object.keys(e.weightedPrompts).length === 0)
      throw new Error("Weighted prompts must be set and contain at least one entry.");
    const n = Or(e);
    this.conn.send(JSON.stringify({ clientContent: n }));
  }
  /**
      Sets a configuration to the model. Updates the session's current
      music generation config.
  
      @param params - Contains one property, `musicGenerationConfig`.
  
        - `musicGenerationConfig` to set in the model. Passing an empty or
      undefined config to the model will reset the config to defaults.
  
      @experimental
     */
  async setMusicGenerationConfig(e) {
    e.musicGenerationConfig || (e.musicGenerationConfig = {});
    const n = Jr(e);
    this.conn.send(JSON.stringify(n));
  }
  sendPlaybackControl(e) {
    const n = { playbackControl: e };
    this.conn.send(JSON.stringify(n));
  }
  /**
   * Start the music stream.
   *
   * @experimental
   */
  play() {
    this.sendPlaybackControl(le.PLAY);
  }
  /**
   * Temporarily halt the music stream. Use `play` to resume from the current
   * position.
   *
   * @experimental
   */
  pause() {
    this.sendPlaybackControl(le.PAUSE);
  }
  /**
   * Stop the music stream and reset the state. Retains the current prompts
   * and config.
   *
   * @experimental
   */
  stop() {
    this.sendPlaybackControl(le.STOP);
  }
  /**
   * Resets the context of the music generation without stopping it.
   * Retains the current prompts and config.
   *
   * @experimental
   */
  resetContext() {
    this.sendPlaybackControl(le.RESET_CONTEXT);
  }
  /**
       Terminates the WebSocket connection.
  
       @experimental
     */
  close() {
    this.conn.close();
  }
}
function Cu(t) {
  const e = {};
  return t.forEach((n, o) => {
    e[o] = n;
  }), e;
}
function Eu(t) {
  const e = new Headers();
  for (const [n, o] of Object.entries(t))
    e.append(n, o);
  return e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Su = "FunctionResponse request must have an `id` field from the response of a ToolCall.FunctionalCalls in Google AI.";
async function Iu(t, e, n) {
  const o = new Fi();
  let i;
  n.data instanceof Blob ? i = await n.data.text() : n.data instanceof ArrayBuffer ? i = new TextDecoder().decode(n.data) : i = n.data;
  const r = JSON.parse(i);
  if (t.isVertexAI()) {
    const a = Kr(r);
    Object.assign(o, a);
  } else
    Object.assign(o, r);
  e(o);
}
class vu {
  constructor(e, n, o) {
    this.apiClient = e, this.auth = n, this.webSocketFactory = o, this.music = new Tu(this.apiClient, this.auth, this.webSocketFactory);
  }
  /**
       Establishes a connection to the specified model with the given
       configuration and returns a Session object representing that connection.
  
       @experimental Built-in MCP support is an experimental feature, may change in
       future versions.
  
       @remarks
  
       @param params - The parameters for establishing a connection to the model.
       @return A live session.
  
       @example
       ```ts
       let model: string;
       if (GOOGLE_GENAI_USE_VERTEXAI) {
         model = 'gemini-2.0-flash-live-preview-04-09';
       } else {
         model = 'gemini-live-2.5-flash-preview';
       }
       const session = await ai.live.connect({
         model: model,
         config: {
           responseModalities: [Modality.AUDIO],
         },
         callbacks: {
           onopen: () => {
             console.log('Connected to the socket.');
           },
           onmessage: (e: MessageEvent) => {
             console.log('Received message from the server: %s\n', debug(e.data));
           },
           onerror: (e: ErrorEvent) => {
             console.log('Error occurred: %s\n', debug(e.error));
           },
           onclose: (e: CloseEvent) => {
             console.log('Connection closed.');
           },
         },
       });
       ```
      */
  async connect(e) {
    var n, o, i, r, a, u;
    if (e.config && e.config.httpOptions)
      throw new Error("The Live module does not support httpOptions at request-level in LiveConnectConfig yet. Please use the client-level httpOptions configuration instead.");
    const c = this.apiClient.getWebsocketBaseUrl(), d = this.apiClient.getApiVersion();
    let f;
    const p = this.apiClient.getHeaders();
    e.config && e.config.tools && vo(e.config.tools) && Ao(p);
    const m = wu(p);
    if (this.apiClient.isVertexAI()) {
      const P = this.apiClient.getProject(), x = this.apiClient.getLocation(), U = this.apiClient.getApiKey(), F = !!P && !!x || !!U;
      this.apiClient.getCustomBaseUrl() && !F ? f = c : (f = `${c}/ws/google.cloud.aiplatform.${d}.LlmBidiService/BidiGenerateContent`, await this.auth.addAuthHeaders(m, f));
    } else {
      const P = this.apiClient.getApiKey();
      let x = "BidiGenerateContent", U = "key";
      P != null && P.startsWith("auth_tokens/") && (console.warn("Warning: Ephemeral token support is experimental and may change in future versions."), d !== "v1alpha" && console.warn("Warning: The SDK's ephemeral token support is in v1alpha only. Please use const ai = new GoogleGenAI({apiKey: token.name, httpOptions: { apiVersion: 'v1alpha' }}); before session connection."), x = "BidiGenerateContentConstrained", U = "access_token"), f = `${c}/ws/google.ai.generativelanguage.${d}.GenerativeService.${x}?${U}=${P}`;
    }
    let h = () => {
    };
    const g = new Promise((P) => {
      h = P;
    }), T = e.callbacks, y = function() {
      var P;
      (P = T == null ? void 0 : T.onopen) === null || P === void 0 || P.call(T), h({});
    }, E = this.apiClient, v = {
      onopen: y,
      onmessage: (P) => {
        Iu(E, T.onmessage, P);
      },
      onerror: (n = T == null ? void 0 : T.onerror) !== null && n !== void 0 ? n : function(P) {
      },
      onclose: (o = T == null ? void 0 : T.onclose) !== null && o !== void 0 ? o : function(P) {
      }
    }, S = this.webSocketFactory.create(f, Pu(m), v);
    S.connect(), await g;
    let _ = D(this.apiClient, e.model);
    if (this.apiClient.isVertexAI() && _.startsWith("publishers/")) {
      const P = this.apiClient.getProject(), x = this.apiClient.getLocation();
      P && x && (_ = `projects/${P}/locations/${x}/` + _);
    }
    let C = {};
    this.apiClient.isVertexAI() && ((i = e.config) === null || i === void 0 ? void 0 : i.responseModalities) === void 0 && (e.config === void 0 ? e.config = { responseModalities: [we.AUDIO] } : e.config.responseModalities = [we.AUDIO]), !((r = e.config) === null || r === void 0) && r.generationConfig && console.warn("Setting `LiveConnectConfig.generation_config` is deprecated, please set the fields on `LiveConnectConfig` directly. This will become an error in a future version (not before Q3 2025).");
    const A = (u = (a = e.config) === null || a === void 0 ? void 0 : a.tools) !== null && u !== void 0 ? u : [], R = [];
    for (const P of A)
      if (this.isCallableTool(P)) {
        const x = P;
        R.push(await x.tool());
      } else
        R.push(P);
    R.length > 0 && (e.config.tools = R);
    const N = {
      model: _,
      config: e.config,
      callbacks: e.callbacks
    };
    return this.apiClient.isVertexAI() ? C = Br(this.apiClient, N) : C = qr(this.apiClient, N), delete C.config, S.send(JSON.stringify(C)), new Ru(S, this.apiClient);
  }
  // TODO: b/416041229 - Abstract this method to a common place.
  isCallableTool(e) {
    return "callTool" in e && typeof e.callTool == "function";
  }
}
const Au = {
  turnComplete: !0
};
class Ru {
  constructor(e, n) {
    this.conn = e, this.apiClient = n;
  }
  tLiveClientContent(e, n) {
    if (n.turns !== null && n.turns !== void 0) {
      let o = [];
      try {
        o = B(n.turns), e.isVertexAI() || (o = o.map((i) => ke(i)));
      } catch {
        throw new Error(`Failed to parse client content "turns", type: '${typeof n.turns}'`);
      }
      return {
        clientContent: { turns: o, turnComplete: n.turnComplete }
      };
    }
    return {
      clientContent: { turnComplete: n.turnComplete }
    };
  }
  tLiveClienttToolResponse(e, n) {
    let o = [];
    if (n.functionResponses == null)
      throw new Error("functionResponses is required.");
    if (Array.isArray(n.functionResponses) ? o = n.functionResponses : o = [n.functionResponses], o.length === 0)
      throw new Error("functionResponses is required.");
    for (const r of o) {
      if (typeof r != "object" || r === null || !("name" in r) || !("response" in r))
        throw new Error(`Could not parse function response, type '${typeof r}'.`);
      if (!e.isVertexAI() && !("id" in r))
        throw new Error(Su);
    }
    return {
      toolResponse: { functionResponses: o }
    };
  }
  /**
      Send a message over the established connection.
  
      @param params - Contains two **optional** properties, `turns` and
          `turnComplete`.
  
        - `turns` will be converted to a `Content[]`
        - `turnComplete: true` [default] indicates that you are done sending
          content and expect a response. If `turnComplete: false`, the server
          will wait for additional messages before starting generation.
  
      @experimental
  
      @remarks
      There are two ways to send messages to the live API:
      `sendClientContent` and `sendRealtimeInput`.
  
      `sendClientContent` messages are added to the model context **in order**.
      Having a conversation using `sendClientContent` messages is roughly
      equivalent to using the `Chat.sendMessageStream`, except that the state of
      the `chat` history is stored on the API server instead of locally.
  
      Because of `sendClientContent`'s order guarantee, the model cannot respons
      as quickly to `sendClientContent` messages as to `sendRealtimeInput`
      messages. This makes the biggest difference when sending objects that have
      significant preprocessing time (typically images).
  
      The `sendClientContent` message sends a `Content[]`
      which has more options than the `Blob` sent by `sendRealtimeInput`.
  
      So the main use-cases for `sendClientContent` over `sendRealtimeInput` are:
  
      - Sending anything that can't be represented as a `Blob` (text,
      `sendClientContent({turns="Hello?"}`)).
      - Managing turns when not using audio input and voice activity detection.
        (`sendClientContent({turnComplete:true})` or the short form
      `sendClientContent()`)
      - Prefilling a conversation context
        ```
        sendClientContent({
            turns: [
              Content({role:user, parts:...}),
              Content({role:user, parts:...}),
              ...
            ]
        })
        ```
      @experimental
     */
  sendClientContent(e) {
    e = Object.assign(Object.assign({}, Au), e);
    const n = this.tLiveClientContent(this.apiClient, e);
    this.conn.send(JSON.stringify(n));
  }
  /**
      Send a realtime message over the established connection.
  
      @param params - Contains one property, `media`.
  
        - `media` will be converted to a `Blob`
  
      @experimental
  
      @remarks
      Use `sendRealtimeInput` for realtime audio chunks and video frames (images).
  
      With `sendRealtimeInput` the api will respond to audio automatically
      based on voice activity detection (VAD).
  
      `sendRealtimeInput` is optimized for responsivness at the expense of
      deterministic ordering guarantees. Audio and video tokens are to the
      context when they become available.
  
      Note: The Call signature expects a `Blob` object, but only a subset
      of audio and image mimetypes are allowed.
     */
  sendRealtimeInput(e) {
    let n = {};
    this.apiClient.isVertexAI() ? n = {
      realtimeInput: Wr(e)
    } : n = {
      realtimeInput: $r(e)
    }, this.conn.send(JSON.stringify(n));
  }
  /**
      Send a function response message over the established connection.
  
      @param params - Contains property `functionResponses`.
  
        - `functionResponses` will be converted to a `functionResponses[]`
  
      @remarks
      Use `sendFunctionResponse` to reply to `LiveServerToolCall` from the server.
  
      Use {@link types.LiveConnectConfig#tools} to configure the callable functions.
  
      @experimental
     */
  sendToolResponse(e) {
    if (e.functionResponses == null)
      throw new Error("Tool response parameters are required.");
    const n = this.tLiveClienttToolResponse(this.apiClient, e);
    this.conn.send(JSON.stringify(n));
  }
  /**
       Terminates the WebSocket connection.
  
       @experimental
  
       @example
       ```ts
       let model: string;
       if (GOOGLE_GENAI_USE_VERTEXAI) {
         model = 'gemini-2.0-flash-live-preview-04-09';
       } else {
         model = 'gemini-live-2.5-flash-preview';
       }
       const session = await ai.live.connect({
         model: model,
         config: {
           responseModalities: [Modality.AUDIO],
         }
       });
  
       session.close();
       ```
     */
  close() {
    this.conn.close();
  }
}
function Pu(t) {
  const e = {};
  return t.forEach((n, o) => {
    e[o] = n;
  }), e;
}
function wu(t) {
  const e = new Headers();
  for (const [n, o] of Object.entries(t))
    e.append(n, o);
  return e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const bn = 10;
function qn(t) {
  var e, n, o;
  if (!((e = t == null ? void 0 : t.automaticFunctionCalling) === null || e === void 0) && e.disable)
    return !0;
  let i = !1;
  for (const a of (n = t == null ? void 0 : t.tools) !== null && n !== void 0 ? n : [])
    if (de(a)) {
      i = !0;
      break;
    }
  if (!i)
    return !0;
  const r = (o = t == null ? void 0 : t.automaticFunctionCalling) === null || o === void 0 ? void 0 : o.maximumRemoteCalls;
  return r && (r < 0 || !Number.isInteger(r)) || r == 0 ? (console.warn("Invalid maximumRemoteCalls value provided for automatic function calling. Disabled automatic function calling. Please provide a valid integer value greater than 0. maximumRemoteCalls provided:", r), !0) : !1;
}
function de(t) {
  return "callTool" in t && typeof t.callTool == "function";
}
function Mu(t) {
  var e, n, o;
  return (o = (n = (e = t.config) === null || e === void 0 ? void 0 : e.tools) === null || n === void 0 ? void 0 : n.some((i) => de(i))) !== null && o !== void 0 ? o : !1;
}
function Bn(t) {
  var e;
  const n = [];
  return !((e = t == null ? void 0 : t.config) === null || e === void 0) && e.tools && t.config.tools.forEach((o, i) => {
    if (de(o))
      return;
    const r = o;
    r.functionDeclarations && r.functionDeclarations.length > 0 && n.push(i);
  }), n;
}
function Jn(t) {
  var e;
  return !(!((e = t == null ? void 0 : t.automaticFunctionCalling) === null || e === void 0) && e.ignoreCallHistory);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Nu extends X {
  constructor(e) {
    super(), this.apiClient = e, this.generateContent = async (n) => {
      var o, i, r, a, u;
      const c = await this.processParamsMaybeAddMcpUsage(n);
      if (this.maybeMoveToResponseJsonSchem(n), !Mu(n) || qn(n.config))
        return await this.generateContentInternal(c);
      const d = Bn(n);
      if (d.length > 0) {
        const T = d.map((y) => `tools[${y}]`).join(", ");
        throw new Error(`Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations is not yet supported. Incompatible tools found at ${T}.`);
      }
      let f, p;
      const m = B(c.contents), h = (r = (i = (o = c.config) === null || o === void 0 ? void 0 : o.automaticFunctionCalling) === null || i === void 0 ? void 0 : i.maximumRemoteCalls) !== null && r !== void 0 ? r : bn;
      let g = 0;
      for (; g < h && (f = await this.generateContentInternal(c), !(!f.functionCalls || f.functionCalls.length === 0)); ) {
        const T = f.candidates[0].content, y = [];
        for (const E of (u = (a = n.config) === null || a === void 0 ? void 0 : a.tools) !== null && u !== void 0 ? u : [])
          if (de(E)) {
            const S = await E.callTool(f.functionCalls);
            y.push(...S);
          }
        g++, p = {
          role: "user",
          parts: y
        }, c.contents = B(c.contents), c.contents.push(T), c.contents.push(p), Jn(c.config) && (m.push(T), m.push(p));
      }
      return Jn(c.config) && (f.automaticFunctionCallingHistory = m), f;
    }, this.generateContentStream = async (n) => {
      var o, i, r, a, u;
      if (this.maybeMoveToResponseJsonSchem(n), qn(n.config)) {
        const p = await this.processParamsMaybeAddMcpUsage(n);
        return await this.generateContentStreamInternal(p);
      }
      const c = Bn(n);
      if (c.length > 0) {
        const p = c.map((m) => `tools[${m}]`).join(", ");
        throw new Error(`Incompatible tools found at ${p}. Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations" is not yet supported.`);
      }
      const d = (r = (i = (o = n == null ? void 0 : n.config) === null || o === void 0 ? void 0 : o.toolConfig) === null || i === void 0 ? void 0 : i.functionCallingConfig) === null || r === void 0 ? void 0 : r.streamFunctionCallArguments, f = (u = (a = n == null ? void 0 : n.config) === null || a === void 0 ? void 0 : a.automaticFunctionCalling) === null || u === void 0 ? void 0 : u.disable;
      if (d && !f)
        throw new Error("Running in streaming mode with 'streamFunctionCallArguments' enabled, this feature is not compatible with automatic function calling (AFC). Please set 'config.automaticFunctionCalling.disable' to true to disable AFC or leave 'config.toolConfig.functionCallingConfig.streamFunctionCallArguments' to be undefined or set to false to disable streaming function call arguments feature.");
      return await this.processAfcStream(n);
    }, this.generateImages = async (n) => await this.generateImagesInternal(n).then((o) => {
      var i;
      let r;
      const a = [];
      if (o != null && o.generatedImages)
        for (const c of o.generatedImages)
          c && (c != null && c.safetyAttributes) && ((i = c == null ? void 0 : c.safetyAttributes) === null || i === void 0 ? void 0 : i.contentType) === "Positive Prompt" ? r = c == null ? void 0 : c.safetyAttributes : a.push(c);
      let u;
      return r ? u = {
        generatedImages: a,
        positivePromptSafetyAttributes: r,
        sdkHttpResponse: o.sdkHttpResponse
      } : u = {
        generatedImages: a,
        sdkHttpResponse: o.sdkHttpResponse
      }, u;
    }), this.list = async (n) => {
      var o;
      const a = {
        config: Object.assign(Object.assign({}, {
          queryBase: !0
        }), n == null ? void 0 : n.config)
      };
      if (this.apiClient.isVertexAI() && !a.config.queryBase) {
        if (!((o = a.config) === null || o === void 0) && o.filter)
          throw new Error("Filtering tuned models list for Vertex AI is not currently supported");
        a.config.filter = "labels.tune-type:*";
      }
      return new oe(z.PAGED_ITEM_MODELS, (u) => this.listInternal(u), await this.listInternal(a), a);
    }, this.editImage = async (n) => {
      const o = {
        model: n.model,
        prompt: n.prompt,
        referenceImages: [],
        config: n.config
      };
      return n.referenceImages && n.referenceImages && (o.referenceImages = n.referenceImages.map((i) => i.toReferenceImageAPI())), await this.editImageInternal(o);
    }, this.upscaleImage = async (n) => {
      let o = {
        numberOfImages: 1,
        mode: "upscale"
      };
      n.config && (o = Object.assign(Object.assign({}, o), n.config));
      const i = {
        model: n.model,
        image: n.image,
        upscaleFactor: n.upscaleFactor,
        config: o
      };
      return await this.upscaleImageInternal(i);
    }, this.generateVideos = async (n) => {
      var o, i, r, a, u, c;
      if ((n.prompt || n.image || n.video) && n.source)
        throw new Error("Source and prompt/image/video are mutually exclusive. Please only use source.");
      return this.apiClient.isVertexAI() || (!((o = n.video) === null || o === void 0) && o.uri && (!((i = n.video) === null || i === void 0) && i.videoBytes) ? n.video = {
        uri: n.video.uri,
        mimeType: n.video.mimeType
      } : !((a = (r = n.source) === null || r === void 0 ? void 0 : r.video) === null || a === void 0) && a.uri && (!((c = (u = n.source) === null || u === void 0 ? void 0 : u.video) === null || c === void 0) && c.videoBytes) && (n.source.video = {
        uri: n.source.video.uri,
        mimeType: n.source.video.mimeType
      })), await this.generateVideosInternal(n);
    };
  }
  /**
   * This logic is needed for GenerateContentConfig only.
   * Previously we made GenerateContentConfig.responseSchema field to accept
   * unknown. Since v1.9.0, we switch to use backend JSON schema support.
   * To maintain backward compatibility, we move the data that was treated as
   * JSON schema from the responseSchema field to the responseJsonSchema field.
   */
  maybeMoveToResponseJsonSchem(e) {
    e.config && e.config.responseSchema && (e.config.responseJsonSchema || Object.keys(e.config.responseSchema).includes("$schema") && (e.config.responseJsonSchema = e.config.responseSchema, delete e.config.responseSchema));
  }
  /**
   * Transforms the CallableTools in the parameters to be simply Tools, it
   * copies the params into a new object and replaces the tools, it does not
   * modify the original params. Also sets the MCP usage header if there are
   * MCP tools in the parameters.
   */
  async processParamsMaybeAddMcpUsage(e) {
    var n, o, i;
    const r = (n = e.config) === null || n === void 0 ? void 0 : n.tools;
    if (!r)
      return e;
    const a = await Promise.all(r.map(async (c) => de(c) ? await c.tool() : c)), u = {
      model: e.model,
      contents: e.contents,
      config: Object.assign(Object.assign({}, e.config), { tools: a })
    };
    if (u.config.tools = a, e.config && e.config.tools && vo(e.config.tools)) {
      const c = (i = (o = e.config.httpOptions) === null || o === void 0 ? void 0 : o.headers) !== null && i !== void 0 ? i : {};
      let d = Object.assign({}, c);
      Object.keys(d).length === 0 && (d = this.apiClient.getDefaultHeaders()), Ao(d), u.config.httpOptions = Object.assign(Object.assign({}, e.config.httpOptions), { headers: d });
    }
    return u;
  }
  async initAfcToolsMap(e) {
    var n, o, i;
    const r = /* @__PURE__ */ new Map();
    for (const a of (o = (n = e.config) === null || n === void 0 ? void 0 : n.tools) !== null && o !== void 0 ? o : [])
      if (de(a)) {
        const u = a, c = await u.tool();
        for (const d of (i = c.functionDeclarations) !== null && i !== void 0 ? i : []) {
          if (!d.name)
            throw new Error("Function declaration name is required.");
          if (r.has(d.name))
            throw new Error(`Duplicate tool declaration name: ${d.name}`);
          r.set(d.name, u);
        }
      }
    return r;
  }
  async processAfcStream(e) {
    var n, o, i;
    const r = (i = (o = (n = e.config) === null || n === void 0 ? void 0 : n.automaticFunctionCalling) === null || o === void 0 ? void 0 : o.maximumRemoteCalls) !== null && i !== void 0 ? i : bn;
    let a = !1, u = 0;
    const c = await this.initAfcToolsMap(e);
    return function(d, f, p) {
      return O(this, arguments, function* () {
        for (var m, h, g, T, y, E; u < r; ) {
          a && (u++, a = !1);
          const C = yield M(d.processParamsMaybeAddMcpUsage(p)), A = yield M(d.generateContentStreamInternal(C)), R = [], N = [];
          try {
            for (var v = !0, S = (h = void 0, $(A)), _; _ = yield M(S.next()), m = _.done, !m; v = !0) {
              T = _.value, v = !1;
              const P = T;
              if (yield yield M(P), P.candidates && (!((y = P.candidates[0]) === null || y === void 0) && y.content)) {
                N.push(P.candidates[0].content);
                for (const x of (E = P.candidates[0].content.parts) !== null && E !== void 0 ? E : [])
                  if (u < r && x.functionCall) {
                    if (!x.functionCall.name)
                      throw new Error("Function call name was not returned by the model.");
                    if (f.has(x.functionCall.name)) {
                      const U = yield M(f.get(x.functionCall.name).callTool([x.functionCall]));
                      R.push(...U);
                    } else
                      throw new Error(`Automatic function calling was requested, but not all the tools the model used implement the CallableTool interface. Available tools: ${f.keys()}, mising tool: ${x.functionCall.name}`);
                  }
              }
            }
          } catch (P) {
            h = { error: P };
          } finally {
            try {
              !v && !m && (g = S.return) && (yield M(g.call(S)));
            } finally {
              if (h) throw h.error;
            }
          }
          if (R.length > 0) {
            a = !0;
            const P = new he();
            P.candidates = [
              {
                content: {
                  role: "user",
                  parts: R
                }
              }
            ], yield yield M(P);
            const x = [];
            x.push(...N), x.push({
              role: "user",
              parts: R
            });
            const U = B(p.contents).concat(x);
            p.contents = U;
          } else
            break;
        }
      });
    }(this, c, e);
  }
  async generateContentInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Fn(this.apiClient, e);
      return u = I("{model}:generateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Hn(f), m = new he();
        return Object.assign(m, p), m;
      });
    } else {
      const d = Ln(this.apiClient, e);
      return u = I("{model}:generateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Gn(f), m = new he();
        return Object.assign(m, p), m;
      });
    }
  }
  async generateContentStreamInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Fn(this.apiClient, e);
      return u = I("{model}:streamGenerateContent?alt=sse", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.requestStream({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }), a.then(function(p) {
        return O(this, arguments, function* () {
          var m, h, g, T;
          try {
            for (var y = !0, E = $(p), v; v = yield M(E.next()), m = v.done, !m; y = !0) {
              T = v.value, y = !1;
              const S = T, _ = Hn(yield M(S.json()), e);
              _.sdkHttpResponse = {
                headers: S.headers
              };
              const C = new he();
              Object.assign(C, _), yield yield M(C);
            }
          } catch (S) {
            h = { error: S };
          } finally {
            try {
              !y && !m && (g = E.return) && (yield M(g.call(E)));
            } finally {
              if (h) throw h.error;
            }
          }
        });
      });
    } else {
      const d = Ln(this.apiClient, e);
      return u = I("{model}:streamGenerateContent?alt=sse", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.requestStream({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }), a.then(function(p) {
        return O(this, arguments, function* () {
          var m, h, g, T;
          try {
            for (var y = !0, E = $(p), v; v = yield M(E.next()), m = v.done, !m; y = !0) {
              T = v.value, y = !1;
              const S = T, _ = Gn(yield M(S.json()), e);
              _.sdkHttpResponse = {
                headers: S.headers
              };
              const C = new he();
              Object.assign(C, _), yield yield M(C);
            }
          } catch (S) {
            h = { error: S };
          } finally {
            try {
              !y && !m && (g = E.return) && (yield M(g.call(E)));
            } finally {
              if (h) throw h.error;
            }
          }
        });
      });
    }
  }
  /**
   * Calculates embeddings for the given contents. Only text is supported.
   *
   * @param params - The parameters for embedding contents.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.embedContent({
   *  model: 'text-embedding-004',
   *  contents: [
   *    'What is your name?',
   *    'What is your favorite color?',
   *  ],
   *  config: {
   *    outputDimensionality: 64,
   *  },
   * });
   * console.log(response);
   * ```
   */
  async embedContent(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = vl(this.apiClient, e);
      return u = I("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Rl(f), m = new Tn();
        return Object.assign(m, p), m;
      });
    } else {
      const d = Il(this.apiClient, e);
      return u = I("{model}:batchEmbedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Al(f), m = new Tn();
        return Object.assign(m, p), m;
      });
    }
  }
  /**
   * Private method for generating images.
   */
  async generateImagesInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Gl(this.apiClient, e);
      return u = I("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Vl(f), m = new _n();
        return Object.assign(m, p), m;
      });
    } else {
      const d = Fl(this.apiClient, e);
      return u = I("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Hl(f), m = new _n();
        return Object.assign(m, p), m;
      });
    }
  }
  /**
   * Private method for editing an image.
   */
  async editImageInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = _l(this.apiClient, e);
      return r = I("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = Cl(c), f = new vi();
        return Object.assign(f, d), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for upscaling an image.
   */
  async upscaleImageInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = Ga(this.apiClient, e);
      return r = I("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = Ha(c), f = new Ai();
        return Object.assign(f, d), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Recontextualizes an image.
   *
   * There are two types of recontextualization currently supported:
   * 1) Imagen Product Recontext - Generate images of products in new scenes
   *    and contexts.
   * 2) Virtual Try-On: Generate images of persons modeling fashion products.
   *
   * @param params - The parameters for recontextualizing an image.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response1 = await ai.models.recontextImage({
   *  model: 'imagen-product-recontext-preview-06-30',
   *  source: {
   *    prompt: 'In a modern kitchen setting.',
   *    productImages: [productImage],
   *  },
   *  config: {
   *    numberOfImages: 1,
   *  },
   * });
   * console.log(response1?.generatedImages?.[0]?.image?.imageBytes);
   *
   * const response2 = await ai.models.recontextImage({
   *  model: 'virtual-try-on-001',
   *  source: {
   *    personImage: personImage,
   *    productImages: [productImage],
   *  },
   *  config: {
   *    numberOfImages: 1,
   *  },
   * });
   * console.log(response2?.generatedImages?.[0]?.image?.imageBytes);
   * ```
   */
  async recontextImage(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = Ta(this.apiClient, e);
      return r = I("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = _a(c), f = new Ri();
        return Object.assign(f, d), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Segments an image, creating a mask of a specified area.
   *
   * @param params - The parameters for segmenting an image.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.segmentImage({
   *  model: 'image-segmentation-001',
   *  source: {
   *    image: image,
   *  },
   *  config: {
   *    mode: 'foreground',
   *  },
   * });
   * console.log(response?.generatedMasks?.[0]?.mask?.imageBytes);
   * ```
   */
  async segmentImage(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = Aa(this.apiClient, e);
      return r = I("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Ra(c), f = new Pi();
        return Object.assign(f, d), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Fetches information about a model by name.
   *
   * @example
   * ```ts
   * const modelInfo = await ai.models.get({model: 'gemini-2.0-flash'});
   * ```
   */
  async get(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = na(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Ze(f));
    } else {
      const d = ta(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Qe(f));
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = ca(this.apiClient, e);
      return u = I("{models_url}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = pa(f), m = new Cn();
        return Object.assign(m, p), m;
      });
    } else {
      const d = da(this.apiClient, e);
      return u = I("{models_url}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = fa(f), m = new Cn();
        return Object.assign(m, p), m;
      });
    }
  }
  /**
   * Updates a tuned model by its name.
   *
   * @param params - The parameters for updating the model.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.update({
   *   model: 'tuned-model-name',
   *   config: {
   *     displayName: 'New display name',
   *     description: 'New description',
   *   },
   * });
   * ```
   */
  async update(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = La(this.apiClient, e);
      return u = I("{model}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Ze(f));
    } else {
      const d = ka(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Qe(f));
    }
  }
  /**
   * Deletes a tuned model by its name.
   *
   * @param params - The parameters for deleting the model.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.delete({model: 'tuned-model-name'});
   * ```
   */
  async delete(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = hl(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = yl(f), m = new En();
        return Object.assign(m, p), m;
      });
    } else {
      const d = ml(this.apiClient, e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = gl(f), m = new En();
        return Object.assign(m, p), m;
      });
    }
  }
  /**
   * Counts the number of tokens in the given contents. Multimodal input is
   * supported for Gemini models.
   *
   * @param params - The parameters for counting tokens.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.countTokens({
   *  model: 'gemini-2.0-flash',
   *  contents: 'The quick brown fox jumps over the lazy dog.'
   * });
   * console.log(response);
   * ```
   */
  async countTokens(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = cl(this.apiClient, e);
      return u = I("{model}:countTokens", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = pl(f), m = new Sn();
        return Object.assign(m, p), m;
      });
    } else {
      const d = dl(this.apiClient, e);
      return u = I("{model}:countTokens", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = fl(f), m = new Sn();
        return Object.assign(m, p), m;
      });
    }
  }
  /**
   * Given a list of contents, returns a corresponding TokensInfo containing
   * the list of tokens and list of token ids.
   *
   * This method is not supported by the Gemini Developer API.
   *
   * @param params - The parameters for computing tokens.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.computeTokens({
   *  model: 'gemini-2.0-flash',
   *  contents: 'What is your name?'
   * });
   * console.log(response);
   * ```
   */
  async computeTokens(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = ol(this.apiClient, e);
      return r = I("{model}:computeTokens", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = il(c), f = new wi();
        return Object.assign(f, d), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for generating videos.
   */
  async generateVideosInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = $l(this.apiClient, e);
      return u = I("{model}:predictLongRunning", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const p = Jl(f), m = new Me();
        return Object.assign(m, p), m;
      });
    } else {
      const d = Ol(this.apiClient, e);
      return u = I("{model}:predictLongRunning", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const p = Bl(f), m = new Me();
        return Object.assign(m, p), m;
      });
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class xu extends X {
  constructor(e) {
    super(), this.apiClient = e;
  }
  /**
   * Gets the status of a long-running operation.
   *
   * @param parameters The parameters for the get operation request.
   * @return The updated Operation object, with the latest status or result.
   */
  async getVideosOperation(e) {
    const n = e.operation, o = e.config;
    if (n.name === void 0 || n.name === "")
      throw new Error("Operation name is required.");
    if (this.apiClient.isVertexAI()) {
      const i = n.name.split("/operations/")[0];
      let r;
      o && "httpOptions" in o && (r = o.httpOptions);
      const a = await this.fetchPredictVideosOperationInternal({
        operationName: n.name,
        resourceName: i,
        config: { httpOptions: r }
      });
      return n._fromAPIResponse({
        apiResponse: a,
        _isVertexAI: !0
      });
    } else {
      const i = await this.getVideosOperationInternal({
        operationName: n.name,
        config: o
      });
      return n._fromAPIResponse({
        apiResponse: i,
        _isVertexAI: !1
      });
    }
  }
  /**
   * Gets the status of a long-running operation.
   *
   * @param parameters The parameters for the get operation request.
   * @return The updated Operation object, with the latest status or result.
   */
  async get(e) {
    const n = e.operation, o = e.config;
    if (n.name === void 0 || n.name === "")
      throw new Error("Operation name is required.");
    if (this.apiClient.isVertexAI()) {
      const i = n.name.split("/operations/")[0];
      let r;
      o && "httpOptions" in o && (r = o.httpOptions);
      const a = await this.fetchPredictVideosOperationInternal({
        operationName: n.name,
        resourceName: i,
        config: { httpOptions: r }
      });
      return n._fromAPIResponse({
        apiResponse: a,
        _isVertexAI: !0
      });
    } else {
      const i = await this.getVideosOperationInternal({
        operationName: n.name,
        config: o
      });
      return n._fromAPIResponse({
        apiResponse: i,
        _isVertexAI: !1
      });
    }
  }
  async getVideosOperationInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Ti(e);
      return u = I("{operationName}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a;
    } else {
      const d = yi(e);
      return u = I("{operationName}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a;
    }
  }
  async fetchPredictVideosOperationInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = di(e);
      return r = I("{resourceName}:fetchPredictOperation", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i;
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Du(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && l(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Uu(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => Bu(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function ku(t, e, n) {
  const o = {}, i = s(e, ["expireTime"]);
  n !== void 0 && i != null && l(n, ["expireTime"], i);
  const r = s(e, [
    "newSessionExpireTime"
  ]);
  n !== void 0 && r != null && l(n, ["newSessionExpireTime"], r);
  const a = s(e, ["uses"]);
  n !== void 0 && a != null && l(n, ["uses"], a);
  const u = s(e, [
    "liveConnectConstraints"
  ]);
  n !== void 0 && u != null && l(n, ["bidiGenerateContentSetup"], qu(t, u));
  const c = s(e, [
    "lockAdditionalFields"
  ]);
  return n !== void 0 && c != null && l(n, ["fieldMask"], c), o;
}
function Lu(t, e) {
  const n = {}, o = s(e, ["config"]);
  return o != null && l(n, ["config"], ku(t, o, n)), n;
}
function Fu(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Gu(t) {
  const e = {}, n = s(t, ["id"]);
  n != null && l(e, ["id"], n);
  const o = s(t, ["args"]);
  o != null && l(e, ["args"], o);
  const i = s(t, ["name"]);
  if (i != null && l(e, ["name"], i), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Hu(t) {
  const e = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const n = s(t, ["enableWidget"]);
  return n != null && l(e, ["enableWidget"], n), e;
}
function Vu(t) {
  const e = {};
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const n = s(t, [
    "timeRangeFilter"
  ]);
  return n != null && l(e, ["timeRangeFilter"], n), e;
}
function bu(t, e) {
  const n = {}, o = s(t, [
    "generationConfig"
  ]);
  e !== void 0 && o != null && l(e, ["setup", "generationConfig"], o);
  const i = s(t, [
    "responseModalities"
  ]);
  e !== void 0 && i != null && l(e, ["setup", "generationConfig", "responseModalities"], i);
  const r = s(t, ["temperature"]);
  e !== void 0 && r != null && l(e, ["setup", "generationConfig", "temperature"], r);
  const a = s(t, ["topP"]);
  e !== void 0 && a != null && l(e, ["setup", "generationConfig", "topP"], a);
  const u = s(t, ["topK"]);
  e !== void 0 && u != null && l(e, ["setup", "generationConfig", "topK"], u);
  const c = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], c);
  const d = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "mediaResolution"], d);
  const f = s(t, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], pt(p));
  const m = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "thinkingConfig"], m);
  const h = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], h);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], Uu(H(g)));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let A = fe(T);
    Array.isArray(A) && (A = A.map((R) => Ou(ce(R)))), l(e, ["setup", "tools"], A);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], Ju(y));
  const E = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "inputAudioTranscription"], E);
  const v = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && v != null && l(e, ["setup", "outputAudioTranscription"], v);
  const S = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "realtimeInputConfig"], S);
  const _ = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && _ != null && l(e, ["setup", "contextWindowCompression"], _);
  const C = s(t, ["proactivity"]);
  if (e !== void 0 && C != null && l(e, ["setup", "proactivity"], C), s(t, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return n;
}
function qu(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["setup", "model"], D(t, o));
  const i = s(e, ["config"]);
  return i != null && l(n, ["config"], bu(i, n)), n;
}
function Bu(t) {
  const e = {}, n = s(t, [
    "mediaResolution"
  ]);
  n != null && l(e, ["mediaResolution"], n);
  const o = s(t, [
    "codeExecutionResult"
  ]);
  o != null && l(e, ["codeExecutionResult"], o);
  const i = s(t, [
    "executableCode"
  ]);
  i != null && l(e, ["executableCode"], i);
  const r = s(t, ["fileData"]);
  r != null && l(e, ["fileData"], Fu(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], Gu(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(t, ["inlineData"]);
  c != null && l(e, ["inlineData"], Du(c));
  const d = s(t, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(t, ["thought"]);
  f != null && l(e, ["thought"], f);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && l(e, ["thoughtSignature"], p);
  const m = s(t, [
    "videoMetadata"
  ]);
  return m != null && l(e, ["videoMetadata"], m), e;
}
function Ju(t) {
  const e = {}, n = s(t, ["handle"]);
  if (n != null && l(e, ["handle"], n), s(t, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return e;
}
function Ou(t) {
  const e = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(t, ["computerUse"]);
  n != null && l(e, ["computerUse"], n);
  const o = s(t, ["fileSearch"]);
  o != null && l(e, ["fileSearch"], o);
  const i = s(t, [
    "codeExecution"
  ]);
  if (i != null && l(e, ["codeExecution"], i), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const r = s(t, [
    "functionDeclarations"
  ]);
  if (r != null) {
    let f = r;
    Array.isArray(f) && (f = f.map((p) => p)), l(e, ["functionDeclarations"], f);
  }
  const a = s(t, ["googleMaps"]);
  a != null && l(e, ["googleMaps"], Hu(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Vu(u));
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(t, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function $u(t) {
  const e = [];
  for (const n in t)
    if (Object.prototype.hasOwnProperty.call(t, n)) {
      const o = t[n];
      if (typeof o == "object" && o != null && Object.keys(o).length > 0) {
        const i = Object.keys(o).map((r) => `${n}.${r}`);
        e.push(...i);
      } else
        e.push(n);
    }
  return e.join(",");
}
function Wu(t, e) {
  let n = null;
  const o = t.bidiGenerateContentSetup;
  if (typeof o == "object" && o !== null && "setup" in o) {
    const r = o.setup;
    typeof r == "object" && r !== null ? (t.bidiGenerateContentSetup = r, n = r) : delete t.bidiGenerateContentSetup;
  } else o !== void 0 && delete t.bidiGenerateContentSetup;
  const i = t.fieldMask;
  if (n) {
    const r = $u(n);
    if (Array.isArray(e == null ? void 0 : e.lockAdditionalFields) && (e == null ? void 0 : e.lockAdditionalFields.length) === 0)
      r ? t.fieldMask = r : delete t.fieldMask;
    else if (e != null && e.lockAdditionalFields && e.lockAdditionalFields.length > 0 && i !== null && Array.isArray(i) && i.length > 0) {
      const a = [
        "temperature",
        "topK",
        "topP",
        "maxOutputTokens",
        "responseModalities",
        "seed",
        "speechConfig"
      ];
      let u = [];
      i.length > 0 && (u = i.map((d) => a.includes(d) ? `generationConfig.${d}` : d));
      const c = [];
      r && c.push(r), u.length > 0 && c.push(...u), c.length > 0 ? t.fieldMask = c.join(",") : delete t.fieldMask;
    } else
      delete t.fieldMask;
  } else
    i !== null && Array.isArray(i) && i.length > 0 ? t.fieldMask = i.join(",") : delete t.fieldMask;
  return t;
}
class Ku extends X {
  constructor(e) {
    super(), this.apiClient = e;
  }
  /**
   * Creates an ephemeral auth token resource.
   *
   * @experimental
   *
   * @remarks
   * Ephemeral auth tokens is only supported in the Gemini Developer API.
   * It can be used for the session connection to the Live constrained API.
   * Support in v1alpha only.
   *
   * @param params - The parameters for the create request.
   * @return The created auth token.
   *
   * @example
   * ```ts
   * const ai = new GoogleGenAI({
   *     apiKey: token.name,
   *     httpOptions: { apiVersion: 'v1alpha' }  // Support in v1alpha only.
   * });
   *
   * // Case 1: If LiveEphemeralParameters is unset, unlock LiveConnectConfig
   * // when using the token in Live API sessions. Each session connection can
   * // use a different configuration.
   * const config: CreateAuthTokenConfig = {
   *     uses: 3,
   *     expireTime: '2025-05-01T00:00:00Z',
   * }
   * const token = await ai.tokens.create(config);
   *
   * // Case 2: If LiveEphemeralParameters is set, lock all fields in
   * // LiveConnectConfig when using the token in Live API sessions. For
   * // example, changing `outputAudioTranscription` in the Live API
   * // connection will be ignored by the API.
   * const config: CreateAuthTokenConfig =
   *     uses: 3,
   *     expireTime: '2025-05-01T00:00:00Z',
   *     LiveEphemeralParameters: {
   *        model: 'gemini-2.0-flash-001',
   *        config: {
   *           'responseModalities': ['AUDIO'],
   *           'systemInstruction': 'Always answer in English.',
   *        }
   *     }
   * }
   * const token = await ai.tokens.create(config);
   *
   * // Case 3: If LiveEphemeralParameters is set and lockAdditionalFields is
   * // set, lock LiveConnectConfig with set and additional fields (e.g.
   * // responseModalities, systemInstruction, temperature in this example) when
   * // using the token in Live API sessions.
   * const config: CreateAuthTokenConfig =
   *     uses: 3,
   *     expireTime: '2025-05-01T00:00:00Z',
   *     LiveEphemeralParameters: {
   *        model: 'gemini-2.0-flash-001',
   *        config: {
   *           'responseModalities': ['AUDIO'],
   *           'systemInstruction': 'Always answer in English.',
   *        }
   *     },
   *     lockAdditionalFields: ['temperature'],
   * }
   * const token = await ai.tokens.create(config);
   *
   * // Case 4: If LiveEphemeralParameters is set and lockAdditionalFields is
   * // empty array, lock LiveConnectConfig with set fields (e.g.
   * // responseModalities, systemInstruction in this example) when using the
   * // token in Live API sessions.
   * const config: CreateAuthTokenConfig =
   *     uses: 3,
   *     expireTime: '2025-05-01T00:00:00Z',
   *     LiveEphemeralParameters: {
   *        model: 'gemini-2.0-flash-001',
   *        config: {
   *           'responseModalities': ['AUDIO'],
   *           'systemInstruction': 'Always answer in English.',
   *        }
   *     },
   *     lockAdditionalFields: [],
   * }
   * const token = await ai.tokens.create(config);
   * ```
   */
  async create(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("The client.tokens.create method is only supported by the Gemini Developer API.");
    {
      const u = Lu(this.apiClient, e);
      r = I("auth_tokens", u._url), a = u._query, delete u.config, delete u._url, delete u._query;
      const c = Wu(u, e.config);
      return i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Yu(t, e) {
  const n = {}, o = s(t, ["force"]);
  return e !== void 0 && o != null && l(e, ["_query", "force"], o), n;
}
function zu(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["_url", "name"], n);
  const o = s(t, ["config"]);
  return o != null && Yu(o, e), e;
}
function Xu(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "name"], n), e;
}
function Qu(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function Zu(t) {
  const e = {}, n = s(t, ["parent"]);
  n != null && l(e, ["_url", "parent"], n);
  const o = s(t, ["config"]);
  return o != null && Qu(o, e), e;
}
function ju(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(t, ["documents"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["documents"], r);
  }
  return e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class ed extends X {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n) => new oe(z.PAGED_ITEM_DOCUMENTS, (o) => this.listInternal({ parent: n.parent, config: o.config }), await this.listInternal(n), n);
  }
  /**
   * Gets a Document.
   *
   * @param params - The parameters for getting a document.
   * @return Document.
   */
  async get(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Xu(e);
      return r = I("{name}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => c);
    }
  }
  /**
   * Deletes a Document.
   *
   * @param params - The parameters for deleting a document.
   */
  async delete(e) {
    var n, o;
    let i = "", r = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const a = zu(e);
      i = I("{name}", a._url), r = a._query, delete a._url, delete a._query, await this.apiClient.request({
        path: i,
        queryParams: r,
        body: JSON.stringify(a),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    }
  }
  async listInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Zu(e);
      return r = I("{parent}/documents", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = ju(c), f = new Mi();
        return Object.assign(f, d), f;
      });
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class td extends X {
  constructor(e, n = new ed(e)) {
    super(), this.apiClient = e, this.documents = n, this.list = async (o = {}) => new oe(z.PAGED_ITEM_FILE_SEARCH_STORES, (i) => this.listInternal(i), await this.listInternal(o), o);
  }
  /**
   * Uploads a file asynchronously to a given File Search Store.
   * This method is not available in Vertex AI.
   * Supported upload sources:
   * - Node.js: File path (string) or Blob object.
   * - Browser: Blob object (e.g., File).
   *
   * @remarks
   * The `mimeType` can be specified in the `config` parameter. If omitted:
   *  - For file path (string) inputs, the `mimeType` will be inferred from the
   *     file extension.
   *  - For Blob object inputs, the `mimeType` will be set to the Blob's `type`
   *     property.
   *
   * This section can contain multiple paragraphs and code examples.
   *
   * @param params - Optional parameters specified in the
   *        `types.UploadToFileSearchStoreParameters` interface.
   *         @see {@link types.UploadToFileSearchStoreParameters#config} for the optional
   *         config in the parameters.
   * @return A promise that resolves to a long running operation.
   * @throws An error if called on a Vertex AI client.
   * @throws An error if the `mimeType` is not provided and can not be inferred,
   * the `mimeType` can be provided in the `params.config` parameter.
   * @throws An error occurs if a suitable upload location cannot be established.
   *
   * @example
   * The following code uploads a file to a given file search store.
   *
   * ```ts
   * const operation = await ai.fileSearchStores.upload({fileSearchStoreName: 'fileSearchStores/foo-bar', file: 'file.txt', config: {
   *   mimeType: 'text/plain',
   * }});
   * console.log(operation.name);
   * ```
   */
  async uploadToFileSearchStore(e) {
    if (this.apiClient.isVertexAI())
      throw new Error("Vertex AI does not support uploading files to a file search store.");
    return this.apiClient.uploadFileToFileSearchStore(e.fileSearchStoreName, e.file, e.config);
  }
  /**
   * Creates a File Search Store.
   *
   * @param params - The parameters for creating a File Search Store.
   * @return FileSearchStore.
   */
  async create(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = $a(e);
      return r = I("fileSearchStores", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => c);
    }
  }
  /**
   * Gets a File Search Store.
   *
   * @param params - The parameters for getting a File Search Store.
   * @return FileSearchStore.
   */
  async get(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Ya(e);
      return r = I("{name}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => c);
    }
  }
  /**
   * Deletes a File Search Store.
   *
   * @param params - The parameters for deleting a File Search Store.
   */
  async delete(e) {
    var n, o;
    let i = "", r = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const a = Ka(e);
      i = I("{name}", a._url), r = a._query, delete a._url, delete a._query, await this.apiClient.request({
        path: i,
        queryParams: r,
        body: JSON.stringify(a),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    }
  }
  async listInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = eu(e);
      return r = I("fileSearchStores", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = tu(c), f = new Ni();
        return Object.assign(f, d), f;
      });
    }
  }
  async uploadToFileSearchStoreInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = nu(e);
      return r = I("upload/v1beta/{file_search_store_name}:uploadToFileSearchStore", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = ou(c), f = new xi();
        return Object.assign(f, d), f;
      });
    }
  }
  /**
   * Imports a File from File Service to a FileSearchStore.
   *
   * This is a long-running operation, see aip.dev/151
   *
   * @param params - The parameters for importing a file to a file search store.
   * @return ImportFileOperation.
   */
  async importFile(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Qa(e);
      return r = I("{file_search_store_name}:importFile", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Xa(c), f = new at();
        return Object.assign(f, d), f;
      });
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
let Ro = function() {
  const { crypto: t } = globalThis;
  if (t != null && t.randomUUID)
    return Ro = t.randomUUID.bind(t), t.randomUUID();
  const e = new Uint8Array(1), n = t ? () => t.getRandomValues(e)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (o) => (+o ^ n() & 15 >> +o / 4).toString(16));
};
const nd = () => Ro();
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function et(t) {
  return typeof t == "object" && t !== null && // Spec-compliant fetch implementations
  ("name" in t && t.name === "AbortError" || // Expo fetch
  "message" in t && String(t.message).includes("FetchRequestCanceledException"));
}
const tt = (t) => {
  if (t instanceof Error)
    return t;
  if (typeof t == "object" && t !== null) {
    try {
      if (Object.prototype.toString.call(t) === "[object Error]") {
        const e = new Error(t.message, t.cause ? { cause: t.cause } : {});
        return t.stack && (e.stack = t.stack), t.cause && !e.cause && (e.cause = t.cause), t.name && (e.name = t.name), e;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(t));
    } catch {
    }
  }
  return new Error(t);
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class J extends Error {
}
class b extends J {
  constructor(e, n, o, i) {
    super(`${b.makeMessage(e, n, o)}`), this.status = e, this.headers = i, this.error = n;
  }
  static makeMessage(e, n, o) {
    const i = n != null && n.message ? typeof n.message == "string" ? n.message : JSON.stringify(n.message) : n ? JSON.stringify(n) : o;
    return e && i ? `${e} ${i}` : e ? `${e} status code (no body)` : i || "(no status code or body)";
  }
  static generate(e, n, o, i) {
    if (!e || !i)
      return new Ge({ message: o, cause: tt(n) });
    const r = n;
    return e === 400 ? new wo(e, r, o, i) : e === 401 ? new Mo(e, r, o, i) : e === 403 ? new No(e, r, o, i) : e === 404 ? new xo(e, r, o, i) : e === 409 ? new Do(e, r, o, i) : e === 422 ? new Uo(e, r, o, i) : e === 429 ? new ko(e, r, o, i) : e >= 500 ? new Lo(e, r, o, i) : new b(e, r, o, i);
  }
}
class nt extends b {
  constructor({ message: e } = {}) {
    super(void 0, void 0, e || "Request was aborted.", void 0);
  }
}
class Ge extends b {
  constructor({ message: e, cause: n }) {
    super(void 0, void 0, e || "Connection error.", void 0), n && (this.cause = n);
  }
}
class Po extends Ge {
  constructor({ message: e } = {}) {
    super({ message: e ?? "Request timed out." });
  }
}
class wo extends b {
}
class Mo extends b {
}
class No extends b {
}
class xo extends b {
}
class Do extends b {
}
class Uo extends b {
}
class ko extends b {
}
class Lo extends b {
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const od = /^[a-z][a-z0-9+.-]*:/i, id = (t) => od.test(t);
let ot = (t) => (ot = Array.isArray, ot(t));
const sd = ot;
let rd = sd;
const On = rd;
function ld(t) {
  if (!t)
    return !0;
  for (const e in t)
    return !1;
  return !0;
}
function ad(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
const ud = (t, e) => {
  if (typeof e != "number" || !Number.isInteger(e))
    throw new J(`${t} must be an integer`);
  if (e < 0)
    throw new J(`${t} must be a positive integer`);
  return e;
}, dd = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return;
  }
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const cd = (t) => new Promise((e) => setTimeout(e, t));
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const re = "0.0.1";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function fd() {
  return typeof Deno < "u" && Deno.build != null ? "deno" : typeof EdgeRuntime < "u" ? "edge" : Object.prototype.toString.call(typeof globalThis.process < "u" ? globalThis.process : 0) === "[object process]" ? "node" : "unknown";
}
const pd = () => {
  var t, e, n, o, i;
  const r = fd();
  if (r === "deno")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": re,
      "X-Stainless-OS": Wn(Deno.build.os),
      "X-Stainless-Arch": $n(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version == "string" ? Deno.version : (e = (t = Deno.version) === null || t === void 0 ? void 0 : t.deno) !== null && e !== void 0 ? e : "unknown"
    };
  if (typeof EdgeRuntime < "u")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": re,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  if (r === "node")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": re,
      "X-Stainless-OS": Wn((n = globalThis.process.platform) !== null && n !== void 0 ? n : "unknown"),
      "X-Stainless-Arch": $n((o = globalThis.process.arch) !== null && o !== void 0 ? o : "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": (i = globalThis.process.version) !== null && i !== void 0 ? i : "unknown"
    };
  const a = md();
  return a ? {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": re,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": `browser:${a.browser}`,
    "X-Stainless-Runtime-Version": a.version
  } : {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": re,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function md() {
  if (typeof navigator > "u" || !navigator)
    return null;
  const t = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key: e, pattern: n } of t) {
    const o = n.exec(navigator.userAgent);
    if (o) {
      const i = o[1] || 0, r = o[2] || 0, a = o[3] || 0;
      return { browser: e, version: `${i}.${r}.${a}` };
    }
  }
  return null;
}
const $n = (t) => t === "x32" ? "x32" : t === "x86_64" || t === "x64" ? "x64" : t === "arm" ? "arm" : t === "aarch64" || t === "arm64" ? "arm64" : t ? `other:${t}` : "unknown", Wn = (t) => (t = t.toLowerCase(), t.includes("ios") ? "iOS" : t === "android" ? "Android" : t === "darwin" ? "MacOS" : t === "win32" ? "Windows" : t === "freebsd" ? "FreeBSD" : t === "openbsd" ? "OpenBSD" : t === "linux" ? "Linux" : t ? `Other:${t}` : "Unknown");
let Ce;
const hd = () => Ce ?? (Ce = pd());
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function gd() {
  if (typeof fetch < "u")
    return fetch;
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new GeminiNextGenAPIClient({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function Fo(...t) {
  const e = globalThis.ReadableStream;
  if (typeof e > "u")
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  return new e(...t);
}
function yd(t) {
  let e = Symbol.asyncIterator in t ? t[Symbol.asyncIterator]() : t[Symbol.iterator]();
  return Fo({
    start() {
    },
    async pull(n) {
      const { done: o, value: i } = await e.next();
      o ? n.close() : n.enqueue(i);
    },
    async cancel() {
      var n;
      await ((n = e.return) === null || n === void 0 ? void 0 : n.call(e));
    }
  });
}
function Go(t) {
  if (t[Symbol.asyncIterator])
    return t;
  const e = t.getReader();
  return {
    async next() {
      try {
        const n = await e.read();
        return n != null && n.done && e.releaseLock(), n;
      } catch (n) {
        throw e.releaseLock(), n;
      }
    },
    async return() {
      const n = e.cancel();
      return e.releaseLock(), await n, { done: !0, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function Td(t) {
  var e, n;
  if (t === null || typeof t != "object")
    return;
  if (t[Symbol.asyncIterator]) {
    await ((n = (e = t[Symbol.asyncIterator]()).return) === null || n === void 0 ? void 0 : n.call(e));
    return;
  }
  const o = t.getReader(), i = o.cancel();
  o.releaseLock(), await i;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const _d = ({ headers: t, body: e }) => ({
  bodyHeaders: {
    "content-type": "application/json"
  },
  body: JSON.stringify(e)
});
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Ho = () => {
  var t;
  if (typeof File > "u") {
    const { process: e } = globalThis, n = typeof ((t = e == null ? void 0 : e.versions) === null || t === void 0 ? void 0 : t.node) == "string" && parseInt(e.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (n ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function qe(t, e, n) {
  return Ho(), new File(t, e ?? "unknown_file", n);
}
function Cd(t) {
  return (typeof t == "object" && t !== null && ("name" in t && t.name && String(t.name) || "url" in t && t.url && String(t.url) || "filename" in t && t.filename && String(t.filename) || "path" in t && t.path && String(t.path)) || "").split(/[\\/]/).pop() || void 0;
}
const Ed = (t) => t != null && typeof t == "object" && typeof t[Symbol.asyncIterator] == "function";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Vo = (t) => t != null && typeof t == "object" && typeof t.size == "number" && typeof t.type == "string" && typeof t.text == "function" && typeof t.slice == "function" && typeof t.arrayBuffer == "function", Sd = (t) => t != null && typeof t == "object" && typeof t.name == "string" && typeof t.lastModified == "number" && Vo(t), Id = (t) => t != null && typeof t == "object" && typeof t.url == "string" && typeof t.blob == "function";
async function vd(t, e, n) {
  if (Ho(), t = await t, Sd(t))
    return t instanceof File ? t : qe([await t.arrayBuffer()], t.name);
  if (Id(t)) {
    const i = await t.blob();
    return e || (e = new URL(t.url).pathname.split(/[\\/]/).pop()), qe(await it(i), e, n);
  }
  const o = await it(t);
  if (e || (e = Cd(t)), !(n != null && n.type)) {
    const i = o.find((r) => typeof r == "object" && "type" in r && r.type);
    typeof i == "string" && (n = Object.assign(Object.assign({}, n), { type: i }));
  }
  return qe(o, e, n);
}
async function it(t) {
  var e, n, o, i, r;
  let a = [];
  if (typeof t == "string" || ArrayBuffer.isView(t) || // includes Uint8Array, Buffer, etc.
  t instanceof ArrayBuffer)
    a.push(t);
  else if (Vo(t))
    a.push(t instanceof Blob ? t : await t.arrayBuffer());
  else if (Ed(t))
    try {
      for (var u = !0, c = $(t), d; d = await c.next(), e = d.done, !e; u = !0) {
        i = d.value, u = !1;
        const f = i;
        a.push(...await it(f));
      }
    } catch (f) {
      n = { error: f };
    } finally {
      try {
        !u && !e && (o = c.return) && await o.call(c);
      } finally {
        if (n) throw n.error;
      }
    }
  else {
    const f = (r = t == null ? void 0 : t.constructor) === null || r === void 0 ? void 0 : r.name;
    throw new Error(`Unexpected data type: ${typeof t}${f ? `; constructor: ${f}` : ""}${Ad(t)}`);
  }
  return a;
}
function Ad(t) {
  return typeof t != "object" || t === null ? "" : `; props: [${Object.getOwnPropertyNames(t).map((n) => `"${n}"`).join(", ")}]`;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class bo {
  constructor(e) {
    this._client = e;
  }
}
bo._key = [];
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function qo(t) {
  return t.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const Kn = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null)), Rd = (t = qo) => function(n, ...o) {
  if (n.length === 1)
    return n[0];
  let i = !1;
  const r = [], a = n.reduce((f, p, m) => {
    var h, g, T;
    /[?#]/.test(p) && (i = !0);
    const y = o[m];
    let E = (i ? encodeURIComponent : t)("" + y);
    return m !== o.length && (y == null || typeof y == "object" && // handle values from other realms
    y.toString === ((T = Object.getPrototypeOf((g = Object.getPrototypeOf((h = y.hasOwnProperty) !== null && h !== void 0 ? h : Kn)) !== null && g !== void 0 ? g : Kn)) === null || T === void 0 ? void 0 : T.toString)) && (E = y + "", r.push({
      start: f.length + p.length,
      length: E.length,
      error: `Value of type ${Object.prototype.toString.call(y).slice(8, -1)} is not a valid path parameter`
    })), f + p + (m === o.length ? "" : E);
  }, ""), u = a.split(/[?#]/, 1)[0], c = new RegExp("(?<=^|\\/)(?:\\.|%2e){1,2}(?=\\/|$)", "gi");
  let d;
  for (; (d = c.exec(u)) !== null; )
    r.push({
      start: d.index,
      length: d[0].length,
      error: `Value "${d[0]}" can't be safely passed as a path parameter`
    });
  if (r.sort((f, p) => f.start - p.start), r.length > 0) {
    let f = 0;
    const p = r.reduce((m, h) => {
      const g = " ".repeat(h.start - f), T = "^".repeat(h.length);
      return f = h.start + h.length, m + g + T;
    }, "");
    throw new J(`Path parameters result in path with invalid segments:
${r.map((m) => m.error).join(`
`)}
${a}
${p}`);
  }
  return a;
}, Ee = /* @__PURE__ */ Rd(qo);
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Bo extends bo {
  create(e, n) {
    var o;
    const { api_version: i = this._client.apiVersion } = e, r = xe(e, ["api_version"]);
    if ("model" in r && "agent_config" in r)
      throw new J("Invalid request: specified `model` and `agent_config`. If specifying `model`, use `generation_config`.");
    if ("agent" in r && "generation_config" in r)
      throw new J("Invalid request: specified `agent` and `generation_config`. If specifying `agent`, use `agent_config`.");
    return this._client.post(Ee`/${i}/interactions`, Object.assign(Object.assign({ body: r }, n), { stream: (o = e.stream) !== null && o !== void 0 ? o : !1 }));
  }
  /**
   * Deletes the interaction by id.
   *
   * @example
   * ```ts
   * const interaction = await client.interactions.delete('id', {
   *   api_version: 'api_version',
   * });
   * ```
   */
  delete(e, n = {}, o) {
    const { api_version: i = this._client.apiVersion } = n ?? {};
    return this._client.delete(Ee`/${i}/interactions/${e}`, o);
  }
  /**
   * Cancels an interaction by id. This only applies to background interactions that are still running.
   *
   * @example
   * ```ts
   * const interaction = await client.interactions.cancel('id', {
   *   api_version: 'api_version',
   * });
   * ```
   */
  cancel(e, n = {}, o) {
    const { api_version: i = this._client.apiVersion } = n ?? {};
    return this._client.post(Ee`/${i}/interactions/${e}/cancel`, o);
  }
  get(e, n = {}, o) {
    var i;
    const r = n ?? {}, { api_version: a = this._client.apiVersion } = r, u = xe(r, ["api_version"]);
    return this._client.get(Ee`/${a}/interactions/${e}`, Object.assign(Object.assign({ query: u }, o), { stream: (i = n == null ? void 0 : n.stream) !== null && i !== void 0 ? i : !1 }));
  }
}
Bo._key = Object.freeze(["interactions"]);
class Jo extends Bo {
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Pd(t) {
  let e = 0;
  for (const i of t)
    e += i.length;
  const n = new Uint8Array(e);
  let o = 0;
  for (const i of t)
    n.set(i, o), o += i.length;
  return n;
}
let Se;
function ht(t) {
  let e;
  return (Se ?? (e = new globalThis.TextEncoder(), Se = e.encode.bind(e)))(t);
}
let Ie;
function Yn(t) {
  let e;
  return (Ie ?? (e = new globalThis.TextDecoder(), Ie = e.decode.bind(e)))(t);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class He {
  constructor() {
    this.buffer = new Uint8Array(), this.carriageReturnIndex = null;
  }
  decode(e) {
    if (e == null)
      return [];
    const n = e instanceof ArrayBuffer ? new Uint8Array(e) : typeof e == "string" ? ht(e) : e;
    this.buffer = Pd([this.buffer, n]);
    const o = [];
    let i;
    for (; (i = wd(this.buffer, this.carriageReturnIndex)) != null; ) {
      if (i.carriage && this.carriageReturnIndex == null) {
        this.carriageReturnIndex = i.index;
        continue;
      }
      if (this.carriageReturnIndex != null && (i.index !== this.carriageReturnIndex + 1 || i.carriage)) {
        o.push(Yn(this.buffer.subarray(0, this.carriageReturnIndex - 1))), this.buffer = this.buffer.subarray(this.carriageReturnIndex), this.carriageReturnIndex = null;
        continue;
      }
      const r = this.carriageReturnIndex !== null ? i.preceding - 1 : i.preceding, a = Yn(this.buffer.subarray(0, r));
      o.push(a), this.buffer = this.buffer.subarray(i.index), this.carriageReturnIndex = null;
    }
    return o;
  }
  flush() {
    return this.buffer.length ? this.decode(`
`) : [];
  }
}
He.NEWLINE_CHARS = /* @__PURE__ */ new Set([`
`, "\r"]);
He.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function wd(t, e) {
  for (let i = e ?? 0; i < t.length; i++) {
    if (t[i] === 10)
      return { preceding: i, index: i + 1, carriage: !1 };
    if (t[i] === 13)
      return { preceding: i, index: i + 1, carriage: !0 };
  }
  return null;
}
function Md(t) {
  for (let o = 0; o < t.length - 1; o++) {
    if (t[o] === 10 && t[o + 1] === 10 || t[o] === 13 && t[o + 1] === 13)
      return o + 2;
    if (t[o] === 13 && t[o + 1] === 10 && o + 3 < t.length && t[o + 2] === 13 && t[o + 3] === 10)
      return o + 4;
  }
  return -1;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const De = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
}, zn = (t, e, n) => {
  if (t) {
    if (ad(De, t))
      return t;
    V(n).warn(`${e} was set to ${JSON.stringify(t)}, expected one of ${JSON.stringify(Object.keys(De))}`);
  }
};
function Te() {
}
function ve(t, e, n) {
  return !e || De[t] > De[n] ? Te : e[t].bind(e);
}
const Nd = {
  error: Te,
  warn: Te,
  info: Te,
  debug: Te
};
let Xn = /* @__PURE__ */ new WeakMap();
function V(t) {
  var e;
  const n = t.logger, o = (e = t.logLevel) !== null && e !== void 0 ? e : "off";
  if (!n)
    return Nd;
  const i = Xn.get(n);
  if (i && i[0] === o)
    return i[1];
  const r = {
    error: ve("error", n, o),
    warn: ve("warn", n, o),
    info: ve("info", n, o),
    debug: ve("debug", n, o)
  };
  return Xn.set(n, [o, r]), r;
}
const ee = (t) => (t.options && (t.options = Object.assign({}, t.options), delete t.options.headers), t.headers && (t.headers = Object.fromEntries((t.headers instanceof Headers ? [...t.headers] : Object.entries(t.headers)).map(([e, n]) => [
  e,
  e.toLowerCase() === "x-goog-api-key" || e.toLowerCase() === "authorization" || e.toLowerCase() === "cookie" || e.toLowerCase() === "set-cookie" ? "***" : n
]))), "retryOfRequestLogID" in t && (t.retryOfRequestLogID && (t.retryOf = t.retryOfRequestLogID), delete t.retryOfRequestLogID), t);
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class ae {
  constructor(e, n, o) {
    this.iterator = e, this.controller = n, this.client = o;
  }
  static fromSSEResponse(e, n, o) {
    let i = !1;
    const r = o ? V(o) : console;
    function a() {
      return O(this, arguments, function* () {
        var c, d, f, p;
        if (i)
          throw new J("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let m = !1;
        try {
          try {
            for (var h = !0, g = $(xd(e, n)), T; T = yield M(g.next()), c = T.done, !c; h = !0) {
              p = T.value, h = !1;
              const y = p;
              if (!m)
                if (y.data.startsWith("[DONE]")) {
                  m = !0;
                  continue;
                } else
                  try {
                    yield yield M(JSON.parse(y.data));
                  } catch (E) {
                    throw r.error("Could not parse message into JSON:", y.data), r.error("From chunk:", y.raw), E;
                  }
            }
          } catch (y) {
            d = { error: y };
          } finally {
            try {
              !h && !c && (f = g.return) && (yield M(f.call(g)));
            } finally {
              if (d) throw d.error;
            }
          }
          m = !0;
        } catch (y) {
          if (et(y))
            return yield M(void 0);
          throw y;
        } finally {
          m || n.abort();
        }
      });
    }
    return new ae(a, n, o);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(e, n, o) {
    let i = !1;
    function r() {
      return O(this, arguments, function* () {
        var c, d, f, p;
        const m = new He(), h = Go(e);
        try {
          for (var g = !0, T = $(h), y; y = yield M(T.next()), c = y.done, !c; g = !0) {
            p = y.value, g = !1;
            const E = p;
            for (const v of m.decode(E))
              yield yield M(v);
          }
        } catch (E) {
          d = { error: E };
        } finally {
          try {
            !g && !c && (f = T.return) && (yield M(f.call(T)));
          } finally {
            if (d) throw d.error;
          }
        }
        for (const E of m.flush())
          yield yield M(E);
      });
    }
    function a() {
      return O(this, arguments, function* () {
        var c, d, f, p;
        if (i)
          throw new J("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let m = !1;
        try {
          try {
            for (var h = !0, g = $(r()), T; T = yield M(g.next()), c = T.done, !c; h = !0) {
              p = T.value, h = !1;
              const y = p;
              m || y && (yield yield M(JSON.parse(y)));
            }
          } catch (y) {
            d = { error: y };
          } finally {
            try {
              !h && !c && (f = g.return) && (yield M(f.call(g)));
            } finally {
              if (d) throw d.error;
            }
          }
          m = !0;
        } catch (y) {
          if (et(y))
            return yield M(void 0);
          throw y;
        } finally {
          m || n.abort();
        }
      });
    }
    return new ae(a, n, o);
  }
  [Symbol.asyncIterator]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const e = [], n = [], o = this.iterator(), i = (r) => ({
      next: () => {
        if (r.length === 0) {
          const a = o.next();
          e.push(a), n.push(a);
        }
        return r.shift();
      }
    });
    return [
      new ae(() => i(e), this.controller, this.client),
      new ae(() => i(n), this.controller, this.client)
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    const e = this;
    let n;
    return Fo({
      async start() {
        n = e[Symbol.asyncIterator]();
      },
      async pull(o) {
        try {
          const { value: i, done: r } = await n.next();
          if (r)
            return o.close();
          const a = ht(JSON.stringify(i) + `
`);
          o.enqueue(a);
        } catch (i) {
          o.error(i);
        }
      },
      async cancel() {
        var o;
        await ((o = n.return) === null || o === void 0 ? void 0 : o.call(n));
      }
    });
  }
}
function xd(t, e) {
  return O(this, arguments, function* () {
    var o, i, r, a;
    if (!t.body)
      throw e.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new J("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new J("Attempted to iterate over a response with no body");
    const u = new Ud(), c = new He(), d = Go(t.body);
    try {
      for (var f = !0, p = $(Dd(d)), m; m = yield M(p.next()), o = m.done, !o; f = !0) {
        a = m.value, f = !1;
        const h = a;
        for (const g of c.decode(h)) {
          const T = u.decode(g);
          T && (yield yield M(T));
        }
      }
    } catch (h) {
      i = { error: h };
    } finally {
      try {
        !f && !o && (r = p.return) && (yield M(r.call(p)));
      } finally {
        if (i) throw i.error;
      }
    }
    for (const h of c.flush()) {
      const g = u.decode(h);
      g && (yield yield M(g));
    }
  });
}
function Dd(t) {
  return O(this, arguments, function* () {
    var n, o, i, r;
    let a = new Uint8Array();
    try {
      for (var u = !0, c = $(t), d; d = yield M(c.next()), n = d.done, !n; u = !0) {
        r = d.value, u = !1;
        const f = r;
        if (f == null)
          continue;
        const p = f instanceof ArrayBuffer ? new Uint8Array(f) : typeof f == "string" ? ht(f) : f;
        let m = new Uint8Array(a.length + p.length);
        m.set(a), m.set(p, a.length), a = m;
        let h;
        for (; (h = Md(a)) !== -1; )
          yield yield M(a.slice(0, h)), a = a.slice(h);
      }
    } catch (f) {
      o = { error: f };
    } finally {
      try {
        !u && !n && (i = c.return) && (yield M(i.call(c)));
      } finally {
        if (o) throw o.error;
      }
    }
    a.length > 0 && (yield yield M(a));
  });
}
class Ud {
  constructor() {
    this.event = null, this.data = [], this.chunks = [];
  }
  decode(e) {
    if (e.endsWith("\r") && (e = e.substring(0, e.length - 1)), !e) {
      if (!this.event && !this.data.length)
        return null;
      const r = {
        event: this.event,
        data: this.data.join(`
`),
        raw: this.chunks
      };
      return this.event = null, this.data = [], this.chunks = [], r;
    }
    if (this.chunks.push(e), e.startsWith(":"))
      return null;
    let [n, o, i] = kd(e, ":");
    return i.startsWith(" ") && (i = i.substring(1)), n === "event" ? this.event = i : n === "data" && this.data.push(i), null;
  }
}
function kd(t, e) {
  const n = t.indexOf(e);
  return n !== -1 ? [t.substring(0, n), e, t.substring(n + e.length)] : [t, "", ""];
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
async function Ld(t, e) {
  const { response: n, requestLogID: o, retryOfRequestLogID: i, startTime: r } = e, a = await (async () => {
    var u;
    if (e.options.stream)
      return V(t).debug("response", n.status, n.url, n.headers, n.body), e.options.__streamClass ? e.options.__streamClass.fromSSEResponse(n, e.controller, t) : ae.fromSSEResponse(n, e.controller, t);
    if (n.status === 204)
      return null;
    if (e.options.__binaryResponse)
      return n;
    const c = n.headers.get("content-type"), d = (u = c == null ? void 0 : c.split(";")[0]) === null || u === void 0 ? void 0 : u.trim();
    return (d == null ? void 0 : d.includes("application/json")) || (d == null ? void 0 : d.endsWith("+json")) ? n.headers.get("content-length") === "0" ? void 0 : await n.json() : await n.text();
  })();
  return V(t).debug(`[${o}] response parsed`, ee({
    retryOfRequestLogID: i,
    url: n.url,
    status: n.status,
    body: a,
    durationMs: Date.now() - r
  })), a;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class gt extends Promise {
  constructor(e, n, o = Ld) {
    super((i) => {
      i(null);
    }), this.responsePromise = n, this.parseResponse = o, this.client = e;
  }
  _thenUnwrap(e) {
    return new gt(this.client, this.responsePromise, async (n, o) => e(await this.parseResponse(n, o), o));
  }
  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  asResponse() {
    return this.responsePromise.then((e) => e.response);
  }
  /**
   * Gets the parsed response data and the raw `Response` instance.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  async withResponse() {
    const [e, n] = await Promise.all([this.parse(), this.asResponse()]);
    return { data: e, response: n };
  }
  parse() {
    return this.parsedPromise || (this.parsedPromise = this.responsePromise.then((e) => this.parseResponse(this.client, e))), this.parsedPromise;
  }
  then(e, n) {
    return this.parse().then(e, n);
  }
  catch(e) {
    return this.parse().catch(e);
  }
  finally(e) {
    return this.parse().finally(e);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Oo = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* Fd(t) {
  if (!t)
    return;
  if (Oo in t) {
    const { values: o, nulls: i } = t;
    yield* o.entries();
    for (const r of i)
      yield [r, null];
    return;
  }
  let e = !1, n;
  t instanceof Headers ? n = t.entries() : On(t) ? n = t : (e = !0, n = Object.entries(t ?? {}));
  for (let o of n) {
    const i = o[0];
    if (typeof i != "string")
      throw new TypeError("expected header name to be a string");
    const r = On(o[1]) ? o[1] : [o[1]];
    let a = !1;
    for (const u of r)
      u !== void 0 && (e && !a && (a = !0, yield [i, null]), yield [i, u]);
  }
}
const ge = (t) => {
  const e = new Headers(), n = /* @__PURE__ */ new Set();
  for (const o of t) {
    const i = /* @__PURE__ */ new Set();
    for (const [r, a] of Fd(o)) {
      const u = r.toLowerCase();
      i.has(u) || (e.delete(r), i.add(u)), a === null ? (e.delete(r), n.add(u)) : (e.append(r, a), n.delete(u));
    }
  }
  return { [Oo]: !0, values: e, nulls: n };
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Be = (t) => {
  var e, n, o, i, r, a;
  if (typeof globalThis.process < "u")
    return (o = (n = (e = globalThis.process.env) === null || e === void 0 ? void 0 : e[t]) === null || n === void 0 ? void 0 : n.trim()) !== null && o !== void 0 ? o : void 0;
  if (typeof globalThis.Deno < "u")
    return (a = (r = (i = globalThis.Deno.env) === null || i === void 0 ? void 0 : i.get) === null || r === void 0 ? void 0 : r.call(i, t)) === null || a === void 0 ? void 0 : a.trim();
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var $o;
class Ve {
  /**
   * API Client for interfacing with the Gemini Next Gen API API.
   *
   * @param {string | null | undefined} [opts.apiKey=process.env['GEMINI_API_KEY'] ?? null]
   * @param {string | undefined} [opts.apiVersion=v1beta]
   * @param {string} [opts.baseURL=process.env['GEMINI_NEXT_GEN_API_BASE_URL'] ?? https://generativelanguage.googleapis.com] - Override the default base URL for the API.
   * @param {number} [opts.timeout=1 minute] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   */
  constructor(e) {
    var n, o, i, r, a, u, c, { baseURL: d = Be("GEMINI_NEXT_GEN_API_BASE_URL"), apiKey: f = (n = Be("GEMINI_API_KEY")) !== null && n !== void 0 ? n : null, apiVersion: p = "v1beta" } = e, m = xe(e, ["baseURL", "apiKey", "apiVersion"]);
    const h = Object.assign(Object.assign({
      apiKey: f,
      apiVersion: p
    }, m), { baseURL: d || "https://generativelanguage.googleapis.com" });
    this.baseURL = h.baseURL, this.timeout = (o = h.timeout) !== null && o !== void 0 ? o : Ve.DEFAULT_TIMEOUT, this.logger = (i = h.logger) !== null && i !== void 0 ? i : console;
    const g = "warn";
    this.logLevel = g, this.logLevel = (a = (r = zn(h.logLevel, "ClientOptions.logLevel", this)) !== null && r !== void 0 ? r : zn(Be("GEMINI_NEXT_GEN_API_LOG"), "process.env['GEMINI_NEXT_GEN_API_LOG']", this)) !== null && a !== void 0 ? a : g, this.fetchOptions = h.fetchOptions, this.maxRetries = (u = h.maxRetries) !== null && u !== void 0 ? u : 2, this.fetch = (c = h.fetch) !== null && c !== void 0 ? c : gd(), this.encoder = _d, this._options = h, this.apiKey = f, this.apiVersion = p, this.clientAdapter = h.clientAdapter;
  }
  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(e) {
    return new this.constructor(Object.assign(Object.assign(Object.assign({}, this._options), { baseURL: this.baseURL, maxRetries: this.maxRetries, timeout: this.timeout, logger: this.logger, logLevel: this.logLevel, fetch: this.fetch, fetchOptions: this.fetchOptions, apiKey: this.apiKey, apiVersion: this.apiVersion }), e));
  }
  /**
   * Check whether the base URL is set to its default.
   */
  baseURLOverridden() {
    return this.baseURL !== "https://generativelanguage.googleapis.com";
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values: e, nulls: n }) {
    if (!(e.has("authorization") || e.has("x-goog-api-key")) && !(this.apiKey && e.get("x-goog-api-key")) && !n.has("x-goog-api-key"))
      throw new Error('Could not resolve authentication method. Expected the apiKey to be set. Or for the "x-goog-api-key" headers to be explicitly omitted');
  }
  async authHeaders(e) {
    const n = ge([e.headers]);
    if (!(n.values.has("authorization") || n.values.has("x-goog-api-key"))) {
      if (this.apiKey)
        return ge([{ "x-goog-api-key": this.apiKey }]);
      if (this.clientAdapter.isVertexAI())
        return ge([await this.clientAdapter.getAuthHeaders()]);
    }
  }
  /**
   * Basic re-implementation of `qs.stringify` for primitive types.
   */
  stringifyQuery(e) {
    return Object.entries(e).filter(([n, o]) => typeof o < "u").map(([n, o]) => {
      if (typeof o == "string" || typeof o == "number" || typeof o == "boolean")
        return `${encodeURIComponent(n)}=${encodeURIComponent(o)}`;
      if (o === null)
        return `${encodeURIComponent(n)}=`;
      throw new J(`Cannot stringify type ${typeof o}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
    }).join("&");
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${re}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${nd()}`;
  }
  makeStatusError(e, n, o, i) {
    return b.generate(e, n, o, i);
  }
  buildURL(e, n, o) {
    const i = !this.baseURLOverridden() && o || this.baseURL, r = id(e) ? new URL(e) : new URL(i + (i.endsWith("/") && e.startsWith("/") ? e.slice(1) : e)), a = this.defaultQuery();
    return ld(a) || (n = Object.assign(Object.assign({}, a), n)), typeof n == "object" && n && !Array.isArray(n) && (r.search = this.stringifyQuery(n)), r.toString();
  }
  /**
     * Used as a callback for mutating the given `FinalRequestOptions` object.
  
     */
  async prepareOptions(e) {
    if (this.clientAdapter && this.clientAdapter.isVertexAI() && !e.path.startsWith(`/${this.apiVersion}/projects/`)) {
      const n = e.path.slice(this.apiVersion.length + 1);
      e.path = `/${this.apiVersion}/projects/${this.clientAdapter.getProject()}/locations/${this.clientAdapter.getLocation()}${n}`;
    }
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(e, { url: n, options: o }) {
  }
  get(e, n) {
    return this.methodRequest("get", e, n);
  }
  post(e, n) {
    return this.methodRequest("post", e, n);
  }
  patch(e, n) {
    return this.methodRequest("patch", e, n);
  }
  put(e, n) {
    return this.methodRequest("put", e, n);
  }
  delete(e, n) {
    return this.methodRequest("delete", e, n);
  }
  methodRequest(e, n, o) {
    return this.request(Promise.resolve(o).then((i) => Object.assign({ method: e, path: n }, i)));
  }
  request(e, n = null) {
    return new gt(this, this.makeRequest(e, n, void 0));
  }
  async makeRequest(e, n, o) {
    var i, r, a;
    const u = await e, c = (i = u.maxRetries) !== null && i !== void 0 ? i : this.maxRetries;
    n == null && (n = c), await this.prepareOptions(u);
    const { req: d, url: f, timeout: p } = await this.buildRequest(u, {
      retryCount: c - n
    });
    await this.prepareRequest(d, { url: f, options: u });
    const m = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0"), h = o === void 0 ? "" : `, retryOf: ${o}`, g = Date.now();
    if (V(this).debug(`[${m}] sending request`, ee({
      retryOfRequestLogID: o,
      method: u.method,
      url: f,
      options: u,
      headers: d.headers
    })), !((r = u.signal) === null || r === void 0) && r.aborted)
      throw new nt();
    const T = new AbortController(), y = await this.fetchWithTimeout(f, d, p, T).catch(tt), E = Date.now();
    if (y instanceof globalThis.Error) {
      const S = `retrying, ${n} attempts remaining`;
      if (!((a = u.signal) === null || a === void 0) && a.aborted)
        throw new nt();
      const _ = et(y) || /timed? ?out/i.test(String(y) + ("cause" in y ? String(y.cause) : ""));
      if (n)
        return V(this).info(`[${m}] connection ${_ ? "timed out" : "failed"} - ${S}`), V(this).debug(`[${m}] connection ${_ ? "timed out" : "failed"} (${S})`, ee({
          retryOfRequestLogID: o,
          url: f,
          durationMs: E - g,
          message: y.message
        })), this.retryRequest(u, n, o ?? m);
      throw V(this).info(`[${m}] connection ${_ ? "timed out" : "failed"} - error; no more retries left`), V(this).debug(`[${m}] connection ${_ ? "timed out" : "failed"} (error; no more retries left)`, ee({
        retryOfRequestLogID: o,
        url: f,
        durationMs: E - g,
        message: y.message
      })), _ ? new Po() : new Ge({ cause: y });
    }
    const v = `[${m}${h}] ${d.method} ${f} ${y.ok ? "succeeded" : "failed"} with status ${y.status} in ${E - g}ms`;
    if (!y.ok) {
      const S = await this.shouldRetry(y);
      if (n && S) {
        const P = `retrying, ${n} attempts remaining`;
        return await Td(y.body), V(this).info(`${v} - ${P}`), V(this).debug(`[${m}] response error (${P})`, ee({
          retryOfRequestLogID: o,
          url: y.url,
          status: y.status,
          headers: y.headers,
          durationMs: E - g
        })), this.retryRequest(u, n, o ?? m, y.headers);
      }
      const _ = S ? "error; no more retries left" : "error; not retryable";
      V(this).info(`${v} - ${_}`);
      const C = await y.text().catch((P) => tt(P).message), A = dd(C), R = A ? void 0 : C;
      throw V(this).debug(`[${m}] response error (${_})`, ee({
        retryOfRequestLogID: o,
        url: y.url,
        status: y.status,
        headers: y.headers,
        message: R,
        durationMs: Date.now() - g
      })), this.makeStatusError(y.status, A, R, y.headers);
    }
    return V(this).info(v), V(this).debug(`[${m}] response start`, ee({
      retryOfRequestLogID: o,
      url: y.url,
      status: y.status,
      headers: y.headers,
      durationMs: E - g
    })), { response: y, options: u, controller: T, requestLogID: m, retryOfRequestLogID: o, startTime: g };
  }
  async fetchWithTimeout(e, n, o, i) {
    const r = n || {}, { signal: a, method: u } = r, c = xe(r, ["signal", "method"]), d = i.abort.bind(i);
    a && a.addEventListener("abort", d, { once: !0 });
    const f = setTimeout(d, o), p = globalThis.ReadableStream && c.body instanceof globalThis.ReadableStream || typeof c.body == "object" && c.body !== null && Symbol.asyncIterator in c.body, m = Object.assign(Object.assign(Object.assign({ signal: i.signal }, p ? { duplex: "half" } : {}), { method: "GET" }), c);
    u && (m.method = u.toUpperCase());
    try {
      return await this.fetch.call(void 0, e, m);
    } finally {
      clearTimeout(f);
    }
  }
  async shouldRetry(e) {
    const n = e.headers.get("x-should-retry");
    return n === "true" ? !0 : n === "false" ? !1 : e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500;
  }
  async retryRequest(e, n, o, i) {
    var r;
    let a;
    const u = i == null ? void 0 : i.get("retry-after-ms");
    if (u) {
      const d = parseFloat(u);
      Number.isNaN(d) || (a = d);
    }
    const c = i == null ? void 0 : i.get("retry-after");
    if (c && !a) {
      const d = parseFloat(c);
      Number.isNaN(d) ? a = Date.parse(c) - Date.now() : a = d * 1e3;
    }
    if (!(a && 0 <= a && a < 60 * 1e3)) {
      const d = (r = e.maxRetries) !== null && r !== void 0 ? r : this.maxRetries;
      a = this.calculateDefaultRetryTimeoutMillis(n, d);
    }
    return await cd(a), this.makeRequest(e, n - 1, o);
  }
  calculateDefaultRetryTimeoutMillis(e, n) {
    const r = n - e, a = Math.min(0.5 * Math.pow(2, r), 8), u = 1 - Math.random() * 0.25;
    return a * u * 1e3;
  }
  async buildRequest(e, { retryCount: n = 0 } = {}) {
    var o, i, r;
    const a = Object.assign({}, e), { method: u, path: c, query: d, defaultBaseURL: f } = a, p = this.buildURL(c, d, f);
    "timeout" in a && ud("timeout", a.timeout), a.timeout = (o = a.timeout) !== null && o !== void 0 ? o : this.timeout;
    const { bodyHeaders: m, body: h } = this.buildBody({ options: a }), g = await this.buildHeaders({ options: e, method: u, bodyHeaders: m, retryCount: n });
    return { req: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ method: u, headers: g }, a.signal && { signal: a.signal }), globalThis.ReadableStream && h instanceof globalThis.ReadableStream && { duplex: "half" }), h && { body: h }), (i = this.fetchOptions) !== null && i !== void 0 ? i : {}), (r = a.fetchOptions) !== null && r !== void 0 ? r : {}), url: p, timeout: a.timeout };
  }
  async buildHeaders({ options: e, method: n, bodyHeaders: o, retryCount: i }) {
    let r = {};
    this.idempotencyHeader && n !== "get" && (e.idempotencyKey || (e.idempotencyKey = this.defaultIdempotencyKey()), r[this.idempotencyHeader] = e.idempotencyKey);
    const a = await this.authHeaders(e);
    let u = ge([
      r,
      Object.assign(Object.assign({ Accept: "application/json", "User-Agent": this.getUserAgent(), "X-Stainless-Retry-Count": String(i) }, e.timeout ? { "X-Stainless-Timeout": String(Math.trunc(e.timeout / 1e3)) } : {}), hd()),
      this._options.defaultHeaders,
      o,
      e.headers,
      a
    ]);
    return this.validateHeaders(u), u.values;
  }
  buildBody({ options: { body: e, headers: n } }) {
    if (!e)
      return { bodyHeaders: void 0, body: void 0 };
    const o = ge([n]);
    return (
      // Pass raw type verbatim
      ArrayBuffer.isView(e) || e instanceof ArrayBuffer || e instanceof DataView || typeof e == "string" && // Preserve legacy string encoding behavior for now
      o.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && e instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      e instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      e instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && e instanceof globalThis.ReadableStream ? { bodyHeaders: void 0, body: e } : typeof e == "object" && (Symbol.asyncIterator in e || Symbol.iterator in e && "next" in e && typeof e.next == "function") ? { bodyHeaders: void 0, body: yd(e) } : this.encoder({ body: e, headers: o })
    );
  }
}
Ve.DEFAULT_TIMEOUT = 6e4;
class G extends Ve {
  constructor() {
    super(...arguments), this.interactions = new Jo(this);
  }
}
$o = G;
G.GeminiNextGenAPIClient = $o;
G.GeminiNextGenAPIClientError = J;
G.APIError = b;
G.APIConnectionError = Ge;
G.APIConnectionTimeoutError = Po;
G.APIUserAbortError = nt;
G.NotFoundError = xo;
G.ConflictError = Do;
G.RateLimitError = ko;
G.BadRequestError = wo;
G.AuthenticationError = Mo;
G.InternalServerError = Lo;
G.PermissionDeniedError = No;
G.UnprocessableEntityError = Uo;
G.toFile = vd;
G.Interactions = Jo;
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Gd(t, e) {
  const n = {}, o = s(t, ["name"]);
  return o != null && l(n, ["_url", "name"], o), n;
}
function Hd(t, e) {
  const n = {}, o = s(t, ["name"]);
  return o != null && l(n, ["_url", "name"], o), n;
}
function Vd(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  return o != null && l(n, ["sdkHttpResponse"], o), n;
}
function bd(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  return o != null && l(n, ["sdkHttpResponse"], o), n;
}
function qd(t, e, n) {
  const o = {};
  if (s(t, ["validationDataset"]) !== void 0)
    throw new Error("validationDataset parameter is not supported in Gemini API.");
  const i = s(t, [
    "tunedModelDisplayName"
  ]);
  if (e !== void 0 && i != null && l(e, ["displayName"], i), s(t, ["description"]) !== void 0)
    throw new Error("description parameter is not supported in Gemini API.");
  const r = s(t, ["epochCount"]);
  e !== void 0 && r != null && l(e, ["tuningTask", "hyperparameters", "epochCount"], r);
  const a = s(t, [
    "learningRateMultiplier"
  ]);
  if (a != null && l(o, ["tuningTask", "hyperparameters", "learningRateMultiplier"], a), s(t, ["exportLastCheckpointOnly"]) !== void 0)
    throw new Error("exportLastCheckpointOnly parameter is not supported in Gemini API.");
  if (s(t, ["preTunedModelCheckpointId"]) !== void 0)
    throw new Error("preTunedModelCheckpointId parameter is not supported in Gemini API.");
  if (s(t, ["adapterSize"]) !== void 0)
    throw new Error("adapterSize parameter is not supported in Gemini API.");
  if (s(t, ["tuningMode"]) !== void 0)
    throw new Error("tuningMode parameter is not supported in Gemini API.");
  if (s(t, ["customBaseModel"]) !== void 0)
    throw new Error("customBaseModel parameter is not supported in Gemini API.");
  const u = s(t, ["batchSize"]);
  e !== void 0 && u != null && l(e, ["tuningTask", "hyperparameters", "batchSize"], u);
  const c = s(t, ["learningRate"]);
  if (e !== void 0 && c != null && l(e, ["tuningTask", "hyperparameters", "learningRate"], c), s(t, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  if (s(t, ["beta"]) !== void 0)
    throw new Error("beta parameter is not supported in Gemini API.");
  if (s(t, ["baseTeacherModel"]) !== void 0)
    throw new Error("baseTeacherModel parameter is not supported in Gemini API.");
  if (s(t, ["tunedTeacherModelSource"]) !== void 0)
    throw new Error("tunedTeacherModelSource parameter is not supported in Gemini API.");
  if (s(t, ["sftLossWeightMultiplier"]) !== void 0)
    throw new Error("sftLossWeightMultiplier parameter is not supported in Gemini API.");
  if (s(t, ["outputUri"]) !== void 0)
    throw new Error("outputUri parameter is not supported in Gemini API.");
  return o;
}
function Bd(t, e, n) {
  const o = {};
  let i = s(n, [
    "config",
    "method"
  ]);
  if (i === void 0 && (i = "SUPERVISED_FINE_TUNING"), i === "SUPERVISED_FINE_TUNING") {
    const C = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec"], Je(C));
  } else if (i === "PREFERENCE_TUNING") {
    const C = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && C != null && l(e, ["preferenceOptimizationSpec"], Je(C));
  } else if (i === "DISTILLATION") {
    const C = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && C != null && l(e, ["distillationSpec"], Je(C));
  }
  const r = s(t, [
    "tunedModelDisplayName"
  ]);
  e !== void 0 && r != null && l(e, ["tunedModelDisplayName"], r);
  const a = s(t, ["description"]);
  e !== void 0 && a != null && l(e, ["description"], a);
  let u = s(n, [
    "config",
    "method"
  ]);
  if (u === void 0 && (u = "SUPERVISED_FINE_TUNING"), u === "SUPERVISED_FINE_TUNING") {
    const C = s(t, ["epochCount"]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "hyperParameters", "epochCount"], C);
  } else if (u === "PREFERENCE_TUNING") {
    const C = s(t, ["epochCount"]);
    e !== void 0 && C != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "epochCount"], C);
  } else if (u === "DISTILLATION") {
    const C = s(t, ["epochCount"]);
    e !== void 0 && C != null && l(e, ["distillationSpec", "hyperParameters", "epochCount"], C);
  }
  let c = s(n, [
    "config",
    "method"
  ]);
  if (c === void 0 && (c = "SUPERVISED_FINE_TUNING"), c === "SUPERVISED_FINE_TUNING") {
    const C = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "hyperParameters", "learningRateMultiplier"], C);
  } else if (c === "PREFERENCE_TUNING") {
    const C = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && C != null && l(e, [
      "preferenceOptimizationSpec",
      "hyperParameters",
      "learningRateMultiplier"
    ], C);
  } else if (c === "DISTILLATION") {
    const C = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && C != null && l(e, ["distillationSpec", "hyperParameters", "learningRateMultiplier"], C);
  }
  let d = s(n, ["config", "method"]);
  if (d === void 0 && (d = "SUPERVISED_FINE_TUNING"), d === "SUPERVISED_FINE_TUNING") {
    const C = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "exportLastCheckpointOnly"], C);
  } else if (d === "PREFERENCE_TUNING") {
    const C = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && C != null && l(e, ["preferenceOptimizationSpec", "exportLastCheckpointOnly"], C);
  } else if (d === "DISTILLATION") {
    const C = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && C != null && l(e, ["distillationSpec", "exportLastCheckpointOnly"], C);
  }
  let f = s(n, [
    "config",
    "method"
  ]);
  if (f === void 0 && (f = "SUPERVISED_FINE_TUNING"), f === "SUPERVISED_FINE_TUNING") {
    const C = s(t, ["adapterSize"]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "hyperParameters", "adapterSize"], C);
  } else if (f === "PREFERENCE_TUNING") {
    const C = s(t, ["adapterSize"]);
    e !== void 0 && C != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "adapterSize"], C);
  } else if (f === "DISTILLATION") {
    const C = s(t, ["adapterSize"]);
    e !== void 0 && C != null && l(e, ["distillationSpec", "hyperParameters", "adapterSize"], C);
  }
  let p = s(n, [
    "config",
    "method"
  ]);
  if (p === void 0 && (p = "SUPERVISED_FINE_TUNING"), p === "SUPERVISED_FINE_TUNING") {
    const C = s(t, ["tuningMode"]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "tuningMode"], C);
  }
  const m = s(t, [
    "customBaseModel"
  ]);
  e !== void 0 && m != null && l(e, ["customBaseModel"], m);
  let h = s(n, [
    "config",
    "method"
  ]);
  if (h === void 0 && (h = "SUPERVISED_FINE_TUNING"), h === "SUPERVISED_FINE_TUNING") {
    const C = s(t, ["batchSize"]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "hyperParameters", "batchSize"], C);
  }
  let g = s(n, [
    "config",
    "method"
  ]);
  if (g === void 0 && (g = "SUPERVISED_FINE_TUNING"), g === "SUPERVISED_FINE_TUNING") {
    const C = s(t, [
      "learningRate"
    ]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "hyperParameters", "learningRate"], C);
  }
  const T = s(t, ["labels"]);
  e !== void 0 && T != null && l(e, ["labels"], T);
  const y = s(t, ["beta"]);
  e !== void 0 && y != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "beta"], y);
  const E = s(t, [
    "baseTeacherModel"
  ]);
  e !== void 0 && E != null && l(e, ["distillationSpec", "baseTeacherModel"], E);
  const v = s(t, [
    "tunedTeacherModelSource"
  ]);
  e !== void 0 && v != null && l(e, ["distillationSpec", "tunedTeacherModelSource"], v);
  const S = s(t, [
    "sftLossWeightMultiplier"
  ]);
  e !== void 0 && S != null && l(e, ["distillationSpec", "hyperParameters", "sftLossWeightMultiplier"], S);
  const _ = s(t, ["outputUri"]);
  return e !== void 0 && _ != null && l(e, ["outputUri"], _), o;
}
function Jd(t, e) {
  const n = {}, o = s(t, ["baseModel"]);
  o != null && l(n, ["baseModel"], o);
  const i = s(t, [
    "preTunedModel"
  ]);
  i != null && l(n, ["preTunedModel"], i);
  const r = s(t, [
    "trainingDataset"
  ]);
  r != null && ec(r);
  const a = s(t, ["config"]);
  return a != null && qd(a, n), n;
}
function Od(t, e) {
  const n = {}, o = s(t, ["baseModel"]);
  o != null && l(n, ["baseModel"], o);
  const i = s(t, [
    "preTunedModel"
  ]);
  i != null && l(n, ["preTunedModel"], i);
  const r = s(t, [
    "trainingDataset"
  ]);
  r != null && tc(r, n, e);
  const a = s(t, ["config"]);
  return a != null && Bd(a, n, e), n;
}
function $d(t, e) {
  const n = {}, o = s(t, ["name"]);
  return o != null && l(n, ["_url", "name"], o), n;
}
function Wd(t, e) {
  const n = {}, o = s(t, ["name"]);
  return o != null && l(n, ["_url", "name"], o), n;
}
function Kd(t, e, n) {
  const o = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && l(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  e !== void 0 && r != null && l(e, ["_query", "pageToken"], r);
  const a = s(t, ["filter"]);
  return e !== void 0 && a != null && l(e, ["_query", "filter"], a), o;
}
function Yd(t, e, n) {
  const o = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && l(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  e !== void 0 && r != null && l(e, ["_query", "pageToken"], r);
  const a = s(t, ["filter"]);
  return e !== void 0 && a != null && l(e, ["_query", "filter"], a), o;
}
function zd(t, e) {
  const n = {}, o = s(t, ["config"]);
  return o != null && Kd(o, n), n;
}
function Xd(t, e) {
  const n = {}, o = s(t, ["config"]);
  return o != null && Yd(o, n), n;
}
function Qd(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && l(n, ["nextPageToken"], i);
  const r = s(t, ["tunedModels"]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((u) => Wo(u))), l(n, ["tuningJobs"], a);
  }
  return n;
}
function Zd(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && l(n, ["nextPageToken"], i);
  const r = s(t, ["tuningJobs"]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((u) => st(u))), l(n, ["tuningJobs"], a);
  }
  return n;
}
function jd(t, e) {
  const n = {}, o = s(t, ["name"]);
  o != null && l(n, ["model"], o);
  const i = s(t, ["name"]);
  return i != null && l(n, ["endpoint"], i), n;
}
function ec(t, e) {
  const n = {};
  if (s(t, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  if (s(t, ["vertexDatasetResource"]) !== void 0)
    throw new Error("vertexDatasetResource parameter is not supported in Gemini API.");
  const o = s(t, ["examples"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => r)), l(n, ["examples", "examples"], i);
  }
  return n;
}
function tc(t, e, n) {
  const o = {};
  let i = s(n, [
    "config",
    "method"
  ]);
  if (i === void 0 && (i = "SUPERVISED_FINE_TUNING"), i === "SUPERVISED_FINE_TUNING") {
    const a = s(t, ["gcsUri"]);
    e !== void 0 && a != null && l(e, ["supervisedTuningSpec", "trainingDatasetUri"], a);
  } else if (i === "PREFERENCE_TUNING") {
    const a = s(t, ["gcsUri"]);
    e !== void 0 && a != null && l(e, ["preferenceOptimizationSpec", "trainingDatasetUri"], a);
  } else if (i === "DISTILLATION") {
    const a = s(t, ["gcsUri"]);
    e !== void 0 && a != null && l(e, ["distillationSpec", "promptDatasetUri"], a);
  }
  let r = s(n, [
    "config",
    "method"
  ]);
  if (r === void 0 && (r = "SUPERVISED_FINE_TUNING"), r === "SUPERVISED_FINE_TUNING") {
    const a = s(t, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && l(e, ["supervisedTuningSpec", "trainingDatasetUri"], a);
  } else if (r === "PREFERENCE_TUNING") {
    const a = s(t, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && l(e, ["preferenceOptimizationSpec", "trainingDatasetUri"], a);
  } else if (r === "DISTILLATION") {
    const a = s(t, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && l(e, ["distillationSpec", "promptDatasetUri"], a);
  }
  if (s(t, ["examples"]) !== void 0)
    throw new Error("examples parameter is not supported in Vertex AI.");
  return o;
}
function Wo(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["name"]);
  i != null && l(n, ["name"], i);
  const r = s(t, ["state"]);
  r != null && l(n, ["state"], lo(r));
  const a = s(t, ["createTime"]);
  a != null && l(n, ["createTime"], a);
  const u = s(t, [
    "tuningTask",
    "startTime"
  ]);
  u != null && l(n, ["startTime"], u);
  const c = s(t, [
    "tuningTask",
    "completeTime"
  ]);
  c != null && l(n, ["endTime"], c);
  const d = s(t, ["updateTime"]);
  d != null && l(n, ["updateTime"], d);
  const f = s(t, ["description"]);
  f != null && l(n, ["description"], f);
  const p = s(t, ["baseModel"]);
  p != null && l(n, ["baseModel"], p);
  const m = s(t, ["_self"]);
  return m != null && l(n, ["tunedModel"], jd(m)), n;
}
function st(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["name"]);
  i != null && l(n, ["name"], i);
  const r = s(t, ["state"]);
  r != null && l(n, ["state"], lo(r));
  const a = s(t, ["createTime"]);
  a != null && l(n, ["createTime"], a);
  const u = s(t, ["startTime"]);
  u != null && l(n, ["startTime"], u);
  const c = s(t, ["endTime"]);
  c != null && l(n, ["endTime"], c);
  const d = s(t, ["updateTime"]);
  d != null && l(n, ["updateTime"], d);
  const f = s(t, ["error"]);
  f != null && l(n, ["error"], f);
  const p = s(t, ["description"]);
  p != null && l(n, ["description"], p);
  const m = s(t, ["baseModel"]);
  m != null && l(n, ["baseModel"], m);
  const h = s(t, ["tunedModel"]);
  h != null && l(n, ["tunedModel"], h);
  const g = s(t, [
    "preTunedModel"
  ]);
  g != null && l(n, ["preTunedModel"], g);
  const T = s(t, [
    "supervisedTuningSpec"
  ]);
  T != null && l(n, ["supervisedTuningSpec"], T);
  const y = s(t, [
    "preferenceOptimizationSpec"
  ]);
  y != null && l(n, ["preferenceOptimizationSpec"], y);
  const E = s(t, [
    "distillationSpec"
  ]);
  E != null && l(n, ["distillationSpec"], E);
  const v = s(t, [
    "tuningDataStats"
  ]);
  v != null && l(n, ["tuningDataStats"], v);
  const S = s(t, [
    "encryptionSpec"
  ]);
  S != null && l(n, ["encryptionSpec"], S);
  const _ = s(t, [
    "partnerModelTuningSpec"
  ]);
  _ != null && l(n, ["partnerModelTuningSpec"], _);
  const C = s(t, [
    "customBaseModel"
  ]);
  C != null && l(n, ["customBaseModel"], C);
  const A = s(t, ["experiment"]);
  A != null && l(n, ["experiment"], A);
  const R = s(t, ["labels"]);
  R != null && l(n, ["labels"], R);
  const N = s(t, ["outputUri"]);
  N != null && l(n, ["outputUri"], N);
  const P = s(t, ["pipelineJob"]);
  P != null && l(n, ["pipelineJob"], P);
  const x = s(t, [
    "serviceAccount"
  ]);
  x != null && l(n, ["serviceAccount"], x);
  const U = s(t, [
    "tunedModelDisplayName"
  ]);
  U != null && l(n, ["tunedModelDisplayName"], U);
  const F = s(t, [
    "veoTuningSpec"
  ]);
  return F != null && l(n, ["veoTuningSpec"], F), n;
}
function nc(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["name"]);
  i != null && l(n, ["name"], i);
  const r = s(t, ["metadata"]);
  r != null && l(n, ["metadata"], r);
  const a = s(t, ["done"]);
  a != null && l(n, ["done"], a);
  const u = s(t, ["error"]);
  return u != null && l(n, ["error"], u), n;
}
function Je(t, e) {
  const n = {}, o = s(t, ["gcsUri"]);
  o != null && l(n, ["validationDatasetUri"], o);
  const i = s(t, [
    "vertexDatasetResource"
  ]);
  return i != null && l(n, ["validationDatasetUri"], i), n;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class oc extends X {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new oe(z.PAGED_ITEM_TUNING_JOBS, (o) => this.listInternal(o), await this.listInternal(n), n), this.get = async (n) => await this.getInternal(n), this.tune = async (n) => {
      var o;
      if (this.apiClient.isVertexAI())
        if (n.baseModel.startsWith("projects/")) {
          const i = {
            tunedModelName: n.baseModel
          };
          !((o = n.config) === null || o === void 0) && o.preTunedModelCheckpointId && (i.checkpointId = n.config.preTunedModelCheckpointId);
          const r = Object.assign(Object.assign({}, n), { preTunedModel: i });
          return r.baseModel = void 0, await this.tuneInternal(r);
        } else {
          const i = Object.assign({}, n);
          return await this.tuneInternal(i);
        }
      else {
        const i = Object.assign({}, n), r = await this.tuneMldevInternal(i);
        let a = "";
        return r.metadata !== void 0 && r.metadata.tunedModel !== void 0 ? a = r.metadata.tunedModel : r.name !== void 0 && r.name.includes("/operations/") && (a = r.name.split("/operations/")[0]), {
          name: a,
          state: We.JOB_STATE_QUEUED
        };
      }
    };
  }
  async getInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Wd(e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => st(f));
    } else {
      const d = $d(e);
      return u = I("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => Wo(f));
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Xd(e);
      return u = I("tuningJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Zd(f), m = new In();
        return Object.assign(m, p), m;
      });
    } else {
      const d = zd(e);
      return u = I("tunedModels", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Qd(f), m = new In();
        return Object.assign(m, p), m;
      });
    }
  }
  /**
   * Cancels a tuning job.
   *
   * @param params - The parameters for the cancel request.
   * @return The empty response returned by the API.
   *
   * @example
   * ```ts
   * await ai.tunings.cancel({name: '...'}); // The server-generated resource name.
   * ```
   */
  async cancel(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Hd(e);
      return u = I("{name}:cancel", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = bd(f), m = new vn();
        return Object.assign(m, p), m;
      });
    } else {
      const d = Gd(e);
      return u = I("{name}:cancel", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const m = p;
        return m.sdkHttpResponse = {
          headers: f.headers
        }, m;
      })), a.then((f) => {
        const p = Vd(f), m = new vn();
        return Object.assign(m, p), m;
      });
    }
  }
  async tuneInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = Od(e, e);
      return r = I("tuningJobs", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => st(c));
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  async tuneMldevInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Jd(e);
      return r = I("tunedModels", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => nc(c));
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class ic {
  async download(e, n) {
    throw new Error("Download to file is not supported in the browser, please use a browser compliant download like an <a> tag.");
  }
}
const sc = 1024 * 1024 * 8, rc = 3, lc = 1e3, ac = 2, Ue = "x-goog-upload-status";
async function uc(t, e, n) {
  var o;
  const i = await Ko(t, e, n), r = await (i == null ? void 0 : i.json());
  if (((o = i == null ? void 0 : i.headers) === null || o === void 0 ? void 0 : o[Ue]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  return r.file;
}
async function dc(t, e, n) {
  var o;
  const i = await Ko(t, e, n), r = await (i == null ? void 0 : i.json());
  if (((o = i == null ? void 0 : i.headers) === null || o === void 0 ? void 0 : o[Ue]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  const a = to(r), u = new ut();
  return Object.assign(u, a), u;
}
async function Ko(t, e, n) {
  var o, i;
  let r = 0, a = 0, u = new Ye(new Response()), c = "upload";
  for (r = t.size; a < r; ) {
    const d = Math.min(sc, r - a), f = t.slice(a, a + d);
    a + d >= r && (c += ", finalize");
    let p = 0, m = lc;
    for (; p < rc && (u = await n.request({
      path: "",
      body: f,
      httpMethod: "POST",
      httpOptions: {
        apiVersion: "",
        baseUrl: e,
        headers: {
          "X-Goog-Upload-Command": c,
          "X-Goog-Upload-Offset": String(a),
          "Content-Length": String(d)
        }
      }
    }), !(!((o = u == null ? void 0 : u.headers) === null || o === void 0) && o[Ue])); )
      p++, await fc(m), m = m * ac;
    if (a += d, ((i = u == null ? void 0 : u.headers) === null || i === void 0 ? void 0 : i[Ue]) !== "active")
      break;
    if (r <= a)
      throw new Error("All content has been uploaded, but the upload status is not finalized.");
  }
  return u;
}
async function cc(t) {
  return { size: t.size, type: t.type };
}
function fc(t) {
  return new Promise((e) => setTimeout(e, t));
}
class pc {
  async upload(e, n, o) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await uc(e, n, o);
  }
  async uploadToFileSearchStore(e, n, o) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await dc(e, n, o);
  }
  async stat(e) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await cc(e);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class mc {
  create(e, n, o) {
    return new hc(e, n, o);
  }
}
class hc {
  constructor(e, n, o) {
    this.url = e, this.headers = n, this.callbacks = o;
  }
  connect() {
    this.ws = new WebSocket(this.url), this.ws.onopen = this.callbacks.onopen, this.ws.onerror = this.callbacks.onerror, this.ws.onclose = this.callbacks.onclose, this.ws.onmessage = this.callbacks.onmessage;
  }
  send(e) {
    if (this.ws === void 0)
      throw new Error("WebSocket is not connected");
    this.ws.send(e);
  }
  close() {
    if (this.ws === void 0)
      throw new Error("WebSocket is not connected");
    this.ws.close();
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Qn = "x-goog-api-key";
class gc {
  constructor(e) {
    this.apiKey = e;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addAuthHeaders(e, n) {
    if (e.get(Qn) === null) {
      if (this.apiKey.startsWith("auth_tokens/"))
        throw new Error("Ephemeral tokens are only supported by the live API.");
      if (!this.apiKey)
        throw new Error("API key is missing. Please provide a valid API key.");
      e.append(Qn, this.apiKey);
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const yc = "gl-node/";
class Tc {
  get interactions() {
    if (this._interactions !== void 0)
      return this._interactions;
    console.warn("GoogleGenAI.interactions: Interactions usage is experimental and may change in future versions.");
    const e = this.httpOptions;
    e != null && e.extraBody && console.warn("GoogleGenAI.interactions: Client level httpOptions.extraBody is not supported by the interactions client and will be ignored.");
    const n = new G({
      baseURL: this.apiClient.getBaseUrl(),
      apiKey: this.apiKey,
      apiVersion: this.apiClient.getApiVersion(),
      clientAdapter: this.apiClient,
      defaultHeaders: this.apiClient.getDefaultHeaders(),
      timeout: e == null ? void 0 : e.timeout
    });
    return this._interactions = n.interactions, this._interactions;
  }
  constructor(e) {
    var n;
    if (e.apiKey == null)
      throw new Error("An API Key must be set when running in a browser");
    if (e.project || e.location)
      throw new Error("Vertex AI project based authentication is not supported on browser runtimes. Please do not provide a project or location.");
    this.vertexai = (n = e.vertexai) !== null && n !== void 0 ? n : !1, this.apiKey = e.apiKey;
    const o = ai(
      e.httpOptions,
      e.vertexai,
      /*vertexBaseUrlFromEnv*/
      void 0,
      /*geminiBaseUrlFromEnv*/
      void 0
    );
    o && (e.httpOptions ? e.httpOptions.baseUrl = o : e.httpOptions = { baseUrl: o }), this.apiVersion = e.apiVersion, this.httpOptions = e.httpOptions;
    const i = new gc(this.apiKey);
    this.apiClient = new cu({
      auth: i,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
      vertexai: this.vertexai,
      httpOptions: this.httpOptions,
      userAgentExtra: yc + "web",
      uploader: new pc(),
      downloader: new ic()
    }), this.models = new Nu(this.apiClient), this.live = new vu(this.apiClient, i, new mc()), this.batches = new Hs(this.apiClient), this.chats = new _r(this.models, this.apiClient), this.caches = new gr(this.apiClient), this.files = new xr(this.apiClient), this.operations = new xu(this.apiClient), this.authTokens = new Ku(this.apiClient), this.tunings = new oc(this.apiClient), this.fileSearchStores = new td(this.apiClient);
  }
}
class se {
  /**
   * Convert ToolDefinition to Gemini's tool format
   */
  static convertToolsToGeminiFormat(e) {
    return e.map((n) => {
      const o = this.convertSchemaTypes(n.input_schema);
      return {
        name: n.name,
        description: n.description,
        parameters: o
      };
    });
  }
  /**
   * Generate a unique file ID and return XML tag for file reference
   * The actual file writing is handled by the Desktop application via onFileReceived callback
   * @param threadId - Thread ID for file organization
   * @param mimeType - MIME type of the file content
   * @param contents - Base64 encoded file contents
   * @param displayName - Display name for the file
   * @returns Object with fileId and XML tag
   */
  static dehydrateFileContents(e, n, o, i) {
    const r = crypto.randomUUID(), a = `<FileId id="${r}" thread_id="${e}" mime_type="${n}" name="${i}" />`;
    return { fileId: r, xml: a };
  }
  /**
   * Recursively convert type strings to Type enum values
   */
  static convertSchemaTypes(e) {
    if (!e || typeof e != "object")
      return e;
    const n = Array.isArray(e) ? [] : {};
    for (const o in e) {
      const i = e[o];
      o === "type" && typeof i == "string" ? n[o] = this.mapStringToSchemaType(i) : typeof i == "object" && i !== null ? n[o] = this.convertSchemaTypes(i) : n[o] = i;
    }
    return n;
  }
  /**
   * Map string type names to Type enum values
   */
  static mapStringToSchemaType(e) {
    const n = {
      object: q.OBJECT,
      string: q.STRING,
      number: q.NUMBER,
      integer: q.INTEGER,
      boolean: q.BOOLEAN,
      array: q.ARRAY
    }, o = e.toLowerCase();
    return o in n ? n[o] : (console.warn(`[GeminiChatProvider] Unknown schema type: ${e}, using as-is`), e);
  }
  /**
   * Map internal message format to Gemini's message format
   */
  static mapMessage(e) {
    return {
      role: e.role === "assistant" ? "model" : "user",
      parts: [{ text: e.content }]
    };
  }
  /**
   * Convert internal ChatRequest to Gemini-specific format
   */
  static toGeminiRequest(e, n, o) {
    const a = {
      model: "gemini-2.5-flash-image",
      contents: e.messages.filter((c) => c.role !== "system").map((c) => this.mapMessage(c))
    };
    e.system && (a.systemInstruction = { parts: [{ text: e.system }] }), o && o.length > 0 && (a.tools = [{ functionDeclarations: o }]);
    const u = {};
    return e.temperature !== void 0 && (u.temperature = e.temperature), e.maxTokens !== void 0 && (u.maxOutputTokens = e.maxTokens), e.topP !== void 0 && (u.topP = e.topP), e.stop !== void 0 && (u.stopSequences = e.stop), e.thread_id && (u.httpOptions = {
      headers: {
        "X-Thread-Id": e.thread_id,
        "X-Branch-Id": e.branch_id
      }
    }), Object.keys(u).length > 0 && (a.config = u), a;
  }
  /**
   * Map Gemini API error to a readable error string
   * Handles nested JSON escaping in error messages
   */
  static mapError(e) {
    var o;
    let n = "An error occurred with the Gemini API";
    try {
      if (e != null && e.message) {
        let i = e.message;
        for (; typeof i == "string" && (i.startsWith("{") || i.startsWith('"{')); )
          try {
            const r = JSON.parse(i);
            if ((o = r.error) != null && o.message)
              i = r.error.message;
            else if (r.message)
              i = r.message;
            else
              break;
          } catch {
            break;
          }
        n = i;
      }
    } catch (i) {
      console.error("[GeminiConverter] Failed to parse error:", i);
    }
    return n;
  }
}
class _c {
  constructor(e, n) {
    w(this, "client");
    w(this, "apiEndpoint");
    w(this, "tokenCallback");
    this.client = e, this.apiEndpoint = n;
  }
  /**
   * Set the token callback for streaming mode
   */
  setTokenCallback(e) {
    this.tokenCallback = e;
  }
  /**
   * Make a request to Gemini with function calling enabled
   */
  async makeRequest(e, n, o, i, r) {
    console.log("[GeminiToolHandler] makeRequest called", {
      model: e,
      messagesCount: n.length,
      toolsCount: o.length,
      threadContext: i,
      shouldStream: r
    });
    const a = o.map((c) => ({
      name: c.name,
      description: c.description,
      parameters: c.parameters
    }));
    console.log("[GeminiToolHandler] Converted tools to Gemini format", {
      functionDeclarationsCount: a.length,
      functions: a.map((c) => c.name)
    });
    const u = {
      model: e,
      contents: n,
      config: {
        tools: [{ functionDeclarations: a }]
      }
    };
    return console.log("[GeminiToolHandler] Request params prepared", {
      functionDeclarationsCount: a.length,
      toolNames: a.map((c) => c.name),
      shouldStream: r
    }), r ? await this.makeStreamingRequest(u) : await this.makeNonStreamingRequest(u);
  }
  /**
   * Make a streaming request to Gemini
   * Note: For tool calling, we accumulate the complete response
   */
  async makeStreamingRequest(e) {
    var a, u, c, d, f, p, m, h, g, T, y, E, v, S;
    console.log("[GeminiToolHandler] Starting streaming request with tools", {
      model: e.model,
      contentsCount: (a = e.contents) == null ? void 0 : a.length,
      toolsCount: (u = e.tools) == null ? void 0 : u.length
    }), console.log("[GeminiToolHandler] Calling generateContentStream...");
    const n = await this.client.models.generateContentStream(e);
    console.log("[GeminiToolHandler] generateContentStream returned, starting iteration");
    let o = 0, i = null, r = "";
    try {
      for await (const _ of n) {
        if (o++, i = _, console.log("[GeminiToolHandler] Chunk received", {
          chunkCount: o,
          chunkKeys: Object.keys(_ || {}),
          hasText: !!_.text,
          textLength: ((c = _.text) == null ? void 0 : c.length) || 0,
          hasCandidates: !!_.candidates,
          candidatesCount: ((d = _.candidates) == null ? void 0 : d.length) || 0
        }), (f = _.candidates) != null && f[0]) {
          const R = _.candidates[0];
          console.log("[GeminiToolHandler] Candidate details", {
            chunkCount: o,
            hasContent: !!R.content,
            partsCount: ((m = (p = R.content) == null ? void 0 : p.parts) == null ? void 0 : m.length) || 0,
            finishReason: R.finishReason
          }), (h = R.content) != null && h.parts && R.content.parts.forEach((N, P) => {
            var x, U;
            console.log("[GeminiToolHandler] Part details", {
              chunkCount: o,
              partIndex: P,
              partKeys: Object.keys(N || {}),
              hasText: !!N.text,
              hasFunctionCall: !!N.functionCall,
              functionCallName: (x = N.functionCall) == null ? void 0 : x.name,
              functionCallArgsType: typeof ((U = N.functionCall) == null ? void 0 : U.args)
            });
          });
        }
        const C = _.text;
        C && this.tokenCallback && (r += C, this.tokenCallback(C), console.log("[GeminiToolHandler] Sent text to callback", {
          chunkCount: o,
          textLength: C.length,
          accumulatedLength: r.length
        }));
        const A = (T = (g = _.candidates) == null ? void 0 : g[0]) == null ? void 0 : T.finishReason;
        if (A) {
          console.log("[GeminiToolHandler] Detected finish reason, breaking loop", {
            chunkCount: o,
            finishReason: A,
            hasFunctionCall: !!((S = (v = (E = (y = _.candidates) == null ? void 0 : y[0]) == null ? void 0 : E.content) == null ? void 0 : v.parts) != null && S.some((R) => R.functionCall))
          });
          break;
        }
      }
      console.log("[GeminiToolHandler] Stream iteration completed successfully", {
        totalChunks: o
      });
    } catch (_) {
      throw console.error("[GeminiToolHandler] Error during streaming", {
        error: _,
        errorMessage: _ instanceof Error ? _.message : String(_),
        errorStack: _ instanceof Error ? _.stack : void 0,
        chunkCount: o,
        accumulatedTextLength: r.length
      }), _;
    }
    return console.log("[GeminiToolHandler] Stream completed", {
      chunkCount: o,
      hasCompleteResponse: !!i,
      accumulatedTextLength: r.length,
      responseKeys: i ? Object.keys(i) : []
    }), i;
  }
  /**
   * Make a non-streaming request to Gemini
   */
  async makeNonStreamingRequest(e) {
    console.log("[GeminiToolHandler] Starting non-streaming request");
    const n = await this.client.models.generateContent(e);
    return console.log("[GeminiToolHandler] Non-streaming response received", {
      hasResponse: !!n
    }), n;
  }
  /**
   * Extract tool uses (function calls) from Gemini's response
   */
  extractToolUses(e) {
    var r;
    console.log("[GeminiToolHandler] Extracting tool uses from response");
    const n = [];
    if (!e || !e.candidates) return n;
    const o = e.candidates;
    if (o.length === 0)
      return console.log("[GeminiToolHandler] No candidates found in response"), n;
    const i = (r = o[0].content) == null ? void 0 : r.parts;
    if (!i)
      return console.log("[GeminiToolHandler] No parts found in candidate content"), n;
    console.log("[GeminiToolHandler] Checking parts for function calls", {
      partsCount: i.length
    });
    for (const a of i)
      if (a.functionCall) {
        const u = a.functionCall;
        try {
          let c = u.args || {};
          typeof c == "string" && (console.log("[GeminiToolHandler] Function call args is string, attempting to parse", {
            name: u.name,
            argsPreview: c.substring(0, 100)
          }), c = JSON.parse(c)), console.log("[GeminiToolHandler] Found function call", {
            name: u.name,
            argsType: typeof c,
            argsKeys: typeof c == "object" ? Object.keys(c) : []
          }), n.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: u.name,
            input: c
          });
        } catch (c) {
          console.error("[GeminiToolHandler] Error parsing function call arguments", {
            name: u.name,
            error: c instanceof Error ? c.message : String(c),
            args: u.args
          });
        }
      }
    return console.log("[GeminiToolHandler] Extracted tool uses", {
      count: n.length,
      tools: n.map((a) => ({ id: a.id, name: a.name }))
    }), n;
  }
  /**
   * Extract text content from Gemini's response
   * Manually extracts from parts to avoid SDK warning message when function calls are present
   */
  extractTextContent(e) {
    var n, o, i;
    console.log("[GeminiToolHandler] Extracting text content from response");
    try {
      const r = (i = (o = (n = e.candidates) == null ? void 0 : n[0]) == null ? void 0 : o.content) == null ? void 0 : i.parts;
      if (!r || r.length === 0)
        return console.log("[GeminiToolHandler] No parts found in response"), null;
      let a = "";
      for (const u of r)
        u.text && (a += u.text);
      return console.log("[GeminiToolHandler] Text content extracted", {
        hasText: !!a,
        textLength: a.length
      }), a || null;
    } catch (r) {
      return console.log("[GeminiToolHandler] Error extracting text content:", r), null;
    }
  }
  /**
   * Format tool results for Gemini's expected format
   */
  formatToolResults(e, n) {
    console.log("[GeminiToolHandler] Formatting tool results", {
      toolUsesCount: e.length,
      resultsCount: n.length
    });
    const o = e.map((i, r) => {
      const a = n[r];
      return console.log("[GeminiToolHandler] Formatting result for tool", {
        toolName: i.name,
        resultSuccess: a == null ? void 0 : a.success,
        hasData: !!(a != null && a.data),
        hasError: !!(a != null && a.error)
      }), {
        functionResponse: {
          name: i.name,
          response: {
            success: a.success,
            content: a.success ? a.data : a.error
          }
        }
      };
    });
    return console.log("[GeminiToolHandler] Formatted results", {
      count: o.length
    }), o;
  }
  /**
   * Append the assistant's response and tool results to the conversation
   */
  appendMessages(e, n, o) {
    var c;
    console.log("[GeminiToolHandler] Appending messages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length
    });
    const i = n.candidates;
    if (!i || i.length === 0)
      return console.warn("[GeminiToolHandler] No candidates in response, returning messages unchanged"), e;
    const r = {
      role: "model",
      parts: ((c = i[0].content) == null ? void 0 : c.parts) || []
    };
    console.log("[GeminiToolHandler] Model response parts", {
      partsCount: r.parts.length,
      partTypes: r.parts.map((d) => d.text ? "text" : d.functionCall ? "functionCall" : "unknown")
    });
    const a = {
      role: "user",
      parts: o
    };
    console.log("[GeminiToolHandler] User response with function results", {
      partsCount: a.parts.length
    });
    const u = [
      ...e,
      r,
      a
    ];
    return console.log("[GeminiToolHandler] Messages appended", {
      newMessagesCount: u.length
    }), u;
  }
}
class Cc {
  constructor(e, n, o) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "apiEndpoint");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "onFileReceived");
    w(this, "toolHandler");
    const i = e ? {
      apiKey: n,
      httpOptions: {
        baseUrl: e
      }
    } : { apiKey: n };
    this.client = new Tc(i), this.defaultModel = o || "gemini-2.5-flash-image", this.apiEndpoint = e;
  }
  setTools(e = [], n, o) {
    this.tools = e, this.onToolUse = n, this.onFileReceived = o, this.toolHandler = new _c(this.client, this.apiEndpoint);
  }
  /**
   * Send a chat request to Gemini
   */
  async chat(e, n) {
    var a, u, c;
    const o = e.model || this.defaultModel;
    console.log(`Gemini Chat Provider | model: ${o} | streaming: ${e.streaming !== !1} | hasTools: ${this.tools.length > 0} | toolCount: ${this.tools.length}`);
    const i = se.convertToolsToGeminiFormat(this.tools), r = se.toGeminiRequest(e, o, i);
    console.log("[GeminiChatProvider] ===== FULL REQUEST OBJECT ====="), console.log(JSON.stringify({ model: o, ...r }, null, 2)), console.log("[GeminiChatProvider] ===== END REQUEST =====");
    try {
      if (e.streaming = !1, e.streaming !== !1) {
        const d = await this.client.models.generateContentStream(r);
        let f = 0, p = "";
        for await (const m of d) {
          f++;
          const h = m.text;
          h && n && (p += h, n(h));
        }
        console.log("[GeminiChatProvider] ===== FULL RESPONSE OBJECT ====="), console.log(JSON.stringify(p, null, 2)), console.log("[GeminiChatProvider] ===== END RESPONSE =====");
      } else {
        const d = await this.client.models.generateContent(r);
        console.log("[GeminiChatProvider] ===== FULL RESPONSE OBJECT ====="), console.log(JSON.stringify(d, null, 2)), console.log("[GeminiChatProvider] ===== END RESPONSE =====");
        const f = d.text;
        let p = null;
        const m = (c = (u = (a = d.candidates) == null ? void 0 : a[0]) == null ? void 0 : u.content) == null ? void 0 : c.parts;
        if (m)
          for (const h of m)
            h.inlineData && h.inlineData.mimeType && (p = {
              mimeType: h.inlineData.mimeType,
              displayName: h.inlineData.displayName || "",
              data: h.inlineData.data || ""
            });
        if (f && n && n(f), p && n)
          if (this.onFileReceived) {
            const h = e.thread_id || "", { fileId: g, xml: T } = se.dehydrateFileContents(h, p.mimeType, p.data, p.displayName);
            this.onFileReceived(h, g, p.mimeType, p.data, p.displayName), n(`

${T}`);
          } else {
            const h = `![](data:${p.mimeType};base64,${p.data})`;
            n(`

${h}`);
          }
      }
    } catch (d) {
      console.error("[GeminiChatProvider] Error in Gemini API call:", d);
      const f = se.mapError(d);
      throw console.log("[GeminiChatProvider] Decoded error message:", f), n && n(`

**Error:** ${f}`), d;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   * Implements streaming tool orchestration loop with multiple sequential tool calls
   */
  async chatWithTools(e, n) {
    var p, m, h, g, T, y, E, v, S, _, C;
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const o = e.model || this.defaultModel, i = se.convertToolsToGeminiFormat(this.tools), r = se.toGeminiRequest(e, o, i), a = e.streaming !== !1;
    let u = { model: o, ...r }, c = r.contents, d = 0, f = e.branch_id || "";
    for (; d < Z.MAX_TOOL_ITERATIONS; ) {
      d++, f = Z.setBranchIteration(f, d), e.branch_id = f, u = { ...u, contents: c };
      try {
        if (a) {
          let A = null, R = !1;
          try {
            const U = await this.client.models.generateContentStream(u);
            try {
              let F = 0;
              const k = [];
              for await (const L of U) {
                if (F++, A = L, L && L.candidates && L.candidates[0]) {
                  const me = L.candidates[0];
                  if ((p = me.content) != null && p.parts)
                    for (const ie of me.content.parts)
                      k.push(ie), ie.text && n && n(ie.text);
                }
                const K = (h = (m = L.candidates) == null ? void 0 : m[0]) == null ? void 0 : h.finishReason;
                if (K) {
                  console.log("[GeminiChatProvider] Stream finish", { chunkCount: F, finishReason: K });
                  break;
                }
              }
              k.length > 0 && (A = {
                candidates: [{
                  content: { role: "model", parts: k },
                  finishReason: (T = (g = A == null ? void 0 : A.candidates) == null ? void 0 : g[0]) == null ? void 0 : T.finishReason
                }]
              });
            } catch (F) {
              const k = F instanceof Error ? F.message : String(F);
              if (k.includes("Incomplete JSON") || k.includes("invalid chunk"))
                console.warn("[GeminiChatProvider] JSON streaming error, falling back to non-streaming", {
                  iteration: d,
                  errorMessage: k
                }), R = !0;
              else
                throw F;
            }
          } catch (U) {
            console.warn("[GeminiChatProvider] Stream error, will retry non-streaming", { iteration: d, error: U }), R = !0;
          }
          if (R) {
            console.log("[GeminiChatProvider] Retrying with non-streaming mode", { iteration: d }), A = await this.client.models.generateContent(u);
            const U = this.toolHandler.extractTextContent(A);
            U && n && n(U);
          }
          const N = this.toolHandler.extractToolUses(A);
          if (N.length === 0) {
            console.log("[GeminiChatProvider] No tool calls, ending loop", { iteration: d });
            return;
          }
          c = this.appendMessage(c, {
            role: "model",
            parts: ((v = (E = (y = A.candidates) == null ? void 0 : y[0]) == null ? void 0 : E.content) == null ? void 0 : v.parts) || []
          });
          const P = await this.executeTools(N), x = this.toolHandler.formatToolResults(N, P);
          c = this.appendMessage(c, {
            role: "user",
            parts: x
          });
        } else {
          const A = await this.client.models.generateContent(u), R = this.toolHandler.extractTextContent(A);
          R && n && n(R);
          const N = this.toolHandler.extractToolUses(A);
          if (N.length === 0)
            return;
          c = this.appendMessage(c, {
            role: "model",
            parts: ((C = (_ = (S = A.candidates) == null ? void 0 : S[0]) == null ? void 0 : _.content) == null ? void 0 : C.parts) || []
          });
          const P = await this.executeTools(N), x = this.toolHandler.formatToolResults(N, P);
          c = this.appendMessage(c, {
            role: "user",
            parts: x
          });
        }
      } catch (A) {
        throw console.error("[GeminiChatProvider] Error in tool loop iteration", {
          iteration: d,
          error: A
        }), A;
      }
    }
    throw console.error(
      "[GeminiChatProvider] Tool loop exceeded maximum iterations: ",
      Z.MAX_TOOL_ITERATIONS
    ), new Error("Tool loop exceeded maximum iterations");
  }
  /**
   * Execute a list of tool calls
   */
  async executeTools(e) {
    const n = [];
    console.log("[GeminiChatProvider] Starting tool execution batch", {
      toolCount: e.length,
      tools: e.map((o) => o.name)
    });
    for (let o = 0; o < e.length; o++) {
      const i = e[o];
      console.log("[GeminiChatProvider] Executing tool", {
        toolIndex: o + 1,
        totalTools: e.length,
        toolId: i.id,
        toolName: i.name,
        inputKeys: Object.keys(i.input),
        inputPreview: JSON.stringify(i.input).substring(0, 200)
      });
      try {
        const r = Date.now(), a = await this.onToolUse(i), u = Date.now() - r;
        n.push(a), console.log("[GeminiChatProvider] Tool execution completed", {
          toolIndex: o + 1,
          toolName: i.name,
          duration: `${u}ms`,
          success: a.success,
          hasData: !!a.data,
          dataPreview: a.data ? JSON.stringify(a.data).substring(0, 200) : void 0,
          hasError: !!a.error,
          errorMessage: a.error
        });
      } catch (r) {
        console.error("[GeminiChatProvider] Tool execution failed", {
          toolIndex: o + 1,
          toolName: i.name,
          error: r instanceof Error ? r.message : String(r),
          errorStack: r instanceof Error ? r.stack : void 0
        }), n.push({
          success: !1,
          error: `Tool execution error: ${r instanceof Error ? r.message : String(r)}`
        });
      }
    }
    return console.log("[GeminiChatProvider] Tool execution batch completed", {
      totalTools: e.length,
      successCount: n.filter((o) => o.success).length,
      failureCount: n.filter((o) => !o.success).length
    }), n;
  }
  /**
   * Append a message to the conversation
   */
  appendMessage(e, n) {
    return [...e, n];
  }
}
class Ec extends eo {
  constructor(e, n, o) {
    if (super(e, n, o), this.detectAzureEndpoint(e)) {
      const r = o, a = "2024-04-01-preview";
      this.client = new Xo({
        endpoint: e,
        apiKey: n,
        deployment: r,
        apiVersion: a,
        defaultHeaders: { "api-key": n },
        dangerouslyAllowBrowser: !0
      }), console.log(`CopilotChatProvider initialized (Azure) endpoint: ${e} deployment: ${r} apiVersion: ${a}`);
    } else
      this.client = new jn({
        apiKey: n,
        baseURL: e,
        dangerouslyAllowBrowser: !0
      }), console.log(`CopilotChatProvider initialized (proxy) endpoint: ${e} model: ${o}`);
  }
  setTools(e = [], n, o) {
    super.setTools(e, n, o);
  }
  /**
   * Detect if the endpoint is an Azure OpenAI endpoint
   * Azure endpoints typically end with .cognitiveservices.azure.com or .openai.azure.com
   */
  detectAzureEndpoint(e) {
    if (!e) return !1;
    try {
      const n = new URL(e).hostname.toLowerCase();
      return n.endsWith(".cognitiveservices.azure.com") || n.endsWith(".openai.azure.com");
    } catch {
      return !1;
    }
  }
}
var Pe = /* @__PURE__ */ ((t) => (t.OLLAMA = "ollama", t.OPENAI = "openai", t.CLAUDE = "claude", t.PERPLEXITY = "perplexity", t.GEMINI = "gemini", t.COPILOT = "copilot", t))(Pe || {});
class Sc {
  /**
   * Creates an appropriate chat provider based on the provider type
   */
  static createProvider(e, n) {
    switch (e) {
      case "ollama":
        return new jo(n.url, n.apiKey || "", n.model);
      case "openai":
        if (!n.apiKey)
          throw new Error("API key is required for OpenAI provider");
        return new eo(n.url, n.apiKey, n.model);
      case "claude":
        if (!n.apiKey)
          throw new Error("API key is required for Claude provider");
        return new ii(n.url, n.apiKey, n.model);
      case "gemini":
        if (!n.apiKey)
          throw new Error("API key is required for Gemini provider");
        return new Cc(n.url, n.apiKey, n.model);
      case "copilot":
        if (!n.apiKey)
          throw new Error("API key is required for Copilot provider");
        return new Ec(n.url, n.apiKey, n.model);
      case "perplexity":
        throw new Error("PerplexityChatProvider not implemented yet");
      default:
        throw new Error(`Unsupported provider type: ${e}`);
    }
  }
}
class Ic {
  // Very rough estimation - in production you'd use a proper tokenizer like tiktoken
  countPromptTokens(e) {
    return this.estimateTokens(JSON.stringify(e));
  }
  estimateResponseTokens(e) {
    return this.estimateTokens(e);
  }
  estimateTokens(e) {
    return Math.ceil(e.split(/\s+/).length / 0.75);
  }
}
class vc {
  countPromptTokens(e) {
    return this.estimateTokens(JSON.stringify(e));
  }
  estimateResponseTokens(e) {
    return this.estimateTokens(e);
  }
  estimateTokens(e) {
    return Math.ceil(e.length / 4);
  }
}
class Ac {
  countPromptTokens(e) {
    return this.estimateTokens(JSON.stringify(e));
  }
  estimateResponseTokens(e) {
    return this.estimateTokens(e);
  }
  estimateTokens(e) {
    return Math.ceil(e.split(/\s+/).length / 0.7);
  }
}
class Rc {
  countPromptTokens(e) {
    return this.estimateTokens(JSON.stringify(e));
  }
  estimateResponseTokens(e) {
    return this.estimateTokens(e);
  }
  estimateTokens(e) {
    return Math.ceil(e.length / 4);
  }
}
function Pc(t) {
  switch (t.toLowerCase()) {
    case Pe.OPENAI:
      return new Ic();
    case Pe.CLAUDE:
      return new vc();
    case Pe.OLLAMA:
      return new Ac();
    default:
      return new Rc();
  }
}
class wc {
  constructor(e, n, o, i, r) {
    w(this, "accumulatedResponse", "");
    w(this, "requestStartTime");
    w(this, "firstTokenTime");
    w(this, "tokenCounter");
    w(this, "originalCallback");
    w(this, "totalTokens", 0);
    w(this, "tokensReceived", 0);
    w(this, "isFirstToken", !0);
    this.provider = e, this.model = n, this.prompt = o, this.onComplete = i, this.requestStartTime = Date.now(), this.originalCallback = r, this.tokenCounter = Pc(e);
  }
  /**
   * Handle each token as it arrives
   */
  handleToken(e) {
    this.isFirstToken && (this.firstTokenTime = Date.now(), this.isFirstToken = !1), this.accumulatedResponse += e, this.tokensReceived++, this.originalCallback && this.originalCallback(e);
  }
  /**
   * Complete the accumulation and generate audit data
   */
  complete(e) {
    var a, u;
    const n = Date.now(), o = ((a = this.tokenCounter) == null ? void 0 : a.countPromptTokens(this.prompt)) ?? 0, i = ((u = this.tokenCounter) == null ? void 0 : u.estimateResponseTokens(this.accumulatedResponse)) ?? 0, r = {
      requestId: crypto.randomUUID(),
      provider: this.provider,
      model: this.model,
      requestTimestamp: this.requestStartTime,
      firstTokenTimestamp: this.firstTokenTime,
      completionTimestamp: n,
      totalDuration: n - this.requestStartTime,
      timeToFirstToken: this.firstTokenTime ? this.firstTokenTime - this.requestStartTime : void 0,
      promptTokenCount: o,
      completionTokenCount: i,
      totalTokenCount: o + i,
      tokensPerSecond: this.calculateTokensPerSecond(n),
      promptText: JSON.stringify(this.prompt),
      completeResponse: this.accumulatedResponse,
      success: !e,
      error: e ? String(e) : void 0
    };
    return this.onComplete(r), r;
  }
  /**
   * Calculate tokens per second rate
   */
  calculateTokensPerSecond(e) {
    if (!this.firstTokenTime || this.tokensReceived === 0)
      return;
    const n = (e - this.firstTokenTime) / 1e3;
    return n > 0 ? this.tokensReceived / n : void 0;
  }
}
const ne = class ne {
  constructor(e) {
    w(this, "config");
    w(this, "auditLogs", []);
    this.config = {
      enabled: e.enabled ?? !0,
      logToConsole: e.logToConsole ?? !0,
      logToServer: e.logToServer ?? !1,
      includePromptText: e.includePromptText ?? !0,
      includeResponseText: e.includeResponseText ?? !0
    };
  }
  /**
   * Get the singleton instance
   */
  static getInstance(e) {
    return ne.instance || (ne.instance = new ne(e || { enabled: !0 })), ne.instance;
  }
  /**
   * Create an accumulator for tracking a chat request
   */
  createAccumulator(e, n, o, i) {
    return new wc(
      e,
      n,
      o,
      (r) => this.logChatAudit(r),
      i
    );
  }
  /**
   * Create a wrapped token callback that accumulates tokens
   */
  createWrappedCallback(e, n, o) {
    const i = this.createAccumulator(
      n,
      e.model,
      e.messages,
      o
    );
    return {
      callback: (r) => i.handleToken(r),
      complete: (r) => i.complete(r)
    };
  }
  /**
   * Log the chat audit data
   */
  logChatAudit(e) {
    if (!this.config.enabled) return;
    this.auditLogs.push(e);
    const n = this.applyPrivacyFilters(e);
    this.config.logToConsole && console.log(`[AUDIT] Chat completed: ${n.provider}/${n.model} (${n.totalDuration}ms)`, n), this.config.logToServer && this.config.serverEndpoint && this.sendToServer(n, this.config.serverEndpoint);
  }
  /**
   * Get all accumulated audit logs
   */
  getAuditLogs() {
    return [...this.auditLogs];
  }
  /**
   * Apply privacy filters to the audit data
   */
  applyPrivacyFilters(e) {
    const n = { ...e };
    return this.config.includePromptText || (n.promptText = "[REDACTED]"), this.config.includeResponseText || (n.completeResponse = "[REDACTED]"), n;
  }
  /**
   * Send audit data to a server endpoint
   */
  async sendToServer(e, n) {
    try {
      const o = await fetch(n, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(e)
      });
      o.ok || console.error(`Failed to send audit data to server: ${o.status} ${o.statusText}`);
    } catch (o) {
      console.error("Error sending audit data to server:", o);
    }
  }
};
w(ne, "instance");
let rt = ne;
class kc {
  /**
   * Create a ChatService with the specified provider and configuration
   */
  constructor(e, n, o = !0) {
    w(this, "provider");
    w(this, "providerType");
    w(this, "config");
    w(this, "auditService");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "onFileReceived");
    this.providerType = e, this.config = n, this.provider = this.initializeProvider(), this.auditService = rt.getInstance({
      enabled: o,
      logToConsole: !0,
      logToServer: !1
    });
  }
  /**
   * Initialize the appropriate provider based on provider type
   */
  initializeProvider() {
    return Sc.createProvider(this.providerType, this.config);
  }
  setTools(e, n, o) {
    this.tools = e, this.onToolUse = n, this.onFileReceived = o, this.provider.setTools(e, n, o);
  }
  /**
   * Send a chat request and handle streaming response
   */
  async chat(e, n) {
    const { callback: o, complete: i } = this.auditService.createWrappedCallback(
      e,
      this.providerType,
      n
    );
    try {
      await this.provider.chat(e, o), i();
    } catch (r) {
      throw i(r), r;
    }
  }
  /**
   * Get the audit logs for this chat service
   */
  getAuditLogs() {
    return this.auditService.getAuditLogs();
  }
}
class Mc {
  static toOllamaRequest(e) {
    return {
      model: e.model,
      messages: e.messages.map((n) => ({ role: n.role, content: n.content }))
    };
  }
}
class Lc {
  constructor(e, n) {
    w(this, "url");
    w(this, "model");
    w(this, "ollama");
    this.url = e, this.model = n, this.ollama = new Zn({ host: e }), console.log("in constructor creating ollama client...");
  }
  async chat(e, n) {
    Mc.toOllamaRequest(e);
    const o = await this.ollama.chat({ model: e.model, messages: e.messages, stream: !0 });
    for await (const i of o) {
      const r = i.message.content;
      n && n(r);
    }
  }
}
export {
  rt as AuditService,
  Lc as ChatApiService,
  Sc as ChatProviderFactory,
  Z as ChatProviderUtils,
  kc as ChatService,
  ii as ClaudeChatProvider,
  oi as ClaudeToolHandler,
  Cc as GeminiChatProvider,
  _c as GeminiToolHandler,
  jo as OllamaChatProvider,
  Zo as OllamaToolHandler,
  eo as OpenAIChatProvider,
  ei as OpenAIToolHandler,
  Pe as ProviderType,
  wc as TokenAccumulator
};
