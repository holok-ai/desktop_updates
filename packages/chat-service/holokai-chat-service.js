var U = Object.defineProperty;
var H = (m, e, o) => e in m ? U(m, e, { enumerable: !0, configurable: !0, writable: !0, value: o }) : m[e] = o;
var d = (m, e, o) => H(m, typeof e != "symbol" ? e + "" : e, o);
import { Ollama as M } from "ollama/browser";
import L from "openai";
import E from "@anthropic-ai/sdk";
class x {
  /**
   * Convert internal ChatRequest to Ollama-specific format
   */
  static toOllamaRequest(e) {
    const o = e.messages.filter((l) => l.role !== "system"), t = e.system ? [{ role: "system", content: e.system }, ...o.map((l) => ({ role: l.role, content: l.content }))] : o.map((l) => ({ role: l.role, content: l.content })), n = {
      model: e.model,
      messages: t,
      stream: e.streaming !== !1
    };
    return (e.temperature !== void 0 || e.maxTokens !== void 0 || e.topP !== void 0 || e.frequencyPenalty !== void 0 || e.presencePenalty !== void 0 || e.stop !== void 0) && (n.options = {}, e.temperature !== void 0 && (n.options.temperature = e.temperature), e.maxTokens !== void 0 && (n.options.num_predict = e.maxTokens), e.topP !== void 0 && (n.options.top_p = e.topP), e.frequencyPenalty !== void 0 && (n.options.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (n.options.presence_penalty = e.presencePenalty), e.stop !== void 0 && (n.options.stop = e.stop)), e.responseFormat && (n.format = e.responseFormat), n;
  }
}
const _ = class _ {
  /**
   * Adds a tool sequence branch ID to the thread_id for tool calling iterations
   * Format: {original_thread_id},branch_id=1.0 for iteration 0
   *         {original_thread_id},branch_id=1.0.{iteration} for iteration > 0
   *
   * @param request - Chat request that may contain thread_id
   * @param iteration - Current tool loop iteration number
   * @returns Object with thread_id or empty object if no thread_id exists
   */
  static addToolSeqToBranch(e, o) {
    if (!e.thread_id)
      return {};
    let t = e.thread_id;
    return t.includes(",branch_id=") || (t = `${t},branch_id=1.0.1`), t = `${t}.${Math.floor(o)}`, {
      thread_id: t
    };
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
  static async handleToolLoop(e, o, t, n, a, l, s, r = !1) {
    console.log("[ChatProviderUtils] handleToolLoop starting", {
      model: o,
      initialMessagesCount: t.length,
      toolsCount: n.length,
      originalThreadId: a.thread_id,
      shouldStream: r,
      hasOnTokenReceived: !!s,
      maxIterations: _.MAX_TOOL_ITERATIONS
    });
    let c = t;
    const p = a;
    for (let i = 0; i < _.MAX_TOOL_ITERATIONS; i++) {
      console.log("[ChatProviderUtils] handleToolLoop - Starting iteration", {
        iteration: i,
        currentMessagesCount: c.length
      });
      const h = _.addToolSeqToBranch(p, i);
      console.log("[ChatProviderUtils] handleToolLoop - Thread context for iteration", {
        iteration: i,
        threadContext: h
      });
      const u = "setTokenCallback" in e && typeof e.setTokenCallback == "function";
      u ? (console.log("[ChatProviderUtils] handleToolLoop - Setting token callback"), e.setTokenCallback(s)) : console.log("[ChatProviderUtils] handleToolLoop - Handler does not support streaming callback"), console.log("[ChatProviderUtils] handleToolLoop - Making request to handler");
      const T = await e.makeRequest(
        o,
        c,
        n,
        h,
        r
      );
      console.log("[ChatProviderUtils] handleToolLoop - Request completed", {
        iteration: i,
        hasResponse: !!T
      });
      const v = !r || !u;
      if (console.log("[ChatProviderUtils] handleToolLoop - Text content handling", {
        iteration: i,
        shouldSendTextContent: v,
        hasStreamingCallback: u,
        shouldStream: r
      }), v) {
        const g = e.extractTextContent(T);
        console.log("[ChatProviderUtils] handleToolLoop - Extracted text content", {
          iteration: i,
          hasTextContent: !!g,
          textContentLength: (g == null ? void 0 : g.length) || 0,
          textPreview: (g == null ? void 0 : g.substring(0, 100)) + "...",
          willCallOnTokenReceived: !!(g && s)
        }), g && s && s(g);
      }
      console.log("[ChatProviderUtils] handleToolLoop - Extracting tool uses");
      const k = e.extractToolUses(T);
      console.log("[ChatProviderUtils] handleToolLoop - Tool uses extracted", {
        iteration: i,
        toolUsesCount: k.length,
        toolUses: k.map((g) => ({ id: g.id, name: g.name, inputKeys: Object.keys(g.input) }))
      });
      const y = T.stop_reason;
      if (y === "tool_use" && k.length === 0 && (console.warn('[ChatProviderUtils] handleToolLoop - MISMATCH: stop_reason="tool_use" but no tool_use blocks found in content', {
        iteration: i,
        stopReason: y,
        responseId: T.id,
        contentBlocks: T.content
      }), console.warn("[ChatProviderUtils] handleToolLoop - This may indicate a proxy is modifying Claude responses")), k.length === 0) {
        console.log("[ChatProviderUtils] handleToolLoop - No tool uses found, ending loop", {
          iteration: i,
          stopReason: y
        });
        return;
      }
      console.log("[ChatProviderUtils] handleToolLoop - Executing tools", {
        iteration: i,
        toolUsesCount: k.length
      });
      const f = [];
      for (const g of k) {
        console.log("[ChatProviderUtils] handleToolLoop - Executing tool", {
          iteration: i,
          toolId: g.id,
          toolName: g.name,
          inputKeys: Object.keys(g.input)
        });
        const O = await l(g);
        console.log("[ChatProviderUtils] handleToolLoop - Tool execution completed", {
          iteration: i,
          toolId: g.id,
          toolName: g.name,
          resultSuccess: O == null ? void 0 : O.success,
          hasResultData: !!(O != null && O.data),
          hasResultError: !!(O != null && O.error)
        }), f.push(O);
      }
      console.log("[ChatProviderUtils] handleToolLoop - All tools executed", {
        iteration: i,
        toolResultsCount: f.length
      }), console.log("[ChatProviderUtils] handleToolLoop - Formatting tool results");
      const C = e.formatToolResults(k, f);
      console.log("[ChatProviderUtils] handleToolLoop - Appending messages"), c = e.appendMessages(c, T, C), console.log("[ChatProviderUtils] handleToolLoop - Iteration complete, continuing loop", {
        iteration: i,
        newMessagesCount: c.length
      });
    }
    throw console.error("[ChatProviderUtils] handleToolLoop - Maximum iterations exceeded", {
      maxIterations: _.MAX_TOOL_ITERATIONS
    }), new Error("Tool loop exceeded maximum iterations");
  }
};
/**
 * Maximum number of tool calling iterations to prevent infinite loops
 */
d(_, "MAX_TOOL_ITERATIONS", 10);
let P = _;
class N {
  constructor(e) {
    d(this, "onTokenReceived");
    this.ollama = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, o, t, n, a) {
    var l;
    if (console.log("[OllamaToolHandler] makeRequest called", {
      model: e,
      shouldStream: a,
      toolsCount: t.length,
      messagesCount: o.length,
      threadContext: n
    }), a) {
      console.log("[OllamaToolHandler] Using streaming mode");
      const s = await this.ollama.chat({
        ...n,
        model: e,
        messages: o,
        tools: t,
        stream: !0
      });
      let r = null, c = 0;
      for await (const p of s) {
        c++;
        const i = (l = p.message) == null ? void 0 : l.content;
        i && this.onTokenReceived && this.onTokenReceived(i), r = p;
      }
      return console.log("[OllamaToolHandler] Stream complete", {
        chunkCount: c,
        hasFinalMessage: !!r,
        finalMessageKeys: r ? Object.keys(r) : []
      }), r;
    } else {
      console.log("[OllamaToolHandler] Using non-streaming mode");
      const s = await this.ollama.chat({
        ...n,
        model: e,
        messages: o,
        tools: t,
        stream: !1
      });
      return console.log("[OllamaToolHandler] Non-streaming response received", {
        hasResponse: !!s,
        responseKeys: s ? Object.keys(s) : []
      }), s;
    }
  }
  extractToolUses(e) {
    const o = this.extractToolCalls(e.message);
    return console.log("[OllamaToolHandler] extractToolUses", {
      hasMessage: !!e.message,
      toolCallsCount: o.length,
      toolCalls: o.map((t) => ({ id: t.id, name: t.name }))
    }), o.map((t) => ({
      id: t.id,
      name: t.name,
      input: this.parseToolArguments(t.arguments)
    }));
  }
  extractTextContent(e) {
    var t;
    const o = ((t = e.message) == null ? void 0 : t.content) || null;
    return console.log("[OllamaToolHandler] extractTextContent", {
      hasContent: !!o,
      contentLength: (o == null ? void 0 : o.length) || 0
    }), o;
  }
  formatToolResults(e, o) {
    return console.log("[OllamaToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: o.length
    }), e.map((t, n) => ({
      id: t.id,
      result: JSON.stringify(o[n])
    }));
  }
  appendMessages(e, o, t) {
    var a, l;
    console.log("[OllamaToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: t.length,
      hasResponseMessage: !!o.message
    });
    const n = [
      ...e,
      {
        role: "assistant",
        content: ((a = o.message) == null ? void 0 : a.content) || "",
        tool_calls: ((l = o.message) == null ? void 0 : l.tool_calls) || []
      }
    ];
    for (const s of t)
      n.push({
        role: "tool",
        content: s.result
      });
    return console.log("[OllamaToolHandler] appendMessages complete", {
      newMessagesCount: n.length
    }), n;
  }
  /**
   * Extract tool calls from Ollama message
   */
  extractToolCalls(e) {
    var t;
    if (console.log("[OllamaToolHandler] extractToolCalls", {
      hasMessage: !!e,
      hasToolCalls: !!(e != null && e.tool_calls),
      isArray: Array.isArray(e == null ? void 0 : e.tool_calls),
      toolCallsLength: ((t = e == null ? void 0 : e.tool_calls) == null ? void 0 : t.length) || 0,
      messageKeys: e ? Object.keys(e) : []
    }), !(e != null && e.tool_calls) || !Array.isArray(e.tool_calls))
      return [];
    const o = e.tool_calls.map((n, a) => {
      var l, s;
      return {
        id: n.id || `tool_${a}`,
        name: ((l = n.function) == null ? void 0 : l.name) || n.name || "",
        arguments: ((s = n.function) == null ? void 0 : s.arguments) || n.arguments || {}
      };
    });
    return console.log("[OllamaToolHandler] extractToolCalls result", {
      extractedCount: o.length,
      calls: o.map((n) => ({ id: n.id, name: n.name }))
    }), o;
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
class b {
  constructor(e, o, t, n = [], a) {
    d(this, "ollama");
    d(this, "defaultModel");
    d(this, "tools");
    d(this, "onToolUse");
    d(this, "toolHandler");
    this.ollama = new M({ host: e, headers: {
      "X-api-key": o
    } }), this.defaultModel = t, this.tools = n, this.onToolUse = a, n.length > 0 && (this.toolHandler = new N(this.ollama)), console.log(`OllamaChatProvider initialized with endpoint ${e} and model ${t}${n.length > 0 ? ` and ${n.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Ollama
   * Automatically handles tools if configured in constructor
   */
  async chat(e, o) {
    const t = e;
    if (console.log("[OllamaChatProvider] chat called", {
      hasThreadId: !!t.thread_id,
      thread_id: t.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, o);
      return;
    }
    const n = e.model || this.defaultModel, a = { ...e, model: n }, l = x.toOllamaRequest(a), s = t.thread_id ? { thread_id: t.thread_id } : {};
    try {
      if (l.stream) {
        const r = await this.ollama.chat({
          ...s,
          ...l,
          stream: !0
        });
        for await (const c of r) {
          const p = c.message.content;
          o && o(p);
        }
      } else {
        const r = await this.ollama.chat({
          ...s,
          ...l,
          stream: !1
        });
        o && o(r.message.content);
      }
    } catch (r) {
      throw console.error("Error in Ollama API call:", r), r;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, o) {
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const t = e.model || this.defaultModel, n = { ...e, model: t }, a = x.toOllamaRequest(n), l = this.convertToolsToOllamaFormat(this.tools);
    try {
      await P.handleToolLoop(
        this.toolHandler,
        a.model,
        a.messages || [],
        l,
        e,
        this.onToolUse,
        o,
        e.streaming !== !1
      );
    } catch (s) {
      throw console.error("[OllamaChatProvider] Tool-enabled chat failed:", s), s;
    }
  }
  /**
   * Convert ToolDefinition to Ollama's tools format
   */
  convertToolsToOllamaFormat(e) {
    return e.map((o) => ({
      type: "function",
      function: {
        name: o.name,
        description: o.description,
        parameters: o.input_schema
      }
    }));
  }
  /**
   * Extract tool calls from Ollama response
   */
  extractToolCalls(e) {
    return !e.tool_calls || !Array.isArray(e.tool_calls) ? [] : e.tool_calls.map((o, t) => ({
      id: `call_${Date.now()}_${t}`,
      name: o.function.name,
      arguments: o.function.arguments
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
        const o = JSON.parse(e);
        return o && typeof o == "object" && !Array.isArray(o) ? o : {};
      } catch (o) {
        return console.warn("[OllamaChatProvider] Failed to parse tool arguments", { error: o, raw: e }), {};
      }
    return {};
  }
  /**
   * Handle the tool use loop
   */
  async handleToolLoop(e, o, t, n) {
    var r, c, p, i;
    let a = [...e.messages];
    const l = e.stream !== !1, s = n;
    console.log("[OllamaChatProvider] handleToolLoop starting", {
      shouldStream: l,
      toolsCount: o.length,
      messagesCount: a.length,
      hasThreadId: !!s.thread_id
    });
    for (let h = 0; h < P.MAX_TOOL_ITERATIONS; h++) {
      console.log("[OllamaChatProvider] Tool loop iteration", { iteration: h });
      const u = P.addToolSeqToBranch(s, h), T = await this.ollama.chat({
        ...u,
        model: e.model,
        messages: a,
        tools: o,
        stream: !1
        // Use non-streaming for tool calls
      });
      console.log("[OllamaChatProvider] Got response", {
        hasMessage: !!T.message,
        hasToolCalls: !!((r = T.message) != null && r.tool_calls),
        messageKeys: T.message ? Object.keys(T.message) : [],
        messageContent: (c = T.message) == null ? void 0 : c.content,
        toolCalls: (p = T.message) == null ? void 0 : p.tool_calls,
        fullResponse: JSON.stringify(T, null, 2)
      }), (i = T.message) != null && i.content && t && t(T.message.content);
      const v = this.extractToolCalls(T.message);
      if (v.length === 0) {
        console.log("[OllamaChatProvider] No tool calls found, ending loop");
        return;
      }
      console.log("[OllamaChatProvider] Found tool calls", { count: v.length });
      const k = [];
      for (const y of v) {
        console.log("[OllamaChatProvider] Executing tool", { name: y.name });
        const f = {
          id: y.id,
          name: y.name,
          input: this.parseToolArguments(y.arguments)
        }, C = await this.onToolUse(f);
        console.log("[OllamaChatProvider] Tool result", { success: C.success }), k.push({
          id: y.id,
          result: JSON.stringify(C)
        });
      }
      a.push({
        role: "assistant",
        content: T.message.content || "",
        tool_calls: T.message.tool_calls
      });
      for (const y of k)
        a.push({
          role: "tool",
          content: y.result
        });
    }
    throw new Error("Tool loop exceeded maximum iterations");
  }
}
class I {
  /**
   * Map internal message format to OpenAI's ChatCompletionMessageParam
   */
  static mapMessage(e) {
    return {
      role: ["system", "user", "assistant", "function", "tool"].includes(e.role) ? e.role : "user",
      // Type cast to satisfy TypeScript
      content: e.content
    };
  }
  /**
   * Convert internal ChatRequest to OpenAI-specific format
   */
  static toOpenAIRequest(e) {
    let o;
    if (e.system) {
      const n = e.messages.filter((a) => a.role !== "system");
      o = [
        { role: "system", content: e.system },
        ...n.map((a) => this.mapMessage(a))
      ];
    } else
      o = e.messages.map((n) => this.mapMessage(n));
    const t = {
      model: e.model,
      messages: o,
      stream: e.streaming !== !1
    };
    return e.temperature !== void 0 && (t.temperature = e.temperature), e.maxTokens !== void 0 && (t.max_tokens = e.maxTokens), e.topP !== void 0 && (t.top_p = e.topP), e.frequencyPenalty !== void 0 && (t.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (t.presence_penalty = e.presencePenalty), e.stop !== void 0 && (t.stop = e.stop), e.responseFormat !== void 0 && (t.response_format = e.responseFormat), t;
  }
}
class D {
  constructor(e) {
    d(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, o, t, n, a) {
    return console.log("[OpenAIToolHandler] makeRequest called", {
      model: e,
      shouldStream: a,
      toolsCount: t.length,
      messagesCount: o.length,
      threadContext: n
    }), a ? (console.log("[OpenAIToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, o, t, n)) : (console.log("[OpenAIToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, o, t, n));
  }
  extractToolUses(e) {
    var t, n, a, l, s, r, c;
    const o = e.choices[0];
    if (console.log("[OpenAIToolHandler] extractToolUses", {
      hasChoice: !!o,
      finishReason: o == null ? void 0 : o.finish_reason,
      hasToolCalls: !!((t = o == null ? void 0 : o.message) != null && t.tool_calls),
      toolCallsCount: ((a = (n = o == null ? void 0 : o.message) == null ? void 0 : n.tool_calls) == null ? void 0 : a.length) || 0,
      hasFunctionCall: !!((l = o == null ? void 0 : o.message) != null && l.function_call)
    }), (o == null ? void 0 : o.finish_reason) === "tool_calls" || (s = o == null ? void 0 : o.message) != null && s.tool_calls) {
      const p = (r = o == null ? void 0 : o.message) == null ? void 0 : r.tool_calls;
      if (p && p.length > 0) {
        const i = p.map((h) => ({
          id: h.id,
          name: h.function.name,
          input: this.parseToolArguments(h.function.arguments)
        }));
        return console.log("[OpenAIToolHandler] Extracted tool uses (tool_calls format)", {
          count: i.length,
          tools: i.map((h) => ({ id: h.id, name: h.name }))
        }), i;
      }
    }
    if ((o == null ? void 0 : o.finish_reason) === "function_call") {
      const p = (c = o == null ? void 0 : o.message) == null ? void 0 : c.function_call;
      if (p) {
        const i = {
          id: `call_${Date.now()}`,
          name: p.name,
          input: this.parseToolArguments(p.arguments || "{}")
        };
        return console.log("[OpenAIToolHandler] Extracted tool use (function_call format)", {
          id: i.id,
          name: i.name
        }), [i];
      }
    }
    return console.log("[OpenAIToolHandler] No tool uses found"), [];
  }
  extractTextContent(e) {
    var t, n;
    const o = (n = (t = e.choices[0]) == null ? void 0 : t.message) == null ? void 0 : n.content;
    return console.log("[OpenAIToolHandler] extractTextContent", {
      hasContent: !!o,
      contentLength: (o == null ? void 0 : o.length) || 0
    }), o || null;
  }
  formatToolResults(e, o) {
    return console.log("[OpenAIToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: o.length
    }), e.map((t, n) => ({
      role: "tool",
      tool_call_id: t.id,
      content: JSON.stringify(o[n])
    }));
  }
  appendMessages(e, o, t) {
    var l;
    console.log("[OpenAIToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: t.length,
      hasResponseMessage: !!((l = o.choices[0]) != null && l.message)
    });
    const n = {
      role: "assistant",
      content: o.choices[0].message.content,
      tool_calls: o.choices[0].message.tool_calls
    }, a = [
      ...e,
      n,
      ...t
    ];
    return console.log("[OpenAIToolHandler] appendMessages complete", {
      newMessagesCount: a.length
    }), a;
  }
  /**
   * Make a streaming request to OpenAI API
   */
  async makeStreamingRequest(e, o, t, n) {
    var a, l, s, r;
    console.log("[OpenAIToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: o.length,
      toolsCount: t.length,
      threadContext: n
    });
    try {
      const c = Date.now(), p = await this.client.chat.completions.create({
        ...n,
        model: e,
        messages: o,
        tools: t,
        stream: !0
      });
      console.log("[OpenAIToolHandler] Stream received, processing chunks");
      let i = "", h = [], u = null, T = 0;
      for await (const k of p) {
        T++;
        const y = k.choices[0], f = y == null ? void 0 : y.delta;
        if (f != null && f.content && (i += f.content, this.onTokenReceived && this.onTokenReceived(f.content)), f != null && f.tool_calls)
          for (const C of f.tool_calls) {
            const g = C.index;
            h[g] ? (C.id && (h[g].id += C.id), (s = C.function) != null && s.name && (h[g].function.name += C.function.name), (r = C.function) != null && r.arguments && (h[g].function.arguments += C.function.arguments)) : h[g] = {
              id: C.id || "",
              type: "function",
              function: {
                name: ((a = C.function) == null ? void 0 : a.name) || "",
                arguments: ((l = C.function) == null ? void 0 : l.arguments) || ""
              }
            };
          }
        y != null && y.finish_reason && (u = y.finish_reason);
      }
      const v = Date.now() - c;
      return console.log("[OpenAIToolHandler] makeStreamingRequest complete", {
        duration: `${v}ms`,
        chunkCount: T,
        accumulatedContentLength: i.length,
        toolCallsCount: h.length,
        finishReason: u
      }), {
        choices: [
          {
            finish_reason: u || "stop",
            message: {
              role: "assistant",
              content: i || null,
              tool_calls: h.length > 0 ? h : void 0
            },
            index: 0,
            logprobs: null
          }
        ],
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1e3),
        model: e
      };
    } catch (c) {
      throw console.error("[OpenAIToolHandler] makeStreamingRequest failed", {
        error: c,
        errorMessage: c instanceof Error ? c.message : String(c),
        errorStack: c instanceof Error ? c.stack : void 0
      }), c;
    }
  }
  /**
   * Make a non-streaming request to OpenAI API
   */
  async makeNonStreamingRequest(e, o, t, n) {
    var a, l, s, r, c, p, i, h, u, T, v, k, y;
    console.log("[OpenAIToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: o.length,
      toolsCount: t.length,
      threadContext: n
    });
    try {
      const f = Date.now(), C = await this.client.chat.completions.create({
        ...n,
        model: e,
        messages: o,
        tools: t,
        stream: !1
      }), g = Date.now() - f;
      return console.log("[OpenAIToolHandler] makeNonStreamingRequest response received", {
        duration: `${g}ms`,
        hasResponse: !!C,
        hasChoices: !!C.choices,
        choicesCount: ((a = C.choices) == null ? void 0 : a.length) || 0,
        finishReason: (s = (l = C.choices) == null ? void 0 : l[0]) == null ? void 0 : s.finish_reason,
        hasContent: !!((p = (c = (r = C.choices) == null ? void 0 : r[0]) == null ? void 0 : c.message) != null && p.content),
        hasToolCalls: !!((u = (h = (i = C.choices) == null ? void 0 : i[0]) == null ? void 0 : h.message) != null && u.tool_calls),
        toolCallsCount: ((y = (k = (v = (T = C.choices) == null ? void 0 : T[0]) == null ? void 0 : v.message) == null ? void 0 : k.tool_calls) == null ? void 0 : y.length) || 0
      }), C;
    } catch (f) {
      throw console.error("[OpenAIToolHandler] makeNonStreamingRequest failed", {
        error: f,
        errorMessage: f instanceof Error ? f.message : String(f),
        errorStack: f instanceof Error ? f.stack : void 0
      }), f;
    }
  }
  /**
   * Parse tool arguments from string
   */
  parseToolArguments(e) {
    if (!e)
      return {};
    try {
      const o = JSON.parse(e);
      return o && typeof o == "object" && !Array.isArray(o) ? o : {};
    } catch (o) {
      return console.warn("[OpenAIToolHandler] Failed to parse tool arguments", { error: o, raw: e }), {};
    }
  }
}
class $ {
  constructor(e, o, t, n = [], a) {
    d(this, "client");
    d(this, "defaultModel");
    d(this, "tools");
    d(this, "onToolUse");
    d(this, "toolHandler");
    this.client = new L({ apiKey: o, baseURL: e, dangerouslyAllowBrowser: !0 }), this.defaultModel = t || "gpt-3.5-turbo", this.tools = n, this.onToolUse = a, n.length > 0 && (this.toolHandler = new D(this.client)), console.log(`OpenAIChatProvider initialized with model ${this.defaultModel}${n.length > 0 ? ` and ${n.length} tools` : ""}`);
  }
  /**
   * Send a chat request to OpenAI
   * Automatically handles tools if configured in constructor
   */
  async chat(e, o) {
    var s, r, c, p;
    const t = e;
    if (console.log("[OpenAIChatProvider] chat called", {
      hasThreadId: !!t.thread_id,
      thread_id: t.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, o);
      return;
    }
    const n = e.model || this.defaultModel, a = I.toOpenAIRequest({ ...e, model: n }), l = t.thread_id ? { thread_id: t.thread_id } : {};
    try {
      if (e.streaming !== !1) {
        const i = await this.client.chat.completions.create({
          model: a.model,
          messages: a.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens,
          top_p: e.topP,
          frequency_penalty: e.frequencyPenalty,
          presence_penalty: e.presencePenalty,
          stop: e.stop,
          response_format: e.responseFormat,
          stream: !0,
          ...l
        });
        for await (const h of i) {
          const u = ((r = (s = h.choices[0]) == null ? void 0 : s.delta) == null ? void 0 : r.content) || "";
          u && o && o(u);
        }
      } else {
        const h = ((p = (c = (await this.client.chat.completions.create({
          model: a.model,
          messages: a.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens,
          top_p: e.topP,
          frequency_penalty: e.frequencyPenalty,
          presence_penalty: e.presencePenalty,
          stop: e.stop,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "schema_name",
              schema: e.responseFormat,
              strict: !0
            }
          },
          ...l
        })).choices[0]) == null ? void 0 : c.message) == null ? void 0 : p.content) || "";
        h && o && o(h);
      }
    } catch (i) {
      throw console.error("Error in OpenAI API call:", i), i;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, o) {
    if (console.log("[OpenAIChatProvider] chatWithTools called", {
      hasToolHandler: !!this.toolHandler,
      hasOnToolUse: !!this.onToolUse,
      toolsCount: this.tools.length
    }), !this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const t = e.model || this.defaultModel, n = I.toOpenAIRequest({ ...e, model: t }), a = this.convertToolsToOpenAIFormat(this.tools);
    console.log("[OpenAIChatProvider] Converted request", {
      model: n.model,
      messagesCount: n.messages.length,
      toolsCount: a.length,
      shouldStream: e.streaming !== !1
    });
    try {
      console.log("[OpenAIChatProvider] Calling ChatProviderUtils.handleToolLoop"), await P.handleToolLoop(
        this.toolHandler,
        n.model,
        n.messages,
        a,
        e,
        this.onToolUse,
        o,
        e.streaming !== !1
      ), console.log("[OpenAIChatProvider] handleToolLoop completed");
    } catch (l) {
      throw console.error("[OpenAIChatProvider] Tool-enabled chat failed:", l), l;
    }
  }
  /**
   * Convert ToolDefinition to OpenAI's tools format (new API)
   */
  convertToolsToOpenAIFormat(e) {
    return e.map((o) => ({
      type: "function",
      function: {
        name: o.name,
        description: o.description,
        parameters: o.input_schema
      }
    }));
  }
}
class S {
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
    const o = e.messages.filter((n) => n.role !== "system"), t = {
      model: e.model,
      messages: o.map((n) => this.mapMessage(n)),
      stream: e.streaming !== !1
    };
    if (e.system) {
      let n = e.system;
      if (e.responseFormat) {
        const a = `

You must respond with valid JSON that matches this exact schema:
\`\`\`json
${JSON.stringify(e.responseFormat, null, 2)}
\`\`\`

Respond only with the JSON, no other text.`;
        n += a;
      }
      t.system = n;
    }
    return e.temperature !== void 0 && (t.temperature = e.temperature), e.maxTokens !== void 0 && (t.max_tokens = e.maxTokens), e.topP !== void 0 && (t.top_p = e.topP), e.stop !== void 0 && (t.stop_sequences = e.stop), t;
  }
}
class F {
  constructor(e) {
    d(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   * This is called before each tool loop iteration to update the callback
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, o, t, n, a) {
    return console.log("[ClaudeToolHandler] makeRequest called", {
      model: e,
      shouldStream: a,
      toolsCount: t.length,
      messagesCount: o.length,
      threadContext: n,
      tools: t.map((l) => {
        var s;
        return {
          name: l.name,
          description: ((s = l.description) == null ? void 0 : s.substring(0, 50)) + "..."
        };
      }),
      messages: o.map((l) => ({
        role: l.role,
        contentType: Array.isArray(l.content) ? "array" : typeof l.content,
        contentPreview: Array.isArray(l.content) ? `[${l.content.length} blocks]` : typeof l.content == "string" ? l.content.substring(0, 50) + "..." : "N/A"
      }))
    }), a ? (console.log("[ClaudeToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, o, t, n)) : (console.log("[ClaudeToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, o, t, n));
  }
  extractToolUses(e) {
    console.log("[ClaudeToolHandler] extractToolUses - Full response", {
      responseId: e.id,
      model: e.model,
      stopReason: e.stop_reason,
      contentBlocks: e.content.map((t) => ({
        type: t.type,
        ...t.type === "tool_use" ? {
          id: t.id,
          name: t.name,
          input: t.input
        } : {},
        ...t.type === "text" ? {
          text: t.text.substring(0, 100) + "..."
        } : {}
      }))
    });
    const o = this.extractToolUseBlocks(e.content);
    return console.log("[ClaudeToolHandler] extractToolUses - Extracted tools", {
      contentBlocksCount: e.content.length,
      toolUseBlocksCount: o.length,
      toolUses: o.map((t) => ({
        id: t.id,
        name: t.name,
        inputKeys: Object.keys(t.input)
      }))
    }), o.map((t) => ({
      id: t.id,
      name: t.name,
      input: t.input
    }));
  }
  extractTextContent(e) {
    const o = e.content.filter((t) => t.type === "text").map((t) => t.text).join("");
    return console.log("[ClaudeToolHandler] extractTextContent", {
      hasContent: !!o,
      contentLength: (o == null ? void 0 : o.length) || 0
    }), o || null;
  }
  formatToolResults(e, o) {
    console.log("[ClaudeToolHandler] formatToolResults - Input", {
      toolUsesCount: e.length,
      resultsCount: o.length,
      toolUses: e.map((n) => ({ id: n.id, name: n.name })),
      results: o.map((n) => ({
        success: n == null ? void 0 : n.success,
        hasData: !!(n != null && n.data),
        hasError: !!(n != null && n.error)
      }))
    });
    const t = e.map((n, a) => {
      const l = o[a], s = {
        type: "tool_result",
        tool_use_id: n.id,
        content: JSON.stringify({
          success: (l == null ? void 0 : l.success) ?? !1,
          data: (l == null ? void 0 : l.data) ?? null,
          error: (l == null ? void 0 : l.error) ?? null
        })
      };
      return console.log("[ClaudeToolHandler] formatToolResults - Formatted result", {
        toolUseId: n.id,
        toolName: n.name,
        resultSuccess: l == null ? void 0 : l.success,
        formattedContentLength: s.content.length
      }), s;
    });
    return console.log("[ClaudeToolHandler] formatToolResults - Output", {
      formattedResultsCount: t.length
    }), t;
  }
  appendMessages(e, o, t) {
    console.log("[ClaudeToolHandler] appendMessages - Input state", {
      currentMessagesCount: e.length,
      currentMessages: e.map((s) => ({
        role: s.role,
        contentType: Array.isArray(s.content) ? "array" : typeof s.content,
        contentLength: Array.isArray(s.content) || typeof s.content == "string" ? s.content.length : "N/A"
      })),
      responseContentBlocks: o.content.length,
      responseContentTypes: o.content.map((s) => s.type),
      toolResultsCount: t.length
    });
    const n = {
      role: "assistant",
      content: o.content
    }, a = {
      role: "user",
      content: t
    };
    console.log("[ClaudeToolHandler] appendMessages - New messages being added", {
      assistantMessageContentBlocks: n.content.length,
      userMessageToolResults: a.content.length
    });
    const l = [
      ...e,
      n,
      a
    ];
    return console.log("[ClaudeToolHandler] appendMessages - Output state", {
      newMessagesCount: l.length,
      lastTwoMessages: l.slice(-2).map((s) => ({
        role: s.role,
        contentType: Array.isArray(s.content) ? "array" : typeof s.content,
        contentLength: Array.isArray(s.content) || typeof s.content == "string" ? s.content.length : "N/A"
      }))
    }), l;
  }
  /**
   * Make a streaming request to Claude API
   * Streams text tokens in real-time while collecting the final message for tool extraction
   */
  async makeStreamingRequest(e, o, t, n) {
    var a, l;
    console.log("[ClaudeToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: o.length,
      toolsCount: t.length,
      threadContext: n
    });
    try {
      const s = Date.now();
      let r = 0, c = 0;
      const p = this.client.messages.stream({
        model: e,
        messages: o,
        tools: t,
        max_tokens: 4096,
        stream: !0,
        ...n
      }).on("text", (u) => {
        r++, this.onTokenReceived && this.onTokenReceived(u);
      }).on("contentBlock", (u) => {
        c++, console.log("[ClaudeToolHandler] Stream contentBlock event", {
          contentBlockCount: c,
          blockType: u.type,
          ...u.type === "tool_use" ? {
            toolId: u.id,
            toolName: u.name
          } : {}
        });
      }).on("message", (u) => {
        console.log("[ClaudeToolHandler] Stream message event", {
          messageId: u.id,
          stopReason: u.stop_reason,
          contentBlocksCount: u.content.length,
          contentTypes: u.content.map((T) => T.type)
        });
      });
      console.log("[ClaudeToolHandler] Stream started, waiting for final message");
      const i = await p.finalMessage(), h = Date.now() - s;
      return console.log("[ClaudeToolHandler] makeStreamingRequest complete", {
        duration: `${h}ms`,
        hasMessage: !!i,
        responseId: i.id,
        model: i.model,
        stopReason: i.stop_reason,
        contentBlocksCount: ((a = i.content) == null ? void 0 : a.length) || 0,
        contentBlockTypes: ((l = i.content) == null ? void 0 : l.map((u) => u.type)) || [],
        totalTokensStreamed: r,
        usage: i.usage
      }), i;
    } catch (s) {
      throw console.error("[ClaudeToolHandler] makeStreamingRequest failed", {
        error: s,
        errorMessage: s instanceof Error ? s.message : String(s),
        errorStack: s instanceof Error ? s.stack : void 0
      }), s;
    }
  }
  /**
   * Make a non-streaming request to Claude API
   */
  async makeNonStreamingRequest(e, o, t, n) {
    var a, l;
    console.log("[ClaudeToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: o.length,
      toolsCount: t.length,
      threadContext: n
    });
    try {
      const s = Date.now(), r = await this.client.messages.create({
        model: e,
        messages: o,
        tools: t,
        max_tokens: 4096,
        stream: !1,
        ...n
      }), c = Date.now() - s;
      return console.log("[ClaudeToolHandler] makeNonStreamingRequest response received", {
        duration: `${c}ms`,
        hasResponse: !!r,
        responseId: r.id,
        model: r.model,
        stopReason: r.stop_reason,
        contentBlocksCount: ((a = r.content) == null ? void 0 : a.length) || 0,
        contentBlockTypes: ((l = r.content) == null ? void 0 : l.map((p) => p.type)) || [],
        usage: r.usage
      }), r;
    } catch (s) {
      throw console.error("[ClaudeToolHandler] makeNonStreamingRequest failed", {
        error: s,
        errorMessage: s instanceof Error ? s.message : String(s),
        errorStack: s instanceof Error ? s.stack : void 0
      }), s;
    }
  }
  /**
   * Extract tool_use blocks from response content
   */
  extractToolUseBlocks(e) {
    return e.filter((o) => o.type === "tool_use");
  }
}
class B {
  constructor(e, o, t, n = [], a) {
    d(this, "client");
    d(this, "defaultModel");
    d(this, "tools");
    d(this, "onToolUse");
    d(this, "toolHandler");
    this.client = new E({
      apiKey: o,
      dangerouslyAllowBrowser: !0
    }), e && (this.client.baseURL = e), this.defaultModel = t || "claude-3-opus-20240229", this.tools = n, this.onToolUse = a, n.length > 0 && (this.toolHandler = new F(this.client)), console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}${n.length > 0 ? ` and ${n.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Claude
   * Automatically handles tools if configured in constructor
   */
  async chat(e, o) {
    const t = e;
    if (console.log("[ClaudeChatProvider] chat called", {
      hasThreadId: !!t.thread_id,
      thread_id: t.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, o);
      return;
    }
    const n = e.model || this.defaultModel, a = S.toClaudeRequest({ ...e, model: n }), l = t.thread_id ? { thread_id: t.thread_id } : {};
    try {
      if (e.streaming !== !1) {
        const s = this.client.messages.stream({
          ...l,
          model: a.model,
          messages: a.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          stream: !0,
          system: a.system
        }).on("text", (c) => {
          o && o(c);
        });
        console.log("waiting for final message");
        const r = await s.finalMessage();
        console.log(r);
      } else {
        const s = await this.client.messages.create({
          ...l,
          model: a.model,
          messages: a.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          system: a.system
        });
        if (s.content && s.content.length > 0) {
          const r = s.content.filter((c) => c.type === "text").map((c) => c.text).join("");
          o && o(r);
        }
      }
    } catch (s) {
      throw console.error("Error in Claude API call:", s), s;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, o) {
    var l;
    if (console.log("[ClaudeChatProvider] chatWithTools called", {
      hasToolHandler: !!this.toolHandler,
      hasOnToolUse: !!this.onToolUse,
      toolsCount: this.tools.length,
      requestModel: e.model,
      requestThreadId: e.thread_id,
      requestMessagesCount: e.messages.length,
      requestStreaming: e.streaming
    }), !this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const t = e.model || this.defaultModel, n = S.toClaudeRequest({ ...e, model: t }), a = this.convertToolsToClaudeFormat(this.tools);
    console.log("[ClaudeChatProvider] Converted request for tool loop", {
      model: n.model,
      system: ((l = n.system) == null ? void 0 : l.substring(0, 100)) + "...",
      messagesCount: n.messages.length,
      messages: n.messages.map((s) => {
        var r;
        return {
          role: s.role,
          contentType: typeof s.content,
          contentPreview: typeof s.content == "string" ? s.content.substring(0, 50) + "..." : `[${((r = s.content) == null ? void 0 : r.length) || 0} items]`
        };
      }),
      toolsCount: a.length,
      tools: a.map((s) => {
        var r;
        return {
          name: s.name,
          description: ((r = s.description) == null ? void 0 : r.substring(0, 50)) + "..."
        };
      }),
      shouldStream: e.streaming !== !1,
      hasOnTokenReceived: !!o
    });
    try {
      console.log("[ClaudeChatProvider] Calling ChatProviderUtils.handleToolLoop"), await P.handleToolLoop(
        this.toolHandler,
        n.model,
        n.messages,
        a,
        e,
        this.onToolUse,
        o,
        e.streaming !== !1
      ), console.log("[ClaudeChatProvider] handleToolLoop completed successfully");
    } catch (s) {
      throw console.error("[ClaudeChatProvider] Tool-enabled chat failed:", {
        error: s,
        errorMessage: s instanceof Error ? s.message : String(s),
        errorStack: s instanceof Error ? s.stack : void 0
      }), s;
    }
  }
  /**
   * Convert ToolDefinition to Claude's tool format
   */
  convertToolsToClaudeFormat(e) {
    return e.map((o) => ({
      name: o.name,
      description: o.description,
      input_schema: o.input_schema
    }));
  }
}
var R = /* @__PURE__ */ ((m) => (m.OLLAMA = "ollama", m.OPENAI = "openai", m.CLAUDE = "claude", m.PERPLEXITY = "perplexity", m))(R || {});
class j {
  /**
   * Creates an appropriate chat provider based on the provider type
   */
  static createProvider(e, o, t, n) {
    switch (e) {
      case "ollama":
        if (!o.apiKey)
          throw new Error("API key is required for Ollama provider");
        return new b(o.url, o.apiKey, o.model, t || [], n);
      case "openai":
        if (!o.apiKey)
          throw new Error("API key is required for OpenAI provider");
        return new $(o.url, o.apiKey, o.model, t || [], n);
      case "claude":
        if (!o.apiKey)
          throw new Error("API key is required for Claude provider");
        return new B(o.url, o.apiKey, o.model, t || [], n);
      case "perplexity":
        throw new Error("PerplexityChatProvider not implemented yet");
      default:
        throw new Error(`Unsupported provider type: ${e}`);
    }
  }
}
class J {
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
class W {
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
class K {
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
class X {
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
function z(m) {
  switch (m.toLowerCase()) {
    case R.OPENAI:
      return new J();
    case R.CLAUDE:
      return new W();
    case R.OLLAMA:
      return new K();
    default:
      return new X();
  }
}
class Y {
  constructor(e, o, t, n, a) {
    d(this, "accumulatedResponse", "");
    d(this, "requestStartTime");
    d(this, "firstTokenTime");
    d(this, "tokenCounter");
    d(this, "originalCallback");
    d(this, "totalTokens", 0);
    d(this, "tokensReceived", 0);
    d(this, "isFirstToken", !0);
    this.provider = e, this.model = o, this.prompt = t, this.onComplete = n, this.requestStartTime = Date.now(), this.originalCallback = a, this.tokenCounter = z(e);
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
    var l, s;
    const o = Date.now(), t = ((l = this.tokenCounter) == null ? void 0 : l.countPromptTokens(this.prompt)) ?? 0, n = ((s = this.tokenCounter) == null ? void 0 : s.estimateResponseTokens(this.accumulatedResponse)) ?? 0, a = {
      requestId: crypto.randomUUID(),
      provider: this.provider,
      model: this.model,
      requestTimestamp: this.requestStartTime,
      firstTokenTimestamp: this.firstTokenTime,
      completionTimestamp: o,
      totalDuration: o - this.requestStartTime,
      timeToFirstToken: this.firstTokenTime ? this.firstTokenTime - this.requestStartTime : void 0,
      promptTokenCount: t,
      completionTokenCount: n,
      totalTokenCount: t + n,
      tokensPerSecond: this.calculateTokensPerSecond(o),
      promptText: JSON.stringify(this.prompt),
      completeResponse: this.accumulatedResponse,
      success: !e,
      error: e ? String(e) : void 0
    };
    return this.onComplete(a), a;
  }
  /**
   * Calculate tokens per second rate
   */
  calculateTokensPerSecond(e) {
    if (!this.firstTokenTime || this.tokensReceived === 0)
      return;
    const o = (e - this.firstTokenTime) / 1e3;
    return o > 0 ? this.tokensReceived / o : void 0;
  }
}
const w = class w {
  constructor(e) {
    d(this, "config");
    d(this, "auditLogs", []);
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
    return w.instance || (w.instance = new w(e || { enabled: !0 })), w.instance;
  }
  /**
   * Create an accumulator for tracking a chat request
   */
  createAccumulator(e, o, t, n) {
    return new Y(
      e,
      o,
      t,
      (a) => this.logChatAudit(a),
      n
    );
  }
  /**
   * Create a wrapped token callback that accumulates tokens
   */
  createWrappedCallback(e, o, t) {
    const n = this.createAccumulator(
      o,
      e.model,
      e.messages,
      t
    );
    return {
      callback: (a) => n.handleToken(a),
      complete: (a) => n.complete(a)
    };
  }
  /**
   * Log the chat audit data
   */
  logChatAudit(e) {
    if (!this.config.enabled) return;
    this.auditLogs.push(e);
    const o = this.applyPrivacyFilters(e);
    this.config.logToConsole && console.log(`[AUDIT] Chat completed: ${o.provider}/${o.model} (${o.totalDuration}ms)`, o), this.config.logToServer && this.config.serverEndpoint && this.sendToServer(o, this.config.serverEndpoint);
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
    const o = { ...e };
    return this.config.includePromptText || (o.promptText = "[REDACTED]"), this.config.includeResponseText || (o.completeResponse = "[REDACTED]"), o;
  }
  /**
   * Send audit data to a server endpoint
   */
  async sendToServer(e, o) {
    try {
      const t = await fetch(o, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(e)
      });
      t.ok || console.error(`Failed to send audit data to server: ${t.status} ${t.statusText}`);
    } catch (t) {
      console.error("Error sending audit data to server:", t);
    }
  }
};
d(w, "instance");
let A = w;
class ee {
  /**
   * Create a ChatService with the specified provider and configuration
   */
  constructor(e, o, t = !0, n, a) {
    d(this, "provider");
    d(this, "providerType");
    d(this, "config");
    d(this, "auditService");
    d(this, "tools");
    d(this, "onToolUse");
    this.providerType = e, this.config = o, this.tools = n, this.onToolUse = a, this.provider = this.initializeProvider(), this.auditService = A.getInstance({
      enabled: t,
      logToConsole: !0,
      logToServer: !1
    });
  }
  /**
   * Initialize the appropriate provider based on provider type
   */
  initializeProvider() {
    return j.createProvider(this.providerType, this.config, this.tools, this.onToolUse);
  }
  /**
   * Send a chat request and handle streaming response
   */
  async chat(e, o) {
    const { callback: t, complete: n } = this.auditService.createWrappedCallback(
      e,
      this.providerType,
      o
    );
    try {
      await this.provider.chat(e, t), n();
    } catch (a) {
      throw n(a), a;
    }
  }
  /**
   * Get the audit logs for this chat service
   */
  getAuditLogs() {
    return this.auditService.getAuditLogs();
  }
}
class G {
  static toOllamaRequest(e) {
    return {
      model: e.model,
      messages: e.messages.map((o) => ({ role: o.role, content: o.content }))
    };
  }
}
class oe {
  constructor(e, o) {
    d(this, "url");
    d(this, "model");
    d(this, "ollama");
    this.url = e, this.model = o, this.ollama = new M({ host: e }), console.log("in constructor creating ollama client...");
  }
  async chat(e, o) {
    G.toOllamaRequest(e);
    const t = await this.ollama.chat({ model: e.model, messages: e.messages, stream: !0 });
    for await (const n of t) {
      const a = n.message.content;
      o && o(a);
    }
  }
}
export {
  A as AuditService,
  oe as ChatApiService,
  j as ChatProviderFactory,
  P as ChatProviderUtils,
  ee as ChatService,
  B as ClaudeChatProvider,
  F as ClaudeToolHandler,
  b as OllamaChatProvider,
  N as OllamaToolHandler,
  $ as OpenAIChatProvider,
  D as OpenAIToolHandler,
  R as ProviderType,
  Y as TokenAccumulator
};
