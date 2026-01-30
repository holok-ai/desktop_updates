var ye = Object.defineProperty;
var ve = (s, e, t) => e in s ? ye(s, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : s[e] = t;
var g = (s, e, t) => ve(s, typeof e != "symbol" ? e + "" : e, t);
import { Ollama as ge } from "ollama/browser";
import _e from "openai";
import Ee from "@anthropic-ai/sdk";
class V {
  /**
   * Convert internal ChatRequest to Ollama-specific format
   */
  static toOllamaRequest(e) {
    const t = e.messages.filter((i) => i.role !== "system"), o = e.system ? [{ role: "system", content: e.system }, ...t.map((i) => ({ role: i.role, content: i.content }))] : t.map((i) => ({ role: i.role, content: i.content })), n = {
      model: e.model,
      messages: o,
      stream: e.streaming !== !1
    };
    return (e.temperature !== void 0 || e.maxTokens !== void 0 || e.topP !== void 0 || e.frequencyPenalty !== void 0 || e.presencePenalty !== void 0 || e.stop !== void 0) && (n.options = {}, e.temperature !== void 0 && (n.options.temperature = e.temperature), e.maxTokens !== void 0 && (n.options.num_predict = e.maxTokens), e.topP !== void 0 && (n.options.top_p = e.topP), e.frequencyPenalty !== void 0 && (n.options.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (n.options.presence_penalty = e.presencePenalty), e.stop !== void 0 && (n.options.stop = e.stop)), e.responseFormat && (n.format = e.responseFormat), n;
  }
}
const N = class N {
  /**
   * Sets the iteration value in a branch ID string
   * Format: row.lane.chat (3 parts) or row.lane.chat.iteration (4 parts)
   *
   * @param branchId - Current branch ID string (e.g., "1.0.1" or "1.0.1.5")
   * @param iteration - Iteration number (0-9) to set
   * @returns New branch ID with iteration set
   */
  static setBranchIteration(e, t) {
    if (!e)
      return e;
    const o = e.split(".");
    return o.length === 3 ? `${e}.${t}` : o.length === 4 ? (o[3] = t.toString(), o.join(".")) : e;
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
  static async handleToolLoop(e, t, o, n, a, i, r, l = !1) {
    const h = a.thread_id;
    var m = a.branch_id;
    console.log("[ChatProviderUtils] handleToolLoop starting", {
      model: t,
      initialMessagesCount: o.length,
      toolsCount: n.length,
      originalThreadId: h,
      originalBranchId: m,
      shouldStream: l,
      hasOnTokenReceived: !!r,
      maxIterations: N.MAX_TOOL_ITERATIONS
    });
    let d = o;
    for (let c = 0; c < N.MAX_TOOL_ITERATIONS; c++) {
      console.log("[ChatProviderUtils] handleToolLoop - Starting iteration", {
        iteration: c,
        currentMessagesCount: d.length
      }), m = N.setBranchIteration(m, c);
      const u = {
        thread_id: h,
        branch_id: m
      };
      console.log("[ChatProviderUtils] handleToolLoop - Thread context for iteration", {
        iteration: c,
        threadContext: u
      });
      const p = "setTokenCallback" in e && typeof e.setTokenCallback == "function";
      p ? (console.log("[ChatProviderUtils] handleToolLoop - Setting token callback"), e.setTokenCallback(r)) : console.log("[ChatProviderUtils] handleToolLoop - Handler does not support streaming callback"), console.log("[ChatProviderUtils] handleToolLoop - Making request to handler");
      const y = await e.makeRequest(
        t,
        d,
        n,
        u,
        l
      );
      console.log("[ChatProviderUtils] handleToolLoop - Request completed", {
        iteration: c,
        hasResponse: !!y
      });
      const I = !l || !p;
      if (console.log("[ChatProviderUtils] handleToolLoop - Text content handling", {
        iteration: c,
        shouldSendTextContent: I,
        hasStreamingCallback: p,
        shouldStream: l
      }), I) {
        const C = e.extractTextContent(y);
        console.log("[ChatProviderUtils] handleToolLoop - Extracted text content", {
          iteration: c,
          hasTextContent: !!C,
          textContentLength: (C == null ? void 0 : C.length) || 0,
          textPreview: (C == null ? void 0 : C.substring(0, 100)) + "...",
          willCallOnTokenReceived: !!(C && r)
        }), C && r && r(C);
      }
      console.log("[ChatProviderUtils] handleToolLoop - Extracting tool uses");
      const v = e.extractToolUses(y);
      console.log("[ChatProviderUtils] handleToolLoop - Tool uses extracted", {
        iteration: c,
        toolUsesCount: v.length,
        toolUses: v.map((C) => ({ id: C.id, name: C.name, inputKeys: Object.keys(C.input) }))
      });
      const T = y.stop_reason;
      if (T === "tool_use" && v.length === 0 && (console.warn('[ChatProviderUtils] handleToolLoop - MISMATCH: stop_reason="tool_use" but no tool_use blocks found in content', {
        iteration: c,
        stopReason: T,
        responseId: y.id,
        contentBlocks: y.content
      }), console.warn("[ChatProviderUtils] handleToolLoop - This may indicate a proxy is modifying Claude responses")), v.length === 0) {
        console.log("[ChatProviderUtils] handleToolLoop - No tool uses found, ending loop", {
          iteration: c,
          stopReason: T
        });
        return;
      }
      console.log("[ChatProviderUtils] handleToolLoop - Executing tools", {
        iteration: c,
        toolUsesCount: v.length
      });
      const f = [];
      for (const C of v) {
        console.log("[ChatProviderUtils] handleToolLoop - Executing tool", {
          iteration: c,
          toolId: C.id,
          toolName: C.name,
          inputKeys: Object.keys(C.input)
        });
        const E = await i(C);
        console.log("[ChatProviderUtils] handleToolLoop - Tool execution completed", {
          iteration: c,
          toolId: C.id,
          toolName: C.name,
          resultSuccess: E == null ? void 0 : E.success,
          hasResultData: !!(E != null && E.data),
          hasResultError: !!(E != null && E.error)
        }), f.push(E);
      }
      console.log("[ChatProviderUtils] handleToolLoop - All tools executed", {
        iteration: c,
        toolResultsCount: f.length
      }), console.log("[ChatProviderUtils] handleToolLoop - Formatting tool results");
      const O = e.formatToolResults(v, f);
      console.log("[ChatProviderUtils] handleToolLoop - Appending messages"), d = e.appendMessages(d, y, O), console.log("[ChatProviderUtils] handleToolLoop - Iteration complete, continuing loop", {
        iteration: c,
        newMessagesCount: d.length
      });
    }
    throw console.error("[ChatProviderUtils] handleToolLoop - Maximum iterations exceeded", {
      maxIterations: N.MAX_TOOL_ITERATIONS
    }), new Error("Tool loop exceeded maximum iterations");
  }
};
/**
 * Maximum number of tool calling iterations to prevent infinite loops
 */
g(N, "MAX_TOOL_ITERATIONS", 10);
let A = N;
class Re {
  constructor(e) {
    g(this, "onTokenReceived");
    this.ollama = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, t, o, n, a) {
    var i;
    if (console.log("[OllamaToolHandler] makeRequest called", {
      model: e,
      shouldStream: a,
      toolsCount: o.length,
      messagesCount: t.length,
      threadContext: n
    }), a) {
      console.log("[OllamaToolHandler] Using streaming mode");
      const r = await this.ollama.chat({
        ...n,
        model: e,
        messages: t,
        tools: o,
        stream: !0
      });
      let l = null, h = 0;
      for await (const m of r) {
        h++;
        const d = (i = m.message) == null ? void 0 : i.content;
        d && this.onTokenReceived && this.onTokenReceived(d), l = m;
      }
      return console.log("[OllamaToolHandler] Stream complete", {
        chunkCount: h,
        hasFinalMessage: !!l,
        finalMessageKeys: l ? Object.keys(l) : []
      }), l;
    } else {
      console.log("[OllamaToolHandler] Using non-streaming mode");
      const r = await this.ollama.chat({
        ...n,
        model: e,
        messages: t,
        tools: o,
        stream: !1
      });
      return console.log("[OllamaToolHandler] Non-streaming response received", {
        hasResponse: !!r,
        responseKeys: r ? Object.keys(r) : []
      }), r;
    }
  }
  extractToolUses(e) {
    const t = this.extractToolCalls(e.message);
    return console.log("[OllamaToolHandler] extractToolUses", {
      hasMessage: !!e.message,
      toolCallsCount: t.length,
      toolCalls: t.map((o) => ({ id: o.id, name: o.name }))
    }), t.map((o) => ({
      id: o.id,
      name: o.name,
      input: this.parseToolArguments(o.arguments)
    }));
  }
  extractTextContent(e) {
    var o;
    const t = ((o = e.message) == null ? void 0 : o.content) || null;
    return console.log("[OllamaToolHandler] extractTextContent", {
      hasContent: !!t,
      contentLength: (t == null ? void 0 : t.length) || 0
    }), t;
  }
  formatToolResults(e, t) {
    return console.log("[OllamaToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: t.length
    }), e.map((o, n) => ({
      id: o.id,
      result: JSON.stringify(t[n])
    }));
  }
  appendMessages(e, t, o) {
    var a, i;
    console.log("[OllamaToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length,
      hasResponseMessage: !!t.message
    });
    const n = [
      ...e,
      {
        role: "assistant",
        content: ((a = t.message) == null ? void 0 : a.content) || "",
        tool_calls: ((i = t.message) == null ? void 0 : i.tool_calls) || []
      }
    ];
    for (const r of o)
      n.push({
        role: "tool",
        content: r.result
      });
    return console.log("[OllamaToolHandler] appendMessages complete", {
      newMessagesCount: n.length
    }), n;
  }
  /**
   * Extract tool calls from Ollama message
   */
  extractToolCalls(e) {
    var o;
    if (console.log("[OllamaToolHandler] extractToolCalls", {
      hasMessage: !!e,
      hasToolCalls: !!(e != null && e.tool_calls),
      isArray: Array.isArray(e == null ? void 0 : e.tool_calls),
      toolCallsLength: ((o = e == null ? void 0 : e.tool_calls) == null ? void 0 : o.length) || 0,
      messageKeys: e ? Object.keys(e) : []
    }), !(e != null && e.tool_calls) || !Array.isArray(e.tool_calls))
      return [];
    const t = e.tool_calls.map((n, a) => {
      var i, r;
      return {
        id: n.id || `tool_${a}`,
        name: ((i = n.function) == null ? void 0 : i.name) || n.name || "",
        arguments: ((r = n.function) == null ? void 0 : r.arguments) || n.arguments || {}
      };
    });
    return console.log("[OllamaToolHandler] extractToolCalls result", {
      extractedCount: t.length,
      calls: t.map((n) => ({ id: n.id, name: n.name }))
    }), t;
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
class Oe {
  constructor(e, t, o, n = [], a) {
    g(this, "ollama");
    g(this, "defaultModel");
    g(this, "tools");
    g(this, "onToolUse");
    g(this, "toolHandler");
    this.ollama = new ge({ host: e, headers: {
      "X-api-key": t
    } }), this.defaultModel = o, this.tools = n, this.onToolUse = a, n.length > 0 && (this.toolHandler = new Re(this.ollama)), console.log(`OllamaChatProvider initialized with endpoint ${e} and model ${o}${n.length > 0 ? ` and ${n.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Ollama
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    var l, h;
    const o = e;
    if (console.log("[OllamaChatProvider] chat called", {
      hasThreadId: !!o.thread_id,
      thread_id: o.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    const n = e.model || this.defaultModel, a = { ...e, model: n }, i = V.toOllamaRequest(a);
    let r = {};
    if (o.thread_id) {
      const m = A.setBranchIteration(e.branch_id, 0);
      r = {
        thread_id: o.thread_id,
        branch_id: m
      };
    }
    try {
      if (i.stream) {
        const m = await this.ollama.chat({
          ...r,
          ...i,
          stream: !0
        });
        for await (const d of m) {
          const c = (l = d.message) == null ? void 0 : l.content;
          c && t && t(c);
        }
      } else {
        const d = (h = (await this.ollama.chat({
          ...r,
          ...i,
          stream: !1
        })).message) == null ? void 0 : h.content;
        d && t && t(d);
      }
    } catch (m) {
      throw console.error("Error in Ollama API call:", m), m;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, t) {
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const o = e.model || this.defaultModel, n = { ...e, model: o }, a = V.toOllamaRequest(n), i = this.convertToolsToOllamaFormat(this.tools);
    try {
      await A.handleToolLoop(
        this.toolHandler,
        a.model,
        a.messages || [],
        i,
        e,
        this.onToolUse,
        t,
        e.streaming !== !1
      );
    } catch (r) {
      throw console.error("[OllamaChatProvider] Tool-enabled chat failed:", r), r;
    }
  }
  /**
   * Convert ToolDefinition to Ollama's tools format
   */
  convertToolsToOllamaFormat(e) {
    return e.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    }));
  }
  /**
   * Extract tool calls from Ollama response
   */
  extractToolCalls(e) {
    return !e.tool_calls || !Array.isArray(e.tool_calls) ? [] : e.tool_calls.map((t, o) => ({
      id: `call_${Date.now()}_${o}`,
      name: t.function.name,
      arguments: t.function.arguments
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
        const t = JSON.parse(e);
        return t && typeof t == "object" && !Array.isArray(t) ? t : {};
      } catch (t) {
        return console.warn("[OllamaChatProvider] Failed to parse tool arguments", { error: t, raw: e }), {};
      }
    return {};
  }
}
class X {
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
    let t;
    if (e.system) {
      const n = e.messages.filter((a) => a.role !== "system");
      t = [
        { role: "system", content: e.system },
        ...n.map((a) => this.mapMessage(a))
      ];
    } else
      t = e.messages.map((n) => this.mapMessage(n));
    const o = {
      model: e.model,
      messages: t,
      stream: e.streaming !== !1
    };
    return e.temperature !== void 0 && (o.temperature = e.temperature), e.maxTokens !== void 0 && (o.max_tokens = e.maxTokens), e.topP !== void 0 && (o.top_p = e.topP), e.frequencyPenalty !== void 0 && (o.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (o.presence_penalty = e.presencePenalty), e.stop !== void 0 && (o.stop = e.stop), e.responseFormat !== void 0 && (o.response_format = e.responseFormat), o;
  }
}
class we {
  constructor(e) {
    g(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, t, o, n, a) {
    return console.log("[OpenAIToolHandler] makeRequest called", {
      model: e,
      shouldStream: a,
      toolsCount: o.length,
      messagesCount: t.length,
      threadContext: n
    }), a ? (console.log("[OpenAIToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, t, o, n)) : (console.log("[OpenAIToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, t, o, n));
  }
  extractToolUses(e) {
    var o, n, a, i, r, l, h;
    const t = e.choices[0];
    if (console.log("[OpenAIToolHandler] extractToolUses", {
      hasChoice: !!t,
      finishReason: t == null ? void 0 : t.finish_reason,
      hasToolCalls: !!((o = t == null ? void 0 : t.message) != null && o.tool_calls),
      toolCallsCount: ((a = (n = t == null ? void 0 : t.message) == null ? void 0 : n.tool_calls) == null ? void 0 : a.length) || 0,
      hasFunctionCall: !!((i = t == null ? void 0 : t.message) != null && i.function_call)
    }), (t == null ? void 0 : t.finish_reason) === "tool_calls" || (r = t == null ? void 0 : t.message) != null && r.tool_calls) {
      const m = (l = t == null ? void 0 : t.message) == null ? void 0 : l.tool_calls;
      if (m && m.length > 0) {
        const d = m.map((c) => ({
          id: c.id,
          name: c.function.name,
          input: this.parseToolArguments(c.function.arguments)
        }));
        return console.log("[OpenAIToolHandler] Extracted tool uses (tool_calls format)", {
          count: d.length,
          tools: d.map((c) => ({ id: c.id, name: c.name }))
        }), d;
      }
    }
    if ((t == null ? void 0 : t.finish_reason) === "function_call") {
      const m = (h = t == null ? void 0 : t.message) == null ? void 0 : h.function_call;
      if (m) {
        const d = {
          id: `call_${Date.now()}`,
          name: m.name,
          input: this.parseToolArguments(m.arguments || "{}")
        };
        return console.log("[OpenAIToolHandler] Extracted tool use (function_call format)", {
          id: d.id,
          name: d.name
        }), [d];
      }
    }
    return console.log("[OpenAIToolHandler] No tool uses found"), [];
  }
  extractTextContent(e) {
    var o, n;
    const t = (n = (o = e.choices[0]) == null ? void 0 : o.message) == null ? void 0 : n.content;
    return console.log("[OpenAIToolHandler] extractTextContent", {
      hasContent: !!t,
      contentLength: (t == null ? void 0 : t.length) || 0
    }), t || null;
  }
  formatToolResults(e, t) {
    return console.log("[OpenAIToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: t.length
    }), e.map((o, n) => ({
      role: "tool",
      tool_call_id: o.id,
      content: JSON.stringify(t[n])
    }));
  }
  appendMessages(e, t, o) {
    var i;
    console.log("[OpenAIToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length,
      hasResponseMessage: !!((i = t.choices[0]) != null && i.message)
    });
    const n = {
      role: "assistant",
      content: t.choices[0].message.content,
      tool_calls: t.choices[0].message.tool_calls
    }, a = [
      ...e,
      n,
      ...o
    ];
    return console.log("[OpenAIToolHandler] appendMessages complete", {
      newMessagesCount: a.length
    }), a;
  }
  /**
   * Make a streaming request to OpenAI API
   */
  async makeStreamingRequest(e, t, o, n) {
    var a, i, r, l;
    console.log("[OpenAIToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: n
    });
    try {
      const h = Date.now(), m = await this.client.chat.completions.create({
        ...n,
        model: e,
        messages: t,
        tools: o,
        stream: !0
      });
      console.log("[OpenAIToolHandler] Stream received, processing chunks");
      let d = "", c = [], u = null, p = 0;
      for await (const I of m) {
        p++;
        const v = I.choices[0], T = v == null ? void 0 : v.delta;
        if (T != null && T.content && (d += T.content, this.onTokenReceived && this.onTokenReceived(T.content)), T != null && T.tool_calls)
          for (const f of T.tool_calls) {
            const O = f.index;
            c[O] ? (f.id && (c[O].id += f.id), (r = f.function) != null && r.name && (c[O].function.name += f.function.name), (l = f.function) != null && l.arguments && (c[O].function.arguments += f.function.arguments)) : c[O] = {
              id: f.id || "",
              type: "function",
              function: {
                name: ((a = f.function) == null ? void 0 : a.name) || "",
                arguments: ((i = f.function) == null ? void 0 : i.arguments) || ""
              }
            };
          }
        v != null && v.finish_reason && (u = v.finish_reason);
      }
      const y = Date.now() - h;
      return console.log("[OpenAIToolHandler] makeStreamingRequest complete", {
        duration: `${y}ms`,
        chunkCount: p,
        accumulatedContentLength: d.length,
        toolCallsCount: c.length,
        finishReason: u
      }), {
        choices: [
          {
            finish_reason: u || "stop",
            message: {
              role: "assistant",
              content: d || null,
              tool_calls: c.length > 0 ? c : void 0
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
    } catch (h) {
      throw console.error("[OpenAIToolHandler] makeStreamingRequest failed", {
        error: h,
        errorMessage: h instanceof Error ? h.message : String(h),
        errorStack: h instanceof Error ? h.stack : void 0
      }), h;
    }
  }
  /**
   * Make a non-streaming request to OpenAI API
   */
  async makeNonStreamingRequest(e, t, o, n) {
    var a, i, r, l, h, m, d, c, u, p, y, I, v;
    console.log("[OpenAIToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: n
    });
    try {
      const T = Date.now(), f = await this.client.chat.completions.create({
        ...n,
        model: e,
        messages: t,
        tools: o,
        stream: !1
      }), O = Date.now() - T;
      return console.log("[OpenAIToolHandler] makeNonStreamingRequest response received", {
        duration: `${O}ms`,
        hasResponse: !!f,
        hasChoices: !!f.choices,
        choicesCount: ((a = f.choices) == null ? void 0 : a.length) || 0,
        finishReason: (r = (i = f.choices) == null ? void 0 : i[0]) == null ? void 0 : r.finish_reason,
        hasContent: !!((m = (h = (l = f.choices) == null ? void 0 : l[0]) == null ? void 0 : h.message) != null && m.content),
        hasToolCalls: !!((u = (c = (d = f.choices) == null ? void 0 : d[0]) == null ? void 0 : c.message) != null && u.tool_calls),
        toolCallsCount: ((v = (I = (y = (p = f.choices) == null ? void 0 : p[0]) == null ? void 0 : y.message) == null ? void 0 : I.tool_calls) == null ? void 0 : v.length) || 0
      }), f;
    } catch (T) {
      throw console.error("[OpenAIToolHandler] makeNonStreamingRequest failed", {
        error: T,
        errorMessage: T instanceof Error ? T.message : String(T),
        errorStack: T instanceof Error ? T.stack : void 0
      }), T;
    }
  }
  /**
   * Parse tool arguments from string
   */
  parseToolArguments(e) {
    if (!e)
      return {};
    try {
      const t = JSON.parse(e);
      return t && typeof t == "object" && !Array.isArray(t) ? t : {};
    } catch (t) {
      return console.warn("[OpenAIToolHandler] Failed to parse tool arguments", { error: t, raw: e }), {};
    }
  }
}
class Ie {
  constructor(e, t, o, n = [], a) {
    g(this, "client");
    g(this, "defaultModel");
    g(this, "tools");
    g(this, "onToolUse");
    g(this, "toolHandler");
    this.client = new _e({ apiKey: t, baseURL: e, dangerouslyAllowBrowser: !0 }), this.defaultModel = o || "gpt-3.5-turbo", this.tools = n, this.onToolUse = a, n.length > 0 && (this.toolHandler = new we(this.client)), console.log(`OpenAIChatProvider initialized with model ${this.defaultModel}${n.length > 0 ? ` and ${n.length} tools` : ""}`);
  }
  /**
   * Send a chat request to OpenAI
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    var r, l, h, m;
    const o = e;
    if (console.log("[OpenAIChatProvider] chat called", {
      hasThreadId: !!o.thread_id,
      thread_id: o.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    const n = e.model || this.defaultModel, a = X.toOpenAIRequest({ ...e, model: n });
    let i = {};
    if (o.thread_id) {
      const d = A.setBranchIteration(e.branch_id, 0);
      i = {
        thread_id: o.thread_id,
        branch_id: d
      };
    }
    try {
      if (e.streaming !== !1) {
        const d = {
          model: a.model,
          messages: a.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens,
          top_p: e.topP,
          frequency_penalty: e.frequencyPenalty,
          presence_penalty: e.presencePenalty,
          stop: e.stop,
          stream: !0,
          ...i
        };
        e.responseFormat !== void 0 && (d.response_format = e.responseFormat);
        const c = await this.client.chat.completions.create(d);
        for await (const u of c) {
          const p = ((l = (r = u.choices[0]) == null ? void 0 : r.delta) == null ? void 0 : l.content) || "";
          p && t && t(p);
        }
      } else {
        const d = {
          model: a.model,
          messages: a.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens,
          top_p: e.topP,
          frequency_penalty: e.frequencyPenalty,
          presence_penalty: e.presencePenalty,
          stop: e.stop,
          ...i
        };
        e.responseFormat !== void 0 && (d.response_format = {
          type: "json_schema",
          json_schema: {
            name: "schema_name",
            schema: e.responseFormat,
            strict: !0
          }
        });
        const u = ((m = (h = (await this.client.chat.completions.create(d)).choices[0]) == null ? void 0 : h.message) == null ? void 0 : m.content) || "";
        u && t && t(u);
      }
    } catch (d) {
      throw console.error("Error in OpenAI API call:", d), d;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, t) {
    if (console.log("[OpenAIChatProvider] chatWithTools called", {
      hasToolHandler: !!this.toolHandler,
      hasOnToolUse: !!this.onToolUse,
      toolsCount: this.tools.length
    }), !this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const o = e.model || this.defaultModel, n = X.toOpenAIRequest({ ...e, model: o }), a = this.convertToolsToOpenAIFormat(this.tools);
    console.log("[OpenAIChatProvider] Converted request", {
      model: n.model,
      messagesCount: n.messages.length,
      toolsCount: a.length,
      shouldStream: e.streaming !== !1
    });
    try {
      console.log("[OpenAIChatProvider] Calling ChatProviderUtils.handleToolLoop"), await A.handleToolLoop(
        this.toolHandler,
        n.model,
        n.messages,
        a,
        e,
        this.onToolUse,
        t,
        e.streaming !== !1
      ), console.log("[OpenAIChatProvider] handleToolLoop completed");
    } catch (i) {
      throw console.error("[OpenAIChatProvider] Tool-enabled chat failed:", i), i;
    }
  }
  /**
   * Convert ToolDefinition to OpenAI's tools format (new API)
   */
  convertToolsToOpenAIFormat(e) {
    return e.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    }));
  }
}
class z {
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
    const t = e.messages.filter((n) => n.role !== "system"), o = {
      model: e.model,
      messages: t.map((n) => this.mapMessage(n)),
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
      o.system = n;
    }
    return e.temperature !== void 0 && (o.temperature = e.temperature), e.maxTokens !== void 0 && (o.max_tokens = e.maxTokens), e.topP !== void 0 && (o.top_p = e.topP), e.stop !== void 0 && (o.stop_sequences = e.stop), o;
  }
}
class Ae {
  constructor(e) {
    g(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   * This is called before each tool loop iteration to update the callback
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, t, o, n, a) {
    return console.log("[ClaudeToolHandler] makeRequest called", {
      model: e,
      shouldStream: a,
      toolsCount: o.length,
      messagesCount: t.length,
      threadContext: n,
      tools: o.map((i) => {
        var r;
        return {
          name: i.name,
          description: ((r = i.description) == null ? void 0 : r.substring(0, 50)) + "..."
        };
      }),
      messages: t.map((i) => ({
        role: i.role,
        contentType: Array.isArray(i.content) ? "array" : typeof i.content,
        contentPreview: Array.isArray(i.content) ? `[${i.content.length} blocks]` : typeof i.content == "string" ? i.content.substring(0, 50) + "..." : "N/A"
      }))
    }), a ? (console.log("[ClaudeToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, t, o, n)) : (console.log("[ClaudeToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, t, o, n));
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
    const t = this.extractToolUseBlocks(e.content);
    return console.log("[ClaudeToolHandler] extractToolUses - Extracted tools", {
      contentBlocksCount: e.content.length,
      toolUseBlocksCount: t.length,
      toolUses: t.map((o) => ({
        id: o.id,
        name: o.name,
        inputKeys: Object.keys(o.input)
      }))
    }), t.map((o) => ({
      id: o.id,
      name: o.name,
      input: o.input
    }));
  }
  extractTextContent(e) {
    const t = e.content.filter((o) => o.type === "text").map((o) => o.text).join("");
    return console.log("[ClaudeToolHandler] extractTextContent", {
      hasContent: !!t,
      contentLength: (t == null ? void 0 : t.length) || 0
    }), t || null;
  }
  formatToolResults(e, t) {
    console.log("[ClaudeToolHandler] formatToolResults - Input", {
      toolUsesCount: e.length,
      resultsCount: t.length,
      toolUses: e.map((n) => ({ id: n.id, name: n.name })),
      results: t.map((n) => ({
        success: n == null ? void 0 : n.success,
        hasData: !!(n != null && n.data),
        hasError: !!(n != null && n.error)
      }))
    });
    const o = e.map((n, a) => {
      const i = t[a], r = {
        type: "tool_result",
        tool_use_id: n.id,
        content: JSON.stringify({
          success: (i == null ? void 0 : i.success) ?? !1,
          data: (i == null ? void 0 : i.data) ?? null,
          error: (i == null ? void 0 : i.error) ?? null
        })
      };
      return console.log("[ClaudeToolHandler] formatToolResults - Formatted result", {
        toolUseId: n.id,
        toolName: n.name,
        resultSuccess: i == null ? void 0 : i.success,
        formattedContentLength: r.content.length
      }), r;
    });
    return console.log("[ClaudeToolHandler] formatToolResults - Output", {
      formattedResultsCount: o.length
    }), o;
  }
  appendMessages(e, t, o) {
    console.log("[ClaudeToolHandler] appendMessages - Input state", {
      currentMessagesCount: e.length,
      currentMessages: e.map((r) => ({
        role: r.role,
        contentType: Array.isArray(r.content) ? "array" : typeof r.content,
        contentLength: Array.isArray(r.content) || typeof r.content == "string" ? r.content.length : "N/A"
      })),
      responseContentBlocks: t.content.length,
      responseContentTypes: t.content.map((r) => r.type),
      toolResultsCount: o.length
    });
    const n = {
      role: "assistant",
      content: t.content
    }, a = {
      role: "user",
      content: o
    };
    console.log("[ClaudeToolHandler] appendMessages - New messages being added", {
      assistantMessageContentBlocks: n.content.length,
      userMessageToolResults: a.content.length
    });
    const i = [
      ...e,
      n,
      a
    ];
    return console.log("[ClaudeToolHandler] appendMessages - Output state", {
      newMessagesCount: i.length,
      lastTwoMessages: i.slice(-2).map((r) => ({
        role: r.role,
        contentType: Array.isArray(r.content) ? "array" : typeof r.content,
        contentLength: Array.isArray(r.content) || typeof r.content == "string" ? r.content.length : "N/A"
      }))
    }), i;
  }
  /**
   * Make a streaming request to Claude API
   * Streams text tokens in real-time while collecting the final message for tool extraction
   */
  async makeStreamingRequest(e, t, o, n) {
    var a, i;
    console.log("[ClaudeToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: n
    });
    try {
      const r = Date.now();
      let l = 0, h = 0;
      const m = this.client.messages.stream({
        model: e,
        messages: t,
        tools: o,
        max_tokens: 4096,
        stream: !0,
        ...n
      }).on("text", (u) => {
        l++, this.onTokenReceived && this.onTokenReceived(u);
      }).on("contentBlock", (u) => {
        h++, console.log("[ClaudeToolHandler] Stream contentBlock event", {
          contentBlockCount: h,
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
          contentTypes: u.content.map((p) => p.type)
        });
      });
      console.log("[ClaudeToolHandler] Stream started, waiting for final message");
      const d = await m.finalMessage(), c = Date.now() - r;
      return console.log("[ClaudeToolHandler] makeStreamingRequest complete", {
        duration: `${c}ms`,
        hasMessage: !!d,
        responseId: d.id,
        model: d.model,
        stopReason: d.stop_reason,
        contentBlocksCount: ((a = d.content) == null ? void 0 : a.length) || 0,
        contentBlockTypes: ((i = d.content) == null ? void 0 : i.map((u) => u.type)) || [],
        totalTokensStreamed: l,
        usage: d.usage
      }), d;
    } catch (r) {
      throw console.error("[ClaudeToolHandler] makeStreamingRequest failed", {
        error: r,
        errorMessage: r instanceof Error ? r.message : String(r),
        errorStack: r instanceof Error ? r.stack : void 0
      }), r;
    }
  }
  /**
   * Make a non-streaming request to Claude API
   */
  async makeNonStreamingRequest(e, t, o, n) {
    var a, i;
    console.log("[ClaudeToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: n
    });
    try {
      const r = Date.now(), l = await this.client.messages.create({
        model: e,
        messages: t,
        tools: o,
        max_tokens: 4096,
        stream: !1,
        ...n
      }), h = Date.now() - r;
      return console.log("[ClaudeToolHandler] makeNonStreamingRequest response received", {
        duration: `${h}ms`,
        hasResponse: !!l,
        responseId: l.id,
        model: l.model,
        stopReason: l.stop_reason,
        contentBlocksCount: ((a = l.content) == null ? void 0 : a.length) || 0,
        contentBlockTypes: ((i = l.content) == null ? void 0 : i.map((m) => m.type)) || [],
        usage: l.usage
      }), l;
    } catch (r) {
      throw console.error("[ClaudeToolHandler] makeNonStreamingRequest failed", {
        error: r,
        errorMessage: r instanceof Error ? r.message : String(r),
        errorStack: r instanceof Error ? r.stack : void 0
      }), r;
    }
  }
  /**
   * Extract tool_use blocks from response content
   */
  extractToolUseBlocks(e) {
    return e.filter((t) => t.type === "tool_use");
  }
}
class Se {
  constructor(e, t, o, n = [], a) {
    g(this, "client");
    g(this, "defaultModel");
    g(this, "tools");
    g(this, "onToolUse");
    g(this, "toolHandler");
    this.client = new Ee({
      apiKey: t,
      dangerouslyAllowBrowser: !0
    }), e && (this.client.baseURL = e), this.defaultModel = o || "claude-3-opus-20240229", this.tools = n, this.onToolUse = a, n.length > 0 && (this.toolHandler = new Ae(this.client)), console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}${n.length > 0 ? ` and ${n.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Claude
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    const o = e;
    if (console.log("[ClaudeChatProvider] chat called", {
      hasThreadId: !!o.thread_id,
      thread_id: o.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    const n = e.model || this.defaultModel, a = z.toClaudeRequest({ ...e, model: n });
    let i = {};
    if (o.thread_id) {
      const r = A.setBranchIteration(e.branch_id, 0);
      i = {
        thread_id: o.thread_id,
        branch_id: r
      };
    }
    try {
      if (e.streaming !== !1) {
        const r = this.client.messages.stream({
          ...i,
          model: a.model,
          messages: a.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          stream: !0,
          system: a.system
        }).on("text", (h) => {
          t && t(h);
        });
        console.log("waiting for final message");
        const l = await r.finalMessage();
        console.log(l);
      } else {
        const r = await this.client.messages.create({
          ...i,
          model: a.model,
          messages: a.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          system: a.system
        });
        if (r.content && r.content.length > 0) {
          const l = r.content.filter((h) => h.type === "text").map((h) => h.text).join("");
          t && t(l);
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
  async chatWithTools(e, t) {
    var i;
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
    const o = e.model || this.defaultModel, n = z.toClaudeRequest({ ...e, model: o }), a = this.convertToolsToClaudeFormat(this.tools);
    console.log("[ClaudeChatProvider] Converted request for tool loop", {
      model: n.model,
      system: ((i = n.system) == null ? void 0 : i.substring(0, 100)) + "...",
      messagesCount: n.messages.length,
      messages: n.messages.map((r) => {
        var l;
        return {
          role: r.role,
          contentType: typeof r.content,
          contentPreview: typeof r.content == "string" ? r.content.substring(0, 50) + "..." : `[${((l = r.content) == null ? void 0 : l.length) || 0} items]`
        };
      }),
      toolsCount: a.length,
      tools: a.map((r) => {
        var l;
        return {
          name: r.name,
          description: ((l = r.description) == null ? void 0 : l.substring(0, 50)) + "..."
        };
      }),
      shouldStream: e.streaming !== !1,
      hasOnTokenReceived: !!t
    });
    try {
      console.log("[ClaudeChatProvider] Calling ChatProviderUtils.handleToolLoop"), await A.handleToolLoop(
        this.toolHandler,
        n.model,
        n.messages,
        a,
        e,
        this.onToolUse,
        t,
        e.streaming !== !1
      ), console.log("[ClaudeChatProvider] handleToolLoop completed successfully");
    } catch (r) {
      throw console.error("[ClaudeChatProvider] Tool-enabled chat failed:", {
        error: r,
        errorMessage: r instanceof Error ? r.message : String(r),
        errorStack: r instanceof Error ? r.stack : void 0
      }), r;
    }
  }
  /**
   * Convert ToolDefinition to Claude's tool format
   */
  convertToolsToClaudeFormat(e) {
    return e.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema
    }));
  }
}
var Q;
(function(s) {
  s.STRING = "string", s.NUMBER = "number", s.INTEGER = "integer", s.BOOLEAN = "boolean", s.ARRAY = "array", s.OBJECT = "object";
})(Q || (Q = {}));
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var Z;
(function(s) {
  s.LANGUAGE_UNSPECIFIED = "language_unspecified", s.PYTHON = "python";
})(Z || (Z = {}));
var q;
(function(s) {
  s.OUTCOME_UNSPECIFIED = "outcome_unspecified", s.OUTCOME_OK = "outcome_ok", s.OUTCOME_FAILED = "outcome_failed", s.OUTCOME_DEADLINE_EXCEEDED = "outcome_deadline_exceeded";
})(q || (q = {}));
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ee = ["user", "model", "function", "system"];
var te;
(function(s) {
  s.HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED", s.HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH", s.HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT", s.HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT", s.HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT";
})(te || (te = {}));
var oe;
(function(s) {
  s.HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED", s.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", s.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", s.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", s.BLOCK_NONE = "BLOCK_NONE";
})(oe || (oe = {}));
var ne;
(function(s) {
  s.HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED", s.NEGLIGIBLE = "NEGLIGIBLE", s.LOW = "LOW", s.MEDIUM = "MEDIUM", s.HIGH = "HIGH";
})(ne || (ne = {}));
var se;
(function(s) {
  s.BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED", s.SAFETY = "SAFETY", s.OTHER = "OTHER";
})(se || (se = {}));
var U;
(function(s) {
  s.FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED", s.STOP = "STOP", s.MAX_TOKENS = "MAX_TOKENS", s.SAFETY = "SAFETY", s.RECITATION = "RECITATION", s.LANGUAGE = "LANGUAGE", s.OTHER = "OTHER";
})(U || (U = {}));
var ae;
(function(s) {
  s.TASK_TYPE_UNSPECIFIED = "TASK_TYPE_UNSPECIFIED", s.RETRIEVAL_QUERY = "RETRIEVAL_QUERY", s.RETRIEVAL_DOCUMENT = "RETRIEVAL_DOCUMENT", s.SEMANTIC_SIMILARITY = "SEMANTIC_SIMILARITY", s.CLASSIFICATION = "CLASSIFICATION", s.CLUSTERING = "CLUSTERING";
})(ae || (ae = {}));
var ie;
(function(s) {
  s.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", s.AUTO = "AUTO", s.ANY = "ANY", s.NONE = "NONE";
})(ie || (ie = {}));
var re;
(function(s) {
  s.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", s.MODE_DYNAMIC = "MODE_DYNAMIC";
})(re || (re = {}));
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class w extends Error {
  constructor(e) {
    super(`[GoogleGenerativeAI Error]: ${e}`);
  }
}
class P extends w {
  constructor(e, t) {
    super(e), this.response = t;
  }
}
class pe extends w {
  constructor(e, t, o, n) {
    super(e), this.status = t, this.statusText = o, this.errorDetails = n;
  }
}
class x extends w {
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ke = "https://generativelanguage.googleapis.com", Me = "v1beta", xe = "0.21.0", Ne = "genai-js";
var H;
(function(s) {
  s.GENERATE_CONTENT = "generateContent", s.STREAM_GENERATE_CONTENT = "streamGenerateContent", s.COUNT_TOKENS = "countTokens", s.EMBED_CONTENT = "embedContent", s.BATCH_EMBED_CONTENTS = "batchEmbedContents";
})(H || (H = {}));
class be {
  constructor(e, t, o, n, a) {
    this.model = e, this.task = t, this.apiKey = o, this.stream = n, this.requestOptions = a;
  }
  toString() {
    var e, t;
    const o = ((e = this.requestOptions) === null || e === void 0 ? void 0 : e.apiVersion) || Me;
    let a = `${((t = this.requestOptions) === null || t === void 0 ? void 0 : t.baseUrl) || ke}/${o}/${this.model}:${this.task}`;
    return this.stream && (a += "?alt=sse"), a;
  }
}
function He(s) {
  const e = [];
  return s != null && s.apiClient && e.push(s.apiClient), e.push(`${Ne}/${xe}`), e.join(" ");
}
async function Pe(s) {
  var e;
  const t = new Headers();
  t.append("Content-Type", "application/json"), t.append("x-goog-api-client", He(s.requestOptions)), t.append("x-goog-api-key", s.apiKey);
  let o = (e = s.requestOptions) === null || e === void 0 ? void 0 : e.customHeaders;
  if (o) {
    if (!(o instanceof Headers))
      try {
        o = new Headers(o);
      } catch (n) {
        throw new x(`unable to convert customHeaders value ${JSON.stringify(o)} to Headers: ${n.message}`);
      }
    for (const [n, a] of o.entries()) {
      if (n === "x-goog-api-key")
        throw new x(`Cannot set reserved header name ${n}`);
      if (n === "x-goog-api-client")
        throw new x(`Header name ${n} can only be set using the apiClient field`);
      t.append(n, a);
    }
  }
  return t;
}
async function Ue(s, e, t, o, n, a) {
  const i = new be(s, e, t, o, a);
  return {
    url: i.toString(),
    fetchOptions: Object.assign(Object.assign({}, Fe(a)), { method: "POST", headers: await Pe(i), body: n })
  };
}
async function D(s, e, t, o, n, a = {}, i = fetch) {
  const { url: r, fetchOptions: l } = await Ue(s, e, t, o, n, a);
  return Le(r, l, i);
}
async function Le(s, e, t = fetch) {
  let o;
  try {
    o = await t(s, e);
  } catch (n) {
    Ge(n, s);
  }
  return o.ok || await De(o, s), o;
}
function Ge(s, e) {
  let t = s;
  throw s instanceof pe || s instanceof x || (t = new w(`Error fetching from ${e.toString()}: ${s.message}`), t.stack = s.stack), t;
}
async function De(s, e) {
  let t = "", o;
  try {
    const n = await s.json();
    t = n.error.message, n.error.details && (t += ` ${JSON.stringify(n.error.details)}`, o = n.error.details);
  } catch {
  }
  throw new pe(`Error fetching from ${e.toString()}: [${s.status} ${s.statusText}] ${t}`, s.status, s.statusText, o);
}
function Fe(s) {
  const e = {};
  if ((s == null ? void 0 : s.signal) !== void 0 || (s == null ? void 0 : s.timeout) >= 0) {
    const t = new AbortController();
    (s == null ? void 0 : s.timeout) >= 0 && setTimeout(() => t.abort(), s.timeout), s != null && s.signal && s.signal.addEventListener("abort", () => {
      t.abort();
    }), e.signal = t.signal;
  }
  return e;
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Y(s) {
  return s.text = () => {
    if (s.candidates && s.candidates.length > 0) {
      if (s.candidates.length > 1 && console.warn(`This response had ${s.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`), $(s.candidates[0]))
        throw new P(`${M(s)}`, s);
      return $e(s);
    } else if (s.promptFeedback)
      throw new P(`Text not available. ${M(s)}`, s);
    return "";
  }, s.functionCall = () => {
    if (s.candidates && s.candidates.length > 0) {
      if (s.candidates.length > 1 && console.warn(`This response had ${s.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`), $(s.candidates[0]))
        throw new P(`${M(s)}`, s);
      return console.warn("response.functionCall() is deprecated. Use response.functionCalls() instead."), le(s)[0];
    } else if (s.promptFeedback)
      throw new P(`Function call not available. ${M(s)}`, s);
  }, s.functionCalls = () => {
    if (s.candidates && s.candidates.length > 0) {
      if (s.candidates.length > 1 && console.warn(`This response had ${s.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`), $(s.candidates[0]))
        throw new P(`${M(s)}`, s);
      return le(s);
    } else if (s.promptFeedback)
      throw new P(`Function call not available. ${M(s)}`, s);
  }, s;
}
function $e(s) {
  var e, t, o, n;
  const a = [];
  if (!((t = (e = s.candidates) === null || e === void 0 ? void 0 : e[0].content) === null || t === void 0) && t.parts)
    for (const i of (n = (o = s.candidates) === null || o === void 0 ? void 0 : o[0].content) === null || n === void 0 ? void 0 : n.parts)
      i.text && a.push(i.text), i.executableCode && a.push("\n```" + i.executableCode.language + `
` + i.executableCode.code + "\n```\n"), i.codeExecutionResult && a.push("\n```\n" + i.codeExecutionResult.output + "\n```\n");
  return a.length > 0 ? a.join("") : "";
}
function le(s) {
  var e, t, o, n;
  const a = [];
  if (!((t = (e = s.candidates) === null || e === void 0 ? void 0 : e[0].content) === null || t === void 0) && t.parts)
    for (const i of (n = (o = s.candidates) === null || o === void 0 ? void 0 : o[0].content) === null || n === void 0 ? void 0 : n.parts)
      i.functionCall && a.push(i.functionCall);
  if (a.length > 0)
    return a;
}
const je = [
  U.RECITATION,
  U.SAFETY,
  U.LANGUAGE
];
function $(s) {
  return !!s.finishReason && je.includes(s.finishReason);
}
function M(s) {
  var e, t, o;
  let n = "";
  if ((!s.candidates || s.candidates.length === 0) && s.promptFeedback)
    n += "Response was blocked", !((e = s.promptFeedback) === null || e === void 0) && e.blockReason && (n += ` due to ${s.promptFeedback.blockReason}`), !((t = s.promptFeedback) === null || t === void 0) && t.blockReasonMessage && (n += `: ${s.promptFeedback.blockReasonMessage}`);
  else if (!((o = s.candidates) === null || o === void 0) && o[0]) {
    const a = s.candidates[0];
    $(a) && (n += `Candidate was blocked due to ${a.finishReason}`, a.finishMessage && (n += `: ${a.finishMessage}`));
  }
  return n;
}
function L(s) {
  return this instanceof L ? (this.v = s, this) : new L(s);
}
function Be(s, e, t) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var o = t.apply(s, e || []), n, a = [];
  return n = {}, i("next"), i("throw"), i("return"), n[Symbol.asyncIterator] = function() {
    return this;
  }, n;
  function i(c) {
    o[c] && (n[c] = function(u) {
      return new Promise(function(p, y) {
        a.push([c, u, p, y]) > 1 || r(c, u);
      });
    });
  }
  function r(c, u) {
    try {
      l(o[c](u));
    } catch (p) {
      d(a[0][3], p);
    }
  }
  function l(c) {
    c.value instanceof L ? Promise.resolve(c.value.v).then(h, m) : d(a[0][2], c);
  }
  function h(c) {
    r("next", c);
  }
  function m(c) {
    r("throw", c);
  }
  function d(c, u) {
    c(u), a.shift(), a.length && r(a[0][0], a[0][1]);
  }
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ce = /^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;
function Ke(s) {
  const e = s.body.pipeThrough(new TextDecoderStream("utf8", { fatal: !0 })), t = Je(e), [o, n] = t.tee();
  return {
    stream: We(o),
    response: Ye(n)
  };
}
async function Ye(s) {
  const e = [], t = s.getReader();
  for (; ; ) {
    const { done: o, value: n } = await t.read();
    if (o)
      return Y(Ve(e));
    e.push(n);
  }
}
function We(s) {
  return Be(this, arguments, function* () {
    const t = s.getReader();
    for (; ; ) {
      const { value: o, done: n } = yield L(t.read());
      if (n)
        break;
      yield yield L(Y(o));
    }
  });
}
function Je(s) {
  const e = s.getReader();
  return new ReadableStream({
    start(o) {
      let n = "";
      return a();
      function a() {
        return e.read().then(({ value: i, done: r }) => {
          if (r) {
            if (n.trim()) {
              o.error(new w("Failed to parse stream"));
              return;
            }
            o.close();
            return;
          }
          n += i;
          let l = n.match(ce), h;
          for (; l; ) {
            try {
              h = JSON.parse(l[1]);
            } catch {
              o.error(new w(`Error parsing JSON response: "${l[1]}"`));
              return;
            }
            o.enqueue(h), n = n.substring(l[0].length), l = n.match(ce);
          }
          return a();
        });
      }
    }
  });
}
function Ve(s) {
  const e = s[s.length - 1], t = {
    promptFeedback: e == null ? void 0 : e.promptFeedback
  };
  for (const o of s) {
    if (o.candidates)
      for (const n of o.candidates) {
        const a = n.index;
        if (t.candidates || (t.candidates = []), t.candidates[a] || (t.candidates[a] = {
          index: n.index
        }), t.candidates[a].citationMetadata = n.citationMetadata, t.candidates[a].groundingMetadata = n.groundingMetadata, t.candidates[a].finishReason = n.finishReason, t.candidates[a].finishMessage = n.finishMessage, t.candidates[a].safetyRatings = n.safetyRatings, n.content && n.content.parts) {
          t.candidates[a].content || (t.candidates[a].content = {
            role: n.content.role || "user",
            parts: []
          });
          const i = {};
          for (const r of n.content.parts)
            r.text && (i.text = r.text), r.functionCall && (i.functionCall = r.functionCall), r.executableCode && (i.executableCode = r.executableCode), r.codeExecutionResult && (i.codeExecutionResult = r.codeExecutionResult), Object.keys(i).length === 0 && (i.text = ""), t.candidates[a].content.parts.push(i);
        }
      }
    o.usageMetadata && (t.usageMetadata = o.usageMetadata);
  }
  return t;
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function fe(s, e, t, o) {
  const n = await D(
    e,
    H.STREAM_GENERATE_CONTENT,
    s,
    /* stream */
    !0,
    JSON.stringify(t),
    o
  );
  return Ke(n);
}
async function Te(s, e, t, o) {
  const a = await (await D(
    e,
    H.GENERATE_CONTENT,
    s,
    /* stream */
    !1,
    JSON.stringify(t),
    o
  )).json();
  return {
    response: Y(a)
  };
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Ce(s) {
  if (s != null) {
    if (typeof s == "string")
      return { role: "system", parts: [{ text: s }] };
    if (s.text)
      return { role: "system", parts: [s] };
    if (s.parts)
      return s.role ? s : { role: "system", parts: s.parts };
  }
}
function G(s) {
  let e = [];
  if (typeof s == "string")
    e = [{ text: s }];
  else
    for (const t of s)
      typeof t == "string" ? e.push({ text: t }) : e.push(t);
  return Xe(e);
}
function Xe(s) {
  const e = { role: "user", parts: [] }, t = { role: "function", parts: [] };
  let o = !1, n = !1;
  for (const a of s)
    "functionResponse" in a ? (t.parts.push(a), n = !0) : (e.parts.push(a), o = !0);
  if (o && n)
    throw new w("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");
  if (!o && !n)
    throw new w("No content is provided for sending chat message.");
  return o ? e : t;
}
function ze(s, e) {
  var t;
  let o = {
    model: e == null ? void 0 : e.model,
    generationConfig: e == null ? void 0 : e.generationConfig,
    safetySettings: e == null ? void 0 : e.safetySettings,
    tools: e == null ? void 0 : e.tools,
    toolConfig: e == null ? void 0 : e.toolConfig,
    systemInstruction: e == null ? void 0 : e.systemInstruction,
    cachedContent: (t = e == null ? void 0 : e.cachedContent) === null || t === void 0 ? void 0 : t.name,
    contents: []
  };
  const n = s.generateContentRequest != null;
  if (s.contents) {
    if (n)
      throw new x("CountTokensRequest must have one of contents or generateContentRequest, not both.");
    o.contents = s.contents;
  } else if (n)
    o = Object.assign(Object.assign({}, o), s.generateContentRequest);
  else {
    const a = G(s);
    o.contents = [a];
  }
  return { generateContentRequest: o };
}
function de(s) {
  let e;
  return s.contents ? e = s : e = { contents: [G(s)] }, s.systemInstruction && (e.systemInstruction = Ce(s.systemInstruction)), e;
}
function Qe(s) {
  return typeof s == "string" || Array.isArray(s) ? { content: G(s) } : s;
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const he = [
  "text",
  "inlineData",
  "functionCall",
  "functionResponse",
  "executableCode",
  "codeExecutionResult"
], Ze = {
  user: ["text", "inlineData"],
  function: ["functionResponse"],
  model: ["text", "functionCall", "executableCode", "codeExecutionResult"],
  // System instructions shouldn't be in history anyway.
  system: ["text"]
};
function qe(s) {
  let e = !1;
  for (const t of s) {
    const { role: o, parts: n } = t;
    if (!e && o !== "user")
      throw new w(`First content should be with role 'user', got ${o}`);
    if (!ee.includes(o))
      throw new w(`Each item should include role field. Got ${o} but valid roles are: ${JSON.stringify(ee)}`);
    if (!Array.isArray(n))
      throw new w("Content should have 'parts' property with an array of Parts");
    if (n.length === 0)
      throw new w("Each Content should have at least one part");
    const a = {
      text: 0,
      inlineData: 0,
      functionCall: 0,
      functionResponse: 0,
      fileData: 0,
      executableCode: 0,
      codeExecutionResult: 0
    };
    for (const r of n)
      for (const l of he)
        l in r && (a[l] += 1);
    const i = Ze[o];
    for (const r of he)
      if (!i.includes(r) && a[r] > 0)
        throw new w(`Content with role '${o}' can't contain '${r}' part`);
    e = !0;
  }
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ue = "SILENT_ERROR";
class et {
  constructor(e, t, o, n = {}) {
    this.model = t, this.params = o, this._requestOptions = n, this._history = [], this._sendPromise = Promise.resolve(), this._apiKey = e, o != null && o.history && (qe(o.history), this._history = o.history);
  }
  /**
   * Gets the chat history so far. Blocked prompts are not added to history.
   * Blocked candidates are not added to history, nor are the prompts that
   * generated them.
   */
  async getHistory() {
    return await this._sendPromise, this._history;
  }
  /**
   * Sends a chat message and receives a non-streaming
   * {@link GenerateContentResult}.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async sendMessage(e, t = {}) {
    var o, n, a, i, r, l;
    await this._sendPromise;
    const h = G(e), m = {
      safetySettings: (o = this.params) === null || o === void 0 ? void 0 : o.safetySettings,
      generationConfig: (n = this.params) === null || n === void 0 ? void 0 : n.generationConfig,
      tools: (a = this.params) === null || a === void 0 ? void 0 : a.tools,
      toolConfig: (i = this.params) === null || i === void 0 ? void 0 : i.toolConfig,
      systemInstruction: (r = this.params) === null || r === void 0 ? void 0 : r.systemInstruction,
      cachedContent: (l = this.params) === null || l === void 0 ? void 0 : l.cachedContent,
      contents: [...this._history, h]
    }, d = Object.assign(Object.assign({}, this._requestOptions), t);
    let c;
    return this._sendPromise = this._sendPromise.then(() => Te(this._apiKey, this.model, m, d)).then((u) => {
      var p;
      if (u.response.candidates && u.response.candidates.length > 0) {
        this._history.push(h);
        const y = Object.assign({
          parts: [],
          // Response seems to come back without a role set.
          role: "model"
        }, (p = u.response.candidates) === null || p === void 0 ? void 0 : p[0].content);
        this._history.push(y);
      } else {
        const y = M(u.response);
        y && console.warn(`sendMessage() was unsuccessful. ${y}. Inspect response object for details.`);
      }
      c = u;
    }), await this._sendPromise, c;
  }
  /**
   * Sends a chat message and receives the response as a
   * {@link GenerateContentStreamResult} containing an iterable stream
   * and a response promise.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async sendMessageStream(e, t = {}) {
    var o, n, a, i, r, l;
    await this._sendPromise;
    const h = G(e), m = {
      safetySettings: (o = this.params) === null || o === void 0 ? void 0 : o.safetySettings,
      generationConfig: (n = this.params) === null || n === void 0 ? void 0 : n.generationConfig,
      tools: (a = this.params) === null || a === void 0 ? void 0 : a.tools,
      toolConfig: (i = this.params) === null || i === void 0 ? void 0 : i.toolConfig,
      systemInstruction: (r = this.params) === null || r === void 0 ? void 0 : r.systemInstruction,
      cachedContent: (l = this.params) === null || l === void 0 ? void 0 : l.cachedContent,
      contents: [...this._history, h]
    }, d = Object.assign(Object.assign({}, this._requestOptions), t), c = fe(this._apiKey, this.model, m, d);
    return this._sendPromise = this._sendPromise.then(() => c).catch((u) => {
      throw new Error(ue);
    }).then((u) => u.response).then((u) => {
      if (u.candidates && u.candidates.length > 0) {
        this._history.push(h);
        const p = Object.assign({}, u.candidates[0].content);
        p.role || (p.role = "model"), this._history.push(p);
      } else {
        const p = M(u);
        p && console.warn(`sendMessageStream() was unsuccessful. ${p}. Inspect response object for details.`);
      }
    }).catch((u) => {
      u.message !== ue && console.error(u);
    }), c;
  }
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function tt(s, e, t, o) {
  return (await D(e, H.COUNT_TOKENS, s, !1, JSON.stringify(t), o)).json();
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function ot(s, e, t, o) {
  return (await D(e, H.EMBED_CONTENT, s, !1, JSON.stringify(t), o)).json();
}
async function nt(s, e, t, o) {
  const n = t.requests.map((i) => Object.assign(Object.assign({}, i), { model: e }));
  return (await D(e, H.BATCH_EMBED_CONTENTS, s, !1, JSON.stringify({ requests: n }), o)).json();
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class me {
  constructor(e, t, o = {}) {
    this.apiKey = e, this._requestOptions = o, t.model.includes("/") ? this.model = t.model : this.model = `models/${t.model}`, this.generationConfig = t.generationConfig || {}, this.safetySettings = t.safetySettings || [], this.tools = t.tools, this.toolConfig = t.toolConfig, this.systemInstruction = Ce(t.systemInstruction), this.cachedContent = t.cachedContent;
  }
  /**
   * Makes a single non-streaming call to the model
   * and returns an object containing a single {@link GenerateContentResponse}.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async generateContent(e, t = {}) {
    var o;
    const n = de(e), a = Object.assign(Object.assign({}, this._requestOptions), t);
    return Te(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (o = this.cachedContent) === null || o === void 0 ? void 0 : o.name }, n), a);
  }
  /**
   * Makes a single streaming call to the model and returns an object
   * containing an iterable stream that iterates over all chunks in the
   * streaming response as well as a promise that returns the final
   * aggregated response.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async generateContentStream(e, t = {}) {
    var o;
    const n = de(e), a = Object.assign(Object.assign({}, this._requestOptions), t);
    return fe(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (o = this.cachedContent) === null || o === void 0 ? void 0 : o.name }, n), a);
  }
  /**
   * Gets a new {@link ChatSession} instance which can be used for
   * multi-turn chats.
   */
  startChat(e) {
    var t;
    return new et(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (t = this.cachedContent) === null || t === void 0 ? void 0 : t.name }, e), this._requestOptions);
  }
  /**
   * Counts the tokens in the provided request.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async countTokens(e, t = {}) {
    const o = ze(e, {
      model: this.model,
      generationConfig: this.generationConfig,
      safetySettings: this.safetySettings,
      tools: this.tools,
      toolConfig: this.toolConfig,
      systemInstruction: this.systemInstruction,
      cachedContent: this.cachedContent
    }), n = Object.assign(Object.assign({}, this._requestOptions), t);
    return tt(this.apiKey, this.model, o, n);
  }
  /**
   * Embeds the provided content.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async embedContent(e, t = {}) {
    const o = Qe(e), n = Object.assign(Object.assign({}, this._requestOptions), t);
    return ot(this.apiKey, this.model, o, n);
  }
  /**
   * Embeds an array of {@link EmbedContentRequest}s.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async batchEmbedContents(e, t = {}) {
    const o = Object.assign(Object.assign({}, this._requestOptions), t);
    return nt(this.apiKey, this.model, e, o);
  }
}
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class st {
  constructor(e) {
    this.apiKey = e;
  }
  /**
   * Gets a {@link GenerativeModel} instance for the provided model name.
   */
  getGenerativeModel(e, t) {
    if (!e.model)
      throw new w("Must provide a model name. Example: genai.getGenerativeModel({ model: 'my-model-name' })");
    return new me(this.apiKey, e, t);
  }
  /**
   * Creates a {@link GenerativeModel} instance from provided content cache.
   */
  getGenerativeModelFromCachedContent(e, t, o) {
    if (!e.name)
      throw new x("Cached content must contain a `name` field.");
    if (!e.model)
      throw new x("Cached content must contain a `model` field.");
    const n = ["model", "systemInstruction"];
    for (const i of n)
      if (t != null && t[i] && e[i] && (t == null ? void 0 : t[i]) !== e[i]) {
        if (i === "model") {
          const r = t.model.startsWith("models/") ? t.model.replace("models/", "") : t.model, l = e.model.startsWith("models/") ? e.model.replace("models/", "") : e.model;
          if (r === l)
            continue;
        }
        throw new x(`Different value for "${i}" specified in modelParams (${t[i]}) and cachedContent (${e[i]})`);
      }
    const a = Object.assign(Object.assign({}, t), { model: e.model, tools: e.tools, toolConfig: e.toolConfig, systemInstruction: e.systemInstruction, cachedContent: e });
    return new me(this.apiKey, a, o);
  }
}
class B {
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
  static toGeminiRequest(e) {
    const n = {
      contents: e.messages.filter((i) => i.role !== "system").map((i) => this.mapMessage(i))
    };
    e.system && (n.systemInstruction = {
      parts: [{ text: e.system }]
    });
    const a = {};
    return e.temperature !== void 0 && (a.temperature = e.temperature), e.maxTokens !== void 0 && (a.maxOutputTokens = e.maxTokens), e.topP !== void 0 && (a.topP = e.topP), e.stop !== void 0 && (a.stopSequences = e.stop), Object.keys(a).length > 0 && (n.generationConfig = a), n;
  }
  /**
   * Map Gemini API error to a readable error string
   * Handles nested JSON escaping in error messages
   */
  static mapError(e) {
    var o;
    let t = "An error occurred with the Gemini API";
    try {
      if (e != null && e.message) {
        let n = e.message;
        for (; typeof n == "string" && (n.startsWith("{") || n.startsWith('"{')); )
          try {
            const a = JSON.parse(n);
            if ((o = a.error) != null && o.message)
              n = a.error.message;
            else if (a.message)
              n = a.message;
            else
              break;
          } catch {
            break;
          }
        t = n;
      }
    } catch (n) {
      console.error("[GeminiConverter] Failed to parse error:", n);
    }
    return t;
  }
}
class at {
  constructor(e) {
    g(this, "client");
    g(this, "tokenCallback");
    this.client = e;
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
  async makeRequest(e, t, o, n, a) {
    console.log("[GeminiToolHandler] makeRequest called", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: n,
      shouldStream: a
    });
    const i = o.map((m) => ({
      name: m.name,
      description: m.description,
      parameters: m.parameters
    })), r = [{
      functionDeclarations: i
    }];
    console.log("[GeminiToolHandler] Converted tools to Gemini format", {
      functionDeclarationsCount: i.length,
      functions: i.map((m) => m.name)
    });
    const l = this.client.getGenerativeModel({ model: e }), h = {
      contents: t,
      tools: r
    };
    return console.log("[GeminiToolHandler] Making API request", {
      shouldStream: a,
      hasTools: r.length > 0
    }), a ? await this.makeStreamingRequest(l, h) : await this.makeNonStreamingRequest(l, h);
  }
  /**
   * Make a streaming request to Gemini
   */
  async makeStreamingRequest(e, t) {
    var i, r, l, h, m;
    console.log("[GeminiToolHandler] Starting streaming request");
    const o = await e.generateContentStream(t);
    let n = 0, a = !1;
    try {
      for await (const d of o.stream) {
        n++, console.log("[GeminiToolHandler] Received streaming chunk", {
          chunkCount: n,
          hasText: !!d.text,
          finishReason: (r = (i = d.candidates) == null ? void 0 : i[0]) == null ? void 0 : r.finishReason
        });
        const c = (l = d.text) == null ? void 0 : l.call(d);
        c && this.tokenCallback && this.tokenCallback(c);
        const u = (m = (h = d.candidates) == null ? void 0 : h[0]) == null ? void 0 : m.finishReason;
        if (u) {
          console.log("[GeminiToolHandler] Detected finish reason, breaking loop", { finishReason: u }), a = !0;
          break;
        }
      }
    } catch (d) {
      throw console.error("[GeminiToolHandler] Error during streaming", d), d;
    }
    return console.log("[GeminiToolHandler] Stream completed", { chunkCount: n, isDone: a }), a || (await o.response, console.log("[GeminiToolHandler] Final response awaited")), console.log("[GeminiToolHandler] Returning stream result"), o;
  }
  /**
   * Make a non-streaming request to Gemini
   */
  async makeNonStreamingRequest(e, t) {
    console.log("[GeminiToolHandler] Starting non-streaming request");
    const o = await e.generateContent(t);
    return console.log("[GeminiToolHandler] Non-streaming response received", {
      hasResponse: !!o.response
    }), o;
  }
  /**
   * Extract tool uses (function calls) from Gemini's response
   */
  extractToolUses(e) {
    var i;
    console.log("[GeminiToolHandler] Extracting tool uses from response");
    const t = [], n = e.response.candidates;
    if (!n || n.length === 0)
      return console.log("[GeminiToolHandler] No candidates found in response"), t;
    const a = (i = n[0].content) == null ? void 0 : i.parts;
    if (!a)
      return console.log("[GeminiToolHandler] No parts found in candidate content"), t;
    console.log("[GeminiToolHandler] Checking parts for function calls", {
      partsCount: a.length
    });
    for (const r of a)
      if (r.functionCall) {
        const l = r.functionCall;
        console.log("[GeminiToolHandler] Found function call", {
          name: l.name,
          args: l.args
        }), t.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: l.name,
          input: l.args || {}
        });
      }
    return console.log("[GeminiToolHandler] Extracted tool uses", {
      count: t.length,
      tools: t.map((r) => ({ id: r.id, name: r.name }))
    }), t;
  }
  /**
   * Extract text content from Gemini's response
   */
  extractTextContent(e) {
    var t;
    console.log("[GeminiToolHandler] Extracting text content from response");
    try {
      const o = e.response, n = (t = o.text) == null ? void 0 : t.call(o);
      return console.log("[GeminiToolHandler] Text content extracted", {
        hasText: !!n,
        textLength: (n == null ? void 0 : n.length) || 0
      }), n || null;
    } catch {
      return console.log("[GeminiToolHandler] No text content in response (this is normal for function calls)"), null;
    }
  }
  /**
   * Format tool results for Gemini's expected format
   */
  formatToolResults(e, t) {
    console.log("[GeminiToolHandler] Formatting tool results", {
      toolUsesCount: e.length,
      resultsCount: t.length
    });
    const o = e.map((n, a) => {
      const i = t[a];
      return console.log("[GeminiToolHandler] Formatting result for tool", {
        toolName: n.name,
        resultSuccess: i == null ? void 0 : i.success,
        hasData: !!(i != null && i.data),
        hasError: !!(i != null && i.error)
      }), {
        functionResponse: {
          name: n.name,
          response: {
            success: i.success,
            content: i.success ? i.data : i.error
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
  appendMessages(e, t, o) {
    var h;
    console.log("[GeminiToolHandler] Appending messages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length
    });
    const a = t.response.candidates;
    if (!a || a.length === 0)
      return console.warn("[GeminiToolHandler] No candidates in response, returning messages unchanged"), e;
    const i = {
      role: "model",
      parts: ((h = a[0].content) == null ? void 0 : h.parts) || []
    };
    console.log("[GeminiToolHandler] Model response parts", {
      partsCount: i.parts.length,
      partTypes: i.parts.map((m) => m.text ? "text" : m.functionCall ? "functionCall" : "unknown")
    });
    const r = {
      role: "user",
      parts: o
    };
    console.log("[GeminiToolHandler] User response with function results", {
      partsCount: r.parts.length
    });
    const l = [
      ...e,
      i,
      r
    ];
    return console.log("[GeminiToolHandler] Messages appended", {
      newMessagesCount: l.length
    }), l;
  }
}
class it {
  constructor(e, t, o, n = [], a) {
    g(this, "client");
    g(this, "defaultModel");
    g(this, "apiEndpoint");
    g(this, "tools");
    g(this, "onToolUse");
    g(this, "toolHandler");
    this.client = new st(t), this.defaultModel = o || "gemini-pro", this.apiEndpoint = e, this.tools = n, this.onToolUse = a, n.length > 0 && (this.toolHandler = new at(this.client)), console.log(`GeminiChatProvider initialized url: ${e} with model ${this.defaultModel}${n.length > 0 ? ` and ${n.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Gemini
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    var r, l, h, m, d, c, u, p, y, I, v, T;
    const o = e;
    if (console.log("[GeminiChatProvider] v1.03 chat called", {
      hasThreadId: !!o.thread_id,
      thread_id: o.thread_id,
      streaming: e.streaming !== !1,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    let n = {};
    if (o.thread_id) {
      const f = A.setBranchIteration(e.branch_id, 0);
      n = {
        thread_id: o.thread_id,
        branch_id: f
      };
    }
    const a = e.model || this.defaultModel, i = B.toGeminiRequest({ ...e, model: a });
    console.log("[GeminiChatProvider] Converted request", {
      model: a,
      hasSystemInstruction: !!i.systemInstruction,
      contentsCount: i.contents.length,
      threadContext: n,
      streaming: e.streaming !== !1
    });
    try {
      const f = {
        baseUrl: this.apiEndpoint
      }, O = this.client.getGenerativeModel(
        { model: a },
        f
      );
      if (e.streaming !== !1) {
        console.log("[GeminiChatProvider] Using streaming mode");
        const C = await O.generateContentStream(i);
        console.log("[GeminiChatProvider] Stream started, processing chunks");
        let E = 0, k = !1, _ = null;
        try {
          for await (const R of C.stream) {
            E++;
            const S = (h = (l = (r = R.candidates) == null ? void 0 : r[0]) == null ? void 0 : l.content) == null ? void 0 : h.parts;
            if (S)
              for (const J of S)
                J.inlineData && (_ = J.inlineData, console.log("[GeminiChatProvider] Detected inline data", {
                  mimeType: _.mimeType,
                  dataLength: _.data.length
                }));
            console.log("[GeminiChatProvider] Received chunk", {
              chunkCount: E,
              hasText: !!R.text,
              hasInlineData: !!_,
              finishReason: (d = (m = R.candidates) == null ? void 0 : m[0]) == null ? void 0 : d.finishReason
            });
            const F = R.text();
            F && t && t(F);
            const W = (u = (c = R.candidates) == null ? void 0 : c[0]) == null ? void 0 : u.finishReason;
            if (W) {
              console.log("[GeminiChatProvider] Detected finish reason, breaking loop", { finishReason: W }), k = !0;
              break;
            }
          }
        } catch (R) {
          throw console.error("[GeminiChatProvider] Error during streaming", R), R;
        }
        if (console.log("[GeminiChatProvider] Stream loop exited", { chunkCount: E, isDone: k, hasInlineData: !!_ }), _ && t) {
          const R = `![](data:${_.mimeType};base64,${_.data})`;
          console.log("[GeminiChatProvider] Appending inline data as markdown", {
            mimeType: _.mimeType,
            dataLength: _.data.length
          });
          const S = `

${R}`;
          t(S);
        }
        if (k)
          console.log("[GeminiChatProvider] Stream completed (finish detected in chunk)");
        else {
          const R = await C.response;
          console.log("[GeminiChatProvider] Stream completed", {
            finishReason: (y = (p = R.candidates) == null ? void 0 : p[0]) == null ? void 0 : y.finishReason,
            modelVersion: R.modelVersion
          });
        }
      } else {
        console.log("[GeminiChatProvider] Using non-streaming mode");
        const E = (await O.generateContent(i)).response, k = E.text();
        let _ = null;
        const R = (T = (v = (I = E.candidates) == null ? void 0 : I[0]) == null ? void 0 : v.content) == null ? void 0 : T.parts;
        if (R)
          for (const S of R)
            S.inlineData && (_ = S.inlineData, console.log("[GeminiChatProvider] Detected inline data in non-streaming response", {
              mimeType: _.mimeType,
              dataLength: _.data.length
            }));
        if (console.log("[GeminiChatProvider] Response received", {
          textLength: k.length,
          hasText: !!k,
          hasInlineData: !!_
        }), k && t && t(k), _ && t) {
          const S = `![](data:${_.mimeType};base64,${_.data})`;
          console.log("[GeminiChatProvider] Appending inline data as markdown", {
            mimeType: _.mimeType,
            dataLength: _.data.length
          });
          const F = `

${S}`;
          t(F);
        }
      }
    } catch (f) {
      console.error("[GeminiChatProvider] Error in Gemini API call:", f);
      const O = B.mapError(f);
      throw console.log("[GeminiChatProvider] Decoded error message:", O), t && t(`

**Error:** ${O}`), f;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, t) {
    if (console.log("[GeminiChatProvider] chatWithTools called", {
      hasToolHandler: !!this.toolHandler,
      hasOnToolUse: !!this.onToolUse,
      toolsCount: this.tools.length,
      requestModel: e.model,
      requestThreadId: e.thread_id,
      requestMessagesCount: e.messages.length,
      requestStreaming: e.streaming
    }), !this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const o = e.model || this.defaultModel, n = B.toGeminiRequest({ ...e, model: o }), a = this.convertToolsToGeminiFormat(this.tools);
    await A.handleToolLoop(
      this.toolHandler,
      o,
      n.contents,
      a,
      e,
      this.onToolUse,
      t,
      e.streaming !== !1
    );
  }
  /**
   * Convert ToolDefinition to Gemini's tool format
   */
  convertToolsToGeminiFormat(e) {
    return e.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    }));
  }
}
var j = /* @__PURE__ */ ((s) => (s.OLLAMA = "ollama", s.OPENAI = "openai", s.CLAUDE = "claude", s.PERPLEXITY = "perplexity", s.GEMINI = "gemini", s))(j || {});
class rt {
  /**
   * Creates an appropriate chat provider based on the provider type
   */
  static createProvider(e, t, o, n) {
    switch (e) {
      case "ollama":
        if (!t.apiKey)
          throw new Error("API key is required for Ollama provider");
        return new Oe(t.url, t.apiKey, t.model, o || [], n);
      case "openai":
        if (!t.apiKey)
          throw new Error("API key is required for OpenAI provider");
        return new Ie(t.url, t.apiKey, t.model, o || [], n);
      case "claude":
        if (!t.apiKey)
          throw new Error("API key is required for Claude provider");
        return new Se(t.url, t.apiKey, t.model, o || [], n);
      case "gemini":
        if (!t.apiKey)
          throw new Error("API key is required for Gemini provider");
        return new it(t.url, t.apiKey, t.model, o || [], n);
      case "perplexity":
        throw new Error("PerplexityChatProvider not implemented yet");
      default:
        throw new Error(`Unsupported provider type: ${e}`);
    }
  }
}
class lt {
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
class ct {
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
class dt {
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
class ht {
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
function ut(s) {
  switch (s.toLowerCase()) {
    case j.OPENAI:
      return new lt();
    case j.CLAUDE:
      return new ct();
    case j.OLLAMA:
      return new dt();
    default:
      return new ht();
  }
}
class mt {
  constructor(e, t, o, n, a) {
    g(this, "accumulatedResponse", "");
    g(this, "requestStartTime");
    g(this, "firstTokenTime");
    g(this, "tokenCounter");
    g(this, "originalCallback");
    g(this, "totalTokens", 0);
    g(this, "tokensReceived", 0);
    g(this, "isFirstToken", !0);
    this.provider = e, this.model = t, this.prompt = o, this.onComplete = n, this.requestStartTime = Date.now(), this.originalCallback = a, this.tokenCounter = ut(e);
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
    var i, r;
    const t = Date.now(), o = ((i = this.tokenCounter) == null ? void 0 : i.countPromptTokens(this.prompt)) ?? 0, n = ((r = this.tokenCounter) == null ? void 0 : r.estimateResponseTokens(this.accumulatedResponse)) ?? 0, a = {
      requestId: crypto.randomUUID(),
      provider: this.provider,
      model: this.model,
      requestTimestamp: this.requestStartTime,
      firstTokenTimestamp: this.firstTokenTime,
      completionTimestamp: t,
      totalDuration: t - this.requestStartTime,
      timeToFirstToken: this.firstTokenTime ? this.firstTokenTime - this.requestStartTime : void 0,
      promptTokenCount: o,
      completionTokenCount: n,
      totalTokenCount: o + n,
      tokensPerSecond: this.calculateTokensPerSecond(t),
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
    const t = (e - this.firstTokenTime) / 1e3;
    return t > 0 ? this.tokensReceived / t : void 0;
  }
}
const b = class b {
  constructor(e) {
    g(this, "config");
    g(this, "auditLogs", []);
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
    return b.instance || (b.instance = new b(e || { enabled: !0 })), b.instance;
  }
  /**
   * Create an accumulator for tracking a chat request
   */
  createAccumulator(e, t, o, n) {
    return new mt(
      e,
      t,
      o,
      (a) => this.logChatAudit(a),
      n
    );
  }
  /**
   * Create a wrapped token callback that accumulates tokens
   */
  createWrappedCallback(e, t, o) {
    const n = this.createAccumulator(
      t,
      e.model,
      e.messages,
      o
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
    const t = this.applyPrivacyFilters(e);
    this.config.logToConsole && console.log(`[AUDIT] Chat completed: ${t.provider}/${t.model} (${t.totalDuration}ms)`, t), this.config.logToServer && this.config.serverEndpoint && this.sendToServer(t, this.config.serverEndpoint);
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
    const t = { ...e };
    return this.config.includePromptText || (t.promptText = "[REDACTED]"), this.config.includeResponseText || (t.completeResponse = "[REDACTED]"), t;
  }
  /**
   * Send audit data to a server endpoint
   */
  async sendToServer(e, t) {
    try {
      const o = await fetch(t, {
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
g(b, "instance");
let K = b;
class yt {
  /**
   * Create a ChatService with the specified provider and configuration
   */
  constructor(e, t, o = !0, n, a) {
    g(this, "provider");
    g(this, "providerType");
    g(this, "config");
    g(this, "auditService");
    g(this, "tools");
    g(this, "onToolUse");
    this.providerType = e, this.config = t, this.tools = n, this.onToolUse = a, this.provider = this.initializeProvider(), this.auditService = K.getInstance({
      enabled: o,
      logToConsole: !0,
      logToServer: !1
    });
  }
  /**
   * Initialize the appropriate provider based on provider type
   */
  initializeProvider() {
    return rt.createProvider(this.providerType, this.config, this.tools, this.onToolUse);
  }
  /**
   * Send a chat request and handle streaming response
   */
  async chat(e, t) {
    const { callback: o, complete: n } = this.auditService.createWrappedCallback(
      e,
      this.providerType,
      t
    );
    try {
      await this.provider.chat(e, o), n();
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
class gt {
  static toOllamaRequest(e) {
    return {
      model: e.model,
      messages: e.messages.map((t) => ({ role: t.role, content: t.content }))
    };
  }
}
class vt {
  constructor(e, t) {
    g(this, "url");
    g(this, "model");
    g(this, "ollama");
    this.url = e, this.model = t, this.ollama = new ge({ host: e }), console.log("in constructor creating ollama client...");
  }
  async chat(e, t) {
    gt.toOllamaRequest(e);
    const o = await this.ollama.chat({ model: e.model, messages: e.messages, stream: !0 });
    for await (const n of o) {
      const a = n.message.content;
      t && t(a);
    }
  }
}
export {
  K as AuditService,
  vt as ChatApiService,
  rt as ChatProviderFactory,
  A as ChatProviderUtils,
  yt as ChatService,
  Se as ClaudeChatProvider,
  Ae as ClaudeToolHandler,
  it as GeminiChatProvider,
  at as GeminiToolHandler,
  Oe as OllamaChatProvider,
  Re as OllamaToolHandler,
  Ie as OpenAIChatProvider,
  we as OpenAIToolHandler,
  j as ProviderType,
  mt as TokenAccumulator
};
