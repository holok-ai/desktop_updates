var $o = Object.defineProperty;
var Wo = (n, e, t) => e in n ? $o(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var P = (n, e, t) => Wo(n, typeof e != "symbol" ? e + "" : e, t);
import { Ollama as Qt } from "ollama/browser";
import Ko from "openai";
import Yo from "@anthropic-ai/sdk";
class gn {
  /**
   * Convert internal ChatRequest to Ollama-specific format
   */
  static toOllamaRequest(e) {
    const t = e.messages.filter((a) => a.role !== "system"), o = e.system ? [{ role: "system", content: e.system }, ...t.map((a) => ({ role: a.role, content: a.content }))] : t.map((a) => ({ role: a.role, content: a.content })), i = {
      model: e.model,
      messages: o,
      stream: e.streaming !== !1
    };
    return (e.temperature !== void 0 || e.maxTokens !== void 0 || e.topP !== void 0 || e.frequencyPenalty !== void 0 || e.presencePenalty !== void 0 || e.stop !== void 0) && (i.options = {}, e.temperature !== void 0 && (i.options.temperature = e.temperature), e.maxTokens !== void 0 && (i.options.num_predict = e.maxTokens), e.topP !== void 0 && (i.options.top_p = e.topP), e.frequencyPenalty !== void 0 && (i.options.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (i.options.presence_penalty = e.presencePenalty), e.stop !== void 0 && (i.options.stop = e.stop)), e.responseFormat && (i.format = e.responseFormat), i;
  }
}
const ee = class ee {
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
  static async handleToolLoop(e, t, o, i, r, a, u, c = !1) {
    const d = r.thread_id;
    var f = r.branch_id;
    console.log("[ChatProviderUtils] handleToolLoop starting", {
      model: t,
      initialMessagesCount: o.length,
      toolsCount: i.length,
      originalThreadId: d,
      originalBranchId: f,
      shouldStream: c,
      hasOnTokenReceived: !!u,
      maxIterations: ee.MAX_TOOL_ITERATIONS
    });
    let m = o;
    for (let p = 0; p < ee.MAX_TOOL_ITERATIONS; p++) {
      console.log("[ChatProviderUtils] handleToolLoop - Starting iteration", {
        iteration: p,
        currentMessagesCount: m.length
      }), f = ee.setBranchIteration(f, p);
      const h = {
        thread_id: d,
        branch_id: f
      };
      console.log("[ChatProviderUtils] handleToolLoop - Thread context for iteration", {
        iteration: p,
        threadContext: h
      });
      const g = "setTokenCallback" in e && typeof e.setTokenCallback == "function";
      g ? (console.log("[ChatProviderUtils] handleToolLoop - Setting token callback"), e.setTokenCallback(u)) : console.log("[ChatProviderUtils] handleToolLoop - Handler does not support streaming callback"), console.log("[ChatProviderUtils] handleToolLoop - Making request to handler");
      const _ = await e.makeRequest(
        t,
        m,
        i,
        h,
        c
      );
      console.log("[ChatProviderUtils] handleToolLoop - Request completed", {
        iteration: p,
        hasResponse: !!_
      });
      const T = !c || !g;
      if (console.log("[ChatProviderUtils] handleToolLoop - Text content handling", {
        iteration: p,
        shouldSendTextContent: T,
        hasStreamingCallback: g,
        shouldStream: c
      }), T) {
        const y = e.extractTextContent(_);
        console.log("[ChatProviderUtils] handleToolLoop - Extracted text content", {
          iteration: p,
          hasTextContent: !!y,
          textContentLength: (y == null ? void 0 : y.length) || 0,
          textPreview: (y == null ? void 0 : y.substring(0, 100)) + "...",
          willCallOnTokenReceived: !!(y && u)
        }), y && u && u(y);
      }
      console.log("[ChatProviderUtils] handleToolLoop - Extracting tool uses");
      const C = e.extractToolUses(_);
      console.log("[ChatProviderUtils] handleToolLoop - Tool uses extracted", {
        iteration: p,
        toolUsesCount: C.length,
        toolUses: C.map((y) => ({ id: y.id, name: y.name, inputKeys: Object.keys(y.input) }))
      });
      const S = _.stop_reason;
      if (S === "tool_use" && C.length === 0 && (console.warn('[ChatProviderUtils] handleToolLoop - MISMATCH: stop_reason="tool_use" but no tool_use blocks found in content', {
        iteration: p,
        stopReason: S,
        responseId: _.id,
        contentBlocks: _.content
      }), console.warn("[ChatProviderUtils] handleToolLoop - This may indicate a proxy is modifying Claude responses")), C.length === 0) {
        console.log("[ChatProviderUtils] handleToolLoop - No tool uses found, ending loop", {
          iteration: p,
          stopReason: S
        });
        return;
      }
      console.log("[ChatProviderUtils] handleToolLoop - Executing tools", {
        iteration: p,
        toolUsesCount: C.length
      });
      const E = [];
      for (const y of C) {
        console.log("[ChatProviderUtils] handleToolLoop - Executing tool", {
          iteration: p,
          toolId: y.id,
          toolName: y.name,
          inputKeys: Object.keys(y.input)
        });
        const R = await a(y);
        console.log("[ChatProviderUtils] handleToolLoop - Tool execution completed", {
          iteration: p,
          toolId: y.id,
          toolName: y.name,
          resultSuccess: R == null ? void 0 : R.success,
          hasResultData: !!(R != null && R.data),
          hasResultError: !!(R != null && R.error)
        }), E.push(R);
      }
      console.log("[ChatProviderUtils] handleToolLoop - All tools executed", {
        iteration: p,
        toolResultsCount: E.length
      }), console.log("[ChatProviderUtils] handleToolLoop - Formatting tool results");
      const I = e.formatToolResults(C, E);
      console.log("[ChatProviderUtils] handleToolLoop - Appending messages"), m = e.appendMessages(m, _, I), console.log("[ChatProviderUtils] handleToolLoop - Iteration complete, continuing loop", {
        iteration: p,
        newMessagesCount: m.length
      });
    }
    throw console.error("[ChatProviderUtils] handleToolLoop - Maximum iterations exceeded", {
      maxIterations: ee.MAX_TOOL_ITERATIONS
    }), new Error("Tool loop exceeded maximum iterations");
  }
};
/**
 * Maximum number of tool calling iterations to prevent infinite loops
 */
P(ee, "MAX_TOOL_ITERATIONS", 10);
let W = ee;
class zo {
  constructor(e) {
    P(this, "onTokenReceived");
    this.ollama = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, t, o, i, r) {
    var a;
    if (console.log("[OllamaToolHandler] makeRequest called", {
      model: e,
      shouldStream: r,
      toolsCount: o.length,
      messagesCount: t.length,
      threadContext: i
    }), r) {
      console.log("[OllamaToolHandler] Using streaming mode");
      const u = await this.ollama.chat({
        ...i,
        model: e,
        messages: t,
        tools: o,
        stream: !0
      });
      let c = null, d = 0;
      for await (const f of u) {
        d++;
        const m = (a = f.message) == null ? void 0 : a.content;
        m && this.onTokenReceived && this.onTokenReceived(m), c = f;
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
        messages: t,
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
    }), e.map((o, i) => ({
      id: o.id,
      result: JSON.stringify(t[i])
    }));
  }
  appendMessages(e, t, o) {
    var r, a;
    console.log("[OllamaToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length,
      hasResponseMessage: !!t.message
    });
    const i = [
      ...e,
      {
        role: "assistant",
        content: ((r = t.message) == null ? void 0 : r.content) || "",
        tool_calls: ((a = t.message) == null ? void 0 : a.tool_calls) || []
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
    var o;
    if (console.log("[OllamaToolHandler] extractToolCalls", {
      hasMessage: !!e,
      hasToolCalls: !!(e != null && e.tool_calls),
      isArray: Array.isArray(e == null ? void 0 : e.tool_calls),
      toolCallsLength: ((o = e == null ? void 0 : e.tool_calls) == null ? void 0 : o.length) || 0,
      messageKeys: e ? Object.keys(e) : []
    }), !(e != null && e.tool_calls) || !Array.isArray(e.tool_calls))
      return [];
    const t = e.tool_calls.map((i, r) => {
      var a, u;
      return {
        id: i.id || `tool_${r}`,
        name: ((a = i.function) == null ? void 0 : a.name) || i.name || "",
        arguments: ((u = i.function) == null ? void 0 : u.arguments) || i.arguments || {}
      };
    });
    return console.log("[OllamaToolHandler] extractToolCalls result", {
      extractedCount: t.length,
      calls: t.map((i) => ({ id: i.id, name: i.name }))
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
class Xo {
  constructor(e, t, o, i = [], r) {
    P(this, "ollama");
    P(this, "defaultModel");
    P(this, "tools");
    P(this, "onToolUse");
    P(this, "toolHandler");
    this.ollama = new Qt({ host: e, headers: {
      "X-api-key": t
    } }), this.defaultModel = o, this.tools = i, this.onToolUse = r, i.length > 0 && (this.toolHandler = new zo(this.ollama)), console.log(`OllamaChatProvider initialized with endpoint ${e} and model ${o}${i.length > 0 ? ` and ${i.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Ollama
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    var c, d;
    const o = e;
    if (console.log("[OllamaChatProvider] chat called", {
      hasThreadId: !!o.thread_id,
      thread_id: o.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    const i = e.model || this.defaultModel, r = { ...e, model: i }, a = gn.toOllamaRequest(r);
    let u = {};
    if (o.thread_id) {
      const f = W.setBranchIteration(e.branch_id, 0);
      u = {
        thread_id: o.thread_id,
        branch_id: f
      };
    }
    try {
      if (a.stream) {
        const f = await this.ollama.chat({
          ...u,
          ...a,
          stream: !0
        });
        for await (const m of f) {
          const p = (c = m.message) == null ? void 0 : c.content;
          p && t && t(p);
        }
      } else {
        const m = (d = (await this.ollama.chat({
          ...u,
          ...a,
          stream: !1
        })).message) == null ? void 0 : d.content;
        m && t && t(m);
      }
    } catch (f) {
      throw console.error("Error in Ollama API call:", f), f;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, t) {
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const o = e.model || this.defaultModel, i = { ...e, model: o }, r = gn.toOllamaRequest(i), a = this.convertToolsToOllamaFormat(this.tools);
    try {
      await W.handleToolLoop(
        this.toolHandler,
        r.model,
        r.messages || [],
        a,
        e,
        this.onToolUse,
        t,
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
class yn {
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
      const i = e.messages.filter((r) => r.role !== "system");
      t = [
        { role: "system", content: e.system },
        ...i.map((r) => this.mapMessage(r))
      ];
    } else
      t = e.messages.map((i) => this.mapMessage(i));
    const o = {
      model: e.model,
      messages: t,
      stream: e.streaming !== !1
    };
    return e.temperature !== void 0 && (o.temperature = e.temperature), e.maxTokens !== void 0 && (o.max_tokens = e.maxTokens), e.topP !== void 0 && (o.top_p = e.topP), e.frequencyPenalty !== void 0 && (o.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (o.presence_penalty = e.presencePenalty), e.stop !== void 0 && (o.stop = e.stop), e.responseFormat !== void 0 && (o.response_format = e.responseFormat), o;
  }
}
class Qo {
  constructor(e) {
    P(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, t, o, i, r) {
    return console.log("[OpenAIToolHandler] makeRequest called", {
      model: e,
      shouldStream: r,
      toolsCount: o.length,
      messagesCount: t.length,
      threadContext: i
    }), r ? (console.log("[OpenAIToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, t, o, i)) : (console.log("[OpenAIToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, t, o, i));
  }
  extractToolUses(e) {
    var o, i, r, a, u, c, d;
    const t = e.choices[0];
    if (console.log("[OpenAIToolHandler] extractToolUses", {
      hasChoice: !!t,
      finishReason: t == null ? void 0 : t.finish_reason,
      hasToolCalls: !!((o = t == null ? void 0 : t.message) != null && o.tool_calls),
      toolCallsCount: ((r = (i = t == null ? void 0 : t.message) == null ? void 0 : i.tool_calls) == null ? void 0 : r.length) || 0,
      hasFunctionCall: !!((a = t == null ? void 0 : t.message) != null && a.function_call)
    }), (t == null ? void 0 : t.finish_reason) === "tool_calls" || (u = t == null ? void 0 : t.message) != null && u.tool_calls) {
      const f = (c = t == null ? void 0 : t.message) == null ? void 0 : c.tool_calls;
      if (f && f.length > 0) {
        const m = f.map((p) => ({
          id: p.id,
          name: p.function.name,
          input: this.parseToolArguments(p.function.arguments)
        }));
        return console.log("[OpenAIToolHandler] Extracted tool uses (tool_calls format)", {
          count: m.length,
          tools: m.map((p) => ({ id: p.id, name: p.name }))
        }), m;
      }
    }
    if ((t == null ? void 0 : t.finish_reason) === "function_call") {
      const f = (d = t == null ? void 0 : t.message) == null ? void 0 : d.function_call;
      if (f) {
        const m = {
          id: `call_${Date.now()}`,
          name: f.name,
          input: this.parseToolArguments(f.arguments || "{}")
        };
        return console.log("[OpenAIToolHandler] Extracted tool use (function_call format)", {
          id: m.id,
          name: m.name
        }), [m];
      }
    }
    return console.log("[OpenAIToolHandler] No tool uses found"), [];
  }
  extractTextContent(e) {
    var o, i;
    const t = (i = (o = e.choices[0]) == null ? void 0 : o.message) == null ? void 0 : i.content;
    return console.log("[OpenAIToolHandler] extractTextContent", {
      hasContent: !!t,
      contentLength: (t == null ? void 0 : t.length) || 0
    }), t || null;
  }
  formatToolResults(e, t) {
    return console.log("[OpenAIToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: t.length
    }), e.map((o, i) => ({
      role: "tool",
      tool_call_id: o.id,
      content: JSON.stringify(t[i])
    }));
  }
  appendMessages(e, t, o) {
    var a;
    console.log("[OpenAIToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length,
      hasResponseMessage: !!((a = t.choices[0]) != null && a.message)
    });
    const i = {
      role: "assistant",
      content: t.choices[0].message.content,
      tool_calls: t.choices[0].message.tool_calls
    }, r = [
      ...e,
      i,
      ...o
    ];
    return console.log("[OpenAIToolHandler] appendMessages complete", {
      newMessagesCount: r.length
    }), r;
  }
  /**
   * Make a streaming request to OpenAI API
   */
  async makeStreamingRequest(e, t, o, i) {
    var r, a, u, c;
    console.log("[OpenAIToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: i
    });
    try {
      const d = Date.now(), f = await this.client.chat.completions.create({
        ...i,
        model: e,
        messages: t,
        tools: o,
        stream: !0
      });
      console.log("[OpenAIToolHandler] Stream received, processing chunks");
      let m = "", p = [], h = null, g = 0;
      for await (const T of f) {
        g++;
        const C = T.choices[0], S = C == null ? void 0 : C.delta;
        if (S != null && S.content && (m += S.content, this.onTokenReceived && this.onTokenReceived(S.content)), S != null && S.tool_calls)
          for (const E of S.tool_calls) {
            const I = E.index;
            p[I] ? (E.id && (p[I].id += E.id), (u = E.function) != null && u.name && (p[I].function.name += E.function.name), (c = E.function) != null && c.arguments && (p[I].function.arguments += E.function.arguments)) : p[I] = {
              id: E.id || "",
              type: "function",
              function: {
                name: ((r = E.function) == null ? void 0 : r.name) || "",
                arguments: ((a = E.function) == null ? void 0 : a.arguments) || ""
              }
            };
          }
        C != null && C.finish_reason && (h = C.finish_reason);
      }
      const _ = Date.now() - d;
      return console.log("[OpenAIToolHandler] makeStreamingRequest complete", {
        duration: `${_}ms`,
        chunkCount: g,
        accumulatedContentLength: m.length,
        toolCallsCount: p.length,
        finishReason: h
      }), {
        choices: [
          {
            finish_reason: h || "stop",
            message: {
              role: "assistant",
              content: m || null,
              tool_calls: p.length > 0 ? p : void 0
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
    } catch (d) {
      throw console.error("[OpenAIToolHandler] makeStreamingRequest failed", {
        error: d,
        errorMessage: d instanceof Error ? d.message : String(d),
        errorStack: d instanceof Error ? d.stack : void 0
      }), d;
    }
  }
  /**
   * Make a non-streaming request to OpenAI API
   */
  async makeNonStreamingRequest(e, t, o, i) {
    var r, a, u, c, d, f, m, p, h, g, _, T, C;
    console.log("[OpenAIToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: i
    });
    try {
      const S = Date.now(), E = await this.client.chat.completions.create({
        ...i,
        model: e,
        messages: t,
        tools: o,
        stream: !1
      }), I = Date.now() - S;
      return console.log("[OpenAIToolHandler] makeNonStreamingRequest response received", {
        duration: `${I}ms`,
        hasResponse: !!E,
        hasChoices: !!E.choices,
        choicesCount: ((r = E.choices) == null ? void 0 : r.length) || 0,
        finishReason: (u = (a = E.choices) == null ? void 0 : a[0]) == null ? void 0 : u.finish_reason,
        hasContent: !!((f = (d = (c = E.choices) == null ? void 0 : c[0]) == null ? void 0 : d.message) != null && f.content),
        hasToolCalls: !!((h = (p = (m = E.choices) == null ? void 0 : m[0]) == null ? void 0 : p.message) != null && h.tool_calls),
        toolCallsCount: ((C = (T = (_ = (g = E.choices) == null ? void 0 : g[0]) == null ? void 0 : _.message) == null ? void 0 : T.tool_calls) == null ? void 0 : C.length) || 0
      }), E;
    } catch (S) {
      throw console.error("[OpenAIToolHandler] makeNonStreamingRequest failed", {
        error: S,
        errorMessage: S instanceof Error ? S.message : String(S),
        errorStack: S instanceof Error ? S.stack : void 0
      }), S;
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
class Zo {
  constructor(e, t, o, i = [], r) {
    P(this, "client");
    P(this, "defaultModel");
    P(this, "tools");
    P(this, "onToolUse");
    P(this, "toolHandler");
    this.client = new Ko({ apiKey: t, baseURL: e, dangerouslyAllowBrowser: !0 }), this.defaultModel = o || "gpt-3.5-turbo", this.tools = i, this.onToolUse = r, i.length > 0 && (this.toolHandler = new Qo(this.client)), console.log(`OpenAIChatProvider initialized with model ${this.defaultModel}${i.length > 0 ? ` and ${i.length} tools` : ""}`);
  }
  /**
   * Send a chat request to OpenAI
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    var u, c, d, f;
    const o = e;
    if (console.log("[OpenAIChatProvider] chat called", {
      hasThreadId: !!o.thread_id,
      thread_id: o.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    const i = e.model || this.defaultModel, r = yn.toOpenAIRequest({ ...e, model: i });
    let a = {};
    if (o.thread_id) {
      const m = W.setBranchIteration(e.branch_id, 0);
      a = {
        thread_id: o.thread_id,
        branch_id: m
      };
    }
    try {
      if (e.streaming !== !1) {
        const m = {
          model: r.model,
          messages: r.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens,
          top_p: e.topP,
          frequency_penalty: e.frequencyPenalty,
          presence_penalty: e.presencePenalty,
          stop: e.stop,
          stream: !0,
          ...a
        };
        e.responseFormat !== void 0 && (m.response_format = e.responseFormat);
        const p = await this.client.chat.completions.create(m);
        for await (const h of p) {
          const g = ((c = (u = h.choices[0]) == null ? void 0 : u.delta) == null ? void 0 : c.content) || "";
          g && t && t(g);
        }
      } else {
        const m = {
          model: r.model,
          messages: r.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens,
          top_p: e.topP,
          frequency_penalty: e.frequencyPenalty,
          presence_penalty: e.presencePenalty,
          stop: e.stop,
          ...a
        };
        e.responseFormat !== void 0 && (m.response_format = {
          type: "json_schema",
          json_schema: {
            name: "schema_name",
            schema: e.responseFormat,
            strict: !0
          }
        });
        const h = ((f = (d = (await this.client.chat.completions.create(m)).choices[0]) == null ? void 0 : d.message) == null ? void 0 : f.content) || "";
        h && t && t(h);
      }
    } catch (m) {
      throw console.error("Error in OpenAI API call:", m), m;
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
    const o = e.model || this.defaultModel, i = yn.toOpenAIRequest({ ...e, model: o }), r = this.convertToolsToOpenAIFormat(this.tools);
    console.log("[OpenAIChatProvider] Converted request", {
      model: i.model,
      messagesCount: i.messages.length,
      toolsCount: r.length,
      shouldStream: e.streaming !== !1
    });
    try {
      console.log("[OpenAIChatProvider] Calling ChatProviderUtils.handleToolLoop"), await W.handleToolLoop(
        this.toolHandler,
        i.model,
        i.messages,
        r,
        e,
        this.onToolUse,
        t,
        e.streaming !== !1
      ), console.log("[OpenAIChatProvider] handleToolLoop completed");
    } catch (a) {
      throw console.error("[OpenAIChatProvider] Tool-enabled chat failed:", a), a;
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
class Tn {
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
    const t = e.messages.filter((i) => i.role !== "system"), o = {
      model: e.model,
      messages: t.map((i) => this.mapMessage(i)),
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
    return e.temperature !== void 0 && (o.temperature = e.temperature), e.maxTokens !== void 0 && (o.max_tokens = e.maxTokens), e.topP !== void 0 && (o.top_p = e.topP), e.stop !== void 0 && (o.stop_sequences = e.stop), o;
  }
}
class jo {
  constructor(e) {
    P(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   * This is called before each tool loop iteration to update the callback
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, t, o, i, r) {
    return console.log("[ClaudeToolHandler] makeRequest called", {
      model: e,
      shouldStream: r,
      toolsCount: o.length,
      messagesCount: t.length,
      threadContext: i,
      tools: o.map((a) => {
        var u;
        return {
          name: a.name,
          description: ((u = a.description) == null ? void 0 : u.substring(0, 50)) + "..."
        };
      }),
      messages: t.map((a) => ({
        role: a.role,
        contentType: Array.isArray(a.content) ? "array" : typeof a.content,
        contentPreview: Array.isArray(a.content) ? `[${a.content.length} blocks]` : typeof a.content == "string" ? a.content.substring(0, 50) + "..." : "N/A"
      }))
    }), r ? (console.log("[ClaudeToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, t, o, i)) : (console.log("[ClaudeToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, t, o, i));
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
      toolUses: e.map((i) => ({ id: i.id, name: i.name })),
      results: t.map((i) => ({
        success: i == null ? void 0 : i.success,
        hasData: !!(i != null && i.data),
        hasError: !!(i != null && i.error)
      }))
    });
    const o = e.map((i, r) => {
      const a = t[r], u = {
        type: "tool_result",
        tool_use_id: i.id,
        content: JSON.stringify({
          success: (a == null ? void 0 : a.success) ?? !1,
          data: (a == null ? void 0 : a.data) ?? null,
          error: (a == null ? void 0 : a.error) ?? null
        })
      };
      return console.log("[ClaudeToolHandler] formatToolResults - Formatted result", {
        toolUseId: i.id,
        toolName: i.name,
        resultSuccess: a == null ? void 0 : a.success,
        formattedContentLength: u.content.length
      }), u;
    });
    return console.log("[ClaudeToolHandler] formatToolResults - Output", {
      formattedResultsCount: o.length
    }), o;
  }
  appendMessages(e, t, o) {
    console.log("[ClaudeToolHandler] appendMessages - Input state", {
      currentMessagesCount: e.length,
      currentMessages: e.map((u) => ({
        role: u.role,
        contentType: Array.isArray(u.content) ? "array" : typeof u.content,
        contentLength: Array.isArray(u.content) || typeof u.content == "string" ? u.content.length : "N/A"
      })),
      responseContentBlocks: t.content.length,
      responseContentTypes: t.content.map((u) => u.type),
      toolResultsCount: o.length
    });
    const i = {
      role: "assistant",
      content: t.content
    }, r = {
      role: "user",
      content: o
    };
    console.log("[ClaudeToolHandler] appendMessages - New messages being added", {
      assistantMessageContentBlocks: i.content.length,
      userMessageToolResults: r.content.length
    });
    const a = [
      ...e,
      i,
      r
    ];
    return console.log("[ClaudeToolHandler] appendMessages - Output state", {
      newMessagesCount: a.length,
      lastTwoMessages: a.slice(-2).map((u) => ({
        role: u.role,
        contentType: Array.isArray(u.content) ? "array" : typeof u.content,
        contentLength: Array.isArray(u.content) || typeof u.content == "string" ? u.content.length : "N/A"
      }))
    }), a;
  }
  /**
   * Make a streaming request to Claude API
   * Streams text tokens in real-time while collecting the final message for tool extraction
   */
  async makeStreamingRequest(e, t, o, i) {
    var r, a;
    console.log("[ClaudeToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: i
    });
    try {
      const u = Date.now();
      let c = 0, d = 0;
      const f = this.client.messages.stream({
        model: e,
        messages: t,
        tools: o,
        max_tokens: 4096,
        stream: !0,
        ...i
      }).on("text", (h) => {
        c++, this.onTokenReceived && this.onTokenReceived(h);
      }).on("contentBlock", (h) => {
        d++, console.log("[ClaudeToolHandler] Stream contentBlock event", {
          contentBlockCount: d,
          blockType: h.type,
          ...h.type === "tool_use" ? {
            toolId: h.id,
            toolName: h.name
          } : {}
        });
      }).on("message", (h) => {
        console.log("[ClaudeToolHandler] Stream message event", {
          messageId: h.id,
          stopReason: h.stop_reason,
          contentBlocksCount: h.content.length,
          contentTypes: h.content.map((g) => g.type)
        });
      });
      console.log("[ClaudeToolHandler] Stream started, waiting for final message");
      const m = await f.finalMessage(), p = Date.now() - u;
      return console.log("[ClaudeToolHandler] makeStreamingRequest complete", {
        duration: `${p}ms`,
        hasMessage: !!m,
        responseId: m.id,
        model: m.model,
        stopReason: m.stop_reason,
        contentBlocksCount: ((r = m.content) == null ? void 0 : r.length) || 0,
        contentBlockTypes: ((a = m.content) == null ? void 0 : a.map((h) => h.type)) || [],
        totalTokensStreamed: c,
        usage: m.usage
      }), m;
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
  async makeNonStreamingRequest(e, t, o, i) {
    var r, a;
    console.log("[ClaudeToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: i
    });
    try {
      const u = Date.now(), c = await this.client.messages.create({
        model: e,
        messages: t,
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
    return e.filter((t) => t.type === "tool_use");
  }
}
class ei {
  constructor(e, t, o, i = [], r) {
    P(this, "client");
    P(this, "defaultModel");
    P(this, "tools");
    P(this, "onToolUse");
    P(this, "toolHandler");
    this.client = new Yo({
      apiKey: t,
      dangerouslyAllowBrowser: !0
    }), e && (this.client.baseURL = e), this.defaultModel = o || "claude-3-opus-20240229", this.tools = i, this.onToolUse = r, i.length > 0 && (this.toolHandler = new jo(this.client)), console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}${i.length > 0 ? ` and ${i.length} tools` : ""}`);
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
    const i = e.model || this.defaultModel, r = Tn.toClaudeRequest({ ...e, model: i });
    let a = {};
    if (o.thread_id) {
      const u = W.setBranchIteration(e.branch_id, 0);
      a = {
        thread_id: o.thread_id,
        branch_id: u
      };
    }
    try {
      if (e.streaming !== !1) {
        const u = this.client.messages.stream({
          ...a,
          model: r.model,
          messages: r.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          stream: !0,
          system: r.system
        }).on("text", (d) => {
          t && t(d);
        });
        console.log("waiting for final message");
        const c = await u.finalMessage();
        console.log(c);
      } else {
        const u = await this.client.messages.create({
          ...a,
          model: r.model,
          messages: r.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          system: r.system
        });
        if (u.content && u.content.length > 0) {
          const c = u.content.filter((d) => d.type === "text").map((d) => d.text).join("");
          t && t(c);
        }
      }
    } catch (u) {
      throw console.error("Error in Claude API call:", u), u;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, t) {
    var a;
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
    const o = e.model || this.defaultModel, i = Tn.toClaudeRequest({ ...e, model: o }), r = this.convertToolsToClaudeFormat(this.tools);
    console.log("[ClaudeChatProvider] Converted request for tool loop", {
      model: i.model,
      system: ((a = i.system) == null ? void 0 : a.substring(0, 100)) + "...",
      messagesCount: i.messages.length,
      messages: i.messages.map((u) => {
        var c;
        return {
          role: u.role,
          contentType: typeof u.content,
          contentPreview: typeof u.content == "string" ? u.content.substring(0, 50) + "..." : `[${((c = u.content) == null ? void 0 : c.length) || 0} items]`
        };
      }),
      toolsCount: r.length,
      tools: r.map((u) => {
        var c;
        return {
          name: u.name,
          description: ((c = u.description) == null ? void 0 : c.substring(0, 50)) + "..."
        };
      }),
      shouldStream: e.streaming !== !1,
      hasOnTokenReceived: !!t
    });
    try {
      console.log("[ClaudeChatProvider] Calling ChatProviderUtils.handleToolLoop"), await W.handleToolLoop(
        this.toolHandler,
        i.model,
        i.messages,
        r,
        e,
        this.onToolUse,
        t,
        e.streaming !== !1
      ), console.log("[ClaudeChatProvider] handleToolLoop completed successfully");
    } catch (u) {
      throw console.error("[ClaudeChatProvider] Tool-enabled chat failed:", {
        error: u,
        errorMessage: u instanceof Error ? u.message : String(u),
        errorStack: u instanceof Error ? u.stack : void 0
      }), u;
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
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
let ni, ti;
function oi() {
  return {
    geminiUrl: ni,
    vertexUrl: ti
  };
}
function ii(n, e, t, o) {
  var i, r;
  if (!(n != null && n.baseUrl)) {
    const a = oi();
    return e ? (i = a.vertexUrl) !== null && i !== void 0 ? i : t : (r = a.geminiUrl) !== null && r !== void 0 ? r : o;
  }
  return n.baseUrl;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class z {
}
function v(n, e) {
  const t = /\{([^}]+)\}/g;
  return n.replace(t, (o, i) => {
    if (Object.prototype.hasOwnProperty.call(e, i)) {
      const r = e[i];
      return r != null ? String(r) : "";
    } else
      throw new Error(`Key '${i}' not found in valueMap.`);
  });
}
function l(n, e, t) {
  for (let r = 0; r < e.length - 1; r++) {
    const a = e[r];
    if (a.endsWith("[]")) {
      const u = a.slice(0, -2);
      if (!(u in n))
        if (Array.isArray(t))
          n[u] = Array.from({ length: t.length }, () => ({}));
        else
          throw new Error(`Value must be a list given an array path ${a}`);
      if (Array.isArray(n[u])) {
        const c = n[u];
        if (Array.isArray(t))
          for (let d = 0; d < c.length; d++) {
            const f = c[d];
            l(f, e.slice(r + 1), t[d]);
          }
        else
          for (const d of c)
            l(d, e.slice(r + 1), t);
      }
      return;
    } else if (a.endsWith("[0]")) {
      const u = a.slice(0, -3);
      u in n || (n[u] = [{}]);
      const c = n[u];
      l(c[0], e.slice(r + 1), t);
      return;
    }
    (!n[a] || typeof n[a] != "object") && (n[a] = {}), n = n[a];
  }
  const o = e[e.length - 1], i = n[o];
  if (i !== void 0) {
    if (!t || typeof t == "object" && Object.keys(t).length === 0 || t === i)
      return;
    if (typeof i == "object" && typeof t == "object" && i !== null && t !== null)
      Object.assign(i, t);
    else
      throw new Error(`Cannot set value for an existing key. Key: ${o}`);
  } else
    o === "_self" && typeof t == "object" && t !== null && !Array.isArray(t) ? Object.assign(n, t) : n[o] = t;
}
function s(n, e, t = void 0) {
  try {
    if (e.length === 1 && e[0] === "_self")
      return n;
    for (let o = 0; o < e.length; o++) {
      if (typeof n != "object" || n === null)
        return t;
      const i = e[o];
      if (i.endsWith("[]")) {
        const r = i.slice(0, -2);
        if (r in n) {
          const a = n[r];
          return Array.isArray(a) ? a.map((u) => s(u, e.slice(o + 1), t)) : t;
        } else
          return t;
      } else
        n = n[i];
    }
    return n;
  } catch (o) {
    if (o instanceof TypeError)
      return t;
    throw o;
  }
}
function si(n, e) {
  for (const [t, o] of Object.entries(e)) {
    const i = t.split("."), r = o.split("."), a = /* @__PURE__ */ new Set();
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
    be(n, i, r, 0, a);
  }
}
function be(n, e, t, o, i) {
  if (o >= e.length || typeof n != "object" || n === null)
    return;
  const r = e[o];
  if (r.endsWith("[]")) {
    const a = r.slice(0, -2), u = n;
    if (a in u && Array.isArray(u[a]))
      for (const c of u[a])
        be(c, e, t, o + 1, i);
  } else if (r === "*") {
    if (typeof n == "object" && n !== null && !Array.isArray(n)) {
      const a = n, u = Object.keys(a).filter((d) => !d.startsWith("_") && !i.has(d)), c = {};
      for (const d of u)
        c[d] = a[d];
      for (const [d, f] of Object.entries(c)) {
        const m = [];
        for (const p of t.slice(o))
          p === "*" ? m.push(d) : m.push(p);
        l(a, m, f);
      }
      for (const d of u)
        delete a[d];
    }
  } else {
    const a = n;
    r in a && be(a[r], e, t, o + 1, i);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function on(n) {
  if (typeof n != "string")
    throw new Error("fromImageBytes must be a string");
  return n;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function ri(n) {
  const e = {}, t = s(n, [
    "operationName"
  ]);
  t != null && l(e, ["operationName"], t);
  const o = s(n, ["resourceName"]);
  return o != null && l(e, ["_url", "resourceName"], o), e;
}
function li(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["name"], t);
  const o = s(n, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(n, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(n, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(n, [
    "response",
    "generateVideoResponse"
  ]);
  return a != null && l(e, ["response"], ui(a)), e;
}
function ai(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["name"], t);
  const o = s(n, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(n, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(n, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(n, ["response"]);
  return a != null && l(e, ["response"], di(a)), e;
}
function ui(n) {
  const e = {}, t = s(n, [
    "generatedSamples"
  ]);
  if (t != null) {
    let r = t;
    Array.isArray(r) && (r = r.map((a) => ci(a))), l(e, ["generatedVideos"], r);
  }
  const o = s(n, [
    "raiMediaFilteredCount"
  ]);
  o != null && l(e, ["raiMediaFilteredCount"], o);
  const i = s(n, [
    "raiMediaFilteredReasons"
  ]);
  return i != null && l(e, ["raiMediaFilteredReasons"], i), e;
}
function di(n) {
  const e = {}, t = s(n, ["videos"]);
  if (t != null) {
    let r = t;
    Array.isArray(r) && (r = r.map((a) => fi(a))), l(e, ["generatedVideos"], r);
  }
  const o = s(n, [
    "raiMediaFilteredCount"
  ]);
  o != null && l(e, ["raiMediaFilteredCount"], o);
  const i = s(n, [
    "raiMediaFilteredReasons"
  ]);
  return i != null && l(e, ["raiMediaFilteredReasons"], i), e;
}
function ci(n) {
  const e = {}, t = s(n, ["video"]);
  return t != null && l(e, ["video"], Ti(t)), e;
}
function fi(n) {
  const e = {}, t = s(n, ["_self"]);
  return t != null && l(e, ["video"], _i(t)), e;
}
function pi(n) {
  const e = {}, t = s(n, [
    "operationName"
  ]);
  return t != null && l(e, ["_url", "operationName"], t), e;
}
function mi(n) {
  const e = {}, t = s(n, [
    "operationName"
  ]);
  return t != null && l(e, ["_url", "operationName"], t), e;
}
function hi(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["name"], t);
  const o = s(n, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(n, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(n, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(n, ["response"]);
  return a != null && l(e, ["response"], gi(a)), e;
}
function gi(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(n, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function Zt(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["name"], t);
  const o = s(n, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(n, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(n, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(n, ["response"]);
  return a != null && l(e, ["response"], yi(a)), e;
}
function yi(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(n, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function Ti(n) {
  const e = {}, t = s(n, ["uri"]);
  t != null && l(e, ["uri"], t);
  const o = s(n, ["encodedVideo"]);
  o != null && l(e, ["videoBytes"], on(o));
  const i = s(n, ["encoding"]);
  return i != null && l(e, ["mimeType"], i), e;
}
function _i(n) {
  const e = {}, t = s(n, ["gcsUri"]);
  t != null && l(e, ["uri"], t);
  const o = s(n, [
    "bytesBase64Encoded"
  ]);
  o != null && l(e, ["videoBytes"], on(o));
  const i = s(n, ["mimeType"]);
  return i != null && l(e, ["mimeType"], i), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var _n;
(function(n) {
  n.OUTCOME_UNSPECIFIED = "OUTCOME_UNSPECIFIED", n.OUTCOME_OK = "OUTCOME_OK", n.OUTCOME_FAILED = "OUTCOME_FAILED", n.OUTCOME_DEADLINE_EXCEEDED = "OUTCOME_DEADLINE_EXCEEDED";
})(_n || (_n = {}));
var Cn;
(function(n) {
  n.LANGUAGE_UNSPECIFIED = "LANGUAGE_UNSPECIFIED", n.PYTHON = "PYTHON";
})(Cn || (Cn = {}));
var En;
(function(n) {
  n.SCHEDULING_UNSPECIFIED = "SCHEDULING_UNSPECIFIED", n.SILENT = "SILENT", n.WHEN_IDLE = "WHEN_IDLE", n.INTERRUPT = "INTERRUPT";
})(En || (En = {}));
var Q;
(function(n) {
  n.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", n.STRING = "STRING", n.NUMBER = "NUMBER", n.INTEGER = "INTEGER", n.BOOLEAN = "BOOLEAN", n.ARRAY = "ARRAY", n.OBJECT = "OBJECT", n.NULL = "NULL";
})(Q || (Q = {}));
var Sn;
(function(n) {
  n.API_SPEC_UNSPECIFIED = "API_SPEC_UNSPECIFIED", n.SIMPLE_SEARCH = "SIMPLE_SEARCH", n.ELASTIC_SEARCH = "ELASTIC_SEARCH";
})(Sn || (Sn = {}));
var In;
(function(n) {
  n.AUTH_TYPE_UNSPECIFIED = "AUTH_TYPE_UNSPECIFIED", n.NO_AUTH = "NO_AUTH", n.API_KEY_AUTH = "API_KEY_AUTH", n.HTTP_BASIC_AUTH = "HTTP_BASIC_AUTH", n.GOOGLE_SERVICE_ACCOUNT_AUTH = "GOOGLE_SERVICE_ACCOUNT_AUTH", n.OAUTH = "OAUTH", n.OIDC_AUTH = "OIDC_AUTH";
})(In || (In = {}));
var vn;
(function(n) {
  n.HTTP_IN_UNSPECIFIED = "HTTP_IN_UNSPECIFIED", n.HTTP_IN_QUERY = "HTTP_IN_QUERY", n.HTTP_IN_HEADER = "HTTP_IN_HEADER", n.HTTP_IN_PATH = "HTTP_IN_PATH", n.HTTP_IN_BODY = "HTTP_IN_BODY", n.HTTP_IN_COOKIE = "HTTP_IN_COOKIE";
})(vn || (vn = {}));
var An;
(function(n) {
  n.PHISH_BLOCK_THRESHOLD_UNSPECIFIED = "PHISH_BLOCK_THRESHOLD_UNSPECIFIED", n.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", n.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", n.BLOCK_HIGH_AND_ABOVE = "BLOCK_HIGH_AND_ABOVE", n.BLOCK_HIGHER_AND_ABOVE = "BLOCK_HIGHER_AND_ABOVE", n.BLOCK_VERY_HIGH_AND_ABOVE = "BLOCK_VERY_HIGH_AND_ABOVE", n.BLOCK_ONLY_EXTREMELY_HIGH = "BLOCK_ONLY_EXTREMELY_HIGH";
})(An || (An = {}));
var Rn;
(function(n) {
  n.UNSPECIFIED = "UNSPECIFIED", n.BLOCKING = "BLOCKING", n.NON_BLOCKING = "NON_BLOCKING";
})(Rn || (Rn = {}));
var Pn;
(function(n) {
  n.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", n.MODE_DYNAMIC = "MODE_DYNAMIC";
})(Pn || (Pn = {}));
var wn;
(function(n) {
  n.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", n.AUTO = "AUTO", n.ANY = "ANY", n.NONE = "NONE", n.VALIDATED = "VALIDATED";
})(wn || (wn = {}));
var Mn;
(function(n) {
  n.THINKING_LEVEL_UNSPECIFIED = "THINKING_LEVEL_UNSPECIFIED", n.LOW = "LOW", n.MEDIUM = "MEDIUM", n.HIGH = "HIGH", n.MINIMAL = "MINIMAL";
})(Mn || (Mn = {}));
var Nn;
(function(n) {
  n.HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED", n.HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT", n.HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH", n.HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT", n.HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT", n.HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY", n.HARM_CATEGORY_IMAGE_HATE = "HARM_CATEGORY_IMAGE_HATE", n.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT = "HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT", n.HARM_CATEGORY_IMAGE_HARASSMENT = "HARM_CATEGORY_IMAGE_HARASSMENT", n.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT = "HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT", n.HARM_CATEGORY_JAILBREAK = "HARM_CATEGORY_JAILBREAK";
})(Nn || (Nn = {}));
var xn;
(function(n) {
  n.HARM_BLOCK_METHOD_UNSPECIFIED = "HARM_BLOCK_METHOD_UNSPECIFIED", n.SEVERITY = "SEVERITY", n.PROBABILITY = "PROBABILITY";
})(xn || (xn = {}));
var Dn;
(function(n) {
  n.HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED", n.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", n.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", n.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", n.BLOCK_NONE = "BLOCK_NONE", n.OFF = "OFF";
})(Dn || (Dn = {}));
var kn;
(function(n) {
  n.FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED", n.STOP = "STOP", n.MAX_TOKENS = "MAX_TOKENS", n.SAFETY = "SAFETY", n.RECITATION = "RECITATION", n.LANGUAGE = "LANGUAGE", n.OTHER = "OTHER", n.BLOCKLIST = "BLOCKLIST", n.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", n.SPII = "SPII", n.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", n.IMAGE_SAFETY = "IMAGE_SAFETY", n.UNEXPECTED_TOOL_CALL = "UNEXPECTED_TOOL_CALL", n.IMAGE_PROHIBITED_CONTENT = "IMAGE_PROHIBITED_CONTENT", n.NO_IMAGE = "NO_IMAGE", n.IMAGE_RECITATION = "IMAGE_RECITATION", n.IMAGE_OTHER = "IMAGE_OTHER";
})(kn || (kn = {}));
var Un;
(function(n) {
  n.HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED", n.NEGLIGIBLE = "NEGLIGIBLE", n.LOW = "LOW", n.MEDIUM = "MEDIUM", n.HIGH = "HIGH";
})(Un || (Un = {}));
var Ln;
(function(n) {
  n.HARM_SEVERITY_UNSPECIFIED = "HARM_SEVERITY_UNSPECIFIED", n.HARM_SEVERITY_NEGLIGIBLE = "HARM_SEVERITY_NEGLIGIBLE", n.HARM_SEVERITY_LOW = "HARM_SEVERITY_LOW", n.HARM_SEVERITY_MEDIUM = "HARM_SEVERITY_MEDIUM", n.HARM_SEVERITY_HIGH = "HARM_SEVERITY_HIGH";
})(Ln || (Ln = {}));
var Fn;
(function(n) {
  n.URL_RETRIEVAL_STATUS_UNSPECIFIED = "URL_RETRIEVAL_STATUS_UNSPECIFIED", n.URL_RETRIEVAL_STATUS_SUCCESS = "URL_RETRIEVAL_STATUS_SUCCESS", n.URL_RETRIEVAL_STATUS_ERROR = "URL_RETRIEVAL_STATUS_ERROR", n.URL_RETRIEVAL_STATUS_PAYWALL = "URL_RETRIEVAL_STATUS_PAYWALL", n.URL_RETRIEVAL_STATUS_UNSAFE = "URL_RETRIEVAL_STATUS_UNSAFE";
})(Fn || (Fn = {}));
var Gn;
(function(n) {
  n.BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED", n.SAFETY = "SAFETY", n.OTHER = "OTHER", n.BLOCKLIST = "BLOCKLIST", n.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", n.IMAGE_SAFETY = "IMAGE_SAFETY", n.MODEL_ARMOR = "MODEL_ARMOR", n.JAILBREAK = "JAILBREAK";
})(Gn || (Gn = {}));
var Vn;
(function(n) {
  n.TRAFFIC_TYPE_UNSPECIFIED = "TRAFFIC_TYPE_UNSPECIFIED", n.ON_DEMAND = "ON_DEMAND", n.PROVISIONED_THROUGHPUT = "PROVISIONED_THROUGHPUT";
})(Vn || (Vn = {}));
var ve;
(function(n) {
  n.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", n.TEXT = "TEXT", n.IMAGE = "IMAGE", n.AUDIO = "AUDIO";
})(ve || (ve = {}));
var Hn;
(function(n) {
  n.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", n.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", n.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", n.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH";
})(Hn || (Hn = {}));
var qn;
(function(n) {
  n.TUNING_MODE_UNSPECIFIED = "TUNING_MODE_UNSPECIFIED", n.TUNING_MODE_FULL = "TUNING_MODE_FULL", n.TUNING_MODE_PEFT_ADAPTER = "TUNING_MODE_PEFT_ADAPTER";
})(qn || (qn = {}));
var bn;
(function(n) {
  n.ADAPTER_SIZE_UNSPECIFIED = "ADAPTER_SIZE_UNSPECIFIED", n.ADAPTER_SIZE_ONE = "ADAPTER_SIZE_ONE", n.ADAPTER_SIZE_TWO = "ADAPTER_SIZE_TWO", n.ADAPTER_SIZE_FOUR = "ADAPTER_SIZE_FOUR", n.ADAPTER_SIZE_EIGHT = "ADAPTER_SIZE_EIGHT", n.ADAPTER_SIZE_SIXTEEN = "ADAPTER_SIZE_SIXTEEN", n.ADAPTER_SIZE_THIRTY_TWO = "ADAPTER_SIZE_THIRTY_TWO";
})(bn || (bn = {}));
var Be;
(function(n) {
  n.JOB_STATE_UNSPECIFIED = "JOB_STATE_UNSPECIFIED", n.JOB_STATE_QUEUED = "JOB_STATE_QUEUED", n.JOB_STATE_PENDING = "JOB_STATE_PENDING", n.JOB_STATE_RUNNING = "JOB_STATE_RUNNING", n.JOB_STATE_SUCCEEDED = "JOB_STATE_SUCCEEDED", n.JOB_STATE_FAILED = "JOB_STATE_FAILED", n.JOB_STATE_CANCELLING = "JOB_STATE_CANCELLING", n.JOB_STATE_CANCELLED = "JOB_STATE_CANCELLED", n.JOB_STATE_PAUSED = "JOB_STATE_PAUSED", n.JOB_STATE_EXPIRED = "JOB_STATE_EXPIRED", n.JOB_STATE_UPDATING = "JOB_STATE_UPDATING", n.JOB_STATE_PARTIALLY_SUCCEEDED = "JOB_STATE_PARTIALLY_SUCCEEDED";
})(Be || (Be = {}));
var Bn;
(function(n) {
  n.TUNING_TASK_UNSPECIFIED = "TUNING_TASK_UNSPECIFIED", n.TUNING_TASK_I2V = "TUNING_TASK_I2V", n.TUNING_TASK_T2V = "TUNING_TASK_T2V", n.TUNING_TASK_R2V = "TUNING_TASK_R2V";
})(Bn || (Bn = {}));
var Jn;
(function(n) {
  n.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", n.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", n.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", n.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH", n.MEDIA_RESOLUTION_ULTRA_HIGH = "MEDIA_RESOLUTION_ULTRA_HIGH";
})(Jn || (Jn = {}));
var Je;
(function(n) {
  n.COLLECTION = "COLLECTION";
})(Je || (Je = {}));
var On;
(function(n) {
  n.FEATURE_SELECTION_PREFERENCE_UNSPECIFIED = "FEATURE_SELECTION_PREFERENCE_UNSPECIFIED", n.PRIORITIZE_QUALITY = "PRIORITIZE_QUALITY", n.BALANCED = "BALANCED", n.PRIORITIZE_COST = "PRIORITIZE_COST";
})(On || (On = {}));
var $n;
(function(n) {
  n.ENVIRONMENT_UNSPECIFIED = "ENVIRONMENT_UNSPECIFIED", n.ENVIRONMENT_BROWSER = "ENVIRONMENT_BROWSER";
})($n || ($n = {}));
var Wn;
(function(n) {
  n.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", n.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", n.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", n.BLOCK_NONE = "BLOCK_NONE";
})(Wn || (Wn = {}));
var Kn;
(function(n) {
  n.DONT_ALLOW = "DONT_ALLOW", n.ALLOW_ADULT = "ALLOW_ADULT", n.ALLOW_ALL = "ALLOW_ALL";
})(Kn || (Kn = {}));
var Yn;
(function(n) {
  n.auto = "auto", n.en = "en", n.ja = "ja", n.ko = "ko", n.hi = "hi", n.zh = "zh", n.pt = "pt", n.es = "es";
})(Yn || (Yn = {}));
var zn;
(function(n) {
  n.MASK_MODE_DEFAULT = "MASK_MODE_DEFAULT", n.MASK_MODE_USER_PROVIDED = "MASK_MODE_USER_PROVIDED", n.MASK_MODE_BACKGROUND = "MASK_MODE_BACKGROUND", n.MASK_MODE_FOREGROUND = "MASK_MODE_FOREGROUND", n.MASK_MODE_SEMANTIC = "MASK_MODE_SEMANTIC";
})(zn || (zn = {}));
var Xn;
(function(n) {
  n.CONTROL_TYPE_DEFAULT = "CONTROL_TYPE_DEFAULT", n.CONTROL_TYPE_CANNY = "CONTROL_TYPE_CANNY", n.CONTROL_TYPE_SCRIBBLE = "CONTROL_TYPE_SCRIBBLE", n.CONTROL_TYPE_FACE_MESH = "CONTROL_TYPE_FACE_MESH";
})(Xn || (Xn = {}));
var Qn;
(function(n) {
  n.SUBJECT_TYPE_DEFAULT = "SUBJECT_TYPE_DEFAULT", n.SUBJECT_TYPE_PERSON = "SUBJECT_TYPE_PERSON", n.SUBJECT_TYPE_ANIMAL = "SUBJECT_TYPE_ANIMAL", n.SUBJECT_TYPE_PRODUCT = "SUBJECT_TYPE_PRODUCT";
})(Qn || (Qn = {}));
var Zn;
(function(n) {
  n.EDIT_MODE_DEFAULT = "EDIT_MODE_DEFAULT", n.EDIT_MODE_INPAINT_REMOVAL = "EDIT_MODE_INPAINT_REMOVAL", n.EDIT_MODE_INPAINT_INSERTION = "EDIT_MODE_INPAINT_INSERTION", n.EDIT_MODE_OUTPAINT = "EDIT_MODE_OUTPAINT", n.EDIT_MODE_CONTROLLED_EDITING = "EDIT_MODE_CONTROLLED_EDITING", n.EDIT_MODE_STYLE = "EDIT_MODE_STYLE", n.EDIT_MODE_BGSWAP = "EDIT_MODE_BGSWAP", n.EDIT_MODE_PRODUCT_IMAGE = "EDIT_MODE_PRODUCT_IMAGE";
})(Zn || (Zn = {}));
var jn;
(function(n) {
  n.FOREGROUND = "FOREGROUND", n.BACKGROUND = "BACKGROUND", n.PROMPT = "PROMPT", n.SEMANTIC = "SEMANTIC", n.INTERACTIVE = "INTERACTIVE";
})(jn || (jn = {}));
var et;
(function(n) {
  n.ASSET = "ASSET", n.STYLE = "STYLE";
})(et || (et = {}));
var nt;
(function(n) {
  n.INSERT = "INSERT", n.REMOVE = "REMOVE", n.REMOVE_STATIC = "REMOVE_STATIC", n.OUTPAINT = "OUTPAINT";
})(nt || (nt = {}));
var tt;
(function(n) {
  n.OPTIMIZED = "OPTIMIZED", n.LOSSLESS = "LOSSLESS";
})(tt || (tt = {}));
var ot;
(function(n) {
  n.SUPERVISED_FINE_TUNING = "SUPERVISED_FINE_TUNING", n.PREFERENCE_TUNING = "PREFERENCE_TUNING", n.DISTILLATION = "DISTILLATION";
})(ot || (ot = {}));
var it;
(function(n) {
  n.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", n.STATE_PENDING = "STATE_PENDING", n.STATE_ACTIVE = "STATE_ACTIVE", n.STATE_FAILED = "STATE_FAILED";
})(it || (it = {}));
var st;
(function(n) {
  n.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", n.PROCESSING = "PROCESSING", n.ACTIVE = "ACTIVE", n.FAILED = "FAILED";
})(st || (st = {}));
var rt;
(function(n) {
  n.SOURCE_UNSPECIFIED = "SOURCE_UNSPECIFIED", n.UPLOADED = "UPLOADED", n.GENERATED = "GENERATED", n.REGISTERED = "REGISTERED";
})(rt || (rt = {}));
var lt;
(function(n) {
  n.TURN_COMPLETE_REASON_UNSPECIFIED = "TURN_COMPLETE_REASON_UNSPECIFIED", n.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", n.RESPONSE_REJECTED = "RESPONSE_REJECTED", n.NEED_MORE_INPUT = "NEED_MORE_INPUT";
})(lt || (lt = {}));
var at;
(function(n) {
  n.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", n.TEXT = "TEXT", n.IMAGE = "IMAGE", n.VIDEO = "VIDEO", n.AUDIO = "AUDIO", n.DOCUMENT = "DOCUMENT";
})(at || (at = {}));
var ut;
(function(n) {
  n.VAD_SIGNAL_TYPE_UNSPECIFIED = "VAD_SIGNAL_TYPE_UNSPECIFIED", n.VAD_SIGNAL_TYPE_SOS = "VAD_SIGNAL_TYPE_SOS", n.VAD_SIGNAL_TYPE_EOS = "VAD_SIGNAL_TYPE_EOS";
})(ut || (ut = {}));
var dt;
(function(n) {
  n.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", n.ACTIVITY_START = "ACTIVITY_START", n.ACTIVITY_END = "ACTIVITY_END";
})(dt || (dt = {}));
var ct;
(function(n) {
  n.START_SENSITIVITY_UNSPECIFIED = "START_SENSITIVITY_UNSPECIFIED", n.START_SENSITIVITY_HIGH = "START_SENSITIVITY_HIGH", n.START_SENSITIVITY_LOW = "START_SENSITIVITY_LOW";
})(ct || (ct = {}));
var ft;
(function(n) {
  n.END_SENSITIVITY_UNSPECIFIED = "END_SENSITIVITY_UNSPECIFIED", n.END_SENSITIVITY_HIGH = "END_SENSITIVITY_HIGH", n.END_SENSITIVITY_LOW = "END_SENSITIVITY_LOW";
})(ft || (ft = {}));
var pt;
(function(n) {
  n.ACTIVITY_HANDLING_UNSPECIFIED = "ACTIVITY_HANDLING_UNSPECIFIED", n.START_OF_ACTIVITY_INTERRUPTS = "START_OF_ACTIVITY_INTERRUPTS", n.NO_INTERRUPTION = "NO_INTERRUPTION";
})(pt || (pt = {}));
var mt;
(function(n) {
  n.TURN_COVERAGE_UNSPECIFIED = "TURN_COVERAGE_UNSPECIFIED", n.TURN_INCLUDES_ONLY_ACTIVITY = "TURN_INCLUDES_ONLY_ACTIVITY", n.TURN_INCLUDES_ALL_INPUT = "TURN_INCLUDES_ALL_INPUT";
})(mt || (mt = {}));
var ht;
(function(n) {
  n.SCALE_UNSPECIFIED = "SCALE_UNSPECIFIED", n.C_MAJOR_A_MINOR = "C_MAJOR_A_MINOR", n.D_FLAT_MAJOR_B_FLAT_MINOR = "D_FLAT_MAJOR_B_FLAT_MINOR", n.D_MAJOR_B_MINOR = "D_MAJOR_B_MINOR", n.E_FLAT_MAJOR_C_MINOR = "E_FLAT_MAJOR_C_MINOR", n.E_MAJOR_D_FLAT_MINOR = "E_MAJOR_D_FLAT_MINOR", n.F_MAJOR_D_MINOR = "F_MAJOR_D_MINOR", n.G_FLAT_MAJOR_E_FLAT_MINOR = "G_FLAT_MAJOR_E_FLAT_MINOR", n.G_MAJOR_E_MINOR = "G_MAJOR_E_MINOR", n.A_FLAT_MAJOR_F_MINOR = "A_FLAT_MAJOR_F_MINOR", n.A_MAJOR_G_FLAT_MINOR = "A_MAJOR_G_FLAT_MINOR", n.B_FLAT_MAJOR_G_MINOR = "B_FLAT_MAJOR_G_MINOR", n.B_MAJOR_A_FLAT_MINOR = "B_MAJOR_A_FLAT_MINOR";
})(ht || (ht = {}));
var gt;
(function(n) {
  n.MUSIC_GENERATION_MODE_UNSPECIFIED = "MUSIC_GENERATION_MODE_UNSPECIFIED", n.QUALITY = "QUALITY", n.DIVERSITY = "DIVERSITY", n.VOCALIZATION = "VOCALIZATION";
})(gt || (gt = {}));
var se;
(function(n) {
  n.PLAYBACK_CONTROL_UNSPECIFIED = "PLAYBACK_CONTROL_UNSPECIFIED", n.PLAY = "PLAY", n.PAUSE = "PAUSE", n.STOP = "STOP", n.RESET_CONTEXT = "RESET_CONTEXT";
})(se || (se = {}));
class Oe {
  constructor(e) {
    const t = {};
    for (const o of e.headers.entries())
      t[o[0]] = o[1];
    this.headers = t, this.responseInternal = e;
  }
  json() {
    return this.responseInternal.json();
  }
}
class fe {
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
    var e, t, o, i, r, a, u, c;
    if (((i = (o = (t = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || t === void 0 ? void 0 : t.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning text from the first one.");
    let d = "", f = !1;
    const m = [];
    for (const p of (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) !== null && c !== void 0 ? c : []) {
      for (const [h, g] of Object.entries(p))
        h !== "text" && h !== "thought" && h !== "thoughtSignature" && (g !== null || g !== void 0) && m.push(h);
      if (typeof p.text == "string") {
        if (typeof p.thought == "boolean" && p.thought)
          continue;
        f = !0, d += p.text;
      }
    }
    return m.length > 0 && console.warn(`there are non-text parts ${m} in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.`), f ? d : void 0;
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
    var e, t, o, i, r, a, u, c;
    if (((i = (o = (t = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || t === void 0 ? void 0 : t.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning data from the first one.");
    let d = "";
    const f = [];
    for (const m of (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) !== null && c !== void 0 ? c : []) {
      for (const [p, h] of Object.entries(m))
        p !== "inlineData" && (h !== null || h !== void 0) && f.push(p);
      m.inlineData && typeof m.inlineData.data == "string" && (d += atob(m.inlineData.data));
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
    var e, t, o, i, r, a, u, c;
    if (((i = (o = (t = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || t === void 0 ? void 0 : t.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
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
    var e, t, o, i, r, a, u, c, d;
    if (((i = (o = (t = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || t === void 0 ? void 0 : t.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning executable code from the first one.");
    const f = (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) === null || c === void 0 ? void 0 : c.filter((m) => m.executableCode).map((m) => m.executableCode).filter((m) => m !== void 0);
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
    var e, t, o, i, r, a, u, c, d;
    if (((i = (o = (t = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || t === void 0 ? void 0 : t.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning code execution result from the first one.");
    const f = (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) === null || c === void 0 ? void 0 : c.filter((m) => m.codeExecutionResult).map((m) => m.codeExecutionResult).filter((m) => m !== void 0);
    if ((f == null ? void 0 : f.length) !== 0)
      return (d = f == null ? void 0 : f[0]) === null || d === void 0 ? void 0 : d.output;
  }
}
class yt {
}
class Tt {
}
class Ci {
}
class Ei {
}
class Si {
}
class Ii {
}
class _t {
}
class Ct {
}
class Et {
}
class vi {
}
class Ae {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: t }) {
    const o = new Ae();
    let i;
    const r = e;
    return t ? i = ai(r) : i = li(r), Object.assign(o, i), o;
  }
}
class St {
}
class It {
}
class vt {
}
class At {
}
class Ai {
}
class Ri {
}
class Pi {
}
class sn {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: t }) {
    const o = new sn(), r = hi(e);
    return Object.assign(o, r), o;
  }
}
class wi {
}
class Mi {
}
class Ni {
}
class xi {
}
class Rt {
}
class Di {
  /**
   * Returns the concatenation of all text parts from the server content if present.
   *
   * @remarks
   * If there are non-text parts in the response, the concatenation of all text
   * parts will be returned, and a warning will be logged.
   */
  get text() {
    var e, t, o;
    let i = "", r = !1;
    const a = [];
    for (const u of (o = (t = (e = this.serverContent) === null || e === void 0 ? void 0 : e.modelTurn) === null || t === void 0 ? void 0 : t.parts) !== null && o !== void 0 ? o : []) {
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
    var e, t, o;
    let i = "";
    const r = [];
    for (const a of (o = (t = (e = this.serverContent) === null || e === void 0 ? void 0 : e.modelTurn) === null || t === void 0 ? void 0 : t.parts) !== null && o !== void 0 ? o : []) {
      for (const [u, c] of Object.entries(a))
        u !== "inlineData" && c !== null && r.push(u);
      a.inlineData && typeof a.inlineData.data == "string" && (i += atob(a.inlineData.data));
    }
    return r.length > 0 && console.warn(`there are non-data parts ${r} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), i.length > 0 ? btoa(i) : void 0;
  }
}
class ki {
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
class rn {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: t }) {
    const o = new rn(), r = Zt(e);
    return Object.assign(o, r), o;
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function x(n, e) {
  if (!e || typeof e != "string")
    throw new Error("model is required and must be a string");
  if (e.includes("..") || e.includes("?") || e.includes("&"))
    throw new Error("invalid model parameter");
  if (n.isVertexAI()) {
    if (e.startsWith("publishers/") || e.startsWith("projects/") || e.startsWith("models/"))
      return e;
    if (e.indexOf("/") >= 0) {
      const t = e.split("/", 2);
      return `publishers/${t[0]}/models/${t[1]}`;
    } else
      return `publishers/google/models/${e}`;
  } else
    return e.startsWith("models/") || e.startsWith("tunedModels/") ? e : `models/${e}`;
}
function jt(n, e) {
  const t = x(n, e);
  return t ? t.startsWith("publishers/") && n.isVertexAI() ? `projects/${n.getProject()}/locations/${n.getLocation()}/${t}` : t.startsWith("models/") && n.isVertexAI() ? `projects/${n.getProject()}/locations/${n.getLocation()}/publishers/google/${t}` : t : "";
}
function eo(n) {
  return Array.isArray(n) ? n.map((e) => Re(e)) : [Re(n)];
}
function Re(n) {
  if (typeof n == "object" && n !== null)
    return n;
  throw new Error(`Could not parse input as Blob. Unsupported blob type: ${typeof n}`);
}
function no(n) {
  const e = Re(n);
  if (e.mimeType && e.mimeType.startsWith("image/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function to(n) {
  const e = Re(n);
  if (e.mimeType && e.mimeType.startsWith("audio/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function Pt(n) {
  if (n == null)
    throw new Error("PartUnion is required");
  if (typeof n == "object")
    return n;
  if (typeof n == "string")
    return { text: n };
  throw new Error(`Unsupported part type: ${typeof n}`);
}
function oo(n) {
  if (n == null || Array.isArray(n) && n.length === 0)
    throw new Error("PartListUnion is required");
  return Array.isArray(n) ? n.map((e) => Pt(e)) : [Pt(n)];
}
function $e(n) {
  return n != null && typeof n == "object" && "parts" in n && Array.isArray(n.parts);
}
function wt(n) {
  return n != null && typeof n == "object" && "functionCall" in n;
}
function Mt(n) {
  return n != null && typeof n == "object" && "functionResponse" in n;
}
function F(n) {
  if (n == null)
    throw new Error("ContentUnion is required");
  return $e(n) ? n : {
    role: "user",
    parts: oo(n)
  };
}
function ln(n, e) {
  if (!e)
    return [];
  if (n.isVertexAI() && Array.isArray(e))
    return e.flatMap((t) => {
      const o = F(t);
      return o.parts && o.parts.length > 0 && o.parts[0].text !== void 0 ? [o.parts[0].text] : [];
    });
  if (n.isVertexAI()) {
    const t = F(e);
    return t.parts && t.parts.length > 0 && t.parts[0].text !== void 0 ? [t.parts[0].text] : [];
  }
  return Array.isArray(e) ? e.map((t) => F(t)) : [F(e)];
}
function b(n) {
  if (n == null || Array.isArray(n) && n.length === 0)
    throw new Error("contents are required");
  if (!Array.isArray(n)) {
    if (wt(n) || Mt(n))
      throw new Error("To specify functionCall or functionResponse parts, please wrap them in a Content object, specifying the role for them");
    return [F(n)];
  }
  const e = [], t = [], o = $e(n[0]);
  for (const i of n) {
    const r = $e(i);
    if (r != o)
      throw new Error("Mixing Content and Parts is not supported, please group the parts into a the appropriate Content objects and specify the roles for them");
    if (r)
      e.push(i);
    else {
      if (wt(i) || Mt(i))
        throw new Error("To specify functionCall or functionResponse parts, please wrap them, and any other parts, in Content objects as appropriate, specifying the role for them");
      t.push(i);
    }
  }
  return o || e.push({ role: "user", parts: oo(t) }), e;
}
function Ui(n, e) {
  n.includes("null") && (e.nullable = !0);
  const t = n.filter((o) => o !== "null");
  if (t.length === 1)
    e.type = Object.values(Q).includes(t[0].toUpperCase()) ? t[0].toUpperCase() : Q.TYPE_UNSPECIFIED;
  else {
    e.anyOf = [];
    for (const o of t)
      e.anyOf.push({
        type: Object.values(Q).includes(o.toUpperCase()) ? o.toUpperCase() : Q.TYPE_UNSPECIFIED
      });
  }
}
function le(n) {
  const e = {}, t = ["items"], o = ["anyOf"], i = ["properties"];
  if (n.type && n.anyOf)
    throw new Error("type and anyOf cannot be both populated.");
  const r = n.anyOf;
  r != null && r.length == 2 && (r[0].type === "null" ? (e.nullable = !0, n = r[1]) : r[1].type === "null" && (e.nullable = !0, n = r[0])), n.type instanceof Array && Ui(n.type, e);
  for (const [a, u] of Object.entries(n))
    if (u != null)
      if (a == "type") {
        if (u === "null")
          throw new Error("type: null can not be the only possible type for the field.");
        if (u instanceof Array)
          continue;
        e.type = Object.values(Q).includes(u.toUpperCase()) ? u.toUpperCase() : Q.TYPE_UNSPECIFIED;
      } else if (t.includes(a))
        e[a] = le(u);
      else if (o.includes(a)) {
        const c = [];
        for (const d of u) {
          if (d.type == "null") {
            e.nullable = !0;
            continue;
          }
          c.push(le(d));
        }
        e[a] = c;
      } else if (i.includes(a)) {
        const c = {};
        for (const [d, f] of Object.entries(u))
          c[d] = le(f);
        e[a] = c;
      } else {
        if (a === "additionalProperties")
          continue;
        e[a] = u;
      }
  return e;
}
function an(n) {
  return le(n);
}
function un(n) {
  if (typeof n == "object")
    return n;
  if (typeof n == "string")
    return {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: n
        }
      }
    };
  throw new Error(`Unsupported speechConfig type: ${typeof n}`);
}
function dn(n) {
  if ("multiSpeakerVoiceConfig" in n)
    throw new Error("multiSpeakerVoiceConfig is not supported in the live API.");
  return n;
}
function ue(n) {
  if (n.functionDeclarations)
    for (const e of n.functionDeclarations)
      e.parameters && (Object.keys(e.parameters).includes("$schema") ? e.parametersJsonSchema || (e.parametersJsonSchema = e.parameters, delete e.parameters) : e.parameters = le(e.parameters)), e.response && (Object.keys(e.response).includes("$schema") ? e.responseJsonSchema || (e.responseJsonSchema = e.response, delete e.response) : e.response = le(e.response));
  return n;
}
function de(n) {
  if (n == null)
    throw new Error("tools is required");
  if (!Array.isArray(n))
    throw new Error("tools is required and must be an array of Tools");
  const e = [];
  for (const t of n)
    e.push(t);
  return e;
}
function Li(n, e, t, o = 1) {
  const i = !e.startsWith(`${t}/`) && e.split("/").length === o;
  return n.isVertexAI() ? e.startsWith("projects/") ? e : e.startsWith("locations/") ? `projects/${n.getProject()}/${e}` : e.startsWith(`${t}/`) ? `projects/${n.getProject()}/locations/${n.getLocation()}/${e}` : i ? `projects/${n.getProject()}/locations/${n.getLocation()}/${t}/${e}` : e : i ? `${t}/${e}` : e;
}
function X(n, e) {
  if (typeof e != "string")
    throw new Error("name must be a string");
  return Li(n, e, "cachedContents");
}
function io(n) {
  switch (n) {
    case "STATE_UNSPECIFIED":
      return "JOB_STATE_UNSPECIFIED";
    case "CREATING":
      return "JOB_STATE_RUNNING";
    case "ACTIVE":
      return "JOB_STATE_SUCCEEDED";
    case "FAILED":
      return "JOB_STATE_FAILED";
    default:
      return n;
  }
}
function Z(n) {
  return on(n);
}
function Fi(n) {
  return n != null && typeof n == "object" && "name" in n;
}
function Gi(n) {
  return n != null && typeof n == "object" && "video" in n;
}
function Vi(n) {
  return n != null && typeof n == "object" && "uri" in n;
}
function so(n) {
  var e;
  let t;
  if (Fi(n) && (t = n.name), !(Vi(n) && (t = n.uri, t === void 0)) && !(Gi(n) && (t = (e = n.video) === null || e === void 0 ? void 0 : e.uri, t === void 0))) {
    if (typeof n == "string" && (t = n), t === void 0)
      throw new Error("Could not extract file name from the provided input.");
    if (t.startsWith("https://")) {
      const i = t.split("files/")[1].match(/[a-z0-9]+/);
      if (i === null)
        throw new Error(`Could not extract file name from URI ${t}`);
      t = i[0];
    } else t.startsWith("files/") && (t = t.split("files/")[1]);
    return t;
  }
}
function ro(n, e) {
  let t;
  return n.isVertexAI() ? t = e ? "publishers/google/models" : "models" : t = e ? "models" : "tunedModels", t;
}
function lo(n) {
  for (const e of ["models", "tunedModels", "publisherModels"])
    if (Hi(n, e))
      return n[e];
  return [];
}
function Hi(n, e) {
  return n !== null && typeof n == "object" && e in n;
}
function qi(n, e = {}) {
  const t = n, o = {
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.inputSchema
  };
  return t.outputSchema && (o.responseJsonSchema = t.outputSchema), e.behavior && (o.behavior = e.behavior), {
    functionDeclarations: [
      o
    ]
  };
}
function bi(n, e = {}) {
  const t = [], o = /* @__PURE__ */ new Set();
  for (const i of n) {
    const r = i.name;
    if (o.has(r))
      throw new Error(`Duplicate function name ${r} found in MCP tools. Please ensure function names are unique.`);
    o.add(r);
    const a = qi(i, e);
    a.functionDeclarations && t.push(...a.functionDeclarations);
  }
  return { functionDeclarations: t };
}
function ao(n, e) {
  let t;
  if (typeof e == "string")
    if (n.isVertexAI())
      if (e.startsWith("gs://"))
        t = { format: "jsonl", gcsUri: [e] };
      else if (e.startsWith("bq://"))
        t = { format: "bigquery", bigqueryUri: e };
      else
        throw new Error(`Unsupported string source for Vertex AI: ${e}`);
    else if (e.startsWith("files/"))
      t = { fileName: e };
    else
      throw new Error(`Unsupported string source for Gemini API: ${e}`);
  else if (Array.isArray(e)) {
    if (n.isVertexAI())
      throw new Error("InlinedRequest[] is not supported in Vertex AI.");
    t = { inlinedRequests: e };
  } else
    t = e;
  const o = [t.gcsUri, t.bigqueryUri].filter(Boolean).length, i = [
    t.inlinedRequests,
    t.fileName
  ].filter(Boolean).length;
  if (n.isVertexAI()) {
    if (i > 0 || o !== 1)
      throw new Error("Exactly one of `gcsUri` or `bigqueryUri` must be set for Vertex AI.");
  } else if (o > 0 || i !== 1)
    throw new Error("Exactly one of `inlinedRequests`, `fileName`, must be set for Gemini API.");
  return t;
}
function Bi(n) {
  if (typeof n != "string")
    return n;
  const e = n;
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
function uo(n) {
  if (typeof n != "object" || n === null)
    return {};
  const e = n, t = e.inlinedResponses;
  if (typeof t != "object" || t === null)
    return n;
  const i = t.inlinedResponses;
  if (!Array.isArray(i) || i.length === 0)
    return n;
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
  return r && (e.inlinedEmbedContentResponses = e.inlinedResponses, delete e.inlinedResponses), n;
}
function ce(n, e) {
  const t = e;
  if (!n.isVertexAI()) {
    if (/batches\/[^/]+$/.test(t))
      return t.split("/").pop();
    throw new Error(`Invalid batch job name: ${t}.`);
  }
  if (/^projects\/[^/]+\/locations\/[^/]+\/batchPredictionJobs\/[^/]+$/.test(t))
    return t.split("/").pop();
  if (/^\d+$/.test(t))
    return t;
  throw new Error(`Invalid batch job name: ${t}.`);
}
function co(n) {
  const e = n;
  return e === "BATCH_STATE_UNSPECIFIED" ? "JOB_STATE_UNSPECIFIED" : e === "BATCH_STATE_PENDING" ? "JOB_STATE_PENDING" : e === "BATCH_STATE_RUNNING" ? "JOB_STATE_RUNNING" : e === "BATCH_STATE_SUCCEEDED" ? "JOB_STATE_SUCCEEDED" : e === "BATCH_STATE_FAILED" ? "JOB_STATE_FAILED" : e === "BATCH_STATE_CANCELLED" ? "JOB_STATE_CANCELLED" : e === "BATCH_STATE_EXPIRED" ? "JOB_STATE_EXPIRED" : e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Ji(n) {
  const e = {}, t = s(n, ["responsesFile"]);
  t != null && l(e, ["fileName"], t);
  const o = s(n, [
    "inlinedResponses",
    "inlinedResponses"
  ]);
  if (o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => Is(a))), l(e, ["inlinedResponses"], r);
  }
  const i = s(n, [
    "inlinedEmbedContentResponses",
    "inlinedResponses"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["inlinedEmbedContentResponses"], r);
  }
  return e;
}
function Oi(n) {
  const e = {}, t = s(n, ["predictionsFormat"]);
  t != null && l(e, ["format"], t);
  const o = s(n, [
    "gcsDestination",
    "outputUriPrefix"
  ]);
  o != null && l(e, ["gcsUri"], o);
  const i = s(n, [
    "bigqueryDestination",
    "outputUri"
  ]);
  return i != null && l(e, ["bigqueryUri"], i), e;
}
function $i(n) {
  const e = {}, t = s(n, ["format"]);
  t != null && l(e, ["predictionsFormat"], t);
  const o = s(n, ["gcsUri"]);
  o != null && l(e, ["gcsDestination", "outputUriPrefix"], o);
  const i = s(n, ["bigqueryUri"]);
  if (i != null && l(e, ["bigqueryDestination", "outputUri"], i), s(n, ["fileName"]) !== void 0)
    throw new Error("fileName parameter is not supported in Vertex AI.");
  if (s(n, ["inlinedResponses"]) !== void 0)
    throw new Error("inlinedResponses parameter is not supported in Vertex AI.");
  if (s(n, ["inlinedEmbedContentResponses"]) !== void 0)
    throw new Error("inlinedEmbedContentResponses parameter is not supported in Vertex AI.");
  return e;
}
function Ee(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["name"], t);
  const o = s(n, [
    "metadata",
    "displayName"
  ]);
  o != null && l(e, ["displayName"], o);
  const i = s(n, ["metadata", "state"]);
  i != null && l(e, ["state"], co(i));
  const r = s(n, [
    "metadata",
    "createTime"
  ]);
  r != null && l(e, ["createTime"], r);
  const a = s(n, [
    "metadata",
    "endTime"
  ]);
  a != null && l(e, ["endTime"], a);
  const u = s(n, [
    "metadata",
    "updateTime"
  ]);
  u != null && l(e, ["updateTime"], u);
  const c = s(n, ["metadata", "model"]);
  c != null && l(e, ["model"], c);
  const d = s(n, ["metadata", "output"]);
  return d != null && l(e, ["dest"], Ji(uo(d))), e;
}
function We(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["name"], t);
  const o = s(n, ["displayName"]);
  o != null && l(e, ["displayName"], o);
  const i = s(n, ["state"]);
  i != null && l(e, ["state"], co(i));
  const r = s(n, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(n, ["createTime"]);
  a != null && l(e, ["createTime"], a);
  const u = s(n, ["startTime"]);
  u != null && l(e, ["startTime"], u);
  const c = s(n, ["endTime"]);
  c != null && l(e, ["endTime"], c);
  const d = s(n, ["updateTime"]);
  d != null && l(e, ["updateTime"], d);
  const f = s(n, ["model"]);
  f != null && l(e, ["model"], f);
  const m = s(n, ["inputConfig"]);
  m != null && l(e, ["src"], Wi(m));
  const p = s(n, ["outputConfig"]);
  p != null && l(e, ["dest"], Oi(uo(p)));
  const h = s(n, [
    "completionStats"
  ]);
  return h != null && l(e, ["completionStats"], h), e;
}
function Wi(n) {
  const e = {}, t = s(n, ["instancesFormat"]);
  t != null && l(e, ["format"], t);
  const o = s(n, ["gcsSource", "uris"]);
  o != null && l(e, ["gcsUri"], o);
  const i = s(n, [
    "bigquerySource",
    "inputUri"
  ]);
  return i != null && l(e, ["bigqueryUri"], i), e;
}
function Ki(n, e) {
  const t = {};
  if (s(e, ["format"]) !== void 0)
    throw new Error("format parameter is not supported in Gemini API.");
  if (s(e, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  if (s(e, ["bigqueryUri"]) !== void 0)
    throw new Error("bigqueryUri parameter is not supported in Gemini API.");
  const o = s(e, ["fileName"]);
  o != null && l(t, ["fileName"], o);
  const i = s(e, [
    "inlinedRequests"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Ss(n, a))), l(t, ["requests", "requests"], r);
  }
  return t;
}
function Yi(n) {
  const e = {}, t = s(n, ["format"]);
  t != null && l(e, ["instancesFormat"], t);
  const o = s(n, ["gcsUri"]);
  o != null && l(e, ["gcsSource", "uris"], o);
  const i = s(n, ["bigqueryUri"]);
  if (i != null && l(e, ["bigquerySource", "inputUri"], i), s(n, ["fileName"]) !== void 0)
    throw new Error("fileName parameter is not supported in Vertex AI.");
  if (s(n, ["inlinedRequests"]) !== void 0)
    throw new Error("inlinedRequests parameter is not supported in Vertex AI.");
  return e;
}
function zi(n) {
  const e = {}, t = s(n, ["data"]);
  if (t != null && l(e, ["data"], t), s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(n, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Xi(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], ce(n, o)), t;
}
function Qi(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], ce(n, o)), t;
}
function Zi(n) {
  const e = {}, t = s(n, ["content"]);
  t != null && l(e, ["content"], t);
  const o = s(n, [
    "citationMetadata"
  ]);
  o != null && l(e, ["citationMetadata"], ji(o));
  const i = s(n, ["tokenCount"]);
  i != null && l(e, ["tokenCount"], i);
  const r = s(n, ["finishReason"]);
  r != null && l(e, ["finishReason"], r);
  const a = s(n, ["avgLogprobs"]);
  a != null && l(e, ["avgLogprobs"], a);
  const u = s(n, [
    "groundingMetadata"
  ]);
  u != null && l(e, ["groundingMetadata"], u);
  const c = s(n, ["index"]);
  c != null && l(e, ["index"], c);
  const d = s(n, [
    "logprobsResult"
  ]);
  d != null && l(e, ["logprobsResult"], d);
  const f = s(n, [
    "safetyRatings"
  ]);
  if (f != null) {
    let p = f;
    Array.isArray(p) && (p = p.map((h) => h)), l(e, ["safetyRatings"], p);
  }
  const m = s(n, [
    "urlContextMetadata"
  ]);
  return m != null && l(e, ["urlContextMetadata"], m), e;
}
function ji(n) {
  const e = {}, t = s(n, ["citationSources"]);
  if (t != null) {
    let o = t;
    Array.isArray(o) && (o = o.map((i) => i)), l(e, ["citations"], o);
  }
  return e;
}
function fo(n) {
  const e = {}, t = s(n, ["parts"]);
  if (t != null) {
    let i = t;
    Array.isArray(i) && (i = i.map((r) => Ns(r))), l(e, ["parts"], i);
  }
  const o = s(n, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function es(n, e) {
  const t = {}, o = s(n, ["displayName"]);
  if (e !== void 0 && o != null && l(e, ["batch", "displayName"], o), s(n, ["dest"]) !== void 0)
    throw new Error("dest parameter is not supported in Gemini API.");
  return t;
}
function ns(n, e) {
  const t = {}, o = s(n, ["displayName"]);
  e !== void 0 && o != null && l(e, ["displayName"], o);
  const i = s(n, ["dest"]);
  return e !== void 0 && i != null && l(e, ["outputConfig"], $i(Bi(i))), t;
}
function Nt(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["_url", "model"], x(n, o));
  const i = s(e, ["src"]);
  i != null && l(t, ["batch", "inputConfig"], Ki(n, ao(n, i)));
  const r = s(e, ["config"]);
  return r != null && es(r, t), t;
}
function ts(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["model"], x(n, o));
  const i = s(e, ["src"]);
  i != null && l(t, ["inputConfig"], Yi(ao(n, i)));
  const r = s(e, ["config"]);
  return r != null && ns(r, t), t;
}
function os(n, e) {
  const t = {}, o = s(n, ["displayName"]);
  return e !== void 0 && o != null && l(e, ["batch", "displayName"], o), t;
}
function is(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["_url", "model"], x(n, o));
  const i = s(e, ["src"]);
  i != null && l(t, ["batch", "inputConfig"], cs(n, i));
  const r = s(e, ["config"]);
  return r != null && os(r, t), t;
}
function ss(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], ce(n, o)), t;
}
function rs(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], ce(n, o)), t;
}
function ls(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, ["name"]);
  o != null && l(e, ["name"], o);
  const i = s(n, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(n, ["error"]);
  return r != null && l(e, ["error"], r), e;
}
function as(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, ["name"]);
  o != null && l(e, ["name"], o);
  const i = s(n, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(n, ["error"]);
  return r != null && l(e, ["error"], r), e;
}
function us(n, e) {
  const t = {}, o = s(e, ["contents"]);
  if (o != null) {
    let r = ln(n, o);
    Array.isArray(r) && (r = r.map((a) => a)), l(t, ["requests[]", "request", "content"], r);
  }
  const i = s(e, ["config"]);
  return i != null && (l(t, ["_self"], ds(i, t)), si(t, { "requests[].*": "requests[].request.*" })), t;
}
function ds(n, e) {
  const t = {}, o = s(n, ["taskType"]);
  e !== void 0 && o != null && l(e, ["requests[]", "taskType"], o);
  const i = s(n, ["title"]);
  e !== void 0 && i != null && l(e, ["requests[]", "title"], i);
  const r = s(n, [
    "outputDimensionality"
  ]);
  if (e !== void 0 && r != null && l(e, ["requests[]", "outputDimensionality"], r), s(n, ["mimeType"]) !== void 0)
    throw new Error("mimeType parameter is not supported in Gemini API.");
  if (s(n, ["autoTruncate"]) !== void 0)
    throw new Error("autoTruncate parameter is not supported in Gemini API.");
  return t;
}
function cs(n, e) {
  const t = {}, o = s(e, ["fileName"]);
  o != null && l(t, ["file_name"], o);
  const i = s(e, [
    "inlinedRequests"
  ]);
  return i != null && l(t, ["requests"], us(n, i)), t;
}
function fs(n) {
  const e = {};
  if (s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const t = s(n, ["fileUri"]);
  t != null && l(e, ["fileUri"], t);
  const o = s(n, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function ps(n) {
  const e = {}, t = s(n, ["id"]);
  t != null && l(e, ["id"], t);
  const o = s(n, ["args"]);
  o != null && l(e, ["args"], o);
  const i = s(n, ["name"]);
  if (i != null && l(e, ["name"], i), s(n, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(n, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function ms(n) {
  const e = {}, t = s(n, [
    "allowedFunctionNames"
  ]);
  t != null && l(e, ["allowedFunctionNames"], t);
  const o = s(n, ["mode"]);
  if (o != null && l(e, ["mode"], o), s(n, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return e;
}
function hs(n, e, t) {
  const o = {}, i = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && i != null && l(t, ["systemInstruction"], fo(F(i)));
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
  const m = s(e, [
    "responseLogprobs"
  ]);
  m != null && l(o, ["responseLogprobs"], m);
  const p = s(e, ["logprobs"]);
  p != null && l(o, ["logprobs"], p);
  const h = s(e, [
    "presencePenalty"
  ]);
  h != null && l(o, ["presencePenalty"], h);
  const g = s(e, [
    "frequencyPenalty"
  ]);
  g != null && l(o, ["frequencyPenalty"], g);
  const _ = s(e, ["seed"]);
  _ != null && l(o, ["seed"], _);
  const T = s(e, [
    "responseMimeType"
  ]);
  T != null && l(o, ["responseMimeType"], T);
  const C = s(e, [
    "responseSchema"
  ]);
  C != null && l(o, ["responseSchema"], an(C));
  const S = s(e, [
    "responseJsonSchema"
  ]);
  if (S != null && l(o, ["responseJsonSchema"], S), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const E = s(e, [
    "safetySettings"
  ]);
  if (t !== void 0 && E != null) {
    let G = E;
    Array.isArray(G) && (G = G.map((L) => xs(L))), l(t, ["safetySettings"], G);
  }
  const I = s(e, ["tools"]);
  if (t !== void 0 && I != null) {
    let G = de(I);
    Array.isArray(G) && (G = G.map((L) => ks(ue(L)))), l(t, ["tools"], G);
  }
  const y = s(e, ["toolConfig"]);
  if (t !== void 0 && y != null && l(t, ["toolConfig"], Ds(y)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const R = s(e, [
    "cachedContent"
  ]);
  t !== void 0 && R != null && l(t, ["cachedContent"], X(n, R));
  const M = s(e, [
    "responseModalities"
  ]);
  M != null && l(o, ["responseModalities"], M);
  const D = s(e, [
    "mediaResolution"
  ]);
  D != null && l(o, ["mediaResolution"], D);
  const A = s(e, ["speechConfig"]);
  if (A != null && l(o, ["speechConfig"], un(A)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const N = s(e, [
    "thinkingConfig"
  ]);
  N != null && l(o, ["thinkingConfig"], N);
  const k = s(e, ["imageConfig"]);
  k != null && l(o, ["imageConfig"], Es(k));
  const q = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (q != null && l(o, ["enableEnhancedCivicAnswers"], q), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return o;
}
function gs(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, ["candidates"]);
  if (o != null) {
    let c = o;
    Array.isArray(c) && (c = c.map((d) => Zi(d))), l(e, ["candidates"], c);
  }
  const i = s(n, ["modelVersion"]);
  i != null && l(e, ["modelVersion"], i);
  const r = s(n, [
    "promptFeedback"
  ]);
  r != null && l(e, ["promptFeedback"], r);
  const a = s(n, ["responseId"]);
  a != null && l(e, ["responseId"], a);
  const u = s(n, [
    "usageMetadata"
  ]);
  return u != null && l(e, ["usageMetadata"], u), e;
}
function ys(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], ce(n, o)), t;
}
function Ts(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], ce(n, o)), t;
}
function _s(n) {
  const e = {};
  if (s(n, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const t = s(n, ["enableWidget"]);
  return t != null && l(e, ["enableWidget"], t), e;
}
function Cs(n) {
  const e = {};
  if (s(n, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(n, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const t = s(n, [
    "timeRangeFilter"
  ]);
  return t != null && l(e, ["timeRangeFilter"], t), e;
}
function Es(n) {
  const e = {}, t = s(n, ["aspectRatio"]);
  t != null && l(e, ["aspectRatio"], t);
  const o = s(n, ["imageSize"]);
  if (o != null && l(e, ["imageSize"], o), s(n, ["personGeneration"]) !== void 0)
    throw new Error("personGeneration parameter is not supported in Gemini API.");
  if (s(n, ["outputMimeType"]) !== void 0)
    throw new Error("outputMimeType parameter is not supported in Gemini API.");
  if (s(n, ["outputCompressionQuality"]) !== void 0)
    throw new Error("outputCompressionQuality parameter is not supported in Gemini API.");
  return e;
}
function Ss(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["request", "model"], x(n, o));
  const i = s(e, ["contents"]);
  if (i != null) {
    let u = b(i);
    Array.isArray(u) && (u = u.map((c) => fo(c))), l(t, ["request", "contents"], u);
  }
  const r = s(e, ["metadata"]);
  r != null && l(t, ["metadata"], r);
  const a = s(e, ["config"]);
  return a != null && l(t, ["request", "generationConfig"], hs(n, a, s(t, ["request"], {}))), t;
}
function Is(n) {
  const e = {}, t = s(n, ["response"]);
  t != null && l(e, ["response"], gs(t));
  const o = s(n, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(n, ["error"]);
  return i != null && l(e, ["error"], i), e;
}
function vs(n, e) {
  const t = {}, o = s(n, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(n, ["pageToken"]);
  if (e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), s(n, ["filter"]) !== void 0)
    throw new Error("filter parameter is not supported in Gemini API.");
  return t;
}
function As(n, e) {
  const t = {}, o = s(n, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(n, ["pageToken"]);
  e !== void 0 && i != null && l(e, ["_query", "pageToken"], i);
  const r = s(n, ["filter"]);
  return e !== void 0 && r != null && l(e, ["_query", "filter"], r), t;
}
function Rs(n) {
  const e = {}, t = s(n, ["config"]);
  return t != null && vs(t, e), e;
}
function Ps(n) {
  const e = {}, t = s(n, ["config"]);
  return t != null && As(t, e), e;
}
function ws(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(n, ["operations"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Ee(a))), l(e, ["batchJobs"], r);
  }
  return e;
}
function Ms(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(n, [
    "batchPredictionJobs"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => We(a))), l(e, ["batchJobs"], r);
  }
  return e;
}
function Ns(n) {
  const e = {}, t = s(n, [
    "mediaResolution"
  ]);
  t != null && l(e, ["mediaResolution"], t);
  const o = s(n, [
    "codeExecutionResult"
  ]);
  o != null && l(e, ["codeExecutionResult"], o);
  const i = s(n, [
    "executableCode"
  ]);
  i != null && l(e, ["executableCode"], i);
  const r = s(n, ["fileData"]);
  r != null && l(e, ["fileData"], fs(r));
  const a = s(n, ["functionCall"]);
  a != null && l(e, ["functionCall"], ps(a));
  const u = s(n, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(n, ["inlineData"]);
  c != null && l(e, ["inlineData"], zi(c));
  const d = s(n, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(n, ["thought"]);
  f != null && l(e, ["thought"], f);
  const m = s(n, [
    "thoughtSignature"
  ]);
  m != null && l(e, ["thoughtSignature"], m);
  const p = s(n, [
    "videoMetadata"
  ]);
  return p != null && l(e, ["videoMetadata"], p), e;
}
function xs(n) {
  const e = {}, t = s(n, ["category"]);
  if (t != null && l(e, ["category"], t), s(n, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const o = s(n, ["threshold"]);
  return o != null && l(e, ["threshold"], o), e;
}
function Ds(n) {
  const e = {}, t = s(n, [
    "retrievalConfig"
  ]);
  t != null && l(e, ["retrievalConfig"], t);
  const o = s(n, [
    "functionCallingConfig"
  ]);
  return o != null && l(e, ["functionCallingConfig"], ms(o)), e;
}
function ks(n) {
  const e = {};
  if (s(n, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const t = s(n, ["computerUse"]);
  t != null && l(e, ["computerUse"], t);
  const o = s(n, ["fileSearch"]);
  o != null && l(e, ["fileSearch"], o);
  const i = s(n, [
    "codeExecution"
  ]);
  if (i != null && l(e, ["codeExecution"], i), s(n, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const r = s(n, [
    "functionDeclarations"
  ]);
  if (r != null) {
    let f = r;
    Array.isArray(f) && (f = f.map((m) => m)), l(e, ["functionDeclarations"], f);
  }
  const a = s(n, ["googleMaps"]);
  a != null && l(e, ["googleMaps"], _s(a));
  const u = s(n, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Cs(u));
  const c = s(n, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(n, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var Y;
(function(n) {
  n.PAGED_ITEM_BATCH_JOBS = "batchJobs", n.PAGED_ITEM_MODELS = "models", n.PAGED_ITEM_TUNING_JOBS = "tuningJobs", n.PAGED_ITEM_FILES = "files", n.PAGED_ITEM_CACHED_CONTENTS = "cachedContents", n.PAGED_ITEM_FILE_SEARCH_STORES = "fileSearchStores", n.PAGED_ITEM_DOCUMENTS = "documents";
})(Y || (Y = {}));
class te {
  constructor(e, t, o, i) {
    this.pageInternal = [], this.paramsInternal = {}, this.requestInternal = t, this.init(e, o, i);
  }
  init(e, t, o) {
    var i, r;
    this.nameInternal = e, this.pageInternal = t[this.nameInternal] || [], this.sdkHttpResponseInternal = t == null ? void 0 : t.sdkHttpResponse, this.idxInternal = 0;
    let a = { config: {} };
    !o || Object.keys(o).length === 0 ? a = { config: {} } : typeof o == "object" ? a = Object.assign({}, o) : a = o, a.config && (a.config.pageToken = t.nextPageToken), this.paramsInternal = a, this.pageInternalSize = (r = (i = a.config) === null || i === void 0 ? void 0 : i.pageSize) !== null && r !== void 0 ? r : this.pageInternal.length;
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
class Us extends z {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (t = {}) => new te(Y.PAGED_ITEM_BATCH_JOBS, (o) => this.listInternal(o), await this.listInternal(t), t), this.create = async (t) => (this.apiClient.isVertexAI() && (t.config = this.formatDestination(t.src, t.config)), this.createInternal(t)), this.createEmbeddings = async (t) => {
      if (console.warn("batches.createEmbeddings() is experimental and may change without notice."), this.apiClient.isVertexAI())
        throw new Error("Vertex AI does not support batches.createEmbeddings.");
      return this.createEmbeddingsInternal(t);
    };
  }
  // Helper function to handle inlined generate content requests
  createInlinedGenerateContentRequest(e) {
    const t = Nt(
      this.apiClient,
      // Use instance apiClient
      e
    ), o = t._url, i = v("{model}:batchGenerateContent", o), u = t.batch.inputConfig.requests, c = u.requests, d = [];
    for (const f of c) {
      const m = Object.assign({}, f);
      if (m.systemInstruction) {
        const p = m.systemInstruction;
        delete m.systemInstruction;
        const h = m.request;
        h.systemInstruction = p, m.request = h;
      }
      d.push(m);
    }
    return u.requests = d, delete t.config, delete t._url, delete t._query, { path: i, body: t };
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
  formatDestination(e, t) {
    const o = t ? Object.assign({}, t) : {}, i = Date.now().toString();
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = ts(this.apiClient, e);
      return u = v("batchPredictionJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => We(f));
    } else {
      const d = Nt(this.apiClient, e);
      return u = v("{model}:batchGenerateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ee(f));
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = is(this.apiClient, e);
      return r = v("{model}:asyncBatchEmbedContent", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => Ee(c));
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Ts(this.apiClient, e);
      return u = v("batchPredictionJobs/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => We(f));
    } else {
      const d = ys(this.apiClient, e);
      return u = v("batches/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ee(f));
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
    var t, o, i, r;
    let a = "", u = {};
    if (this.apiClient.isVertexAI()) {
      const c = Qi(this.apiClient, e);
      a = v("batchPredictionJobs/{name}:cancel", c._url), u = c._query, delete c._url, delete c._query, await this.apiClient.request({
        path: a,
        queryParams: u,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    } else {
      const c = Xi(this.apiClient, e);
      a = v("batches/{name}:cancel", c._url), u = c._query, delete c._url, delete c._query, await this.apiClient.request({
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Ps(e);
      return u = v("batchPredictionJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Ms(f), p = new Rt();
        return Object.assign(p, m), p;
      });
    } else {
      const d = Rs(e);
      return u = v("batches", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = ws(f), p = new Rt();
        return Object.assign(p, m), p;
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = rs(this.apiClient, e);
      return u = v("batchPredictionJobs/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => as(f));
    } else {
      const d = ss(this.apiClient, e);
      return u = v("batches/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => ls(f));
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Ls(n) {
  const e = {}, t = s(n, ["data"]);
  if (t != null && l(e, ["data"], t), s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(n, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function xt(n) {
  const e = {}, t = s(n, ["parts"]);
  if (t != null) {
    let i = t;
    Array.isArray(i) && (i = i.map((r) => ir(r))), l(e, ["parts"], i);
  }
  const o = s(n, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function Fs(n, e) {
  const t = {}, o = s(n, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(n, ["expireTime"]);
  e !== void 0 && i != null && l(e, ["expireTime"], i);
  const r = s(n, ["displayName"]);
  e !== void 0 && r != null && l(e, ["displayName"], r);
  const a = s(n, ["contents"]);
  if (e !== void 0 && a != null) {
    let f = b(a);
    Array.isArray(f) && (f = f.map((m) => xt(m))), l(e, ["contents"], f);
  }
  const u = s(n, [
    "systemInstruction"
  ]);
  e !== void 0 && u != null && l(e, ["systemInstruction"], xt(F(u)));
  const c = s(n, ["tools"]);
  if (e !== void 0 && c != null) {
    let f = c;
    Array.isArray(f) && (f = f.map((m) => rr(m))), l(e, ["tools"], f);
  }
  const d = s(n, ["toolConfig"]);
  if (e !== void 0 && d != null && l(e, ["toolConfig"], sr(d)), s(n, ["kmsKeyName"]) !== void 0)
    throw new Error("kmsKeyName parameter is not supported in Gemini API.");
  return t;
}
function Gs(n, e) {
  const t = {}, o = s(n, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(n, ["expireTime"]);
  e !== void 0 && i != null && l(e, ["expireTime"], i);
  const r = s(n, ["displayName"]);
  e !== void 0 && r != null && l(e, ["displayName"], r);
  const a = s(n, ["contents"]);
  if (e !== void 0 && a != null) {
    let m = b(a);
    Array.isArray(m) && (m = m.map((p) => p)), l(e, ["contents"], m);
  }
  const u = s(n, [
    "systemInstruction"
  ]);
  e !== void 0 && u != null && l(e, ["systemInstruction"], F(u));
  const c = s(n, ["tools"]);
  if (e !== void 0 && c != null) {
    let m = c;
    Array.isArray(m) && (m = m.map((p) => lr(p))), l(e, ["tools"], m);
  }
  const d = s(n, ["toolConfig"]);
  e !== void 0 && d != null && l(e, ["toolConfig"], d);
  const f = s(n, ["kmsKeyName"]);
  return e !== void 0 && f != null && l(e, ["encryption_spec", "kmsKeyName"], f), t;
}
function Vs(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["model"], jt(n, o));
  const i = s(e, ["config"]);
  return i != null && Fs(i, t), t;
}
function Hs(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["model"], jt(n, o));
  const i = s(e, ["config"]);
  return i != null && Gs(i, t), t;
}
function qs(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], X(n, o)), t;
}
function bs(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], X(n, o)), t;
}
function Bs(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  return t != null && l(e, ["sdkHttpResponse"], t), e;
}
function Js(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  return t != null && l(e, ["sdkHttpResponse"], t), e;
}
function Os(n) {
  const e = {};
  if (s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const t = s(n, ["fileUri"]);
  t != null && l(e, ["fileUri"], t);
  const o = s(n, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function $s(n) {
  const e = {}, t = s(n, ["id"]);
  t != null && l(e, ["id"], t);
  const o = s(n, ["args"]);
  o != null && l(e, ["args"], o);
  const i = s(n, ["name"]);
  if (i != null && l(e, ["name"], i), s(n, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(n, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Ws(n) {
  const e = {}, t = s(n, [
    "allowedFunctionNames"
  ]);
  t != null && l(e, ["allowedFunctionNames"], t);
  const o = s(n, ["mode"]);
  if (o != null && l(e, ["mode"], o), s(n, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return e;
}
function Ks(n) {
  const e = {}, t = s(n, ["description"]);
  t != null && l(e, ["description"], t);
  const o = s(n, ["name"]);
  o != null && l(e, ["name"], o);
  const i = s(n, ["parameters"]);
  i != null && l(e, ["parameters"], i);
  const r = s(n, [
    "parametersJsonSchema"
  ]);
  r != null && l(e, ["parametersJsonSchema"], r);
  const a = s(n, ["response"]);
  a != null && l(e, ["response"], a);
  const u = s(n, [
    "responseJsonSchema"
  ]);
  if (u != null && l(e, ["responseJsonSchema"], u), s(n, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return e;
}
function Ys(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], X(n, o)), t;
}
function zs(n, e) {
  const t = {}, o = s(e, ["name"]);
  return o != null && l(t, ["_url", "name"], X(n, o)), t;
}
function Xs(n) {
  const e = {};
  if (s(n, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const t = s(n, ["enableWidget"]);
  return t != null && l(e, ["enableWidget"], t), e;
}
function Qs(n) {
  const e = {};
  if (s(n, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(n, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const t = s(n, [
    "timeRangeFilter"
  ]);
  return t != null && l(e, ["timeRangeFilter"], t), e;
}
function Zs(n, e) {
  const t = {}, o = s(n, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(n, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), t;
}
function js(n, e) {
  const t = {}, o = s(n, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(n, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), t;
}
function er(n) {
  const e = {}, t = s(n, ["config"]);
  return t != null && Zs(t, e), e;
}
function nr(n) {
  const e = {}, t = s(n, ["config"]);
  return t != null && js(t, e), e;
}
function tr(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(n, [
    "cachedContents"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["cachedContents"], r);
  }
  return e;
}
function or(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(n, [
    "cachedContents"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["cachedContents"], r);
  }
  return e;
}
function ir(n) {
  const e = {}, t = s(n, [
    "mediaResolution"
  ]);
  t != null && l(e, ["mediaResolution"], t);
  const o = s(n, [
    "codeExecutionResult"
  ]);
  o != null && l(e, ["codeExecutionResult"], o);
  const i = s(n, [
    "executableCode"
  ]);
  i != null && l(e, ["executableCode"], i);
  const r = s(n, ["fileData"]);
  r != null && l(e, ["fileData"], Os(r));
  const a = s(n, ["functionCall"]);
  a != null && l(e, ["functionCall"], $s(a));
  const u = s(n, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(n, ["inlineData"]);
  c != null && l(e, ["inlineData"], Ls(c));
  const d = s(n, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(n, ["thought"]);
  f != null && l(e, ["thought"], f);
  const m = s(n, [
    "thoughtSignature"
  ]);
  m != null && l(e, ["thoughtSignature"], m);
  const p = s(n, [
    "videoMetadata"
  ]);
  return p != null && l(e, ["videoMetadata"], p), e;
}
function sr(n) {
  const e = {}, t = s(n, [
    "retrievalConfig"
  ]);
  t != null && l(e, ["retrievalConfig"], t);
  const o = s(n, [
    "functionCallingConfig"
  ]);
  return o != null && l(e, ["functionCallingConfig"], Ws(o)), e;
}
function rr(n) {
  const e = {};
  if (s(n, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const t = s(n, ["computerUse"]);
  t != null && l(e, ["computerUse"], t);
  const o = s(n, ["fileSearch"]);
  o != null && l(e, ["fileSearch"], o);
  const i = s(n, [
    "codeExecution"
  ]);
  if (i != null && l(e, ["codeExecution"], i), s(n, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const r = s(n, [
    "functionDeclarations"
  ]);
  if (r != null) {
    let f = r;
    Array.isArray(f) && (f = f.map((m) => m)), l(e, ["functionDeclarations"], f);
  }
  const a = s(n, ["googleMaps"]);
  a != null && l(e, ["googleMaps"], Xs(a));
  const u = s(n, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Qs(u));
  const c = s(n, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(n, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
function lr(n) {
  const e = {}, t = s(n, ["retrieval"]);
  t != null && l(e, ["retrieval"], t);
  const o = s(n, ["computerUse"]);
  if (o != null && l(e, ["computerUse"], o), s(n, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const i = s(n, [
    "codeExecution"
  ]);
  i != null && l(e, ["codeExecution"], i);
  const r = s(n, [
    "enterpriseWebSearch"
  ]);
  r != null && l(e, ["enterpriseWebSearch"], r);
  const a = s(n, [
    "functionDeclarations"
  ]);
  if (a != null) {
    let m = a;
    Array.isArray(m) && (m = m.map((p) => Ks(p))), l(e, ["functionDeclarations"], m);
  }
  const u = s(n, ["googleMaps"]);
  u != null && l(e, ["googleMaps"], u);
  const c = s(n, ["googleSearch"]);
  c != null && l(e, ["googleSearch"], c);
  const d = s(n, [
    "googleSearchRetrieval"
  ]);
  d != null && l(e, ["googleSearchRetrieval"], d);
  const f = s(n, ["urlContext"]);
  return f != null && l(e, ["urlContext"], f), e;
}
function ar(n, e) {
  const t = {}, o = s(n, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(n, ["expireTime"]);
  return e !== void 0 && i != null && l(e, ["expireTime"], i), t;
}
function ur(n, e) {
  const t = {}, o = s(n, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(n, ["expireTime"]);
  return e !== void 0 && i != null && l(e, ["expireTime"], i), t;
}
function dr(n, e) {
  const t = {}, o = s(e, ["name"]);
  o != null && l(t, ["_url", "name"], X(n, o));
  const i = s(e, ["config"]);
  return i != null && ar(i, t), t;
}
function cr(n, e) {
  const t = {}, o = s(e, ["name"]);
  o != null && l(t, ["_url", "name"], X(n, o));
  const i = s(e, ["config"]);
  return i != null && ur(i, t), t;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class fr extends z {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (t = {}) => new te(Y.PAGED_ITEM_CACHED_CONTENTS, (o) => this.listInternal(o), await this.listInternal(t), t);
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Hs(this.apiClient, e);
      return u = v("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const d = Vs(this.apiClient, e);
      return u = v("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = zs(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const d = Ys(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = bs(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Js(f), p = new vt();
        return Object.assign(p, m), p;
      });
    } else {
      const d = qs(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Bs(f), p = new vt();
        return Object.assign(p, m), p;
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = cr(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const d = dr(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = nr(e);
      return u = v("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = or(f), p = new At();
        return Object.assign(p, m), p;
      });
    } else {
      const d = er(e);
      return u = v("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = tr(f), p = new At();
        return Object.assign(p, m), p;
      });
    }
  }
}
function Pe(n, e) {
  var t = {};
  for (var o in n) Object.prototype.hasOwnProperty.call(n, o) && e.indexOf(o) < 0 && (t[o] = n[o]);
  if (n != null && typeof Object.getOwnPropertySymbols == "function")
    for (var i = 0, o = Object.getOwnPropertySymbols(n); i < o.length; i++)
      e.indexOf(o[i]) < 0 && Object.prototype.propertyIsEnumerable.call(n, o[i]) && (t[o[i]] = n[o[i]]);
  return t;
}
function Dt(n) {
  var e = typeof Symbol == "function" && Symbol.iterator, t = e && n[e], o = 0;
  if (t) return t.call(n);
  if (n && typeof n.length == "number") return {
    next: function() {
      return n && o >= n.length && (n = void 0), { value: n && n[o++], done: !n };
    }
  };
  throw new TypeError(e ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function w(n) {
  return this instanceof w ? (this.v = n, this) : new w(n);
}
function J(n, e, t) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var o = t.apply(n, e || []), i, r = [];
  return i = Object.create((typeof AsyncIterator == "function" ? AsyncIterator : Object).prototype), u("next"), u("throw"), u("return", a), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function a(h) {
    return function(g) {
      return Promise.resolve(g).then(h, m);
    };
  }
  function u(h, g) {
    o[h] && (i[h] = function(_) {
      return new Promise(function(T, C) {
        r.push([h, _, T, C]) > 1 || c(h, _);
      });
    }, g && (i[h] = g(i[h])));
  }
  function c(h, g) {
    try {
      d(o[h](g));
    } catch (_) {
      p(r[0][3], _);
    }
  }
  function d(h) {
    h.value instanceof w ? Promise.resolve(h.value.v).then(f, m) : p(r[0][2], h);
  }
  function f(h) {
    c("next", h);
  }
  function m(h) {
    c("throw", h);
  }
  function p(h, g) {
    h(g), r.shift(), r.length && c(r[0][0], r[0][1]);
  }
}
function O(n) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var e = n[Symbol.asyncIterator], t;
  return e ? e.call(n) : (n = typeof Dt == "function" ? Dt(n) : n[Symbol.iterator](), t = {}, o("next"), o("throw"), o("return"), t[Symbol.asyncIterator] = function() {
    return this;
  }, t);
  function o(r) {
    t[r] = n[r] && function(a) {
      return new Promise(function(u, c) {
        a = n[r](a), i(u, c, a.done, a.value);
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
function pr(n) {
  var e;
  if (n.candidates == null || n.candidates.length === 0)
    return !1;
  const t = (e = n.candidates[0]) === null || e === void 0 ? void 0 : e.content;
  return t === void 0 ? !1 : po(t);
}
function po(n) {
  if (n.parts === void 0 || n.parts.length === 0)
    return !1;
  for (const e of n.parts)
    if (e === void 0 || Object.keys(e).length === 0)
      return !1;
  return !0;
}
function mr(n) {
  if (n.length !== 0) {
    for (const e of n)
      if (e.role !== "user" && e.role !== "model")
        throw new Error(`Role must be user or model, but got ${e.role}.`);
  }
}
function kt(n) {
  if (n === void 0 || n.length === 0)
    return [];
  const e = [], t = n.length;
  let o = 0;
  for (; o < t; )
    if (n[o].role === "user")
      e.push(n[o]), o++;
    else {
      const i = [];
      let r = !0;
      for (; o < t && n[o].role === "model"; )
        i.push(n[o]), r && !po(n[o]) && (r = !1), o++;
      r ? e.push(...i) : e.pop();
    }
  return e;
}
class hr {
  constructor(e, t) {
    this.modelsModule = e, this.apiClient = t;
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
    return new gr(
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
class gr {
  constructor(e, t, o, i = {}, r = []) {
    this.apiClient = e, this.modelsModule = t, this.model = o, this.config = i, this.history = r, this.sendPromise = Promise.resolve(), mr(r);
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
    var t;
    await this.sendPromise;
    const o = F(e.message), i = this.modelsModule.generateContent({
      model: this.model,
      contents: this.getHistory(!0).concat(o),
      config: (t = e.config) !== null && t !== void 0 ? t : this.config
    });
    return this.sendPromise = (async () => {
      var r, a, u;
      const c = await i, d = (a = (r = c.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content, f = c.automaticFunctionCallingHistory, m = this.getHistory(!0).length;
      let p = [];
      f != null && (p = (u = f.slice(m)) !== null && u !== void 0 ? u : []);
      const h = d ? [d] : [];
      this.recordHistory(o, h, p);
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
    var t;
    await this.sendPromise;
    const o = F(e.message), i = this.modelsModule.generateContentStream({
      model: this.model,
      contents: this.getHistory(!0).concat(o),
      config: (t = e.config) !== null && t !== void 0 ? t : this.config
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
    const t = e ? kt(this.history) : this.history;
    return structuredClone(t);
  }
  processStreamResponse(e, t) {
    return J(this, arguments, function* () {
      var i, r, a, u, c, d;
      const f = [];
      try {
        for (var m = !0, p = O(e), h; h = yield w(p.next()), i = h.done, !i; m = !0) {
          u = h.value, m = !1;
          const g = u;
          if (pr(g)) {
            const _ = (d = (c = g.candidates) === null || c === void 0 ? void 0 : c[0]) === null || d === void 0 ? void 0 : d.content;
            _ !== void 0 && f.push(_);
          }
          yield yield w(g);
        }
      } catch (g) {
        r = { error: g };
      } finally {
        try {
          !m && !i && (a = p.return) && (yield w(a.call(p)));
        } finally {
          if (r) throw r.error;
        }
      }
      this.recordHistory(t, f);
    });
  }
  recordHistory(e, t, o) {
    let i = [];
    t.length > 0 && t.every((r) => r.role !== void 0) ? i = t : i.push({
      role: "model",
      parts: []
    }), o && o.length > 0 ? this.history.push(...kt(o)) : this.history.push(e), this.history.push(...i);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class he extends Error {
  constructor(e) {
    super(e.message), this.name = "ApiError", this.status = e.status, Object.setPrototypeOf(this, he.prototype);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function yr(n) {
  const e = {}, t = s(n, ["file"]);
  return t != null && l(e, ["file"], t), e;
}
function Tr(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  return t != null && l(e, ["sdkHttpResponse"], t), e;
}
function _r(n) {
  const e = {}, t = s(n, ["name"]);
  return t != null && l(e, ["_url", "file"], so(t)), e;
}
function Cr(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  return t != null && l(e, ["sdkHttpResponse"], t), e;
}
function Er(n) {
  const e = {}, t = s(n, ["name"]);
  return t != null && l(e, ["_url", "file"], so(t)), e;
}
function Sr(n) {
  const e = {}, t = s(n, ["uris"]);
  return t != null && l(e, ["uris"], t), e;
}
function Ir(n, e) {
  const t = {}, o = s(n, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(n, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), t;
}
function vr(n) {
  const e = {}, t = s(n, ["config"]);
  return t != null && Ir(t, e), e;
}
function Ar(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(n, ["files"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["files"], r);
  }
  return e;
}
function Rr(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, ["files"]);
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
class Pr extends z {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (t = {}) => new te(Y.PAGED_ITEM_FILES, (o) => this.listInternal(o), await this.listInternal(t), t);
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
    return this.apiClient.uploadFile(e.file, e.config).then((t) => t);
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = vr(e);
      return r = v("files", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = Ar(c), f = new wi();
        return Object.assign(f, d), f;
      });
    }
  }
  async createInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = yr(e);
      return r = v("upload/v1beta/files", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Tr(c), f = new Mi();
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Er(e);
      return r = v("files/{file}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = _r(e);
      return r = v("files/{file}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "DELETE",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = Cr(c), f = new Ni();
        return Object.assign(f, d), f;
      });
    }
  }
  async registerFilesInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Sr(e);
      return r = v("files:register", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Rr(c), f = new xi();
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
function Se(n) {
  const e = {}, t = s(n, ["data"]);
  if (t != null && l(e, ["data"], t), s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(n, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function wr(n) {
  const e = {}, t = s(n, ["parts"]);
  if (t != null) {
    let i = t;
    Array.isArray(i) && (i = i.map((r) => Or(r))), l(e, ["parts"], i);
  }
  const o = s(n, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function Mr(n) {
  const e = {};
  if (s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const t = s(n, ["fileUri"]);
  t != null && l(e, ["fileUri"], t);
  const o = s(n, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Nr(n) {
  const e = {}, t = s(n, ["id"]);
  t != null && l(e, ["id"], t);
  const o = s(n, ["args"]);
  o != null && l(e, ["args"], o);
  const i = s(n, ["name"]);
  if (i != null && l(e, ["name"], i), s(n, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(n, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function xr(n) {
  const e = {}, t = s(n, ["description"]);
  t != null && l(e, ["description"], t);
  const o = s(n, ["name"]);
  o != null && l(e, ["name"], o);
  const i = s(n, ["parameters"]);
  i != null && l(e, ["parameters"], i);
  const r = s(n, [
    "parametersJsonSchema"
  ]);
  r != null && l(e, ["parametersJsonSchema"], r);
  const a = s(n, ["response"]);
  a != null && l(e, ["response"], a);
  const u = s(n, [
    "responseJsonSchema"
  ]);
  if (u != null && l(e, ["responseJsonSchema"], u), s(n, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return e;
}
function Dr(n) {
  const e = {}, t = s(n, [
    "modelSelectionConfig"
  ]);
  t != null && l(e, ["modelConfig"], t);
  const o = s(n, [
    "responseJsonSchema"
  ]);
  o != null && l(e, ["responseJsonSchema"], o);
  const i = s(n, [
    "audioTimestamp"
  ]);
  i != null && l(e, ["audioTimestamp"], i);
  const r = s(n, [
    "candidateCount"
  ]);
  r != null && l(e, ["candidateCount"], r);
  const a = s(n, [
    "enableAffectiveDialog"
  ]);
  a != null && l(e, ["enableAffectiveDialog"], a);
  const u = s(n, [
    "frequencyPenalty"
  ]);
  u != null && l(e, ["frequencyPenalty"], u);
  const c = s(n, ["logprobs"]);
  c != null && l(e, ["logprobs"], c);
  const d = s(n, [
    "maxOutputTokens"
  ]);
  d != null && l(e, ["maxOutputTokens"], d);
  const f = s(n, [
    "mediaResolution"
  ]);
  f != null && l(e, ["mediaResolution"], f);
  const m = s(n, [
    "presencePenalty"
  ]);
  m != null && l(e, ["presencePenalty"], m);
  const p = s(n, [
    "responseLogprobs"
  ]);
  p != null && l(e, ["responseLogprobs"], p);
  const h = s(n, [
    "responseMimeType"
  ]);
  h != null && l(e, ["responseMimeType"], h);
  const g = s(n, [
    "responseModalities"
  ]);
  g != null && l(e, ["responseModalities"], g);
  const _ = s(n, [
    "responseSchema"
  ]);
  _ != null && l(e, ["responseSchema"], _);
  const T = s(n, [
    "routingConfig"
  ]);
  T != null && l(e, ["routingConfig"], T);
  const C = s(n, ["seed"]);
  C != null && l(e, ["seed"], C);
  const S = s(n, ["speechConfig"]);
  S != null && l(e, ["speechConfig"], S);
  const E = s(n, [
    "stopSequences"
  ]);
  E != null && l(e, ["stopSequences"], E);
  const I = s(n, ["temperature"]);
  I != null && l(e, ["temperature"], I);
  const y = s(n, [
    "thinkingConfig"
  ]);
  y != null && l(e, ["thinkingConfig"], y);
  const R = s(n, ["topK"]);
  R != null && l(e, ["topK"], R);
  const M = s(n, ["topP"]);
  if (M != null && l(e, ["topP"], M), s(n, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return e;
}
function kr(n) {
  const e = {};
  if (s(n, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const t = s(n, ["enableWidget"]);
  return t != null && l(e, ["enableWidget"], t), e;
}
function Ur(n) {
  const e = {};
  if (s(n, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(n, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const t = s(n, [
    "timeRangeFilter"
  ]);
  return t != null && l(e, ["timeRangeFilter"], t), e;
}
function Lr(n, e) {
  const t = {}, o = s(n, [
    "generationConfig"
  ]);
  e !== void 0 && o != null && l(e, ["setup", "generationConfig"], o);
  const i = s(n, [
    "responseModalities"
  ]);
  e !== void 0 && i != null && l(e, ["setup", "generationConfig", "responseModalities"], i);
  const r = s(n, ["temperature"]);
  e !== void 0 && r != null && l(e, ["setup", "generationConfig", "temperature"], r);
  const a = s(n, ["topP"]);
  e !== void 0 && a != null && l(e, ["setup", "generationConfig", "topP"], a);
  const u = s(n, ["topK"]);
  e !== void 0 && u != null && l(e, ["setup", "generationConfig", "topK"], u);
  const c = s(n, [
    "maxOutputTokens"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], c);
  const d = s(n, [
    "mediaResolution"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "mediaResolution"], d);
  const f = s(n, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const m = s(n, ["speechConfig"]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "speechConfig"], dn(m));
  const p = s(n, [
    "thinkingConfig"
  ]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "thinkingConfig"], p);
  const h = s(n, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], h);
  const g = s(n, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], wr(F(g)));
  const _ = s(n, ["tools"]);
  if (e !== void 0 && _ != null) {
    let R = de(_);
    Array.isArray(R) && (R = R.map((M) => Wr(ue(M)))), l(e, ["setup", "tools"], R);
  }
  const T = s(n, [
    "sessionResumption"
  ]);
  e !== void 0 && T != null && l(e, ["setup", "sessionResumption"], $r(T));
  const C = s(n, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && C != null && l(e, ["setup", "inputAudioTranscription"], C);
  const S = s(n, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const E = s(n, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "realtimeInputConfig"], E);
  const I = s(n, [
    "contextWindowCompression"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "contextWindowCompression"], I);
  const y = s(n, ["proactivity"]);
  if (e !== void 0 && y != null && l(e, ["setup", "proactivity"], y), s(n, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return t;
}
function Fr(n, e) {
  const t = {}, o = s(n, [
    "generationConfig"
  ]);
  e !== void 0 && o != null && l(e, ["setup", "generationConfig"], Dr(o));
  const i = s(n, [
    "responseModalities"
  ]);
  e !== void 0 && i != null && l(e, ["setup", "generationConfig", "responseModalities"], i);
  const r = s(n, ["temperature"]);
  e !== void 0 && r != null && l(e, ["setup", "generationConfig", "temperature"], r);
  const a = s(n, ["topP"]);
  e !== void 0 && a != null && l(e, ["setup", "generationConfig", "topP"], a);
  const u = s(n, ["topK"]);
  e !== void 0 && u != null && l(e, ["setup", "generationConfig", "topK"], u);
  const c = s(n, [
    "maxOutputTokens"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], c);
  const d = s(n, [
    "mediaResolution"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "mediaResolution"], d);
  const f = s(n, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const m = s(n, ["speechConfig"]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "speechConfig"], dn(m));
  const p = s(n, [
    "thinkingConfig"
  ]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "thinkingConfig"], p);
  const h = s(n, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], h);
  const g = s(n, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], F(g));
  const _ = s(n, ["tools"]);
  if (e !== void 0 && _ != null) {
    let M = de(_);
    Array.isArray(M) && (M = M.map((D) => Kr(ue(D)))), l(e, ["setup", "tools"], M);
  }
  const T = s(n, [
    "sessionResumption"
  ]);
  e !== void 0 && T != null && l(e, ["setup", "sessionResumption"], T);
  const C = s(n, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && C != null && l(e, ["setup", "inputAudioTranscription"], C);
  const S = s(n, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const E = s(n, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "realtimeInputConfig"], E);
  const I = s(n, [
    "contextWindowCompression"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "contextWindowCompression"], I);
  const y = s(n, ["proactivity"]);
  e !== void 0 && y != null && l(e, ["setup", "proactivity"], y);
  const R = s(n, [
    "explicitVadSignal"
  ]);
  return e !== void 0 && R != null && l(e, ["setup", "explicitVadSignal"], R), t;
}
function Gr(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["setup", "model"], x(n, o));
  const i = s(e, ["config"]);
  return i != null && l(t, ["config"], Lr(i, t)), t;
}
function Vr(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["setup", "model"], x(n, o));
  const i = s(e, ["config"]);
  return i != null && l(t, ["config"], Fr(i, t)), t;
}
function Hr(n) {
  const e = {}, t = s(n, [
    "musicGenerationConfig"
  ]);
  return t != null && l(e, ["musicGenerationConfig"], t), e;
}
function qr(n) {
  const e = {}, t = s(n, [
    "weightedPrompts"
  ]);
  if (t != null) {
    let o = t;
    Array.isArray(o) && (o = o.map((i) => i)), l(e, ["weightedPrompts"], o);
  }
  return e;
}
function br(n) {
  const e = {}, t = s(n, ["media"]);
  if (t != null) {
    let d = eo(t);
    Array.isArray(d) && (d = d.map((f) => Se(f))), l(e, ["mediaChunks"], d);
  }
  const o = s(n, ["audio"]);
  o != null && l(e, ["audio"], Se(to(o)));
  const i = s(n, [
    "audioStreamEnd"
  ]);
  i != null && l(e, ["audioStreamEnd"], i);
  const r = s(n, ["video"]);
  r != null && l(e, ["video"], Se(no(r)));
  const a = s(n, ["text"]);
  a != null && l(e, ["text"], a);
  const u = s(n, [
    "activityStart"
  ]);
  u != null && l(e, ["activityStart"], u);
  const c = s(n, ["activityEnd"]);
  return c != null && l(e, ["activityEnd"], c), e;
}
function Br(n) {
  const e = {}, t = s(n, ["media"]);
  if (t != null) {
    let d = eo(t);
    Array.isArray(d) && (d = d.map((f) => f)), l(e, ["mediaChunks"], d);
  }
  const o = s(n, ["audio"]);
  o != null && l(e, ["audio"], to(o));
  const i = s(n, [
    "audioStreamEnd"
  ]);
  i != null && l(e, ["audioStreamEnd"], i);
  const r = s(n, ["video"]);
  r != null && l(e, ["video"], no(r));
  const a = s(n, ["text"]);
  a != null && l(e, ["text"], a);
  const u = s(n, [
    "activityStart"
  ]);
  u != null && l(e, ["activityStart"], u);
  const c = s(n, ["activityEnd"]);
  return c != null && l(e, ["activityEnd"], c), e;
}
function Jr(n) {
  const e = {}, t = s(n, [
    "setupComplete"
  ]);
  t != null && l(e, ["setupComplete"], t);
  const o = s(n, [
    "serverContent"
  ]);
  o != null && l(e, ["serverContent"], o);
  const i = s(n, ["toolCall"]);
  i != null && l(e, ["toolCall"], i);
  const r = s(n, [
    "toolCallCancellation"
  ]);
  r != null && l(e, ["toolCallCancellation"], r);
  const a = s(n, [
    "usageMetadata"
  ]);
  a != null && l(e, ["usageMetadata"], Yr(a));
  const u = s(n, ["goAway"]);
  u != null && l(e, ["goAway"], u);
  const c = s(n, [
    "sessionResumptionUpdate"
  ]);
  c != null && l(e, ["sessionResumptionUpdate"], c);
  const d = s(n, [
    "voiceActivityDetectionSignal"
  ]);
  d != null && l(e, ["voiceActivityDetectionSignal"], d);
  const f = s(n, [
    "voiceActivity"
  ]);
  return f != null && l(e, ["voiceActivity"], zr(f)), e;
}
function Or(n) {
  const e = {}, t = s(n, [
    "mediaResolution"
  ]);
  t != null && l(e, ["mediaResolution"], t);
  const o = s(n, [
    "codeExecutionResult"
  ]);
  o != null && l(e, ["codeExecutionResult"], o);
  const i = s(n, [
    "executableCode"
  ]);
  i != null && l(e, ["executableCode"], i);
  const r = s(n, ["fileData"]);
  r != null && l(e, ["fileData"], Mr(r));
  const a = s(n, ["functionCall"]);
  a != null && l(e, ["functionCall"], Nr(a));
  const u = s(n, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(n, ["inlineData"]);
  c != null && l(e, ["inlineData"], Se(c));
  const d = s(n, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(n, ["thought"]);
  f != null && l(e, ["thought"], f);
  const m = s(n, [
    "thoughtSignature"
  ]);
  m != null && l(e, ["thoughtSignature"], m);
  const p = s(n, [
    "videoMetadata"
  ]);
  return p != null && l(e, ["videoMetadata"], p), e;
}
function $r(n) {
  const e = {}, t = s(n, ["handle"]);
  if (t != null && l(e, ["handle"], t), s(n, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return e;
}
function Wr(n) {
  const e = {};
  if (s(n, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const t = s(n, ["computerUse"]);
  t != null && l(e, ["computerUse"], t);
  const o = s(n, ["fileSearch"]);
  o != null && l(e, ["fileSearch"], o);
  const i = s(n, [
    "codeExecution"
  ]);
  if (i != null && l(e, ["codeExecution"], i), s(n, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const r = s(n, [
    "functionDeclarations"
  ]);
  if (r != null) {
    let f = r;
    Array.isArray(f) && (f = f.map((m) => m)), l(e, ["functionDeclarations"], f);
  }
  const a = s(n, ["googleMaps"]);
  a != null && l(e, ["googleMaps"], kr(a));
  const u = s(n, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Ur(u));
  const c = s(n, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(n, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
function Kr(n) {
  const e = {}, t = s(n, ["retrieval"]);
  t != null && l(e, ["retrieval"], t);
  const o = s(n, ["computerUse"]);
  if (o != null && l(e, ["computerUse"], o), s(n, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const i = s(n, [
    "codeExecution"
  ]);
  i != null && l(e, ["codeExecution"], i);
  const r = s(n, [
    "enterpriseWebSearch"
  ]);
  r != null && l(e, ["enterpriseWebSearch"], r);
  const a = s(n, [
    "functionDeclarations"
  ]);
  if (a != null) {
    let m = a;
    Array.isArray(m) && (m = m.map((p) => xr(p))), l(e, ["functionDeclarations"], m);
  }
  const u = s(n, ["googleMaps"]);
  u != null && l(e, ["googleMaps"], u);
  const c = s(n, ["googleSearch"]);
  c != null && l(e, ["googleSearch"], c);
  const d = s(n, [
    "googleSearchRetrieval"
  ]);
  d != null && l(e, ["googleSearchRetrieval"], d);
  const f = s(n, ["urlContext"]);
  return f != null && l(e, ["urlContext"], f), e;
}
function Yr(n) {
  const e = {}, t = s(n, [
    "promptTokenCount"
  ]);
  t != null && l(e, ["promptTokenCount"], t);
  const o = s(n, [
    "cachedContentTokenCount"
  ]);
  o != null && l(e, ["cachedContentTokenCount"], o);
  const i = s(n, [
    "candidatesTokenCount"
  ]);
  i != null && l(e, ["responseTokenCount"], i);
  const r = s(n, [
    "toolUsePromptTokenCount"
  ]);
  r != null && l(e, ["toolUsePromptTokenCount"], r);
  const a = s(n, [
    "thoughtsTokenCount"
  ]);
  a != null && l(e, ["thoughtsTokenCount"], a);
  const u = s(n, [
    "totalTokenCount"
  ]);
  u != null && l(e, ["totalTokenCount"], u);
  const c = s(n, [
    "promptTokensDetails"
  ]);
  if (c != null) {
    let h = c;
    Array.isArray(h) && (h = h.map((g) => g)), l(e, ["promptTokensDetails"], h);
  }
  const d = s(n, [
    "cacheTokensDetails"
  ]);
  if (d != null) {
    let h = d;
    Array.isArray(h) && (h = h.map((g) => g)), l(e, ["cacheTokensDetails"], h);
  }
  const f = s(n, [
    "candidatesTokensDetails"
  ]);
  if (f != null) {
    let h = f;
    Array.isArray(h) && (h = h.map((g) => g)), l(e, ["responseTokensDetails"], h);
  }
  const m = s(n, [
    "toolUsePromptTokensDetails"
  ]);
  if (m != null) {
    let h = m;
    Array.isArray(h) && (h = h.map((g) => g)), l(e, ["toolUsePromptTokensDetails"], h);
  }
  const p = s(n, ["trafficType"]);
  return p != null && l(e, ["trafficType"], p), e;
}
function zr(n) {
  const e = {}, t = s(n, ["type"]);
  return t != null && l(e, ["voiceActivityType"], t), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Xr(n, e) {
  const t = {}, o = s(n, ["data"]);
  if (o != null && l(t, ["data"], o), s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(n, ["mimeType"]);
  return i != null && l(t, ["mimeType"], i), t;
}
function Qr(n, e) {
  const t = {}, o = s(n, ["content"]);
  o != null && l(t, ["content"], o);
  const i = s(n, [
    "citationMetadata"
  ]);
  i != null && l(t, ["citationMetadata"], Zr(i));
  const r = s(n, ["tokenCount"]);
  r != null && l(t, ["tokenCount"], r);
  const a = s(n, ["finishReason"]);
  a != null && l(t, ["finishReason"], a);
  const u = s(n, ["avgLogprobs"]);
  u != null && l(t, ["avgLogprobs"], u);
  const c = s(n, [
    "groundingMetadata"
  ]);
  c != null && l(t, ["groundingMetadata"], c);
  const d = s(n, ["index"]);
  d != null && l(t, ["index"], d);
  const f = s(n, [
    "logprobsResult"
  ]);
  f != null && l(t, ["logprobsResult"], f);
  const m = s(n, [
    "safetyRatings"
  ]);
  if (m != null) {
    let h = m;
    Array.isArray(h) && (h = h.map((g) => g)), l(t, ["safetyRatings"], h);
  }
  const p = s(n, [
    "urlContextMetadata"
  ]);
  return p != null && l(t, ["urlContextMetadata"], p), t;
}
function Zr(n, e) {
  const t = {}, o = s(n, ["citationSources"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => r)), l(t, ["citations"], i);
  }
  return t;
}
function jr(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let a = b(r);
    Array.isArray(a) && (a = a.map((u) => u)), l(o, ["contents"], a);
  }
  return o;
}
function el(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["tokensInfo"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(t, ["tokensInfo"], r);
  }
  return t;
}
function nl(n, e) {
  const t = {}, o = s(n, ["values"]);
  o != null && l(t, ["values"], o);
  const i = s(n, ["statistics"]);
  return i != null && l(t, ["statistics"], tl(i)), t;
}
function tl(n, e) {
  const t = {}, o = s(n, ["truncated"]);
  o != null && l(t, ["truncated"], o);
  const i = s(n, ["token_count"]);
  return i != null && l(t, ["tokenCount"], i), t;
}
function Ne(n, e) {
  const t = {}, o = s(n, ["parts"]);
  if (o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => ca(a))), l(t, ["parts"], r);
  }
  const i = s(n, ["role"]);
  return i != null && l(t, ["role"], i), t;
}
function ol(n, e) {
  const t = {}, o = s(n, ["controlType"]);
  o != null && l(t, ["controlType"], o);
  const i = s(n, [
    "enableControlImageComputation"
  ]);
  return i != null && l(t, ["computeControl"], i), t;
}
function il(n, e) {
  const t = {};
  if (s(n, ["systemInstruction"]) !== void 0)
    throw new Error("systemInstruction parameter is not supported in Gemini API.");
  if (s(n, ["tools"]) !== void 0)
    throw new Error("tools parameter is not supported in Gemini API.");
  if (s(n, ["generationConfig"]) !== void 0)
    throw new Error("generationConfig parameter is not supported in Gemini API.");
  return t;
}
function sl(n, e, t) {
  const o = {}, i = s(n, [
    "systemInstruction"
  ]);
  e !== void 0 && i != null && l(e, ["systemInstruction"], F(i));
  const r = s(n, ["tools"]);
  if (e !== void 0 && r != null) {
    let u = r;
    Array.isArray(u) && (u = u.map((c) => yo(c))), l(e, ["tools"], u);
  }
  const a = s(n, [
    "generationConfig"
  ]);
  return e !== void 0 && a != null && l(e, ["generationConfig"], Xl(a)), o;
}
function rl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = b(r);
    Array.isArray(u) && (u = u.map((c) => Ne(c))), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && il(a), o;
}
function ll(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = b(r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && sl(a, o), o;
}
function al(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["totalTokens"]);
  i != null && l(t, ["totalTokens"], i);
  const r = s(n, [
    "cachedContentTokenCount"
  ]);
  return r != null && l(t, ["cachedContentTokenCount"], r), t;
}
function ul(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["totalTokens"]);
  return i != null && l(t, ["totalTokens"], i), t;
}
function dl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], x(n, i)), o;
}
function cl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], x(n, i)), o;
}
function fl(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  return o != null && l(t, ["sdkHttpResponse"], o), t;
}
function pl(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  return o != null && l(t, ["sdkHttpResponse"], o), t;
}
function ml(n, e, t) {
  const o = {}, i = s(n, ["outputGcsUri"]);
  e !== void 0 && i != null && l(e, ["parameters", "storageUri"], i);
  const r = s(n, [
    "negativePrompt"
  ]);
  e !== void 0 && r != null && l(e, ["parameters", "negativePrompt"], r);
  const a = s(n, [
    "numberOfImages"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "sampleCount"], a);
  const u = s(n, ["aspectRatio"]);
  e !== void 0 && u != null && l(e, ["parameters", "aspectRatio"], u);
  const c = s(n, [
    "guidanceScale"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "guidanceScale"], c);
  const d = s(n, ["seed"]);
  e !== void 0 && d != null && l(e, ["parameters", "seed"], d);
  const f = s(n, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && f != null && l(e, ["parameters", "safetySetting"], f);
  const m = s(n, [
    "personGeneration"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "personGeneration"], m);
  const p = s(n, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "includeSafetyAttributes"], p);
  const h = s(n, [
    "includeRaiReason"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "includeRaiReason"], h);
  const g = s(n, ["language"]);
  e !== void 0 && g != null && l(e, ["parameters", "language"], g);
  const _ = s(n, [
    "outputMimeType"
  ]);
  e !== void 0 && _ != null && l(e, ["parameters", "outputOptions", "mimeType"], _);
  const T = s(n, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && T != null && l(e, ["parameters", "outputOptions", "compressionQuality"], T);
  const C = s(n, ["addWatermark"]);
  e !== void 0 && C != null && l(e, ["parameters", "addWatermark"], C);
  const S = s(n, ["labels"]);
  e !== void 0 && S != null && l(e, ["labels"], S);
  const E = s(n, ["editMode"]);
  e !== void 0 && E != null && l(e, ["parameters", "editMode"], E);
  const I = s(n, ["baseSteps"]);
  return e !== void 0 && I != null && l(e, ["parameters", "editConfig", "baseSteps"], I), o;
}
function hl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, [
    "referenceImages"
  ]);
  if (a != null) {
    let c = a;
    Array.isArray(c) && (c = c.map((d) => ya(d))), l(o, ["instances[0]", "referenceImages"], c);
  }
  const u = s(e, ["config"]);
  return u != null && ml(u, o), o;
}
function gl(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "predictions"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => xe(a))), l(t, ["generatedImages"], r);
  }
  return t;
}
function yl(n, e, t) {
  const o = {}, i = s(n, ["taskType"]);
  e !== void 0 && i != null && l(e, ["requests[]", "taskType"], i);
  const r = s(n, ["title"]);
  e !== void 0 && r != null && l(e, ["requests[]", "title"], r);
  const a = s(n, [
    "outputDimensionality"
  ]);
  if (e !== void 0 && a != null && l(e, ["requests[]", "outputDimensionality"], a), s(n, ["mimeType"]) !== void 0)
    throw new Error("mimeType parameter is not supported in Gemini API.");
  if (s(n, ["autoTruncate"]) !== void 0)
    throw new Error("autoTruncate parameter is not supported in Gemini API.");
  return o;
}
function Tl(n, e, t) {
  const o = {}, i = s(n, ["taskType"]);
  e !== void 0 && i != null && l(e, ["instances[]", "task_type"], i);
  const r = s(n, ["title"]);
  e !== void 0 && r != null && l(e, ["instances[]", "title"], r);
  const a = s(n, [
    "outputDimensionality"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "outputDimensionality"], a);
  const u = s(n, ["mimeType"]);
  e !== void 0 && u != null && l(e, ["instances[]", "mimeType"], u);
  const c = s(n, ["autoTruncate"]);
  return e !== void 0 && c != null && l(e, ["parameters", "autoTruncate"], c), o;
}
function _l(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let c = ln(n, r);
    Array.isArray(c) && (c = c.map((d) => d)), l(o, ["requests[]", "content"], c);
  }
  const a = s(e, ["config"]);
  a != null && yl(a, o);
  const u = s(e, ["model"]);
  return u !== void 0 && l(o, ["requests[]", "model"], x(n, u)), o;
}
function Cl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = ln(n, r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["instances[]", "content"], u);
  }
  const a = s(e, ["config"]);
  return a != null && Tl(a, o), o;
}
function El(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["embeddings"]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => u)), l(t, ["embeddings"], a);
  }
  const r = s(n, ["metadata"]);
  return r != null && l(t, ["metadata"], r), t;
}
function Sl(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "predictions[]",
    "embeddings"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => nl(u))), l(t, ["embeddings"], a);
  }
  const r = s(n, ["metadata"]);
  return r != null && l(t, ["metadata"], r), t;
}
function Il(n, e) {
  const t = {}, o = s(n, ["endpoint"]);
  o != null && l(t, ["name"], o);
  const i = s(n, [
    "deployedModelId"
  ]);
  return i != null && l(t, ["deployedModelId"], i), t;
}
function vl(n, e) {
  const t = {};
  if (s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(n, ["fileUri"]);
  o != null && l(t, ["fileUri"], o);
  const i = s(n, ["mimeType"]);
  return i != null && l(t, ["mimeType"], i), t;
}
function Al(n, e) {
  const t = {}, o = s(n, ["id"]);
  o != null && l(t, ["id"], o);
  const i = s(n, ["args"]);
  i != null && l(t, ["args"], i);
  const r = s(n, ["name"]);
  if (r != null && l(t, ["name"], r), s(n, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(n, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return t;
}
function Rl(n, e) {
  const t = {}, o = s(n, [
    "allowedFunctionNames"
  ]);
  o != null && l(t, ["allowedFunctionNames"], o);
  const i = s(n, ["mode"]);
  if (i != null && l(t, ["mode"], i), s(n, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return t;
}
function Pl(n, e) {
  const t = {}, o = s(n, ["description"]);
  o != null && l(t, ["description"], o);
  const i = s(n, ["name"]);
  i != null && l(t, ["name"], i);
  const r = s(n, ["parameters"]);
  r != null && l(t, ["parameters"], r);
  const a = s(n, [
    "parametersJsonSchema"
  ]);
  a != null && l(t, ["parametersJsonSchema"], a);
  const u = s(n, ["response"]);
  u != null && l(t, ["response"], u);
  const c = s(n, [
    "responseJsonSchema"
  ]);
  if (c != null && l(t, ["responseJsonSchema"], c), s(n, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return t;
}
function wl(n, e, t, o) {
  const i = {}, r = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && r != null && l(t, ["systemInstruction"], Ne(F(r)));
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
  const m = s(e, [
    "stopSequences"
  ]);
  m != null && l(i, ["stopSequences"], m);
  const p = s(e, [
    "responseLogprobs"
  ]);
  p != null && l(i, ["responseLogprobs"], p);
  const h = s(e, ["logprobs"]);
  h != null && l(i, ["logprobs"], h);
  const g = s(e, [
    "presencePenalty"
  ]);
  g != null && l(i, ["presencePenalty"], g);
  const _ = s(e, [
    "frequencyPenalty"
  ]);
  _ != null && l(i, ["frequencyPenalty"], _);
  const T = s(e, ["seed"]);
  T != null && l(i, ["seed"], T);
  const C = s(e, [
    "responseMimeType"
  ]);
  C != null && l(i, ["responseMimeType"], C);
  const S = s(e, [
    "responseSchema"
  ]);
  S != null && l(i, ["responseSchema"], an(S));
  const E = s(e, [
    "responseJsonSchema"
  ]);
  if (E != null && l(i, ["responseJsonSchema"], E), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const I = s(e, [
    "safetySettings"
  ]);
  if (t !== void 0 && I != null) {
    let L = I;
    Array.isArray(L) && (L = L.map((oe) => Ta(oe))), l(t, ["safetySettings"], L);
  }
  const y = s(e, ["tools"]);
  if (t !== void 0 && y != null) {
    let L = de(y);
    Array.isArray(L) && (L = L.map((oe) => Aa(ue(oe)))), l(t, ["tools"], L);
  }
  const R = s(e, ["toolConfig"]);
  if (t !== void 0 && R != null && l(t, ["toolConfig"], va(R)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const M = s(e, [
    "cachedContent"
  ]);
  t !== void 0 && M != null && l(t, ["cachedContent"], X(n, M));
  const D = s(e, [
    "responseModalities"
  ]);
  D != null && l(i, ["responseModalities"], D);
  const A = s(e, [
    "mediaResolution"
  ]);
  A != null && l(i, ["mediaResolution"], A);
  const N = s(e, ["speechConfig"]);
  if (N != null && l(i, ["speechConfig"], un(N)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const k = s(e, [
    "thinkingConfig"
  ]);
  k != null && l(i, ["thinkingConfig"], k);
  const q = s(e, ["imageConfig"]);
  q != null && l(i, ["imageConfig"], na(q));
  const G = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (G != null && l(i, ["enableEnhancedCivicAnswers"], G), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return i;
}
function Ml(n, e, t, o) {
  const i = {}, r = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && r != null && l(t, ["systemInstruction"], F(r));
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
  const m = s(e, [
    "stopSequences"
  ]);
  m != null && l(i, ["stopSequences"], m);
  const p = s(e, [
    "responseLogprobs"
  ]);
  p != null && l(i, ["responseLogprobs"], p);
  const h = s(e, ["logprobs"]);
  h != null && l(i, ["logprobs"], h);
  const g = s(e, [
    "presencePenalty"
  ]);
  g != null && l(i, ["presencePenalty"], g);
  const _ = s(e, [
    "frequencyPenalty"
  ]);
  _ != null && l(i, ["frequencyPenalty"], _);
  const T = s(e, ["seed"]);
  T != null && l(i, ["seed"], T);
  const C = s(e, [
    "responseMimeType"
  ]);
  C != null && l(i, ["responseMimeType"], C);
  const S = s(e, [
    "responseSchema"
  ]);
  S != null && l(i, ["responseSchema"], an(S));
  const E = s(e, [
    "responseJsonSchema"
  ]);
  E != null && l(i, ["responseJsonSchema"], E);
  const I = s(e, [
    "routingConfig"
  ]);
  I != null && l(i, ["routingConfig"], I);
  const y = s(e, [
    "modelSelectionConfig"
  ]);
  y != null && l(i, ["modelConfig"], y);
  const R = s(e, [
    "safetySettings"
  ]);
  if (t !== void 0 && R != null) {
    let K = R;
    Array.isArray(K) && (K = K.map((Fe) => Fe)), l(t, ["safetySettings"], K);
  }
  const M = s(e, ["tools"]);
  if (t !== void 0 && M != null) {
    let K = de(M);
    Array.isArray(K) && (K = K.map((Fe) => yo(ue(Fe)))), l(t, ["tools"], K);
  }
  const D = s(e, ["toolConfig"]);
  t !== void 0 && D != null && l(t, ["toolConfig"], D);
  const A = s(e, ["labels"]);
  t !== void 0 && A != null && l(t, ["labels"], A);
  const N = s(e, [
    "cachedContent"
  ]);
  t !== void 0 && N != null && l(t, ["cachedContent"], X(n, N));
  const k = s(e, [
    "responseModalities"
  ]);
  k != null && l(i, ["responseModalities"], k);
  const q = s(e, [
    "mediaResolution"
  ]);
  q != null && l(i, ["mediaResolution"], q);
  const G = s(e, ["speechConfig"]);
  G != null && l(i, ["speechConfig"], un(G));
  const L = s(e, [
    "audioTimestamp"
  ]);
  L != null && l(i, ["audioTimestamp"], L);
  const oe = s(e, [
    "thinkingConfig"
  ]);
  oe != null && l(i, ["thinkingConfig"], oe);
  const mn = s(e, ["imageConfig"]);
  if (mn != null && l(i, ["imageConfig"], ta(mn)), s(e, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  const hn = s(e, [
    "modelArmorConfig"
  ]);
  return t !== void 0 && hn != null && l(t, ["modelArmorConfig"], hn), i;
}
function Ut(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = b(r);
    Array.isArray(u) && (u = u.map((c) => Ne(c))), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && l(o, ["generationConfig"], wl(n, a, o)), o;
}
function Lt(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = b(r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && l(o, ["generationConfig"], Ml(n, a, o)), o;
}
function Ft(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["candidates"]);
  if (i != null) {
    let d = i;
    Array.isArray(d) && (d = d.map((f) => Qr(f))), l(t, ["candidates"], d);
  }
  const r = s(n, ["modelVersion"]);
  r != null && l(t, ["modelVersion"], r);
  const a = s(n, [
    "promptFeedback"
  ]);
  a != null && l(t, ["promptFeedback"], a);
  const u = s(n, ["responseId"]);
  u != null && l(t, ["responseId"], u);
  const c = s(n, [
    "usageMetadata"
  ]);
  return c != null && l(t, ["usageMetadata"], c), t;
}
function Gt(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["candidates"]);
  if (i != null) {
    let f = i;
    Array.isArray(f) && (f = f.map((m) => m)), l(t, ["candidates"], f);
  }
  const r = s(n, ["createTime"]);
  r != null && l(t, ["createTime"], r);
  const a = s(n, ["modelVersion"]);
  a != null && l(t, ["modelVersion"], a);
  const u = s(n, [
    "promptFeedback"
  ]);
  u != null && l(t, ["promptFeedback"], u);
  const c = s(n, ["responseId"]);
  c != null && l(t, ["responseId"], c);
  const d = s(n, [
    "usageMetadata"
  ]);
  return d != null && l(t, ["usageMetadata"], d), t;
}
function Nl(n, e, t) {
  const o = {};
  if (s(n, ["outputGcsUri"]) !== void 0)
    throw new Error("outputGcsUri parameter is not supported in Gemini API.");
  if (s(n, ["negativePrompt"]) !== void 0)
    throw new Error("negativePrompt parameter is not supported in Gemini API.");
  const i = s(n, [
    "numberOfImages"
  ]);
  e !== void 0 && i != null && l(e, ["parameters", "sampleCount"], i);
  const r = s(n, ["aspectRatio"]);
  e !== void 0 && r != null && l(e, ["parameters", "aspectRatio"], r);
  const a = s(n, [
    "guidanceScale"
  ]);
  if (e !== void 0 && a != null && l(e, ["parameters", "guidanceScale"], a), s(n, ["seed"]) !== void 0)
    throw new Error("seed parameter is not supported in Gemini API.");
  const u = s(n, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && u != null && l(e, ["parameters", "safetySetting"], u);
  const c = s(n, [
    "personGeneration"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "personGeneration"], c);
  const d = s(n, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "includeSafetyAttributes"], d);
  const f = s(n, [
    "includeRaiReason"
  ]);
  e !== void 0 && f != null && l(e, ["parameters", "includeRaiReason"], f);
  const m = s(n, ["language"]);
  e !== void 0 && m != null && l(e, ["parameters", "language"], m);
  const p = s(n, [
    "outputMimeType"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "outputOptions", "mimeType"], p);
  const h = s(n, [
    "outputCompressionQuality"
  ]);
  if (e !== void 0 && h != null && l(e, ["parameters", "outputOptions", "compressionQuality"], h), s(n, ["addWatermark"]) !== void 0)
    throw new Error("addWatermark parameter is not supported in Gemini API.");
  if (s(n, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const g = s(n, ["imageSize"]);
  if (e !== void 0 && g != null && l(e, ["parameters", "sampleImageSize"], g), s(n, ["enhancePrompt"]) !== void 0)
    throw new Error("enhancePrompt parameter is not supported in Gemini API.");
  return o;
}
function xl(n, e, t) {
  const o = {}, i = s(n, ["outputGcsUri"]);
  e !== void 0 && i != null && l(e, ["parameters", "storageUri"], i);
  const r = s(n, [
    "negativePrompt"
  ]);
  e !== void 0 && r != null && l(e, ["parameters", "negativePrompt"], r);
  const a = s(n, [
    "numberOfImages"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "sampleCount"], a);
  const u = s(n, ["aspectRatio"]);
  e !== void 0 && u != null && l(e, ["parameters", "aspectRatio"], u);
  const c = s(n, [
    "guidanceScale"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "guidanceScale"], c);
  const d = s(n, ["seed"]);
  e !== void 0 && d != null && l(e, ["parameters", "seed"], d);
  const f = s(n, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && f != null && l(e, ["parameters", "safetySetting"], f);
  const m = s(n, [
    "personGeneration"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "personGeneration"], m);
  const p = s(n, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "includeSafetyAttributes"], p);
  const h = s(n, [
    "includeRaiReason"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "includeRaiReason"], h);
  const g = s(n, ["language"]);
  e !== void 0 && g != null && l(e, ["parameters", "language"], g);
  const _ = s(n, [
    "outputMimeType"
  ]);
  e !== void 0 && _ != null && l(e, ["parameters", "outputOptions", "mimeType"], _);
  const T = s(n, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && T != null && l(e, ["parameters", "outputOptions", "compressionQuality"], T);
  const C = s(n, ["addWatermark"]);
  e !== void 0 && C != null && l(e, ["parameters", "addWatermark"], C);
  const S = s(n, ["labels"]);
  e !== void 0 && S != null && l(e, ["labels"], S);
  const E = s(n, ["imageSize"]);
  e !== void 0 && E != null && l(e, ["parameters", "sampleImageSize"], E);
  const I = s(n, [
    "enhancePrompt"
  ]);
  return e !== void 0 && I != null && l(e, ["parameters", "enhancePrompt"], I), o;
}
function Dl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["config"]);
  return a != null && Nl(a, o), o;
}
function kl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["config"]);
  return a != null && xl(a, o), o;
}
function Ul(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "predictions"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => Wl(u))), l(t, ["generatedImages"], a);
  }
  const r = s(n, [
    "positivePromptSafetyAttributes"
  ]);
  return r != null && l(t, ["positivePromptSafetyAttributes"], ho(r)), t;
}
function Ll(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "predictions"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => xe(u))), l(t, ["generatedImages"], a);
  }
  const r = s(n, [
    "positivePromptSafetyAttributes"
  ]);
  return r != null && l(t, ["positivePromptSafetyAttributes"], go(r)), t;
}
function Fl(n, e, t) {
  const o = {}, i = s(n, [
    "numberOfVideos"
  ]);
  if (e !== void 0 && i != null && l(e, ["parameters", "sampleCount"], i), s(n, ["outputGcsUri"]) !== void 0)
    throw new Error("outputGcsUri parameter is not supported in Gemini API.");
  if (s(n, ["fps"]) !== void 0)
    throw new Error("fps parameter is not supported in Gemini API.");
  const r = s(n, [
    "durationSeconds"
  ]);
  if (e !== void 0 && r != null && l(e, ["parameters", "durationSeconds"], r), s(n, ["seed"]) !== void 0)
    throw new Error("seed parameter is not supported in Gemini API.");
  const a = s(n, ["aspectRatio"]);
  e !== void 0 && a != null && l(e, ["parameters", "aspectRatio"], a);
  const u = s(n, ["resolution"]);
  e !== void 0 && u != null && l(e, ["parameters", "resolution"], u);
  const c = s(n, [
    "personGeneration"
  ]);
  if (e !== void 0 && c != null && l(e, ["parameters", "personGeneration"], c), s(n, ["pubsubTopic"]) !== void 0)
    throw new Error("pubsubTopic parameter is not supported in Gemini API.");
  const d = s(n, [
    "negativePrompt"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "negativePrompt"], d);
  const f = s(n, [
    "enhancePrompt"
  ]);
  if (e !== void 0 && f != null && l(e, ["parameters", "enhancePrompt"], f), s(n, ["generateAudio"]) !== void 0)
    throw new Error("generateAudio parameter is not supported in Gemini API.");
  const m = s(n, ["lastFrame"]);
  e !== void 0 && m != null && l(e, ["instances[0]", "lastFrame"], De(m));
  const p = s(n, [
    "referenceImages"
  ]);
  if (e !== void 0 && p != null) {
    let h = p;
    Array.isArray(h) && (h = h.map((g) => Va(g))), l(e, ["instances[0]", "referenceImages"], h);
  }
  if (s(n, ["mask"]) !== void 0)
    throw new Error("mask parameter is not supported in Gemini API.");
  if (s(n, ["compressionQuality"]) !== void 0)
    throw new Error("compressionQuality parameter is not supported in Gemini API.");
  return o;
}
function Gl(n, e, t) {
  const o = {}, i = s(n, [
    "numberOfVideos"
  ]);
  e !== void 0 && i != null && l(e, ["parameters", "sampleCount"], i);
  const r = s(n, ["outputGcsUri"]);
  e !== void 0 && r != null && l(e, ["parameters", "storageUri"], r);
  const a = s(n, ["fps"]);
  e !== void 0 && a != null && l(e, ["parameters", "fps"], a);
  const u = s(n, [
    "durationSeconds"
  ]);
  e !== void 0 && u != null && l(e, ["parameters", "durationSeconds"], u);
  const c = s(n, ["seed"]);
  e !== void 0 && c != null && l(e, ["parameters", "seed"], c);
  const d = s(n, ["aspectRatio"]);
  e !== void 0 && d != null && l(e, ["parameters", "aspectRatio"], d);
  const f = s(n, ["resolution"]);
  e !== void 0 && f != null && l(e, ["parameters", "resolution"], f);
  const m = s(n, [
    "personGeneration"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "personGeneration"], m);
  const p = s(n, ["pubsubTopic"]);
  e !== void 0 && p != null && l(e, ["parameters", "pubsubTopic"], p);
  const h = s(n, [
    "negativePrompt"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "negativePrompt"], h);
  const g = s(n, [
    "enhancePrompt"
  ]);
  e !== void 0 && g != null && l(e, ["parameters", "enhancePrompt"], g);
  const _ = s(n, [
    "generateAudio"
  ]);
  e !== void 0 && _ != null && l(e, ["parameters", "generateAudio"], _);
  const T = s(n, ["lastFrame"]);
  e !== void 0 && T != null && l(e, ["instances[0]", "lastFrame"], $(T));
  const C = s(n, [
    "referenceImages"
  ]);
  if (e !== void 0 && C != null) {
    let I = C;
    Array.isArray(I) && (I = I.map((y) => Ha(y))), l(e, ["instances[0]", "referenceImages"], I);
  }
  const S = s(n, ["mask"]);
  e !== void 0 && S != null && l(e, ["instances[0]", "mask"], Ga(S));
  const E = s(n, [
    "compressionQuality"
  ]);
  return e !== void 0 && E != null && l(e, ["parameters", "compressionQuality"], E), o;
}
function Vl(n, e) {
  const t = {}, o = s(n, ["name"]);
  o != null && l(t, ["name"], o);
  const i = s(n, ["metadata"]);
  i != null && l(t, ["metadata"], i);
  const r = s(n, ["done"]);
  r != null && l(t, ["done"], r);
  const a = s(n, ["error"]);
  a != null && l(t, ["error"], a);
  const u = s(n, [
    "response",
    "generateVideoResponse"
  ]);
  return u != null && l(t, ["response"], Bl(u)), t;
}
function Hl(n, e) {
  const t = {}, o = s(n, ["name"]);
  o != null && l(t, ["name"], o);
  const i = s(n, ["metadata"]);
  i != null && l(t, ["metadata"], i);
  const r = s(n, ["done"]);
  r != null && l(t, ["done"], r);
  const a = s(n, ["error"]);
  a != null && l(t, ["error"], a);
  const u = s(n, ["response"]);
  return u != null && l(t, ["response"], Jl(u)), t;
}
function ql(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["image"]);
  a != null && l(o, ["instances[0]", "image"], De(a));
  const u = s(e, ["video"]);
  u != null && l(o, ["instances[0]", "video"], To(u));
  const c = s(e, ["source"]);
  c != null && Ol(c, o);
  const d = s(e, ["config"]);
  return d != null && Fl(d, o), o;
}
function bl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["image"]);
  a != null && l(o, ["instances[0]", "image"], $(a));
  const u = s(e, ["video"]);
  u != null && l(o, ["instances[0]", "video"], _o(u));
  const c = s(e, ["source"]);
  c != null && $l(c, o);
  const d = s(e, ["config"]);
  return d != null && Gl(d, o), o;
}
function Bl(n, e) {
  const t = {}, o = s(n, [
    "generatedSamples"
  ]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((u) => Yl(u))), l(t, ["generatedVideos"], a);
  }
  const i = s(n, [
    "raiMediaFilteredCount"
  ]);
  i != null && l(t, ["raiMediaFilteredCount"], i);
  const r = s(n, [
    "raiMediaFilteredReasons"
  ]);
  return r != null && l(t, ["raiMediaFilteredReasons"], r), t;
}
function Jl(n, e) {
  const t = {}, o = s(n, ["videos"]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((u) => zl(u))), l(t, ["generatedVideos"], a);
  }
  const i = s(n, [
    "raiMediaFilteredCount"
  ]);
  i != null && l(t, ["raiMediaFilteredCount"], i);
  const r = s(n, [
    "raiMediaFilteredReasons"
  ]);
  return r != null && l(t, ["raiMediaFilteredReasons"], r), t;
}
function Ol(n, e, t) {
  const o = {}, i = s(n, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(n, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], De(r));
  const a = s(n, ["video"]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "video"], To(a)), o;
}
function $l(n, e, t) {
  const o = {}, i = s(n, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(n, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], $(r));
  const a = s(n, ["video"]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "video"], _o(a)), o;
}
function Wl(n, e) {
  const t = {}, o = s(n, ["_self"]);
  o != null && l(t, ["image"], oa(o));
  const i = s(n, [
    "raiFilteredReason"
  ]);
  i != null && l(t, ["raiFilteredReason"], i);
  const r = s(n, ["_self"]);
  return r != null && l(t, ["safetyAttributes"], ho(r)), t;
}
function xe(n, e) {
  const t = {}, o = s(n, ["_self"]);
  o != null && l(t, ["image"], mo(o));
  const i = s(n, [
    "raiFilteredReason"
  ]);
  i != null && l(t, ["raiFilteredReason"], i);
  const r = s(n, ["_self"]);
  r != null && l(t, ["safetyAttributes"], go(r));
  const a = s(n, ["prompt"]);
  return a != null && l(t, ["enhancedPrompt"], a), t;
}
function Kl(n, e) {
  const t = {}, o = s(n, ["_self"]);
  o != null && l(t, ["mask"], mo(o));
  const i = s(n, ["labels"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(t, ["labels"], r);
  }
  return t;
}
function Yl(n, e) {
  const t = {}, o = s(n, ["video"]);
  return o != null && l(t, ["video"], La(o)), t;
}
function zl(n, e) {
  const t = {}, o = s(n, ["_self"]);
  return o != null && l(t, ["video"], Fa(o)), t;
}
function Xl(n, e) {
  const t = {}, o = s(n, [
    "modelSelectionConfig"
  ]);
  o != null && l(t, ["modelConfig"], o);
  const i = s(n, [
    "responseJsonSchema"
  ]);
  i != null && l(t, ["responseJsonSchema"], i);
  const r = s(n, [
    "audioTimestamp"
  ]);
  r != null && l(t, ["audioTimestamp"], r);
  const a = s(n, [
    "candidateCount"
  ]);
  a != null && l(t, ["candidateCount"], a);
  const u = s(n, [
    "enableAffectiveDialog"
  ]);
  u != null && l(t, ["enableAffectiveDialog"], u);
  const c = s(n, [
    "frequencyPenalty"
  ]);
  c != null && l(t, ["frequencyPenalty"], c);
  const d = s(n, ["logprobs"]);
  d != null && l(t, ["logprobs"], d);
  const f = s(n, [
    "maxOutputTokens"
  ]);
  f != null && l(t, ["maxOutputTokens"], f);
  const m = s(n, [
    "mediaResolution"
  ]);
  m != null && l(t, ["mediaResolution"], m);
  const p = s(n, [
    "presencePenalty"
  ]);
  p != null && l(t, ["presencePenalty"], p);
  const h = s(n, [
    "responseLogprobs"
  ]);
  h != null && l(t, ["responseLogprobs"], h);
  const g = s(n, [
    "responseMimeType"
  ]);
  g != null && l(t, ["responseMimeType"], g);
  const _ = s(n, [
    "responseModalities"
  ]);
  _ != null && l(t, ["responseModalities"], _);
  const T = s(n, [
    "responseSchema"
  ]);
  T != null && l(t, ["responseSchema"], T);
  const C = s(n, [
    "routingConfig"
  ]);
  C != null && l(t, ["routingConfig"], C);
  const S = s(n, ["seed"]);
  S != null && l(t, ["seed"], S);
  const E = s(n, ["speechConfig"]);
  E != null && l(t, ["speechConfig"], E);
  const I = s(n, [
    "stopSequences"
  ]);
  I != null && l(t, ["stopSequences"], I);
  const y = s(n, ["temperature"]);
  y != null && l(t, ["temperature"], y);
  const R = s(n, [
    "thinkingConfig"
  ]);
  R != null && l(t, ["thinkingConfig"], R);
  const M = s(n, ["topK"]);
  M != null && l(t, ["topK"], M);
  const D = s(n, ["topP"]);
  if (D != null && l(t, ["topP"], D), s(n, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return t;
}
function Ql(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], x(n, i)), o;
}
function Zl(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], x(n, i)), o;
}
function jl(n, e) {
  const t = {};
  if (s(n, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const o = s(n, ["enableWidget"]);
  return o != null && l(t, ["enableWidget"], o), t;
}
function ea(n, e) {
  const t = {};
  if (s(n, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(n, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const o = s(n, [
    "timeRangeFilter"
  ]);
  return o != null && l(t, ["timeRangeFilter"], o), t;
}
function na(n, e) {
  const t = {}, o = s(n, ["aspectRatio"]);
  o != null && l(t, ["aspectRatio"], o);
  const i = s(n, ["imageSize"]);
  if (i != null && l(t, ["imageSize"], i), s(n, ["personGeneration"]) !== void 0)
    throw new Error("personGeneration parameter is not supported in Gemini API.");
  if (s(n, ["outputMimeType"]) !== void 0)
    throw new Error("outputMimeType parameter is not supported in Gemini API.");
  if (s(n, ["outputCompressionQuality"]) !== void 0)
    throw new Error("outputCompressionQuality parameter is not supported in Gemini API.");
  return t;
}
function ta(n, e) {
  const t = {}, o = s(n, ["aspectRatio"]);
  o != null && l(t, ["aspectRatio"], o);
  const i = s(n, ["imageSize"]);
  i != null && l(t, ["imageSize"], i);
  const r = s(n, [
    "personGeneration"
  ]);
  r != null && l(t, ["personGeneration"], r);
  const a = s(n, [
    "outputMimeType"
  ]);
  a != null && l(t, ["imageOutputOptions", "mimeType"], a);
  const u = s(n, [
    "outputCompressionQuality"
  ]);
  return u != null && l(t, ["imageOutputOptions", "compressionQuality"], u), t;
}
function oa(n, e) {
  const t = {}, o = s(n, [
    "bytesBase64Encoded"
  ]);
  o != null && l(t, ["imageBytes"], Z(o));
  const i = s(n, ["mimeType"]);
  return i != null && l(t, ["mimeType"], i), t;
}
function mo(n, e) {
  const t = {}, o = s(n, ["gcsUri"]);
  o != null && l(t, ["gcsUri"], o);
  const i = s(n, [
    "bytesBase64Encoded"
  ]);
  i != null && l(t, ["imageBytes"], Z(i));
  const r = s(n, ["mimeType"]);
  return r != null && l(t, ["mimeType"], r), t;
}
function De(n, e) {
  const t = {};
  if (s(n, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  const o = s(n, ["imageBytes"]);
  o != null && l(t, ["bytesBase64Encoded"], Z(o));
  const i = s(n, ["mimeType"]);
  return i != null && l(t, ["mimeType"], i), t;
}
function $(n, e) {
  const t = {}, o = s(n, ["gcsUri"]);
  o != null && l(t, ["gcsUri"], o);
  const i = s(n, ["imageBytes"]);
  i != null && l(t, ["bytesBase64Encoded"], Z(i));
  const r = s(n, ["mimeType"]);
  return r != null && l(t, ["mimeType"], r), t;
}
function ia(n, e, t, o) {
  const i = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && l(t, ["_query", "pageSize"], r);
  const a = s(e, ["pageToken"]);
  t !== void 0 && a != null && l(t, ["_query", "pageToken"], a);
  const u = s(e, ["filter"]);
  t !== void 0 && u != null && l(t, ["_query", "filter"], u);
  const c = s(e, ["queryBase"]);
  return t !== void 0 && c != null && l(t, ["_url", "models_url"], ro(n, c)), i;
}
function sa(n, e, t, o) {
  const i = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && l(t, ["_query", "pageSize"], r);
  const a = s(e, ["pageToken"]);
  t !== void 0 && a != null && l(t, ["_query", "pageToken"], a);
  const u = s(e, ["filter"]);
  t !== void 0 && u != null && l(t, ["_query", "filter"], u);
  const c = s(e, ["queryBase"]);
  return t !== void 0 && c != null && l(t, ["_url", "models_url"], ro(n, c)), i;
}
function ra(n, e, t) {
  const o = {}, i = s(e, ["config"]);
  return i != null && ia(n, i, o), o;
}
function la(n, e, t) {
  const o = {}, i = s(e, ["config"]);
  return i != null && sa(n, i, o), o;
}
function aa(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "nextPageToken"
  ]);
  i != null && l(t, ["nextPageToken"], i);
  const r = s(n, ["_self"]);
  if (r != null) {
    let a = lo(r);
    Array.isArray(a) && (a = a.map((u) => Ke(u))), l(t, ["models"], a);
  }
  return t;
}
function ua(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "nextPageToken"
  ]);
  i != null && l(t, ["nextPageToken"], i);
  const r = s(n, ["_self"]);
  if (r != null) {
    let a = lo(r);
    Array.isArray(a) && (a = a.map((u) => Ye(u))), l(t, ["models"], a);
  }
  return t;
}
function da(n, e) {
  const t = {}, o = s(n, ["maskMode"]);
  o != null && l(t, ["maskMode"], o);
  const i = s(n, [
    "segmentationClasses"
  ]);
  i != null && l(t, ["maskClasses"], i);
  const r = s(n, ["maskDilation"]);
  return r != null && l(t, ["dilation"], r), t;
}
function Ke(n, e) {
  const t = {}, o = s(n, ["name"]);
  o != null && l(t, ["name"], o);
  const i = s(n, ["displayName"]);
  i != null && l(t, ["displayName"], i);
  const r = s(n, ["description"]);
  r != null && l(t, ["description"], r);
  const a = s(n, ["version"]);
  a != null && l(t, ["version"], a);
  const u = s(n, ["_self"]);
  u != null && l(t, ["tunedModelInfo"], Ra(u));
  const c = s(n, [
    "inputTokenLimit"
  ]);
  c != null && l(t, ["inputTokenLimit"], c);
  const d = s(n, [
    "outputTokenLimit"
  ]);
  d != null && l(t, ["outputTokenLimit"], d);
  const f = s(n, [
    "supportedGenerationMethods"
  ]);
  f != null && l(t, ["supportedActions"], f);
  const m = s(n, ["temperature"]);
  m != null && l(t, ["temperature"], m);
  const p = s(n, [
    "maxTemperature"
  ]);
  p != null && l(t, ["maxTemperature"], p);
  const h = s(n, ["topP"]);
  h != null && l(t, ["topP"], h);
  const g = s(n, ["topK"]);
  g != null && l(t, ["topK"], g);
  const _ = s(n, ["thinking"]);
  return _ != null && l(t, ["thinking"], _), t;
}
function Ye(n, e) {
  const t = {}, o = s(n, ["name"]);
  o != null && l(t, ["name"], o);
  const i = s(n, ["displayName"]);
  i != null && l(t, ["displayName"], i);
  const r = s(n, ["description"]);
  r != null && l(t, ["description"], r);
  const a = s(n, ["versionId"]);
  a != null && l(t, ["version"], a);
  const u = s(n, ["deployedModels"]);
  if (u != null) {
    let p = u;
    Array.isArray(p) && (p = p.map((h) => Il(h))), l(t, ["endpoints"], p);
  }
  const c = s(n, ["labels"]);
  c != null && l(t, ["labels"], c);
  const d = s(n, ["_self"]);
  d != null && l(t, ["tunedModelInfo"], Pa(d));
  const f = s(n, [
    "defaultCheckpointId"
  ]);
  f != null && l(t, ["defaultCheckpointId"], f);
  const m = s(n, ["checkpoints"]);
  if (m != null) {
    let p = m;
    Array.isArray(p) && (p = p.map((h) => h)), l(t, ["checkpoints"], p);
  }
  return t;
}
function ca(n, e) {
  const t = {}, o = s(n, [
    "mediaResolution"
  ]);
  o != null && l(t, ["mediaResolution"], o);
  const i = s(n, [
    "codeExecutionResult"
  ]);
  i != null && l(t, ["codeExecutionResult"], i);
  const r = s(n, [
    "executableCode"
  ]);
  r != null && l(t, ["executableCode"], r);
  const a = s(n, ["fileData"]);
  a != null && l(t, ["fileData"], vl(a));
  const u = s(n, ["functionCall"]);
  u != null && l(t, ["functionCall"], Al(u));
  const c = s(n, [
    "functionResponse"
  ]);
  c != null && l(t, ["functionResponse"], c);
  const d = s(n, ["inlineData"]);
  d != null && l(t, ["inlineData"], Xr(d));
  const f = s(n, ["text"]);
  f != null && l(t, ["text"], f);
  const m = s(n, ["thought"]);
  m != null && l(t, ["thought"], m);
  const p = s(n, [
    "thoughtSignature"
  ]);
  p != null && l(t, ["thoughtSignature"], p);
  const h = s(n, [
    "videoMetadata"
  ]);
  return h != null && l(t, ["videoMetadata"], h), t;
}
function fa(n, e) {
  const t = {}, o = s(n, ["productImage"]);
  return o != null && l(t, ["image"], $(o)), t;
}
function pa(n, e, t) {
  const o = {}, i = s(n, [
    "numberOfImages"
  ]);
  e !== void 0 && i != null && l(e, ["parameters", "sampleCount"], i);
  const r = s(n, ["baseSteps"]);
  e !== void 0 && r != null && l(e, ["parameters", "baseSteps"], r);
  const a = s(n, ["outputGcsUri"]);
  e !== void 0 && a != null && l(e, ["parameters", "storageUri"], a);
  const u = s(n, ["seed"]);
  e !== void 0 && u != null && l(e, ["parameters", "seed"], u);
  const c = s(n, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "safetySetting"], c);
  const d = s(n, [
    "personGeneration"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "personGeneration"], d);
  const f = s(n, ["addWatermark"]);
  e !== void 0 && f != null && l(e, ["parameters", "addWatermark"], f);
  const m = s(n, [
    "outputMimeType"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "outputOptions", "mimeType"], m);
  const p = s(n, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && p != null && l(e, ["parameters", "outputOptions", "compressionQuality"], p);
  const h = s(n, [
    "enhancePrompt"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "enhancePrompt"], h);
  const g = s(n, ["labels"]);
  return e !== void 0 && g != null && l(e, ["labels"], g), o;
}
function ma(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["source"]);
  r != null && ga(r, o);
  const a = s(e, ["config"]);
  return a != null && pa(a, o), o;
}
function ha(n, e) {
  const t = {}, o = s(n, [
    "predictions"
  ]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => xe(r))), l(t, ["generatedImages"], i);
  }
  return t;
}
function ga(n, e, t) {
  const o = {}, i = s(n, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(n, ["personImage"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "personImage", "image"], $(r));
  const a = s(n, [
    "productImages"
  ]);
  if (e !== void 0 && a != null) {
    let u = a;
    Array.isArray(u) && (u = u.map((c) => fa(c))), l(e, ["instances[0]", "productImages"], u);
  }
  return o;
}
function ya(n, e) {
  const t = {}, o = s(n, [
    "referenceImage"
  ]);
  o != null && l(t, ["referenceImage"], $(o));
  const i = s(n, ["referenceId"]);
  i != null && l(t, ["referenceId"], i);
  const r = s(n, [
    "referenceType"
  ]);
  r != null && l(t, ["referenceType"], r);
  const a = s(n, [
    "maskImageConfig"
  ]);
  a != null && l(t, ["maskImageConfig"], da(a));
  const u = s(n, [
    "controlImageConfig"
  ]);
  u != null && l(t, ["controlImageConfig"], ol(u));
  const c = s(n, [
    "styleImageConfig"
  ]);
  c != null && l(t, ["styleImageConfig"], c);
  const d = s(n, [
    "subjectImageConfig"
  ]);
  return d != null && l(t, ["subjectImageConfig"], d), t;
}
function ho(n, e) {
  const t = {}, o = s(n, [
    "safetyAttributes",
    "categories"
  ]);
  o != null && l(t, ["categories"], o);
  const i = s(n, [
    "safetyAttributes",
    "scores"
  ]);
  i != null && l(t, ["scores"], i);
  const r = s(n, ["contentType"]);
  return r != null && l(t, ["contentType"], r), t;
}
function go(n, e) {
  const t = {}, o = s(n, [
    "safetyAttributes",
    "categories"
  ]);
  o != null && l(t, ["categories"], o);
  const i = s(n, [
    "safetyAttributes",
    "scores"
  ]);
  i != null && l(t, ["scores"], i);
  const r = s(n, ["contentType"]);
  return r != null && l(t, ["contentType"], r), t;
}
function Ta(n, e) {
  const t = {}, o = s(n, ["category"]);
  if (o != null && l(t, ["category"], o), s(n, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const i = s(n, ["threshold"]);
  return i != null && l(t, ["threshold"], i), t;
}
function _a(n, e) {
  const t = {}, o = s(n, ["image"]);
  return o != null && l(t, ["image"], $(o)), t;
}
function Ca(n, e, t) {
  const o = {}, i = s(n, ["mode"]);
  e !== void 0 && i != null && l(e, ["parameters", "mode"], i);
  const r = s(n, [
    "maxPredictions"
  ]);
  e !== void 0 && r != null && l(e, ["parameters", "maxPredictions"], r);
  const a = s(n, [
    "confidenceThreshold"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "confidenceThreshold"], a);
  const u = s(n, ["maskDilation"]);
  e !== void 0 && u != null && l(e, ["parameters", "maskDilation"], u);
  const c = s(n, [
    "binaryColorThreshold"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "binaryColorThreshold"], c);
  const d = s(n, ["labels"]);
  return e !== void 0 && d != null && l(e, ["labels"], d), o;
}
function Ea(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["source"]);
  r != null && Ia(r, o);
  const a = s(e, ["config"]);
  return a != null && Ca(a, o), o;
}
function Sa(n, e) {
  const t = {}, o = s(n, ["predictions"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => Kl(r))), l(t, ["generatedMasks"], i);
  }
  return t;
}
function Ia(n, e, t) {
  const o = {}, i = s(n, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(n, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], $(r));
  const a = s(n, [
    "scribbleImage"
  ]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "scribble"], _a(a)), o;
}
function va(n, e) {
  const t = {}, o = s(n, [
    "retrievalConfig"
  ]);
  o != null && l(t, ["retrievalConfig"], o);
  const i = s(n, [
    "functionCallingConfig"
  ]);
  return i != null && l(t, ["functionCallingConfig"], Rl(i)), t;
}
function Aa(n, e) {
  const t = {};
  if (s(n, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const o = s(n, ["computerUse"]);
  o != null && l(t, ["computerUse"], o);
  const i = s(n, ["fileSearch"]);
  i != null && l(t, ["fileSearch"], i);
  const r = s(n, [
    "codeExecution"
  ]);
  if (r != null && l(t, ["codeExecution"], r), s(n, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const a = s(n, [
    "functionDeclarations"
  ]);
  if (a != null) {
    let m = a;
    Array.isArray(m) && (m = m.map((p) => p)), l(t, ["functionDeclarations"], m);
  }
  const u = s(n, ["googleMaps"]);
  u != null && l(t, ["googleMaps"], jl(u));
  const c = s(n, ["googleSearch"]);
  c != null && l(t, ["googleSearch"], ea(c));
  const d = s(n, [
    "googleSearchRetrieval"
  ]);
  d != null && l(t, ["googleSearchRetrieval"], d);
  const f = s(n, ["urlContext"]);
  return f != null && l(t, ["urlContext"], f), t;
}
function yo(n, e) {
  const t = {}, o = s(n, ["retrieval"]);
  o != null && l(t, ["retrieval"], o);
  const i = s(n, ["computerUse"]);
  if (i != null && l(t, ["computerUse"], i), s(n, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const r = s(n, [
    "codeExecution"
  ]);
  r != null && l(t, ["codeExecution"], r);
  const a = s(n, [
    "enterpriseWebSearch"
  ]);
  a != null && l(t, ["enterpriseWebSearch"], a);
  const u = s(n, [
    "functionDeclarations"
  ]);
  if (u != null) {
    let p = u;
    Array.isArray(p) && (p = p.map((h) => Pl(h))), l(t, ["functionDeclarations"], p);
  }
  const c = s(n, ["googleMaps"]);
  c != null && l(t, ["googleMaps"], c);
  const d = s(n, ["googleSearch"]);
  d != null && l(t, ["googleSearch"], d);
  const f = s(n, [
    "googleSearchRetrieval"
  ]);
  f != null && l(t, ["googleSearchRetrieval"], f);
  const m = s(n, ["urlContext"]);
  return m != null && l(t, ["urlContext"], m), t;
}
function Ra(n, e) {
  const t = {}, o = s(n, ["baseModel"]);
  o != null && l(t, ["baseModel"], o);
  const i = s(n, ["createTime"]);
  i != null && l(t, ["createTime"], i);
  const r = s(n, ["updateTime"]);
  return r != null && l(t, ["updateTime"], r), t;
}
function Pa(n, e) {
  const t = {}, o = s(n, [
    "labels",
    "google-vertex-llm-tuning-base-model-id"
  ]);
  o != null && l(t, ["baseModel"], o);
  const i = s(n, ["createTime"]);
  i != null && l(t, ["createTime"], i);
  const r = s(n, ["updateTime"]);
  return r != null && l(t, ["updateTime"], r), t;
}
function wa(n, e, t) {
  const o = {}, i = s(n, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(n, ["description"]);
  e !== void 0 && r != null && l(e, ["description"], r);
  const a = s(n, [
    "defaultCheckpointId"
  ]);
  return e !== void 0 && a != null && l(e, ["defaultCheckpointId"], a), o;
}
function Ma(n, e, t) {
  const o = {}, i = s(n, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(n, ["description"]);
  e !== void 0 && r != null && l(e, ["description"], r);
  const a = s(n, [
    "defaultCheckpointId"
  ]);
  return e !== void 0 && a != null && l(e, ["defaultCheckpointId"], a), o;
}
function Na(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "name"], x(n, i));
  const r = s(e, ["config"]);
  return r != null && wa(r, o), o;
}
function xa(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["config"]);
  return r != null && Ma(r, o), o;
}
function Da(n, e, t) {
  const o = {}, i = s(n, ["outputGcsUri"]);
  e !== void 0 && i != null && l(e, ["parameters", "storageUri"], i);
  const r = s(n, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && r != null && l(e, ["parameters", "safetySetting"], r);
  const a = s(n, [
    "personGeneration"
  ]);
  e !== void 0 && a != null && l(e, ["parameters", "personGeneration"], a);
  const u = s(n, [
    "includeRaiReason"
  ]);
  e !== void 0 && u != null && l(e, ["parameters", "includeRaiReason"], u);
  const c = s(n, [
    "outputMimeType"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "outputOptions", "mimeType"], c);
  const d = s(n, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "outputOptions", "compressionQuality"], d);
  const f = s(n, [
    "enhanceInputImage"
  ]);
  e !== void 0 && f != null && l(e, ["parameters", "upscaleConfig", "enhanceInputImage"], f);
  const m = s(n, [
    "imagePreservationFactor"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "upscaleConfig", "imagePreservationFactor"], m);
  const p = s(n, ["labels"]);
  e !== void 0 && p != null && l(e, ["labels"], p);
  const h = s(n, [
    "numberOfImages"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "sampleCount"], h);
  const g = s(n, ["mode"]);
  return e !== void 0 && g != null && l(e, ["parameters", "mode"], g), o;
}
function ka(n, e, t) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], x(n, i));
  const r = s(e, ["image"]);
  r != null && l(o, ["instances[0]", "image"], $(r));
  const a = s(e, [
    "upscaleFactor"
  ]);
  a != null && l(o, ["parameters", "upscaleConfig", "upscaleFactor"], a);
  const u = s(e, ["config"]);
  return u != null && Da(u, o), o;
}
function Ua(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "predictions"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => xe(a))), l(t, ["generatedImages"], r);
  }
  return t;
}
function La(n, e) {
  const t = {}, o = s(n, ["uri"]);
  o != null && l(t, ["uri"], o);
  const i = s(n, ["encodedVideo"]);
  i != null && l(t, ["videoBytes"], Z(i));
  const r = s(n, ["encoding"]);
  return r != null && l(t, ["mimeType"], r), t;
}
function Fa(n, e) {
  const t = {}, o = s(n, ["gcsUri"]);
  o != null && l(t, ["uri"], o);
  const i = s(n, [
    "bytesBase64Encoded"
  ]);
  i != null && l(t, ["videoBytes"], Z(i));
  const r = s(n, ["mimeType"]);
  return r != null && l(t, ["mimeType"], r), t;
}
function Ga(n, e) {
  const t = {}, o = s(n, ["image"]);
  o != null && l(t, ["_self"], $(o));
  const i = s(n, ["maskMode"]);
  return i != null && l(t, ["maskMode"], i), t;
}
function Va(n, e) {
  const t = {}, o = s(n, ["image"]);
  o != null && l(t, ["image"], De(o));
  const i = s(n, [
    "referenceType"
  ]);
  return i != null && l(t, ["referenceType"], i), t;
}
function Ha(n, e) {
  const t = {}, o = s(n, ["image"]);
  o != null && l(t, ["image"], $(o));
  const i = s(n, [
    "referenceType"
  ]);
  return i != null && l(t, ["referenceType"], i), t;
}
function To(n, e) {
  const t = {}, o = s(n, ["uri"]);
  o != null && l(t, ["uri"], o);
  const i = s(n, ["videoBytes"]);
  i != null && l(t, ["encodedVideo"], Z(i));
  const r = s(n, ["mimeType"]);
  return r != null && l(t, ["encoding"], r), t;
}
function _o(n, e) {
  const t = {}, o = s(n, ["uri"]);
  o != null && l(t, ["gcsUri"], o);
  const i = s(n, ["videoBytes"]);
  i != null && l(t, ["bytesBase64Encoded"], Z(i));
  const r = s(n, ["mimeType"]);
  return r != null && l(t, ["mimeType"], r), t;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function qa(n, e) {
  const t = {}, o = s(n, ["displayName"]);
  return e !== void 0 && o != null && l(e, ["displayName"], o), t;
}
function ba(n) {
  const e = {}, t = s(n, ["config"]);
  return t != null && qa(t, e), e;
}
function Ba(n, e) {
  const t = {}, o = s(n, ["force"]);
  return e !== void 0 && o != null && l(e, ["_query", "force"], o), t;
}
function Ja(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["_url", "name"], t);
  const o = s(n, ["config"]);
  return o != null && Ba(o, e), e;
}
function Oa(n) {
  const e = {}, t = s(n, ["name"]);
  return t != null && l(e, ["_url", "name"], t), e;
}
function $a(n, e) {
  const t = {}, o = s(n, [
    "customMetadata"
  ]);
  if (e !== void 0 && o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["customMetadata"], r);
  }
  const i = s(n, [
    "chunkingConfig"
  ]);
  return e !== void 0 && i != null && l(e, ["chunkingConfig"], i), t;
}
function Wa(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["name"], t);
  const o = s(n, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(n, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(n, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(n, ["response"]);
  return a != null && l(e, ["response"], Ya(a)), e;
}
function Ka(n) {
  const e = {}, t = s(n, [
    "fileSearchStoreName"
  ]);
  t != null && l(e, ["_url", "file_search_store_name"], t);
  const o = s(n, ["fileName"]);
  o != null && l(e, ["fileName"], o);
  const i = s(n, ["config"]);
  return i != null && $a(i, e), e;
}
function Ya(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(n, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function za(n, e) {
  const t = {}, o = s(n, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(n, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), t;
}
function Xa(n) {
  const e = {}, t = s(n, ["config"]);
  return t != null && za(t, e), e;
}
function Qa(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(n, [
    "fileSearchStores"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(e, ["fileSearchStores"], r);
  }
  return e;
}
function Co(n, e) {
  const t = {}, o = s(n, ["mimeType"]);
  e !== void 0 && o != null && l(e, ["mimeType"], o);
  const i = s(n, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(n, [
    "customMetadata"
  ]);
  if (e !== void 0 && r != null) {
    let u = r;
    Array.isArray(u) && (u = u.map((c) => c)), l(e, ["customMetadata"], u);
  }
  const a = s(n, [
    "chunkingConfig"
  ]);
  return e !== void 0 && a != null && l(e, ["chunkingConfig"], a), t;
}
function Za(n) {
  const e = {}, t = s(n, [
    "fileSearchStoreName"
  ]);
  t != null && l(e, ["_url", "file_search_store_name"], t);
  const o = s(n, ["config"]);
  return o != null && Co(o, e), e;
}
function ja(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  return t != null && l(e, ["sdkHttpResponse"], t), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const eu = "Content-Type", nu = "X-Server-Timeout", tu = "User-Agent", ze = "x-goog-api-client", ou = "1.39.0", iu = `google-genai-sdk/${ou}`, su = "v1beta1", ru = "v1beta";
class lu {
  constructor(e) {
    var t, o, i;
    this.clientOptions = Object.assign({}, e), this.customBaseUrl = (t = e.httpOptions) === null || t === void 0 ? void 0 : t.baseUrl, this.clientOptions.vertexai && (this.clientOptions.project && this.clientOptions.location ? this.clientOptions.apiKey = void 0 : this.clientOptions.apiKey && (this.clientOptions.project = void 0, this.clientOptions.location = void 0));
    const r = {};
    if (this.clientOptions.vertexai) {
      if (!this.clientOptions.location && !this.clientOptions.apiKey && !this.customBaseUrl && (this.clientOptions.location = "global"), !(this.clientOptions.project && this.clientOptions.location || this.clientOptions.apiKey) && !this.customBaseUrl)
        throw new Error("Authentication is not set up. Please provide either a project and location, or an API key, or a custom base URL.");
      const u = e.project && e.location || !!e.apiKey;
      this.customBaseUrl && !u ? (r.baseUrl = this.customBaseUrl, this.clientOptions.project = void 0, this.clientOptions.location = void 0) : this.clientOptions.apiKey || this.clientOptions.location === "global" ? r.baseUrl = "https://aiplatform.googleapis.com/" : this.clientOptions.project && this.clientOptions.location && (r.baseUrl = `https://${this.clientOptions.location}-aiplatform.googleapis.com/`), r.apiVersion = (o = this.clientOptions.apiVersion) !== null && o !== void 0 ? o : su;
    } else {
      if (!this.clientOptions.apiKey)
        throw new he({
          message: "API key must be set when using the Gemini API.",
          status: 403
        });
      r.apiVersion = (i = this.clientOptions.apiVersion) !== null && i !== void 0 ? i : ru, r.baseUrl = "https://generativelanguage.googleapis.com/";
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
    const e = this.getBaseUrl(), t = new URL(e);
    return t.protocol = t.protocol == "http:" ? "ws" : "wss", t.toString();
  }
  setBaseUrl(e) {
    if (this.clientOptions.httpOptions)
      this.clientOptions.httpOptions.baseUrl = e;
    else
      throw new Error("HTTP options are not correctly set.");
  }
  constructUrl(e, t, o) {
    const i = [this.getRequestUrlInternal(t)];
    return o && i.push(this.getBaseResourcePath()), e !== "" && i.push(e), new URL(`${i.join("/")}`);
  }
  shouldPrependVertexProjectPath(e, t) {
    return !(t.baseUrl && t.baseUrlResourceScope === Je.COLLECTION || this.clientOptions.apiKey || !this.clientOptions.vertexai || e.path.startsWith("projects/") || e.httpMethod === "GET" && e.path.startsWith("publishers/google/models"));
  }
  async request(e) {
    let t = this.clientOptions.httpOptions;
    e.httpOptions && (t = this.patchHttpOptions(this.clientOptions.httpOptions, e.httpOptions));
    const o = this.shouldPrependVertexProjectPath(e, t), i = this.constructUrl(e.path, t, o);
    if (e.queryParams)
      for (const [a, u] of Object.entries(e.queryParams))
        i.searchParams.append(a, String(u));
    let r = {};
    if (e.httpMethod === "GET") {
      if (e.body && e.body !== "{}")
        throw new Error("Request body should be empty for GET request, but got non empty request body");
    } else
      r.body = e.body;
    return r = await this.includeExtraHttpOptionsToRequestInit(r, t, i.toString(), e.abortSignal), this.unaryApiCall(i, r, e.httpMethod);
  }
  patchHttpOptions(e, t) {
    const o = JSON.parse(JSON.stringify(e));
    for (const [i, r] of Object.entries(t))
      typeof r == "object" ? o[i] = Object.assign(Object.assign({}, o[i]), r) : r !== void 0 && (o[i] = r);
    return o;
  }
  async requestStream(e) {
    let t = this.clientOptions.httpOptions;
    e.httpOptions && (t = this.patchHttpOptions(this.clientOptions.httpOptions, e.httpOptions));
    const o = this.shouldPrependVertexProjectPath(e, t), i = this.constructUrl(e.path, t, o);
    (!i.searchParams.has("alt") || i.searchParams.get("alt") !== "sse") && i.searchParams.set("alt", "sse");
    let r = {};
    return r.body = e.body, r = await this.includeExtraHttpOptionsToRequestInit(r, t, i.toString(), e.abortSignal), this.streamApiCall(i, r, e.httpMethod);
  }
  async includeExtraHttpOptionsToRequestInit(e, t, o, i) {
    if (t && t.timeout || i) {
      const r = new AbortController(), a = r.signal;
      if (t.timeout && (t == null ? void 0 : t.timeout) > 0) {
        const u = setTimeout(() => r.abort(), t.timeout);
        u && typeof u.unref == "function" && u.unref();
      }
      i && i.addEventListener("abort", () => {
        r.abort();
      }), e.signal = a;
    }
    return t && t.extraBody !== null && au(e, t.extraBody), e.headers = await this.getHeadersInternal(t, o), e;
  }
  async unaryApiCall(e, t, o) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, t), { method: o })).then(async (i) => (await Vt(i), new Oe(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  async streamApiCall(e, t, o) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, t), { method: o })).then(async (i) => (await Vt(i), this.processStreamResponse(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  processStreamResponse(e) {
    return J(this, arguments, function* () {
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
          const { done: d, value: f } = yield w(i.read());
          if (d) {
            if (a.trim().length > 0)
              throw new Error("Incomplete JSON segment at the end");
            break;
          }
          const m = r.decode(f, { stream: !0 });
          try {
            const g = JSON.parse(m);
            if ("error" in g) {
              const _ = JSON.parse(JSON.stringify(g.error)), T = _.status, C = _.code, S = `got status: ${T}. ${JSON.stringify(g)}`;
              if (C >= 400 && C < 600)
                throw new he({
                  message: S,
                  status: C
                });
            }
          } catch (g) {
            if (g.name === "ApiError")
              throw g;
          }
          a += m;
          let p = -1, h = 0;
          for (; ; ) {
            p = -1, h = 0;
            for (const T of c) {
              const C = a.indexOf(T);
              C !== -1 && (p === -1 || C < p) && (p = C, h = T.length);
            }
            if (p === -1)
              break;
            const g = a.substring(0, p);
            a = a.substring(p + h);
            const _ = g.trim();
            if (_.startsWith(u)) {
              const T = _.substring(u.length).trim();
              try {
                const C = new Response(T, {
                  headers: e == null ? void 0 : e.headers,
                  status: e == null ? void 0 : e.status,
                  statusText: e == null ? void 0 : e.statusText
                });
                yield yield w(new Oe(C));
              } catch (C) {
                throw new Error(`exception parsing stream chunk ${T}. ${C}`);
              }
            }
          }
        }
      } finally {
        i.releaseLock();
      }
    });
  }
  async apiCall(e, t) {
    return fetch(e, t).catch((o) => {
      throw new Error(`exception ${o} sending request`);
    });
  }
  getDefaultHeaders() {
    const e = {}, t = iu + " " + this.clientOptions.userAgentExtra;
    return e[tu] = t, e[ze] = t, e[eu] = "application/json", e;
  }
  async getHeadersInternal(e, t) {
    const o = new Headers();
    if (e && e.headers) {
      for (const [i, r] of Object.entries(e.headers))
        o.append(i, r);
      e.timeout && e.timeout > 0 && o.append(nu, String(Math.ceil(e.timeout / 1e3)));
    }
    return await this.clientOptions.auth.addAuthHeaders(o, t), o;
  }
  getFileName(e) {
    var t;
    let o = "";
    return typeof e == "string" && (o = e.replace(/[/\\]+$/, ""), o = (t = o.split(/[/\\]/).pop()) !== null && t !== void 0 ? t : ""), o;
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
  async uploadFile(e, t) {
    var o;
    const i = {};
    t != null && (i.mimeType = t.mimeType, i.name = t.name, i.displayName = t.displayName), i.name && !i.name.startsWith("files/") && (i.name = `files/${i.name}`);
    const r = this.clientOptions.uploader, a = await r.stat(e);
    i.sizeBytes = String(a.size);
    const u = (o = t == null ? void 0 : t.mimeType) !== null && o !== void 0 ? o : a.type;
    if (u === void 0 || u === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    i.mimeType = u;
    const c = {
      file: i
    }, d = this.getFileName(e), f = v("upload/v1beta/files", c._url), m = await this.fetchUploadUrl(f, i.sizeBytes, i.mimeType, d, c, t == null ? void 0 : t.httpOptions);
    return r.upload(e, m, this);
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
  async uploadFileToFileSearchStore(e, t, o) {
    var i;
    const r = this.clientOptions.uploader, a = await r.stat(t), u = String(a.size), c = (i = o == null ? void 0 : o.mimeType) !== null && i !== void 0 ? i : a.type;
    if (c === void 0 || c === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    const d = `upload/v1beta/${e}:uploadToFileSearchStore`, f = this.getFileName(t), m = {};
    o != null && Co(o, m);
    const p = await this.fetchUploadUrl(d, u, c, f, m, o == null ? void 0 : o.httpOptions);
    return r.uploadToFileSearchStore(t, p, this);
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
  async fetchUploadUrl(e, t, o, i, r, a) {
    var u;
    let c = {};
    a ? c = a : c = {
      apiVersion: "",
      // api-version is set in the path.
      headers: Object.assign({ "Content-Type": "application/json", "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": `${t}`, "X-Goog-Upload-Header-Content-Type": `${o}` }, i ? { "X-Goog-Upload-File-Name": i } : {})
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
async function Vt(n) {
  var e;
  if (n === void 0)
    throw new Error("response is undefined");
  if (!n.ok) {
    const t = n.status;
    let o;
    !((e = n.headers.get("content-type")) === null || e === void 0) && e.includes("application/json") ? o = await n.json() : o = {
      error: {
        message: await n.text(),
        code: n.status,
        status: n.statusText
      }
    };
    const i = JSON.stringify(o);
    throw t >= 400 && t < 600 ? new he({
      message: i,
      status: t
    }) : new Error(i);
  }
}
function au(n, e) {
  if (!e || Object.keys(e).length === 0)
    return;
  if (n.body instanceof Blob) {
    console.warn("includeExtraBodyToRequestInit: extraBody provided but current request body is a Blob. extraBody will be ignored as merging is not supported for Blob bodies.");
    return;
  }
  let t = {};
  if (typeof n.body == "string" && n.body.length > 0)
    try {
      const r = JSON.parse(n.body);
      if (typeof r == "object" && r !== null && !Array.isArray(r))
        t = r;
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
  const i = o(t, e);
  n.body = JSON.stringify(i);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const uu = "mcp_used/unknown";
let du = !1;
function Eo(n) {
  for (const e of n)
    if (cu(e) || typeof e == "object" && "inputSchema" in e)
      return !0;
  return du;
}
function So(n) {
  var e;
  const t = (e = n[ze]) !== null && e !== void 0 ? e : "";
  n[ze] = (t + ` ${uu}`).trimStart();
}
function cu(n) {
  return n !== null && typeof n == "object" && n instanceof cn;
}
function fu(n) {
  return J(this, arguments, function* (t, o = 100) {
    let i, r = 0;
    for (; r < o; ) {
      const a = yield w(t.listTools({ cursor: i }));
      for (const u of a.tools)
        yield yield w(u), r++;
      if (!a.nextCursor)
        break;
      i = a.nextCursor;
    }
  });
}
class cn {
  constructor(e = [], t) {
    this.mcpTools = [], this.functionNameToMcpClient = {}, this.mcpClients = e, this.config = t;
  }
  /**
   * Creates a McpCallableTool.
   */
  static create(e, t) {
    return new cn(e, t);
  }
  /**
   * Validates the function names are not duplicate and initialize the function
   * name to MCP client mapping.
   *
   * @throws {Error} if the MCP tools from the MCP clients have duplicate tool
   *     names.
   */
  async initialize() {
    var e, t, o, i;
    if (this.mcpTools.length > 0)
      return;
    const r = {}, a = [];
    for (const f of this.mcpClients)
      try {
        for (var u = !0, c = (t = void 0, O(fu(f))), d; d = await c.next(), e = d.done, !e; u = !0) {
          i = d.value, u = !1;
          const m = i;
          a.push(m);
          const p = m.name;
          if (r[p])
            throw new Error(`Duplicate function name ${p} found in MCP tools. Please ensure function names are unique.`);
          r[p] = f;
        }
      } catch (m) {
        t = { error: m };
      } finally {
        try {
          !u && !e && (o = c.return) && await o.call(c);
        } finally {
          if (t) throw t.error;
        }
      }
    this.mcpTools = a, this.functionNameToMcpClient = r;
  }
  async tool() {
    return await this.initialize(), bi(this.mcpTools, this.config);
  }
  async callTool(e) {
    await this.initialize();
    const t = [];
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
        t.push({
          functionResponse: {
            name: o.name,
            response: a.isError ? { error: a } : a
          }
        });
      }
    return t;
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
async function pu(n, e, t) {
  const o = new ki();
  let i;
  t.data instanceof Blob ? i = JSON.parse(await t.data.text()) : i = JSON.parse(t.data), Object.assign(o, i), e(o);
}
class mu {
  constructor(e, t, o) {
    this.apiClient = e, this.auth = t, this.webSocketFactory = o;
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
    var t, o;
    if (this.apiClient.isVertexAI())
      throw new Error("Live music is not supported for Vertex AI.");
    console.warn("Live music generation is experimental and may change in future versions.");
    const i = this.apiClient.getWebsocketBaseUrl(), r = this.apiClient.getApiVersion(), a = yu(this.apiClient.getDefaultHeaders()), u = this.apiClient.getApiKey(), c = `${i}/ws/google.ai.generativelanguage.${r}.GenerativeService.BidiGenerateMusic?key=${u}`;
    let d = () => {
    };
    const f = new Promise((E) => {
      d = E;
    }), m = e.callbacks, p = function() {
      d({});
    }, h = this.apiClient, g = {
      onopen: p,
      onmessage: (E) => {
        pu(h, m.onmessage, E);
      },
      onerror: (t = m == null ? void 0 : m.onerror) !== null && t !== void 0 ? t : function(E) {
      },
      onclose: (o = m == null ? void 0 : m.onclose) !== null && o !== void 0 ? o : function(E) {
      }
    }, _ = this.webSocketFactory.create(c, gu(a), g);
    _.connect(), await f;
    const S = { setup: { model: x(this.apiClient, e.model) } };
    return _.send(JSON.stringify(S)), new hu(_, this.apiClient);
  }
}
class hu {
  constructor(e, t) {
    this.conn = e, this.apiClient = t;
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
    const t = qr(e);
    this.conn.send(JSON.stringify({ clientContent: t }));
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
    const t = Hr(e);
    this.conn.send(JSON.stringify(t));
  }
  sendPlaybackControl(e) {
    const t = { playbackControl: e };
    this.conn.send(JSON.stringify(t));
  }
  /**
   * Start the music stream.
   *
   * @experimental
   */
  play() {
    this.sendPlaybackControl(se.PLAY);
  }
  /**
   * Temporarily halt the music stream. Use `play` to resume from the current
   * position.
   *
   * @experimental
   */
  pause() {
    this.sendPlaybackControl(se.PAUSE);
  }
  /**
   * Stop the music stream and reset the state. Retains the current prompts
   * and config.
   *
   * @experimental
   */
  stop() {
    this.sendPlaybackControl(se.STOP);
  }
  /**
   * Resets the context of the music generation without stopping it.
   * Retains the current prompts and config.
   *
   * @experimental
   */
  resetContext() {
    this.sendPlaybackControl(se.RESET_CONTEXT);
  }
  /**
       Terminates the WebSocket connection.
  
       @experimental
     */
  close() {
    this.conn.close();
  }
}
function gu(n) {
  const e = {};
  return n.forEach((t, o) => {
    e[o] = t;
  }), e;
}
function yu(n) {
  const e = new Headers();
  for (const [t, o] of Object.entries(n))
    e.append(t, o);
  return e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Tu = "FunctionResponse request must have an `id` field from the response of a ToolCall.FunctionalCalls in Google AI.";
async function _u(n, e, t) {
  const o = new Di();
  let i;
  t.data instanceof Blob ? i = await t.data.text() : t.data instanceof ArrayBuffer ? i = new TextDecoder().decode(t.data) : i = t.data;
  const r = JSON.parse(i);
  if (n.isVertexAI()) {
    const a = Jr(r);
    Object.assign(o, a);
  } else
    Object.assign(o, r);
  e(o);
}
class Cu {
  constructor(e, t, o) {
    this.apiClient = e, this.auth = t, this.webSocketFactory = o, this.music = new mu(this.apiClient, this.auth, this.webSocketFactory);
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
    var t, o, i, r, a, u;
    if (e.config && e.config.httpOptions)
      throw new Error("The Live module does not support httpOptions at request-level in LiveConnectConfig yet. Please use the client-level httpOptions configuration instead.");
    const c = this.apiClient.getWebsocketBaseUrl(), d = this.apiClient.getApiVersion();
    let f;
    const m = this.apiClient.getHeaders();
    e.config && e.config.tools && Eo(e.config.tools) && So(m);
    const p = vu(m);
    if (this.apiClient.isVertexAI()) {
      const A = this.apiClient.getProject(), N = this.apiClient.getLocation(), k = this.apiClient.getApiKey(), q = !!A && !!N || !!k;
      this.apiClient.getCustomBaseUrl() && !q ? f = c : (f = `${c}/ws/google.cloud.aiplatform.${d}.LlmBidiService/BidiGenerateContent`, await this.auth.addAuthHeaders(p, f));
    } else {
      const A = this.apiClient.getApiKey();
      let N = "BidiGenerateContent", k = "key";
      A != null && A.startsWith("auth_tokens/") && (console.warn("Warning: Ephemeral token support is experimental and may change in future versions."), d !== "v1alpha" && console.warn("Warning: The SDK's ephemeral token support is in v1alpha only. Please use const ai = new GoogleGenAI({apiKey: token.name, httpOptions: { apiVersion: 'v1alpha' }}); before session connection."), N = "BidiGenerateContentConstrained", k = "access_token"), f = `${c}/ws/google.ai.generativelanguage.${d}.GenerativeService.${N}?${k}=${A}`;
    }
    let h = () => {
    };
    const g = new Promise((A) => {
      h = A;
    }), _ = e.callbacks, T = function() {
      var A;
      (A = _ == null ? void 0 : _.onopen) === null || A === void 0 || A.call(_), h({});
    }, C = this.apiClient, S = {
      onopen: T,
      onmessage: (A) => {
        _u(C, _.onmessage, A);
      },
      onerror: (t = _ == null ? void 0 : _.onerror) !== null && t !== void 0 ? t : function(A) {
      },
      onclose: (o = _ == null ? void 0 : _.onclose) !== null && o !== void 0 ? o : function(A) {
      }
    }, E = this.webSocketFactory.create(f, Iu(p), S);
    E.connect(), await g;
    let I = x(this.apiClient, e.model);
    if (this.apiClient.isVertexAI() && I.startsWith("publishers/")) {
      const A = this.apiClient.getProject(), N = this.apiClient.getLocation();
      A && N && (I = `projects/${A}/locations/${N}/` + I);
    }
    let y = {};
    this.apiClient.isVertexAI() && ((i = e.config) === null || i === void 0 ? void 0 : i.responseModalities) === void 0 && (e.config === void 0 ? e.config = { responseModalities: [ve.AUDIO] } : e.config.responseModalities = [ve.AUDIO]), !((r = e.config) === null || r === void 0) && r.generationConfig && console.warn("Setting `LiveConnectConfig.generation_config` is deprecated, please set the fields on `LiveConnectConfig` directly. This will become an error in a future version (not before Q3 2025).");
    const R = (u = (a = e.config) === null || a === void 0 ? void 0 : a.tools) !== null && u !== void 0 ? u : [], M = [];
    for (const A of R)
      if (this.isCallableTool(A)) {
        const N = A;
        M.push(await N.tool());
      } else
        M.push(A);
    M.length > 0 && (e.config.tools = M);
    const D = {
      model: I,
      config: e.config,
      callbacks: e.callbacks
    };
    return this.apiClient.isVertexAI() ? y = Vr(this.apiClient, D) : y = Gr(this.apiClient, D), delete y.config, E.send(JSON.stringify(y)), new Su(E, this.apiClient);
  }
  // TODO: b/416041229 - Abstract this method to a common place.
  isCallableTool(e) {
    return "callTool" in e && typeof e.callTool == "function";
  }
}
const Eu = {
  turnComplete: !0
};
class Su {
  constructor(e, t) {
    this.conn = e, this.apiClient = t;
  }
  tLiveClientContent(e, t) {
    if (t.turns !== null && t.turns !== void 0) {
      let o = [];
      try {
        o = b(t.turns), e.isVertexAI() || (o = o.map((i) => Ne(i)));
      } catch {
        throw new Error(`Failed to parse client content "turns", type: '${typeof t.turns}'`);
      }
      return {
        clientContent: { turns: o, turnComplete: t.turnComplete }
      };
    }
    return {
      clientContent: { turnComplete: t.turnComplete }
    };
  }
  tLiveClienttToolResponse(e, t) {
    let o = [];
    if (t.functionResponses == null)
      throw new Error("functionResponses is required.");
    if (Array.isArray(t.functionResponses) ? o = t.functionResponses : o = [t.functionResponses], o.length === 0)
      throw new Error("functionResponses is required.");
    for (const r of o) {
      if (typeof r != "object" || r === null || !("name" in r) || !("response" in r))
        throw new Error(`Could not parse function response, type '${typeof r}'.`);
      if (!e.isVertexAI() && !("id" in r))
        throw new Error(Tu);
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
    e = Object.assign(Object.assign({}, Eu), e);
    const t = this.tLiveClientContent(this.apiClient, e);
    this.conn.send(JSON.stringify(t));
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
    let t = {};
    this.apiClient.isVertexAI() ? t = {
      realtimeInput: Br(e)
    } : t = {
      realtimeInput: br(e)
    }, this.conn.send(JSON.stringify(t));
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
    const t = this.tLiveClienttToolResponse(this.apiClient, e);
    this.conn.send(JSON.stringify(t));
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
function Iu(n) {
  const e = {};
  return n.forEach((t, o) => {
    e[o] = t;
  }), e;
}
function vu(n) {
  const e = new Headers();
  for (const [t, o] of Object.entries(n))
    e.append(t, o);
  return e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Ht = 10;
function qt(n) {
  var e, t, o;
  if (!((e = n == null ? void 0 : n.automaticFunctionCalling) === null || e === void 0) && e.disable)
    return !0;
  let i = !1;
  for (const a of (t = n == null ? void 0 : n.tools) !== null && t !== void 0 ? t : [])
    if (ae(a)) {
      i = !0;
      break;
    }
  if (!i)
    return !0;
  const r = (o = n == null ? void 0 : n.automaticFunctionCalling) === null || o === void 0 ? void 0 : o.maximumRemoteCalls;
  return r && (r < 0 || !Number.isInteger(r)) || r == 0 ? (console.warn("Invalid maximumRemoteCalls value provided for automatic function calling. Disabled automatic function calling. Please provide a valid integer value greater than 0. maximumRemoteCalls provided:", r), !0) : !1;
}
function ae(n) {
  return "callTool" in n && typeof n.callTool == "function";
}
function Au(n) {
  var e, t, o;
  return (o = (t = (e = n.config) === null || e === void 0 ? void 0 : e.tools) === null || t === void 0 ? void 0 : t.some((i) => ae(i))) !== null && o !== void 0 ? o : !1;
}
function bt(n) {
  var e;
  const t = [];
  return !((e = n == null ? void 0 : n.config) === null || e === void 0) && e.tools && n.config.tools.forEach((o, i) => {
    if (ae(o))
      return;
    const r = o;
    r.functionDeclarations && r.functionDeclarations.length > 0 && t.push(i);
  }), t;
}
function Bt(n) {
  var e;
  return !(!((e = n == null ? void 0 : n.automaticFunctionCalling) === null || e === void 0) && e.ignoreCallHistory);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Ru extends z {
  constructor(e) {
    super(), this.apiClient = e, this.generateContent = async (t) => {
      var o, i, r, a, u;
      const c = await this.processParamsMaybeAddMcpUsage(t);
      if (this.maybeMoveToResponseJsonSchem(t), !Au(t) || qt(t.config))
        return await this.generateContentInternal(c);
      const d = bt(t);
      if (d.length > 0) {
        const _ = d.map((T) => `tools[${T}]`).join(", ");
        throw new Error(`Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations is not yet supported. Incompatible tools found at ${_}.`);
      }
      let f, m;
      const p = b(c.contents), h = (r = (i = (o = c.config) === null || o === void 0 ? void 0 : o.automaticFunctionCalling) === null || i === void 0 ? void 0 : i.maximumRemoteCalls) !== null && r !== void 0 ? r : Ht;
      let g = 0;
      for (; g < h && (f = await this.generateContentInternal(c), !(!f.functionCalls || f.functionCalls.length === 0)); ) {
        const _ = f.candidates[0].content, T = [];
        for (const C of (u = (a = t.config) === null || a === void 0 ? void 0 : a.tools) !== null && u !== void 0 ? u : [])
          if (ae(C)) {
            const E = await C.callTool(f.functionCalls);
            T.push(...E);
          }
        g++, m = {
          role: "user",
          parts: T
        }, c.contents = b(c.contents), c.contents.push(_), c.contents.push(m), Bt(c.config) && (p.push(_), p.push(m));
      }
      return Bt(c.config) && (f.automaticFunctionCallingHistory = p), f;
    }, this.generateContentStream = async (t) => {
      var o, i, r, a, u;
      if (this.maybeMoveToResponseJsonSchem(t), qt(t.config)) {
        const m = await this.processParamsMaybeAddMcpUsage(t);
        return await this.generateContentStreamInternal(m);
      }
      const c = bt(t);
      if (c.length > 0) {
        const m = c.map((p) => `tools[${p}]`).join(", ");
        throw new Error(`Incompatible tools found at ${m}. Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations" is not yet supported.`);
      }
      const d = (r = (i = (o = t == null ? void 0 : t.config) === null || o === void 0 ? void 0 : o.toolConfig) === null || i === void 0 ? void 0 : i.functionCallingConfig) === null || r === void 0 ? void 0 : r.streamFunctionCallArguments, f = (u = (a = t == null ? void 0 : t.config) === null || a === void 0 ? void 0 : a.automaticFunctionCalling) === null || u === void 0 ? void 0 : u.disable;
      if (d && !f)
        throw new Error("Running in streaming mode with 'streamFunctionCallArguments' enabled, this feature is not compatible with automatic function calling (AFC). Please set 'config.automaticFunctionCalling.disable' to true to disable AFC or leave 'config.toolConfig.functionCallingConfig.streamFunctionCallArguments' to be undefined or set to false to disable streaming function call arguments feature.");
      return await this.processAfcStream(t);
    }, this.generateImages = async (t) => await this.generateImagesInternal(t).then((o) => {
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
    }), this.list = async (t) => {
      var o;
      const a = {
        config: Object.assign(Object.assign({}, {
          queryBase: !0
        }), t == null ? void 0 : t.config)
      };
      if (this.apiClient.isVertexAI() && !a.config.queryBase) {
        if (!((o = a.config) === null || o === void 0) && o.filter)
          throw new Error("Filtering tuned models list for Vertex AI is not currently supported");
        a.config.filter = "labels.tune-type:*";
      }
      return new te(Y.PAGED_ITEM_MODELS, (u) => this.listInternal(u), await this.listInternal(a), a);
    }, this.editImage = async (t) => {
      const o = {
        model: t.model,
        prompt: t.prompt,
        referenceImages: [],
        config: t.config
      };
      return t.referenceImages && t.referenceImages && (o.referenceImages = t.referenceImages.map((i) => i.toReferenceImageAPI())), await this.editImageInternal(o);
    }, this.upscaleImage = async (t) => {
      let o = {
        numberOfImages: 1,
        mode: "upscale"
      };
      t.config && (o = Object.assign(Object.assign({}, o), t.config));
      const i = {
        model: t.model,
        image: t.image,
        upscaleFactor: t.upscaleFactor,
        config: o
      };
      return await this.upscaleImageInternal(i);
    }, this.generateVideos = async (t) => {
      var o, i, r, a, u, c;
      if ((t.prompt || t.image || t.video) && t.source)
        throw new Error("Source and prompt/image/video are mutually exclusive. Please only use source.");
      return this.apiClient.isVertexAI() || (!((o = t.video) === null || o === void 0) && o.uri && (!((i = t.video) === null || i === void 0) && i.videoBytes) ? t.video = {
        uri: t.video.uri,
        mimeType: t.video.mimeType
      } : !((a = (r = t.source) === null || r === void 0 ? void 0 : r.video) === null || a === void 0) && a.uri && (!((c = (u = t.source) === null || u === void 0 ? void 0 : u.video) === null || c === void 0) && c.videoBytes) && (t.source.video = {
        uri: t.source.video.uri,
        mimeType: t.source.video.mimeType
      })), await this.generateVideosInternal(t);
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
    var t, o, i;
    const r = (t = e.config) === null || t === void 0 ? void 0 : t.tools;
    if (!r)
      return e;
    const a = await Promise.all(r.map(async (c) => ae(c) ? await c.tool() : c)), u = {
      model: e.model,
      contents: e.contents,
      config: Object.assign(Object.assign({}, e.config), { tools: a })
    };
    if (u.config.tools = a, e.config && e.config.tools && Eo(e.config.tools)) {
      const c = (i = (o = e.config.httpOptions) === null || o === void 0 ? void 0 : o.headers) !== null && i !== void 0 ? i : {};
      let d = Object.assign({}, c);
      Object.keys(d).length === 0 && (d = this.apiClient.getDefaultHeaders()), So(d), u.config.httpOptions = Object.assign(Object.assign({}, e.config.httpOptions), { headers: d });
    }
    return u;
  }
  async initAfcToolsMap(e) {
    var t, o, i;
    const r = /* @__PURE__ */ new Map();
    for (const a of (o = (t = e.config) === null || t === void 0 ? void 0 : t.tools) !== null && o !== void 0 ? o : [])
      if (ae(a)) {
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
    var t, o, i;
    const r = (i = (o = (t = e.config) === null || t === void 0 ? void 0 : t.automaticFunctionCalling) === null || o === void 0 ? void 0 : o.maximumRemoteCalls) !== null && i !== void 0 ? i : Ht;
    let a = !1, u = 0;
    const c = await this.initAfcToolsMap(e);
    return function(d, f, m) {
      return J(this, arguments, function* () {
        for (var p, h, g, _, T, C; u < r; ) {
          a && (u++, a = !1);
          const y = yield w(d.processParamsMaybeAddMcpUsage(m)), R = yield w(d.generateContentStreamInternal(y)), M = [], D = [];
          try {
            for (var S = !0, E = (h = void 0, O(R)), I; I = yield w(E.next()), p = I.done, !p; S = !0) {
              _ = I.value, S = !1;
              const A = _;
              if (yield yield w(A), A.candidates && (!((T = A.candidates[0]) === null || T === void 0) && T.content)) {
                D.push(A.candidates[0].content);
                for (const N of (C = A.candidates[0].content.parts) !== null && C !== void 0 ? C : [])
                  if (u < r && N.functionCall) {
                    if (!N.functionCall.name)
                      throw new Error("Function call name was not returned by the model.");
                    if (f.has(N.functionCall.name)) {
                      const k = yield w(f.get(N.functionCall.name).callTool([N.functionCall]));
                      M.push(...k);
                    } else
                      throw new Error(`Automatic function calling was requested, but not all the tools the model used implement the CallableTool interface. Available tools: ${f.keys()}, mising tool: ${N.functionCall.name}`);
                  }
              }
            }
          } catch (A) {
            h = { error: A };
          } finally {
            try {
              !S && !p && (g = E.return) && (yield w(g.call(E)));
            } finally {
              if (h) throw h.error;
            }
          }
          if (M.length > 0) {
            a = !0;
            const A = new fe();
            A.candidates = [
              {
                content: {
                  role: "user",
                  parts: M
                }
              }
            ], yield yield w(A);
            const N = [];
            N.push(...D), N.push({
              role: "user",
              parts: M
            });
            const k = b(m.contents).concat(N);
            m.contents = k;
          } else
            break;
        }
      });
    }(this, c, e);
  }
  async generateContentInternal(e) {
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Lt(this.apiClient, e);
      return u = v("{model}:generateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Gt(f), p = new fe();
        return Object.assign(p, m), p;
      });
    } else {
      const d = Ut(this.apiClient, e);
      return u = v("{model}:generateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Ft(f), p = new fe();
        return Object.assign(p, m), p;
      });
    }
  }
  async generateContentStreamInternal(e) {
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Lt(this.apiClient, e);
      return u = v("{model}:streamGenerateContent?alt=sse", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.requestStream({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }), a.then(function(m) {
        return J(this, arguments, function* () {
          var p, h, g, _;
          try {
            for (var T = !0, C = O(m), S; S = yield w(C.next()), p = S.done, !p; T = !0) {
              _ = S.value, T = !1;
              const E = _, I = Gt(yield w(E.json()), e);
              I.sdkHttpResponse = {
                headers: E.headers
              };
              const y = new fe();
              Object.assign(y, I), yield yield w(y);
            }
          } catch (E) {
            h = { error: E };
          } finally {
            try {
              !T && !p && (g = C.return) && (yield w(g.call(C)));
            } finally {
              if (h) throw h.error;
            }
          }
        });
      });
    } else {
      const d = Ut(this.apiClient, e);
      return u = v("{model}:streamGenerateContent?alt=sse", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.requestStream({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }), a.then(function(m) {
        return J(this, arguments, function* () {
          var p, h, g, _;
          try {
            for (var T = !0, C = O(m), S; S = yield w(C.next()), p = S.done, !p; T = !0) {
              _ = S.value, T = !1;
              const E = _, I = Ft(yield w(E.json()), e);
              I.sdkHttpResponse = {
                headers: E.headers
              };
              const y = new fe();
              Object.assign(y, I), yield yield w(y);
            }
          } catch (E) {
            h = { error: E };
          } finally {
            try {
              !T && !p && (g = C.return) && (yield w(g.call(C)));
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Cl(this.apiClient, e);
      return u = v("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Sl(f), p = new yt();
        return Object.assign(p, m), p;
      });
    } else {
      const d = _l(this.apiClient, e);
      return u = v("{model}:batchEmbedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = El(f), p = new yt();
        return Object.assign(p, m), p;
      });
    }
  }
  /**
   * Private method for generating images.
   */
  async generateImagesInternal(e) {
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = kl(this.apiClient, e);
      return u = v("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Ll(f), p = new Tt();
        return Object.assign(p, m), p;
      });
    } else {
      const d = Dl(this.apiClient, e);
      return u = v("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Ul(f), p = new Tt();
        return Object.assign(p, m), p;
      });
    }
  }
  /**
   * Private method for editing an image.
   */
  async editImageInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = hl(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = gl(c), f = new Ci();
        return Object.assign(f, d), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for upscaling an image.
   */
  async upscaleImageInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = ka(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = Ua(c), f = new Ei();
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = ma(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = ha(c), f = new Si();
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = Ea(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Sa(c), f = new Ii();
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Zl(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Ye(f));
    } else {
      const d = Ql(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ke(f));
    }
  }
  async listInternal(e) {
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = la(this.apiClient, e);
      return u = v("{models_url}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = ua(f), p = new _t();
        return Object.assign(p, m), p;
      });
    } else {
      const d = ra(this.apiClient, e);
      return u = v("{models_url}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = aa(f), p = new _t();
        return Object.assign(p, m), p;
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = xa(this.apiClient, e);
      return u = v("{model}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Ye(f));
    } else {
      const d = Na(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ke(f));
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = cl(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = pl(f), p = new Ct();
        return Object.assign(p, m), p;
      });
    } else {
      const d = dl(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = fl(f), p = new Ct();
        return Object.assign(p, m), p;
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = ll(this.apiClient, e);
      return u = v("{model}:countTokens", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = ul(f), p = new Et();
        return Object.assign(p, m), p;
      });
    } else {
      const d = rl(this.apiClient, e);
      return u = v("{model}:countTokens", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = al(f), p = new Et();
        return Object.assign(p, m), p;
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = jr(this.apiClient, e);
      return r = v("{model}:computeTokens", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => {
        const d = el(c), f = new vi();
        return Object.assign(f, d), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for generating videos.
   */
  async generateVideosInternal(e) {
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = bl(this.apiClient, e);
      return u = v("{model}:predictLongRunning", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const m = Hl(f), p = new Ae();
        return Object.assign(p, m), p;
      });
    } else {
      const d = ql(this.apiClient, e);
      return u = v("{model}:predictLongRunning", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const m = Vl(f), p = new Ae();
        return Object.assign(p, m), p;
      });
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Pu extends z {
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
    const t = e.operation, o = e.config;
    if (t.name === void 0 || t.name === "")
      throw new Error("Operation name is required.");
    if (this.apiClient.isVertexAI()) {
      const i = t.name.split("/operations/")[0];
      let r;
      o && "httpOptions" in o && (r = o.httpOptions);
      const a = await this.fetchPredictVideosOperationInternal({
        operationName: t.name,
        resourceName: i,
        config: { httpOptions: r }
      });
      return t._fromAPIResponse({
        apiResponse: a,
        _isVertexAI: !0
      });
    } else {
      const i = await this.getVideosOperationInternal({
        operationName: t.name,
        config: o
      });
      return t._fromAPIResponse({
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
    const t = e.operation, o = e.config;
    if (t.name === void 0 || t.name === "")
      throw new Error("Operation name is required.");
    if (this.apiClient.isVertexAI()) {
      const i = t.name.split("/operations/")[0];
      let r;
      o && "httpOptions" in o && (r = o.httpOptions);
      const a = await this.fetchPredictVideosOperationInternal({
        operationName: t.name,
        resourceName: i,
        config: { httpOptions: r }
      });
      return t._fromAPIResponse({
        apiResponse: a,
        _isVertexAI: !0
      });
    } else {
      const i = await this.getVideosOperationInternal({
        operationName: t.name,
        config: o
      });
      return t._fromAPIResponse({
        apiResponse: i,
        _isVertexAI: !1
      });
    }
  }
  async getVideosOperationInternal(e) {
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = mi(e);
      return u = v("{operationName}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a;
    } else {
      const d = pi(e);
      return u = v("{operationName}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = ri(e);
      return r = v("{resourceName}:fetchPredictOperation", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
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
function wu(n) {
  const e = {}, t = s(n, ["data"]);
  if (t != null && l(e, ["data"], t), s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(n, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Mu(n) {
  const e = {}, t = s(n, ["parts"]);
  if (t != null) {
    let i = t;
    Array.isArray(i) && (i = i.map((r) => Vu(r))), l(e, ["parts"], i);
  }
  const o = s(n, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function Nu(n, e, t) {
  const o = {}, i = s(e, ["expireTime"]);
  t !== void 0 && i != null && l(t, ["expireTime"], i);
  const r = s(e, [
    "newSessionExpireTime"
  ]);
  t !== void 0 && r != null && l(t, ["newSessionExpireTime"], r);
  const a = s(e, ["uses"]);
  t !== void 0 && a != null && l(t, ["uses"], a);
  const u = s(e, [
    "liveConnectConstraints"
  ]);
  t !== void 0 && u != null && l(t, ["bidiGenerateContentSetup"], Gu(n, u));
  const c = s(e, [
    "lockAdditionalFields"
  ]);
  return t !== void 0 && c != null && l(t, ["fieldMask"], c), o;
}
function xu(n, e) {
  const t = {}, o = s(e, ["config"]);
  return o != null && l(t, ["config"], Nu(n, o, t)), t;
}
function Du(n) {
  const e = {};
  if (s(n, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const t = s(n, ["fileUri"]);
  t != null && l(e, ["fileUri"], t);
  const o = s(n, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function ku(n) {
  const e = {}, t = s(n, ["id"]);
  t != null && l(e, ["id"], t);
  const o = s(n, ["args"]);
  o != null && l(e, ["args"], o);
  const i = s(n, ["name"]);
  if (i != null && l(e, ["name"], i), s(n, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(n, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Uu(n) {
  const e = {};
  if (s(n, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const t = s(n, ["enableWidget"]);
  return t != null && l(e, ["enableWidget"], t), e;
}
function Lu(n) {
  const e = {};
  if (s(n, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  if (s(n, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  const t = s(n, [
    "timeRangeFilter"
  ]);
  return t != null && l(e, ["timeRangeFilter"], t), e;
}
function Fu(n, e) {
  const t = {}, o = s(n, [
    "generationConfig"
  ]);
  e !== void 0 && o != null && l(e, ["setup", "generationConfig"], o);
  const i = s(n, [
    "responseModalities"
  ]);
  e !== void 0 && i != null && l(e, ["setup", "generationConfig", "responseModalities"], i);
  const r = s(n, ["temperature"]);
  e !== void 0 && r != null && l(e, ["setup", "generationConfig", "temperature"], r);
  const a = s(n, ["topP"]);
  e !== void 0 && a != null && l(e, ["setup", "generationConfig", "topP"], a);
  const u = s(n, ["topK"]);
  e !== void 0 && u != null && l(e, ["setup", "generationConfig", "topK"], u);
  const c = s(n, [
    "maxOutputTokens"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], c);
  const d = s(n, [
    "mediaResolution"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "mediaResolution"], d);
  const f = s(n, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const m = s(n, ["speechConfig"]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "speechConfig"], dn(m));
  const p = s(n, [
    "thinkingConfig"
  ]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "thinkingConfig"], p);
  const h = s(n, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], h);
  const g = s(n, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], Mu(F(g)));
  const _ = s(n, ["tools"]);
  if (e !== void 0 && _ != null) {
    let R = de(_);
    Array.isArray(R) && (R = R.map((M) => qu(ue(M)))), l(e, ["setup", "tools"], R);
  }
  const T = s(n, [
    "sessionResumption"
  ]);
  e !== void 0 && T != null && l(e, ["setup", "sessionResumption"], Hu(T));
  const C = s(n, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && C != null && l(e, ["setup", "inputAudioTranscription"], C);
  const S = s(n, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const E = s(n, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "realtimeInputConfig"], E);
  const I = s(n, [
    "contextWindowCompression"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "contextWindowCompression"], I);
  const y = s(n, ["proactivity"]);
  if (e !== void 0 && y != null && l(e, ["setup", "proactivity"], y), s(n, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return t;
}
function Gu(n, e) {
  const t = {}, o = s(e, ["model"]);
  o != null && l(t, ["setup", "model"], x(n, o));
  const i = s(e, ["config"]);
  return i != null && l(t, ["config"], Fu(i, t)), t;
}
function Vu(n) {
  const e = {}, t = s(n, [
    "mediaResolution"
  ]);
  t != null && l(e, ["mediaResolution"], t);
  const o = s(n, [
    "codeExecutionResult"
  ]);
  o != null && l(e, ["codeExecutionResult"], o);
  const i = s(n, [
    "executableCode"
  ]);
  i != null && l(e, ["executableCode"], i);
  const r = s(n, ["fileData"]);
  r != null && l(e, ["fileData"], Du(r));
  const a = s(n, ["functionCall"]);
  a != null && l(e, ["functionCall"], ku(a));
  const u = s(n, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(n, ["inlineData"]);
  c != null && l(e, ["inlineData"], wu(c));
  const d = s(n, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(n, ["thought"]);
  f != null && l(e, ["thought"], f);
  const m = s(n, [
    "thoughtSignature"
  ]);
  m != null && l(e, ["thoughtSignature"], m);
  const p = s(n, [
    "videoMetadata"
  ]);
  return p != null && l(e, ["videoMetadata"], p), e;
}
function Hu(n) {
  const e = {}, t = s(n, ["handle"]);
  if (t != null && l(e, ["handle"], t), s(n, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return e;
}
function qu(n) {
  const e = {};
  if (s(n, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const t = s(n, ["computerUse"]);
  t != null && l(e, ["computerUse"], t);
  const o = s(n, ["fileSearch"]);
  o != null && l(e, ["fileSearch"], o);
  const i = s(n, [
    "codeExecution"
  ]);
  if (i != null && l(e, ["codeExecution"], i), s(n, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const r = s(n, [
    "functionDeclarations"
  ]);
  if (r != null) {
    let f = r;
    Array.isArray(f) && (f = f.map((m) => m)), l(e, ["functionDeclarations"], f);
  }
  const a = s(n, ["googleMaps"]);
  a != null && l(e, ["googleMaps"], Uu(a));
  const u = s(n, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Lu(u));
  const c = s(n, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(n, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function bu(n) {
  const e = [];
  for (const t in n)
    if (Object.prototype.hasOwnProperty.call(n, t)) {
      const o = n[t];
      if (typeof o == "object" && o != null && Object.keys(o).length > 0) {
        const i = Object.keys(o).map((r) => `${t}.${r}`);
        e.push(...i);
      } else
        e.push(t);
    }
  return e.join(",");
}
function Bu(n, e) {
  let t = null;
  const o = n.bidiGenerateContentSetup;
  if (typeof o == "object" && o !== null && "setup" in o) {
    const r = o.setup;
    typeof r == "object" && r !== null ? (n.bidiGenerateContentSetup = r, t = r) : delete n.bidiGenerateContentSetup;
  } else o !== void 0 && delete n.bidiGenerateContentSetup;
  const i = n.fieldMask;
  if (t) {
    const r = bu(t);
    if (Array.isArray(e == null ? void 0 : e.lockAdditionalFields) && (e == null ? void 0 : e.lockAdditionalFields.length) === 0)
      r ? n.fieldMask = r : delete n.fieldMask;
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
      r && c.push(r), u.length > 0 && c.push(...u), c.length > 0 ? n.fieldMask = c.join(",") : delete n.fieldMask;
    } else
      delete n.fieldMask;
  } else
    i !== null && Array.isArray(i) && i.length > 0 ? n.fieldMask = i.join(",") : delete n.fieldMask;
  return n;
}
class Ju extends z {
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("The client.tokens.create method is only supported by the Gemini Developer API.");
    {
      const u = xu(this.apiClient, e);
      r = v("auth_tokens", u._url), a = u._query, delete u.config, delete u._url, delete u._query;
      const c = Bu(u, e.config);
      return i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
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
function Ou(n, e) {
  const t = {}, o = s(n, ["force"]);
  return e !== void 0 && o != null && l(e, ["_query", "force"], o), t;
}
function $u(n) {
  const e = {}, t = s(n, ["name"]);
  t != null && l(e, ["_url", "name"], t);
  const o = s(n, ["config"]);
  return o != null && Ou(o, e), e;
}
function Wu(n) {
  const e = {}, t = s(n, ["name"]);
  return t != null && l(e, ["_url", "name"], t), e;
}
function Ku(n, e) {
  const t = {}, o = s(n, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(n, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), t;
}
function Yu(n) {
  const e = {}, t = s(n, ["parent"]);
  t != null && l(e, ["_url", "parent"], t);
  const o = s(n, ["config"]);
  return o != null && Ku(o, e), e;
}
function zu(n) {
  const e = {}, t = s(n, [
    "sdkHttpResponse"
  ]);
  t != null && l(e, ["sdkHttpResponse"], t);
  const o = s(n, [
    "nextPageToken"
  ]);
  o != null && l(e, ["nextPageToken"], o);
  const i = s(n, ["documents"]);
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
class Xu extends z {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (t) => new te(Y.PAGED_ITEM_DOCUMENTS, (o) => this.listInternal({ parent: t.parent, config: o.config }), await this.listInternal(t), t);
  }
  /**
   * Gets a Document.
   *
   * @param params - The parameters for getting a document.
   * @return Document.
   */
  async get(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Wu(e);
      return r = v("{name}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
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
    var t, o;
    let i = "", r = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const a = $u(e);
      i = v("{name}", a._url), r = a._query, delete a._url, delete a._query, await this.apiClient.request({
        path: i,
        queryParams: r,
        body: JSON.stringify(a),
        httpMethod: "DELETE",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    }
  }
  async listInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Yu(e);
      return r = v("{parent}/documents", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = zu(c), f = new Ai();
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
class Qu extends z {
  constructor(e, t = new Xu(e)) {
    super(), this.apiClient = e, this.documents = t, this.list = async (o = {}) => new te(Y.PAGED_ITEM_FILE_SEARCH_STORES, (i) => this.listInternal(i), await this.listInternal(o), o);
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = ba(e);
      return r = v("fileSearchStores", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Oa(e);
      return r = v("{name}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
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
    var t, o;
    let i = "", r = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const a = Ja(e);
      i = v("{name}", a._url), r = a._query, delete a._url, delete a._query, await this.apiClient.request({
        path: i,
        queryParams: r,
        body: JSON.stringify(a),
        httpMethod: "DELETE",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    }
  }
  async listInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Xa(e);
      return r = v("fileSearchStores", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Qa(c), f = new Ri();
        return Object.assign(f, d), f;
      });
    }
  }
  async uploadToFileSearchStoreInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Za(e);
      return r = v("upload/v1beta/{file_search_store_name}:uploadToFileSearchStore", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = ja(c), f = new Pi();
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
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Ka(e);
      return r = v("{file_search_store_name}:importFile", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Wa(c), f = new sn();
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
let Io = function() {
  const { crypto: n } = globalThis;
  if (n != null && n.randomUUID)
    return Io = n.randomUUID.bind(n), n.randomUUID();
  const e = new Uint8Array(1), t = n ? () => n.getRandomValues(e)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (o) => (+o ^ t() & 15 >> +o / 4).toString(16));
};
const Zu = () => Io();
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Xe(n) {
  return typeof n == "object" && n !== null && // Spec-compliant fetch implementations
  ("name" in n && n.name === "AbortError" || // Expo fetch
  "message" in n && String(n.message).includes("FetchRequestCanceledException"));
}
const Qe = (n) => {
  if (n instanceof Error)
    return n;
  if (typeof n == "object" && n !== null) {
    try {
      if (Object.prototype.toString.call(n) === "[object Error]") {
        const e = new Error(n.message, n.cause ? { cause: n.cause } : {});
        return n.stack && (e.stack = n.stack), n.cause && !e.cause && (e.cause = n.cause), n.name && (e.name = n.name), e;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(n));
    } catch {
    }
  }
  return new Error(n);
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class B extends Error {
}
class H extends B {
  constructor(e, t, o, i) {
    super(`${H.makeMessage(e, t, o)}`), this.status = e, this.headers = i, this.error = t;
  }
  static makeMessage(e, t, o) {
    const i = t != null && t.message ? typeof t.message == "string" ? t.message : JSON.stringify(t.message) : t ? JSON.stringify(t) : o;
    return e && i ? `${e} ${i}` : e ? `${e} status code (no body)` : i || "(no status code or body)";
  }
  static generate(e, t, o, i) {
    if (!e || !i)
      return new ke({ message: o, cause: Qe(t) });
    const r = t;
    return e === 400 ? new Ao(e, r, o, i) : e === 401 ? new Ro(e, r, o, i) : e === 403 ? new Po(e, r, o, i) : e === 404 ? new wo(e, r, o, i) : e === 409 ? new Mo(e, r, o, i) : e === 422 ? new No(e, r, o, i) : e === 429 ? new xo(e, r, o, i) : e >= 500 ? new Do(e, r, o, i) : new H(e, r, o, i);
  }
}
class Ze extends H {
  constructor({ message: e } = {}) {
    super(void 0, void 0, e || "Request was aborted.", void 0);
  }
}
class ke extends H {
  constructor({ message: e, cause: t }) {
    super(void 0, void 0, e || "Connection error.", void 0), t && (this.cause = t);
  }
}
class vo extends ke {
  constructor({ message: e } = {}) {
    super({ message: e ?? "Request timed out." });
  }
}
class Ao extends H {
}
class Ro extends H {
}
class Po extends H {
}
class wo extends H {
}
class Mo extends H {
}
class No extends H {
}
class xo extends H {
}
class Do extends H {
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const ju = /^[a-z][a-z0-9+.-]*:/i, ed = (n) => ju.test(n);
let je = (n) => (je = Array.isArray, je(n));
const nd = je;
let td = nd;
const Jt = td;
function od(n) {
  if (!n)
    return !0;
  for (const e in n)
    return !1;
  return !0;
}
function id(n, e) {
  return Object.prototype.hasOwnProperty.call(n, e);
}
const sd = (n, e) => {
  if (typeof e != "number" || !Number.isInteger(e))
    throw new B(`${n} must be an integer`);
  if (e < 0)
    throw new B(`${n} must be a positive integer`);
  return e;
}, rd = (n) => {
  try {
    return JSON.parse(n);
  } catch {
    return;
  }
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const ld = (n) => new Promise((e) => setTimeout(e, n));
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const ie = "0.0.1";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function ad() {
  return typeof Deno < "u" && Deno.build != null ? "deno" : typeof EdgeRuntime < "u" ? "edge" : Object.prototype.toString.call(typeof globalThis.process < "u" ? globalThis.process : 0) === "[object process]" ? "node" : "unknown";
}
const ud = () => {
  var n, e, t, o, i;
  const r = ad();
  if (r === "deno")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": ie,
      "X-Stainless-OS": $t(Deno.build.os),
      "X-Stainless-Arch": Ot(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version == "string" ? Deno.version : (e = (n = Deno.version) === null || n === void 0 ? void 0 : n.deno) !== null && e !== void 0 ? e : "unknown"
    };
  if (typeof EdgeRuntime < "u")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": ie,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  if (r === "node")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": ie,
      "X-Stainless-OS": $t((t = globalThis.process.platform) !== null && t !== void 0 ? t : "unknown"),
      "X-Stainless-Arch": Ot((o = globalThis.process.arch) !== null && o !== void 0 ? o : "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": (i = globalThis.process.version) !== null && i !== void 0 ? i : "unknown"
    };
  const a = dd();
  return a ? {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": ie,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": `browser:${a.browser}`,
    "X-Stainless-Runtime-Version": a.version
  } : {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": ie,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function dd() {
  if (typeof navigator > "u" || !navigator)
    return null;
  const n = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key: e, pattern: t } of n) {
    const o = t.exec(navigator.userAgent);
    if (o) {
      const i = o[1] || 0, r = o[2] || 0, a = o[3] || 0;
      return { browser: e, version: `${i}.${r}.${a}` };
    }
  }
  return null;
}
const Ot = (n) => n === "x32" ? "x32" : n === "x86_64" || n === "x64" ? "x64" : n === "arm" ? "arm" : n === "aarch64" || n === "arm64" ? "arm64" : n ? `other:${n}` : "unknown", $t = (n) => (n = n.toLowerCase(), n.includes("ios") ? "iOS" : n === "android" ? "Android" : n === "darwin" ? "MacOS" : n === "win32" ? "Windows" : n === "freebsd" ? "FreeBSD" : n === "openbsd" ? "OpenBSD" : n === "linux" ? "Linux" : n ? `Other:${n}` : "Unknown");
let ge;
const cd = () => ge ?? (ge = ud());
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function fd() {
  if (typeof fetch < "u")
    return fetch;
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new GeminiNextGenAPIClient({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function ko(...n) {
  const e = globalThis.ReadableStream;
  if (typeof e > "u")
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  return new e(...n);
}
function pd(n) {
  let e = Symbol.asyncIterator in n ? n[Symbol.asyncIterator]() : n[Symbol.iterator]();
  return ko({
    start() {
    },
    async pull(t) {
      const { done: o, value: i } = await e.next();
      o ? t.close() : t.enqueue(i);
    },
    async cancel() {
      var t;
      await ((t = e.return) === null || t === void 0 ? void 0 : t.call(e));
    }
  });
}
function Uo(n) {
  if (n[Symbol.asyncIterator])
    return n;
  const e = n.getReader();
  return {
    async next() {
      try {
        const t = await e.read();
        return t != null && t.done && e.releaseLock(), t;
      } catch (t) {
        throw e.releaseLock(), t;
      }
    },
    async return() {
      const t = e.cancel();
      return e.releaseLock(), await t, { done: !0, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function md(n) {
  var e, t;
  if (n === null || typeof n != "object")
    return;
  if (n[Symbol.asyncIterator]) {
    await ((t = (e = n[Symbol.asyncIterator]()).return) === null || t === void 0 ? void 0 : t.call(e));
    return;
  }
  const o = n.getReader(), i = o.cancel();
  o.releaseLock(), await i;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const hd = ({ headers: n, body: e }) => ({
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
const Lo = () => {
  var n;
  if (typeof File > "u") {
    const { process: e } = globalThis, t = typeof ((n = e == null ? void 0 : e.versions) === null || n === void 0 ? void 0 : n.node) == "string" && parseInt(e.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (t ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function Ge(n, e, t) {
  return Lo(), new File(n, e ?? "unknown_file", t);
}
function gd(n) {
  return (typeof n == "object" && n !== null && ("name" in n && n.name && String(n.name) || "url" in n && n.url && String(n.url) || "filename" in n && n.filename && String(n.filename) || "path" in n && n.path && String(n.path)) || "").split(/[\\/]/).pop() || void 0;
}
const yd = (n) => n != null && typeof n == "object" && typeof n[Symbol.asyncIterator] == "function";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Fo = (n) => n != null && typeof n == "object" && typeof n.size == "number" && typeof n.type == "string" && typeof n.text == "function" && typeof n.slice == "function" && typeof n.arrayBuffer == "function", Td = (n) => n != null && typeof n == "object" && typeof n.name == "string" && typeof n.lastModified == "number" && Fo(n), _d = (n) => n != null && typeof n == "object" && typeof n.url == "string" && typeof n.blob == "function";
async function Cd(n, e, t) {
  if (Lo(), n = await n, Td(n))
    return n instanceof File ? n : Ge([await n.arrayBuffer()], n.name);
  if (_d(n)) {
    const i = await n.blob();
    return e || (e = new URL(n.url).pathname.split(/[\\/]/).pop()), Ge(await en(i), e, t);
  }
  const o = await en(n);
  if (e || (e = gd(n)), !(t != null && t.type)) {
    const i = o.find((r) => typeof r == "object" && "type" in r && r.type);
    typeof i == "string" && (t = Object.assign(Object.assign({}, t), { type: i }));
  }
  return Ge(o, e, t);
}
async function en(n) {
  var e, t, o, i, r;
  let a = [];
  if (typeof n == "string" || ArrayBuffer.isView(n) || // includes Uint8Array, Buffer, etc.
  n instanceof ArrayBuffer)
    a.push(n);
  else if (Fo(n))
    a.push(n instanceof Blob ? n : await n.arrayBuffer());
  else if (yd(n))
    try {
      for (var u = !0, c = O(n), d; d = await c.next(), e = d.done, !e; u = !0) {
        i = d.value, u = !1;
        const f = i;
        a.push(...await en(f));
      }
    } catch (f) {
      t = { error: f };
    } finally {
      try {
        !u && !e && (o = c.return) && await o.call(c);
      } finally {
        if (t) throw t.error;
      }
    }
  else {
    const f = (r = n == null ? void 0 : n.constructor) === null || r === void 0 ? void 0 : r.name;
    throw new Error(`Unexpected data type: ${typeof n}${f ? `; constructor: ${f}` : ""}${Ed(n)}`);
  }
  return a;
}
function Ed(n) {
  return typeof n != "object" || n === null ? "" : `; props: [${Object.getOwnPropertyNames(n).map((t) => `"${t}"`).join(", ")}]`;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Go {
  constructor(e) {
    this._client = e;
  }
}
Go._key = [];
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Vo(n) {
  return n.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const Wt = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null)), Sd = (n = Vo) => function(t, ...o) {
  if (t.length === 1)
    return t[0];
  let i = !1;
  const r = [], a = t.reduce((f, m, p) => {
    var h, g, _;
    /[?#]/.test(m) && (i = !0);
    const T = o[p];
    let C = (i ? encodeURIComponent : n)("" + T);
    return p !== o.length && (T == null || typeof T == "object" && // handle values from other realms
    T.toString === ((_ = Object.getPrototypeOf((g = Object.getPrototypeOf((h = T.hasOwnProperty) !== null && h !== void 0 ? h : Wt)) !== null && g !== void 0 ? g : Wt)) === null || _ === void 0 ? void 0 : _.toString)) && (C = T + "", r.push({
      start: f.length + m.length,
      length: C.length,
      error: `Value of type ${Object.prototype.toString.call(T).slice(8, -1)} is not a valid path parameter`
    })), f + m + (p === o.length ? "" : C);
  }, ""), u = a.split(/[?#]/, 1)[0], c = new RegExp("(?<=^|\\/)(?:\\.|%2e){1,2}(?=\\/|$)", "gi");
  let d;
  for (; (d = c.exec(u)) !== null; )
    r.push({
      start: d.index,
      length: d[0].length,
      error: `Value "${d[0]}" can't be safely passed as a path parameter`
    });
  if (r.sort((f, m) => f.start - m.start), r.length > 0) {
    let f = 0;
    const m = r.reduce((p, h) => {
      const g = " ".repeat(h.start - f), _ = "^".repeat(h.length);
      return f = h.start + h.length, p + g + _;
    }, "");
    throw new B(`Path parameters result in path with invalid segments:
${r.map((p) => p.error).join(`
`)}
${a}
${m}`);
  }
  return a;
}, ye = /* @__PURE__ */ Sd(Vo);
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Ho extends Go {
  create(e, t) {
    var o;
    const { api_version: i = this._client.apiVersion } = e, r = Pe(e, ["api_version"]);
    if ("model" in r && "agent_config" in r)
      throw new B("Invalid request: specified `model` and `agent_config`. If specifying `model`, use `generation_config`.");
    if ("agent" in r && "generation_config" in r)
      throw new B("Invalid request: specified `agent` and `generation_config`. If specifying `agent`, use `agent_config`.");
    return this._client.post(ye`/${i}/interactions`, Object.assign(Object.assign({ body: r }, t), { stream: (o = e.stream) !== null && o !== void 0 ? o : !1 }));
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
  delete(e, t = {}, o) {
    const { api_version: i = this._client.apiVersion } = t ?? {};
    return this._client.delete(ye`/${i}/interactions/${e}`, o);
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
  cancel(e, t = {}, o) {
    const { api_version: i = this._client.apiVersion } = t ?? {};
    return this._client.post(ye`/${i}/interactions/${e}/cancel`, o);
  }
  get(e, t = {}, o) {
    var i;
    const r = t ?? {}, { api_version: a = this._client.apiVersion } = r, u = Pe(r, ["api_version"]);
    return this._client.get(ye`/${a}/interactions/${e}`, Object.assign(Object.assign({ query: u }, o), { stream: (i = t == null ? void 0 : t.stream) !== null && i !== void 0 ? i : !1 }));
  }
}
Ho._key = Object.freeze(["interactions"]);
class qo extends Ho {
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Id(n) {
  let e = 0;
  for (const i of n)
    e += i.length;
  const t = new Uint8Array(e);
  let o = 0;
  for (const i of n)
    t.set(i, o), o += i.length;
  return t;
}
let Te;
function fn(n) {
  let e;
  return (Te ?? (e = new globalThis.TextEncoder(), Te = e.encode.bind(e)))(n);
}
let _e;
function Kt(n) {
  let e;
  return (_e ?? (e = new globalThis.TextDecoder(), _e = e.decode.bind(e)))(n);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Ue {
  constructor() {
    this.buffer = new Uint8Array(), this.carriageReturnIndex = null;
  }
  decode(e) {
    if (e == null)
      return [];
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : typeof e == "string" ? fn(e) : e;
    this.buffer = Id([this.buffer, t]);
    const o = [];
    let i;
    for (; (i = vd(this.buffer, this.carriageReturnIndex)) != null; ) {
      if (i.carriage && this.carriageReturnIndex == null) {
        this.carriageReturnIndex = i.index;
        continue;
      }
      if (this.carriageReturnIndex != null && (i.index !== this.carriageReturnIndex + 1 || i.carriage)) {
        o.push(Kt(this.buffer.subarray(0, this.carriageReturnIndex - 1))), this.buffer = this.buffer.subarray(this.carriageReturnIndex), this.carriageReturnIndex = null;
        continue;
      }
      const r = this.carriageReturnIndex !== null ? i.preceding - 1 : i.preceding, a = Kt(this.buffer.subarray(0, r));
      o.push(a), this.buffer = this.buffer.subarray(i.index), this.carriageReturnIndex = null;
    }
    return o;
  }
  flush() {
    return this.buffer.length ? this.decode(`
`) : [];
  }
}
Ue.NEWLINE_CHARS = /* @__PURE__ */ new Set([`
`, "\r"]);
Ue.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function vd(n, e) {
  for (let i = e ?? 0; i < n.length; i++) {
    if (n[i] === 10)
      return { preceding: i, index: i + 1, carriage: !1 };
    if (n[i] === 13)
      return { preceding: i, index: i + 1, carriage: !0 };
  }
  return null;
}
function Ad(n) {
  for (let o = 0; o < n.length - 1; o++) {
    if (n[o] === 10 && n[o + 1] === 10 || n[o] === 13 && n[o + 1] === 13)
      return o + 2;
    if (n[o] === 13 && n[o + 1] === 10 && o + 3 < n.length && n[o + 2] === 13 && n[o + 3] === 10)
      return o + 4;
  }
  return -1;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const we = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
}, Yt = (n, e, t) => {
  if (n) {
    if (id(we, n))
      return n;
    V(t).warn(`${e} was set to ${JSON.stringify(n)}, expected one of ${JSON.stringify(Object.keys(we))}`);
  }
};
function me() {
}
function Ce(n, e, t) {
  return !e || we[n] > we[t] ? me : e[n].bind(e);
}
const Rd = {
  error: me,
  warn: me,
  info: me,
  debug: me
};
let zt = /* @__PURE__ */ new WeakMap();
function V(n) {
  var e;
  const t = n.logger, o = (e = n.logLevel) !== null && e !== void 0 ? e : "off";
  if (!t)
    return Rd;
  const i = zt.get(t);
  if (i && i[0] === o)
    return i[1];
  const r = {
    error: Ce("error", t, o),
    warn: Ce("warn", t, o),
    info: Ce("info", t, o),
    debug: Ce("debug", t, o)
  };
  return zt.set(t, [o, r]), r;
}
const j = (n) => (n.options && (n.options = Object.assign({}, n.options), delete n.options.headers), n.headers && (n.headers = Object.fromEntries((n.headers instanceof Headers ? [...n.headers] : Object.entries(n.headers)).map(([e, t]) => [
  e,
  e.toLowerCase() === "x-goog-api-key" || e.toLowerCase() === "authorization" || e.toLowerCase() === "cookie" || e.toLowerCase() === "set-cookie" ? "***" : t
]))), "retryOfRequestLogID" in n && (n.retryOfRequestLogID && (n.retryOf = n.retryOfRequestLogID), delete n.retryOfRequestLogID), n);
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class re {
  constructor(e, t, o) {
    this.iterator = e, this.controller = t, this.client = o;
  }
  static fromSSEResponse(e, t, o) {
    let i = !1;
    const r = o ? V(o) : console;
    function a() {
      return J(this, arguments, function* () {
        var c, d, f, m;
        if (i)
          throw new B("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let p = !1;
        try {
          try {
            for (var h = !0, g = O(Pd(e, t)), _; _ = yield w(g.next()), c = _.done, !c; h = !0) {
              m = _.value, h = !1;
              const T = m;
              if (!p)
                if (T.data.startsWith("[DONE]")) {
                  p = !0;
                  continue;
                } else
                  try {
                    yield yield w(JSON.parse(T.data));
                  } catch (C) {
                    throw r.error("Could not parse message into JSON:", T.data), r.error("From chunk:", T.raw), C;
                  }
            }
          } catch (T) {
            d = { error: T };
          } finally {
            try {
              !h && !c && (f = g.return) && (yield w(f.call(g)));
            } finally {
              if (d) throw d.error;
            }
          }
          p = !0;
        } catch (T) {
          if (Xe(T))
            return yield w(void 0);
          throw T;
        } finally {
          p || t.abort();
        }
      });
    }
    return new re(a, t, o);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(e, t, o) {
    let i = !1;
    function r() {
      return J(this, arguments, function* () {
        var c, d, f, m;
        const p = new Ue(), h = Uo(e);
        try {
          for (var g = !0, _ = O(h), T; T = yield w(_.next()), c = T.done, !c; g = !0) {
            m = T.value, g = !1;
            const C = m;
            for (const S of p.decode(C))
              yield yield w(S);
          }
        } catch (C) {
          d = { error: C };
        } finally {
          try {
            !g && !c && (f = _.return) && (yield w(f.call(_)));
          } finally {
            if (d) throw d.error;
          }
        }
        for (const C of p.flush())
          yield yield w(C);
      });
    }
    function a() {
      return J(this, arguments, function* () {
        var c, d, f, m;
        if (i)
          throw new B("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let p = !1;
        try {
          try {
            for (var h = !0, g = O(r()), _; _ = yield w(g.next()), c = _.done, !c; h = !0) {
              m = _.value, h = !1;
              const T = m;
              p || T && (yield yield w(JSON.parse(T)));
            }
          } catch (T) {
            d = { error: T };
          } finally {
            try {
              !h && !c && (f = g.return) && (yield w(f.call(g)));
            } finally {
              if (d) throw d.error;
            }
          }
          p = !0;
        } catch (T) {
          if (Xe(T))
            return yield w(void 0);
          throw T;
        } finally {
          p || t.abort();
        }
      });
    }
    return new re(a, t, o);
  }
  [Symbol.asyncIterator]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const e = [], t = [], o = this.iterator(), i = (r) => ({
      next: () => {
        if (r.length === 0) {
          const a = o.next();
          e.push(a), t.push(a);
        }
        return r.shift();
      }
    });
    return [
      new re(() => i(e), this.controller, this.client),
      new re(() => i(t), this.controller, this.client)
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    const e = this;
    let t;
    return ko({
      async start() {
        t = e[Symbol.asyncIterator]();
      },
      async pull(o) {
        try {
          const { value: i, done: r } = await t.next();
          if (r)
            return o.close();
          const a = fn(JSON.stringify(i) + `
`);
          o.enqueue(a);
        } catch (i) {
          o.error(i);
        }
      },
      async cancel() {
        var o;
        await ((o = t.return) === null || o === void 0 ? void 0 : o.call(t));
      }
    });
  }
}
function Pd(n, e) {
  return J(this, arguments, function* () {
    var o, i, r, a;
    if (!n.body)
      throw e.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new B("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new B("Attempted to iterate over a response with no body");
    const u = new Md(), c = new Ue(), d = Uo(n.body);
    try {
      for (var f = !0, m = O(wd(d)), p; p = yield w(m.next()), o = p.done, !o; f = !0) {
        a = p.value, f = !1;
        const h = a;
        for (const g of c.decode(h)) {
          const _ = u.decode(g);
          _ && (yield yield w(_));
        }
      }
    } catch (h) {
      i = { error: h };
    } finally {
      try {
        !f && !o && (r = m.return) && (yield w(r.call(m)));
      } finally {
        if (i) throw i.error;
      }
    }
    for (const h of c.flush()) {
      const g = u.decode(h);
      g && (yield yield w(g));
    }
  });
}
function wd(n) {
  return J(this, arguments, function* () {
    var t, o, i, r;
    let a = new Uint8Array();
    try {
      for (var u = !0, c = O(n), d; d = yield w(c.next()), t = d.done, !t; u = !0) {
        r = d.value, u = !1;
        const f = r;
        if (f == null)
          continue;
        const m = f instanceof ArrayBuffer ? new Uint8Array(f) : typeof f == "string" ? fn(f) : f;
        let p = new Uint8Array(a.length + m.length);
        p.set(a), p.set(m, a.length), a = p;
        let h;
        for (; (h = Ad(a)) !== -1; )
          yield yield w(a.slice(0, h)), a = a.slice(h);
      }
    } catch (f) {
      o = { error: f };
    } finally {
      try {
        !u && !t && (i = c.return) && (yield w(i.call(c)));
      } finally {
        if (o) throw o.error;
      }
    }
    a.length > 0 && (yield yield w(a));
  });
}
class Md {
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
    let [t, o, i] = Nd(e, ":");
    return i.startsWith(" ") && (i = i.substring(1)), t === "event" ? this.event = i : t === "data" && this.data.push(i), null;
  }
}
function Nd(n, e) {
  const t = n.indexOf(e);
  return t !== -1 ? [n.substring(0, t), e, n.substring(t + e.length)] : [n, "", ""];
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
async function xd(n, e) {
  const { response: t, requestLogID: o, retryOfRequestLogID: i, startTime: r } = e, a = await (async () => {
    var u;
    if (e.options.stream)
      return V(n).debug("response", t.status, t.url, t.headers, t.body), e.options.__streamClass ? e.options.__streamClass.fromSSEResponse(t, e.controller, n) : re.fromSSEResponse(t, e.controller, n);
    if (t.status === 204)
      return null;
    if (e.options.__binaryResponse)
      return t;
    const c = t.headers.get("content-type"), d = (u = c == null ? void 0 : c.split(";")[0]) === null || u === void 0 ? void 0 : u.trim();
    return (d == null ? void 0 : d.includes("application/json")) || (d == null ? void 0 : d.endsWith("+json")) ? await t.json() : await t.text();
  })();
  return V(n).debug(`[${o}] response parsed`, j({
    retryOfRequestLogID: i,
    url: t.url,
    status: t.status,
    body: a,
    durationMs: Date.now() - r
  })), a;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class pn extends Promise {
  constructor(e, t, o = xd) {
    super((i) => {
      i(null);
    }), this.responsePromise = t, this.parseResponse = o, this.client = e;
  }
  _thenUnwrap(e) {
    return new pn(this.client, this.responsePromise, async (t, o) => e(await this.parseResponse(t, o), o));
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
    const [e, t] = await Promise.all([this.parse(), this.asResponse()]);
    return { data: e, response: t };
  }
  parse() {
    return this.parsedPromise || (this.parsedPromise = this.responsePromise.then((e) => this.parseResponse(this.client, e))), this.parsedPromise;
  }
  then(e, t) {
    return this.parse().then(e, t);
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
const bo = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* Dd(n) {
  if (!n)
    return;
  if (bo in n) {
    const { values: o, nulls: i } = n;
    yield* o.entries();
    for (const r of i)
      yield [r, null];
    return;
  }
  let e = !1, t;
  n instanceof Headers ? t = n.entries() : Jt(n) ? t = n : (e = !0, t = Object.entries(n ?? {}));
  for (let o of t) {
    const i = o[0];
    if (typeof i != "string")
      throw new TypeError("expected header name to be a string");
    const r = Jt(o[1]) ? o[1] : [o[1]];
    let a = !1;
    for (const u of r)
      u !== void 0 && (e && !a && (a = !0, yield [i, null]), yield [i, u]);
  }
}
const pe = (n) => {
  const e = new Headers(), t = /* @__PURE__ */ new Set();
  for (const o of n) {
    const i = /* @__PURE__ */ new Set();
    for (const [r, a] of Dd(o)) {
      const u = r.toLowerCase();
      i.has(u) || (e.delete(r), i.add(u)), a === null ? (e.delete(r), t.add(u)) : (e.append(r, a), t.delete(u));
    }
  }
  return { [bo]: !0, values: e, nulls: t };
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Ve = (n) => {
  var e, t, o, i, r, a;
  if (typeof globalThis.process < "u")
    return (o = (t = (e = globalThis.process.env) === null || e === void 0 ? void 0 : e[n]) === null || t === void 0 ? void 0 : t.trim()) !== null && o !== void 0 ? o : void 0;
  if (typeof globalThis.Deno < "u")
    return (a = (r = (i = globalThis.Deno.env) === null || i === void 0 ? void 0 : i.get) === null || r === void 0 ? void 0 : r.call(i, n)) === null || a === void 0 ? void 0 : a.trim();
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var Bo;
class Le {
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
    var t, o, i, r, a, u, c, { baseURL: d = Ve("GEMINI_NEXT_GEN_API_BASE_URL"), apiKey: f = (t = Ve("GEMINI_API_KEY")) !== null && t !== void 0 ? t : null, apiVersion: m = "v1beta" } = e, p = Pe(e, ["baseURL", "apiKey", "apiVersion"]);
    const h = Object.assign(Object.assign({
      apiKey: f,
      apiVersion: m
    }, p), { baseURL: d || "https://generativelanguage.googleapis.com" });
    this.baseURL = h.baseURL, this.timeout = (o = h.timeout) !== null && o !== void 0 ? o : Le.DEFAULT_TIMEOUT, this.logger = (i = h.logger) !== null && i !== void 0 ? i : console;
    const g = "warn";
    this.logLevel = g, this.logLevel = (a = (r = Yt(h.logLevel, "ClientOptions.logLevel", this)) !== null && r !== void 0 ? r : Yt(Ve("GEMINI_NEXT_GEN_API_LOG"), "process.env['GEMINI_NEXT_GEN_API_LOG']", this)) !== null && a !== void 0 ? a : g, this.fetchOptions = h.fetchOptions, this.maxRetries = (u = h.maxRetries) !== null && u !== void 0 ? u : 2, this.fetch = (c = h.fetch) !== null && c !== void 0 ? c : fd(), this.encoder = hd, this._options = h, this.apiKey = f, this.apiVersion = m, this.clientAdapter = h.clientAdapter;
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
  validateHeaders({ values: e, nulls: t }) {
    if (!(e.has("authorization") || e.has("x-goog-api-key")) && !(this.apiKey && e.get("x-goog-api-key")) && !t.has("x-goog-api-key"))
      throw new Error('Could not resolve authentication method. Expected the apiKey to be set. Or for the "x-goog-api-key" headers to be explicitly omitted');
  }
  async authHeaders(e) {
    const t = pe([e.headers]);
    if (!(t.values.has("authorization") || t.values.has("x-goog-api-key"))) {
      if (this.apiKey)
        return pe([{ "x-goog-api-key": this.apiKey }]);
      if (this.clientAdapter.isVertexAI())
        return pe([await this.clientAdapter.getAuthHeaders()]);
    }
  }
  /**
   * Basic re-implementation of `qs.stringify` for primitive types.
   */
  stringifyQuery(e) {
    return Object.entries(e).filter(([t, o]) => typeof o < "u").map(([t, o]) => {
      if (typeof o == "string" || typeof o == "number" || typeof o == "boolean")
        return `${encodeURIComponent(t)}=${encodeURIComponent(o)}`;
      if (o === null)
        return `${encodeURIComponent(t)}=`;
      throw new B(`Cannot stringify type ${typeof o}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
    }).join("&");
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${ie}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${Zu()}`;
  }
  makeStatusError(e, t, o, i) {
    return H.generate(e, t, o, i);
  }
  buildURL(e, t, o) {
    const i = !this.baseURLOverridden() && o || this.baseURL, r = ed(e) ? new URL(e) : new URL(i + (i.endsWith("/") && e.startsWith("/") ? e.slice(1) : e)), a = this.defaultQuery();
    return od(a) || (t = Object.assign(Object.assign({}, a), t)), typeof t == "object" && t && !Array.isArray(t) && (r.search = this.stringifyQuery(t)), r.toString();
  }
  /**
     * Used as a callback for mutating the given `FinalRequestOptions` object.
  
     */
  async prepareOptions(e) {
    if (this.clientAdapter && this.clientAdapter.isVertexAI() && !e.path.startsWith(`/${this.apiVersion}/projects/`)) {
      const t = e.path.slice(this.apiVersion.length + 1);
      e.path = `/${this.apiVersion}/projects/${this.clientAdapter.getProject()}/locations/${this.clientAdapter.getLocation()}${t}`;
    }
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(e, { url: t, options: o }) {
  }
  get(e, t) {
    return this.methodRequest("get", e, t);
  }
  post(e, t) {
    return this.methodRequest("post", e, t);
  }
  patch(e, t) {
    return this.methodRequest("patch", e, t);
  }
  put(e, t) {
    return this.methodRequest("put", e, t);
  }
  delete(e, t) {
    return this.methodRequest("delete", e, t);
  }
  methodRequest(e, t, o) {
    return this.request(Promise.resolve(o).then((i) => Object.assign({ method: e, path: t }, i)));
  }
  request(e, t = null) {
    return new pn(this, this.makeRequest(e, t, void 0));
  }
  async makeRequest(e, t, o) {
    var i, r, a;
    const u = await e, c = (i = u.maxRetries) !== null && i !== void 0 ? i : this.maxRetries;
    t == null && (t = c), await this.prepareOptions(u);
    const { req: d, url: f, timeout: m } = await this.buildRequest(u, {
      retryCount: c - t
    });
    await this.prepareRequest(d, { url: f, options: u });
    const p = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0"), h = o === void 0 ? "" : `, retryOf: ${o}`, g = Date.now();
    if (V(this).debug(`[${p}] sending request`, j({
      retryOfRequestLogID: o,
      method: u.method,
      url: f,
      options: u,
      headers: d.headers
    })), !((r = u.signal) === null || r === void 0) && r.aborted)
      throw new Ze();
    const _ = new AbortController(), T = await this.fetchWithTimeout(f, d, m, _).catch(Qe), C = Date.now();
    if (T instanceof globalThis.Error) {
      const E = `retrying, ${t} attempts remaining`;
      if (!((a = u.signal) === null || a === void 0) && a.aborted)
        throw new Ze();
      const I = Xe(T) || /timed? ?out/i.test(String(T) + ("cause" in T ? String(T.cause) : ""));
      if (t)
        return V(this).info(`[${p}] connection ${I ? "timed out" : "failed"} - ${E}`), V(this).debug(`[${p}] connection ${I ? "timed out" : "failed"} (${E})`, j({
          retryOfRequestLogID: o,
          url: f,
          durationMs: C - g,
          message: T.message
        })), this.retryRequest(u, t, o ?? p);
      throw V(this).info(`[${p}] connection ${I ? "timed out" : "failed"} - error; no more retries left`), V(this).debug(`[${p}] connection ${I ? "timed out" : "failed"} (error; no more retries left)`, j({
        retryOfRequestLogID: o,
        url: f,
        durationMs: C - g,
        message: T.message
      })), I ? new vo() : new ke({ cause: T });
    }
    const S = `[${p}${h}] ${d.method} ${f} ${T.ok ? "succeeded" : "failed"} with status ${T.status} in ${C - g}ms`;
    if (!T.ok) {
      const E = await this.shouldRetry(T);
      if (t && E) {
        const A = `retrying, ${t} attempts remaining`;
        return await md(T.body), V(this).info(`${S} - ${A}`), V(this).debug(`[${p}] response error (${A})`, j({
          retryOfRequestLogID: o,
          url: T.url,
          status: T.status,
          headers: T.headers,
          durationMs: C - g
        })), this.retryRequest(u, t, o ?? p, T.headers);
      }
      const I = E ? "error; no more retries left" : "error; not retryable";
      V(this).info(`${S} - ${I}`);
      const y = await T.text().catch((A) => Qe(A).message), R = rd(y), M = R ? void 0 : y;
      throw V(this).debug(`[${p}] response error (${I})`, j({
        retryOfRequestLogID: o,
        url: T.url,
        status: T.status,
        headers: T.headers,
        message: M,
        durationMs: Date.now() - g
      })), this.makeStatusError(T.status, R, M, T.headers);
    }
    return V(this).info(S), V(this).debug(`[${p}] response start`, j({
      retryOfRequestLogID: o,
      url: T.url,
      status: T.status,
      headers: T.headers,
      durationMs: C - g
    })), { response: T, options: u, controller: _, requestLogID: p, retryOfRequestLogID: o, startTime: g };
  }
  async fetchWithTimeout(e, t, o, i) {
    const r = t || {}, { signal: a, method: u } = r, c = Pe(r, ["signal", "method"]);
    a && a.addEventListener("abort", () => i.abort());
    const d = setTimeout(() => i.abort(), o), f = globalThis.ReadableStream && c.body instanceof globalThis.ReadableStream || typeof c.body == "object" && c.body !== null && Symbol.asyncIterator in c.body, m = Object.assign(Object.assign(Object.assign({ signal: i.signal }, f ? { duplex: "half" } : {}), { method: "GET" }), c);
    u && (m.method = u.toUpperCase());
    try {
      return await this.fetch.call(void 0, e, m);
    } finally {
      clearTimeout(d);
    }
  }
  async shouldRetry(e) {
    const t = e.headers.get("x-should-retry");
    return t === "true" ? !0 : t === "false" ? !1 : e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500;
  }
  async retryRequest(e, t, o, i) {
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
      a = this.calculateDefaultRetryTimeoutMillis(t, d);
    }
    return await ld(a), this.makeRequest(e, t - 1, o);
  }
  calculateDefaultRetryTimeoutMillis(e, t) {
    const r = t - e, a = Math.min(0.5 * Math.pow(2, r), 8), u = 1 - Math.random() * 0.25;
    return a * u * 1e3;
  }
  async buildRequest(e, { retryCount: t = 0 } = {}) {
    var o, i, r;
    const a = Object.assign({}, e), { method: u, path: c, query: d, defaultBaseURL: f } = a, m = this.buildURL(c, d, f);
    "timeout" in a && sd("timeout", a.timeout), a.timeout = (o = a.timeout) !== null && o !== void 0 ? o : this.timeout;
    const { bodyHeaders: p, body: h } = this.buildBody({ options: a }), g = await this.buildHeaders({ options: e, method: u, bodyHeaders: p, retryCount: t });
    return { req: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ method: u, headers: g }, a.signal && { signal: a.signal }), globalThis.ReadableStream && h instanceof globalThis.ReadableStream && { duplex: "half" }), h && { body: h }), (i = this.fetchOptions) !== null && i !== void 0 ? i : {}), (r = a.fetchOptions) !== null && r !== void 0 ? r : {}), url: m, timeout: a.timeout };
  }
  async buildHeaders({ options: e, method: t, bodyHeaders: o, retryCount: i }) {
    let r = {};
    this.idempotencyHeader && t !== "get" && (e.idempotencyKey || (e.idempotencyKey = this.defaultIdempotencyKey()), r[this.idempotencyHeader] = e.idempotencyKey);
    const a = await this.authHeaders(e);
    let u = pe([
      r,
      Object.assign(Object.assign({ Accept: "application/json", "User-Agent": this.getUserAgent(), "X-Stainless-Retry-Count": String(i) }, e.timeout ? { "X-Stainless-Timeout": String(Math.trunc(e.timeout / 1e3)) } : {}), cd()),
      this._options.defaultHeaders,
      o,
      e.headers,
      a
    ]);
    return this.validateHeaders(u), u.values;
  }
  buildBody({ options: { body: e, headers: t } }) {
    if (!e)
      return { bodyHeaders: void 0, body: void 0 };
    const o = pe([t]);
    return (
      // Pass raw type verbatim
      ArrayBuffer.isView(e) || e instanceof ArrayBuffer || e instanceof DataView || typeof e == "string" && // Preserve legacy string encoding behavior for now
      o.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && e instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      e instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      e instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && e instanceof globalThis.ReadableStream ? { bodyHeaders: void 0, body: e } : typeof e == "object" && (Symbol.asyncIterator in e || Symbol.iterator in e && "next" in e && typeof e.next == "function") ? { bodyHeaders: void 0, body: pd(e) } : this.encoder({ body: e, headers: o })
    );
  }
}
Le.DEFAULT_TIMEOUT = 6e4;
class U extends Le {
  constructor() {
    super(...arguments), this.interactions = new qo(this);
  }
}
Bo = U;
U.GeminiNextGenAPIClient = Bo;
U.GeminiNextGenAPIClientError = B;
U.APIError = H;
U.APIConnectionError = ke;
U.APIConnectionTimeoutError = vo;
U.APIUserAbortError = Ze;
U.NotFoundError = wo;
U.ConflictError = Mo;
U.RateLimitError = xo;
U.BadRequestError = Ao;
U.AuthenticationError = Ro;
U.InternalServerError = Do;
U.PermissionDeniedError = Po;
U.UnprocessableEntityError = No;
U.toFile = Cd;
U.Interactions = qo;
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function kd(n, e) {
  const t = {}, o = s(n, ["name"]);
  return o != null && l(t, ["_url", "name"], o), t;
}
function Ud(n, e) {
  const t = {}, o = s(n, ["name"]);
  return o != null && l(t, ["_url", "name"], o), t;
}
function Ld(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  return o != null && l(t, ["sdkHttpResponse"], o), t;
}
function Fd(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  return o != null && l(t, ["sdkHttpResponse"], o), t;
}
function Gd(n, e, t) {
  const o = {};
  if (s(n, ["validationDataset"]) !== void 0)
    throw new Error("validationDataset parameter is not supported in Gemini API.");
  const i = s(n, [
    "tunedModelDisplayName"
  ]);
  if (e !== void 0 && i != null && l(e, ["displayName"], i), s(n, ["description"]) !== void 0)
    throw new Error("description parameter is not supported in Gemini API.");
  const r = s(n, ["epochCount"]);
  e !== void 0 && r != null && l(e, ["tuningTask", "hyperparameters", "epochCount"], r);
  const a = s(n, [
    "learningRateMultiplier"
  ]);
  if (a != null && l(o, ["tuningTask", "hyperparameters", "learningRateMultiplier"], a), s(n, ["exportLastCheckpointOnly"]) !== void 0)
    throw new Error("exportLastCheckpointOnly parameter is not supported in Gemini API.");
  if (s(n, ["preTunedModelCheckpointId"]) !== void 0)
    throw new Error("preTunedModelCheckpointId parameter is not supported in Gemini API.");
  if (s(n, ["adapterSize"]) !== void 0)
    throw new Error("adapterSize parameter is not supported in Gemini API.");
  if (s(n, ["tuningMode"]) !== void 0)
    throw new Error("tuningMode parameter is not supported in Gemini API.");
  if (s(n, ["customBaseModel"]) !== void 0)
    throw new Error("customBaseModel parameter is not supported in Gemini API.");
  const u = s(n, ["batchSize"]);
  e !== void 0 && u != null && l(e, ["tuningTask", "hyperparameters", "batchSize"], u);
  const c = s(n, ["learningRate"]);
  if (e !== void 0 && c != null && l(e, ["tuningTask", "hyperparameters", "learningRate"], c), s(n, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  if (s(n, ["beta"]) !== void 0)
    throw new Error("beta parameter is not supported in Gemini API.");
  if (s(n, ["baseTeacherModel"]) !== void 0)
    throw new Error("baseTeacherModel parameter is not supported in Gemini API.");
  if (s(n, ["tunedTeacherModelSource"]) !== void 0)
    throw new Error("tunedTeacherModelSource parameter is not supported in Gemini API.");
  if (s(n, ["sftLossWeightMultiplier"]) !== void 0)
    throw new Error("sftLossWeightMultiplier parameter is not supported in Gemini API.");
  if (s(n, ["outputUri"]) !== void 0)
    throw new Error("outputUri parameter is not supported in Gemini API.");
  return o;
}
function Vd(n, e, t) {
  const o = {};
  let i = s(t, [
    "config",
    "method"
  ]);
  if (i === void 0 && (i = "SUPERVISED_FINE_TUNING"), i === "SUPERVISED_FINE_TUNING") {
    const y = s(n, [
      "validationDataset"
    ]);
    e !== void 0 && y != null && l(e, ["supervisedTuningSpec"], He(y));
  } else if (i === "PREFERENCE_TUNING") {
    const y = s(n, [
      "validationDataset"
    ]);
    e !== void 0 && y != null && l(e, ["preferenceOptimizationSpec"], He(y));
  } else if (i === "DISTILLATION") {
    const y = s(n, [
      "validationDataset"
    ]);
    e !== void 0 && y != null && l(e, ["distillationSpec"], He(y));
  }
  const r = s(n, [
    "tunedModelDisplayName"
  ]);
  e !== void 0 && r != null && l(e, ["tunedModelDisplayName"], r);
  const a = s(n, ["description"]);
  e !== void 0 && a != null && l(e, ["description"], a);
  let u = s(t, [
    "config",
    "method"
  ]);
  if (u === void 0 && (u = "SUPERVISED_FINE_TUNING"), u === "SUPERVISED_FINE_TUNING") {
    const y = s(n, ["epochCount"]);
    e !== void 0 && y != null && l(e, ["supervisedTuningSpec", "hyperParameters", "epochCount"], y);
  } else if (u === "PREFERENCE_TUNING") {
    const y = s(n, ["epochCount"]);
    e !== void 0 && y != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "epochCount"], y);
  } else if (u === "DISTILLATION") {
    const y = s(n, ["epochCount"]);
    e !== void 0 && y != null && l(e, ["distillationSpec", "hyperParameters", "epochCount"], y);
  }
  let c = s(t, [
    "config",
    "method"
  ]);
  if (c === void 0 && (c = "SUPERVISED_FINE_TUNING"), c === "SUPERVISED_FINE_TUNING") {
    const y = s(n, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && y != null && l(e, ["supervisedTuningSpec", "hyperParameters", "learningRateMultiplier"], y);
  } else if (c === "PREFERENCE_TUNING") {
    const y = s(n, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && y != null && l(e, [
      "preferenceOptimizationSpec",
      "hyperParameters",
      "learningRateMultiplier"
    ], y);
  } else if (c === "DISTILLATION") {
    const y = s(n, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && y != null && l(e, ["distillationSpec", "hyperParameters", "learningRateMultiplier"], y);
  }
  let d = s(t, ["config", "method"]);
  if (d === void 0 && (d = "SUPERVISED_FINE_TUNING"), d === "SUPERVISED_FINE_TUNING") {
    const y = s(n, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && y != null && l(e, ["supervisedTuningSpec", "exportLastCheckpointOnly"], y);
  } else if (d === "PREFERENCE_TUNING") {
    const y = s(n, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && y != null && l(e, ["preferenceOptimizationSpec", "exportLastCheckpointOnly"], y);
  } else if (d === "DISTILLATION") {
    const y = s(n, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && y != null && l(e, ["distillationSpec", "exportLastCheckpointOnly"], y);
  }
  let f = s(t, [
    "config",
    "method"
  ]);
  if (f === void 0 && (f = "SUPERVISED_FINE_TUNING"), f === "SUPERVISED_FINE_TUNING") {
    const y = s(n, ["adapterSize"]);
    e !== void 0 && y != null && l(e, ["supervisedTuningSpec", "hyperParameters", "adapterSize"], y);
  } else if (f === "PREFERENCE_TUNING") {
    const y = s(n, ["adapterSize"]);
    e !== void 0 && y != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "adapterSize"], y);
  } else if (f === "DISTILLATION") {
    const y = s(n, ["adapterSize"]);
    e !== void 0 && y != null && l(e, ["distillationSpec", "hyperParameters", "adapterSize"], y);
  }
  let m = s(t, [
    "config",
    "method"
  ]);
  if (m === void 0 && (m = "SUPERVISED_FINE_TUNING"), m === "SUPERVISED_FINE_TUNING") {
    const y = s(n, ["tuningMode"]);
    e !== void 0 && y != null && l(e, ["supervisedTuningSpec", "tuningMode"], y);
  }
  const p = s(n, [
    "customBaseModel"
  ]);
  e !== void 0 && p != null && l(e, ["customBaseModel"], p);
  let h = s(t, [
    "config",
    "method"
  ]);
  if (h === void 0 && (h = "SUPERVISED_FINE_TUNING"), h === "SUPERVISED_FINE_TUNING") {
    const y = s(n, ["batchSize"]);
    e !== void 0 && y != null && l(e, ["supervisedTuningSpec", "hyperParameters", "batchSize"], y);
  }
  let g = s(t, [
    "config",
    "method"
  ]);
  if (g === void 0 && (g = "SUPERVISED_FINE_TUNING"), g === "SUPERVISED_FINE_TUNING") {
    const y = s(n, [
      "learningRate"
    ]);
    e !== void 0 && y != null && l(e, ["supervisedTuningSpec", "hyperParameters", "learningRate"], y);
  }
  const _ = s(n, ["labels"]);
  e !== void 0 && _ != null && l(e, ["labels"], _);
  const T = s(n, ["beta"]);
  e !== void 0 && T != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "beta"], T);
  const C = s(n, [
    "baseTeacherModel"
  ]);
  e !== void 0 && C != null && l(e, ["distillationSpec", "baseTeacherModel"], C);
  const S = s(n, [
    "tunedTeacherModelSource"
  ]);
  e !== void 0 && S != null && l(e, ["distillationSpec", "tunedTeacherModelSource"], S);
  const E = s(n, [
    "sftLossWeightMultiplier"
  ]);
  e !== void 0 && E != null && l(e, ["distillationSpec", "hyperParameters", "sftLossWeightMultiplier"], E);
  const I = s(n, ["outputUri"]);
  return e !== void 0 && I != null && l(e, ["outputUri"], I), o;
}
function Hd(n, e) {
  const t = {}, o = s(n, ["baseModel"]);
  o != null && l(t, ["baseModel"], o);
  const i = s(n, [
    "preTunedModel"
  ]);
  i != null && l(t, ["preTunedModel"], i);
  const r = s(n, [
    "trainingDataset"
  ]);
  r != null && Xd(r);
  const a = s(n, ["config"]);
  return a != null && Gd(a, t), t;
}
function qd(n, e) {
  const t = {}, o = s(n, ["baseModel"]);
  o != null && l(t, ["baseModel"], o);
  const i = s(n, [
    "preTunedModel"
  ]);
  i != null && l(t, ["preTunedModel"], i);
  const r = s(n, [
    "trainingDataset"
  ]);
  r != null && Qd(r, t, e);
  const a = s(n, ["config"]);
  return a != null && Vd(a, t, e), t;
}
function bd(n, e) {
  const t = {}, o = s(n, ["name"]);
  return o != null && l(t, ["_url", "name"], o), t;
}
function Bd(n, e) {
  const t = {}, o = s(n, ["name"]);
  return o != null && l(t, ["_url", "name"], o), t;
}
function Jd(n, e, t) {
  const o = {}, i = s(n, ["pageSize"]);
  e !== void 0 && i != null && l(e, ["_query", "pageSize"], i);
  const r = s(n, ["pageToken"]);
  e !== void 0 && r != null && l(e, ["_query", "pageToken"], r);
  const a = s(n, ["filter"]);
  return e !== void 0 && a != null && l(e, ["_query", "filter"], a), o;
}
function Od(n, e, t) {
  const o = {}, i = s(n, ["pageSize"]);
  e !== void 0 && i != null && l(e, ["_query", "pageSize"], i);
  const r = s(n, ["pageToken"]);
  e !== void 0 && r != null && l(e, ["_query", "pageToken"], r);
  const a = s(n, ["filter"]);
  return e !== void 0 && a != null && l(e, ["_query", "filter"], a), o;
}
function $d(n, e) {
  const t = {}, o = s(n, ["config"]);
  return o != null && Jd(o, t), t;
}
function Wd(n, e) {
  const t = {}, o = s(n, ["config"]);
  return o != null && Od(o, t), t;
}
function Kd(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "nextPageToken"
  ]);
  i != null && l(t, ["nextPageToken"], i);
  const r = s(n, ["tunedModels"]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((u) => Jo(u))), l(t, ["tuningJobs"], a);
  }
  return t;
}
function Yd(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, [
    "nextPageToken"
  ]);
  i != null && l(t, ["nextPageToken"], i);
  const r = s(n, ["tuningJobs"]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((u) => nn(u))), l(t, ["tuningJobs"], a);
  }
  return t;
}
function zd(n, e) {
  const t = {}, o = s(n, ["name"]);
  o != null && l(t, ["model"], o);
  const i = s(n, ["name"]);
  return i != null && l(t, ["endpoint"], i), t;
}
function Xd(n, e) {
  const t = {};
  if (s(n, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  if (s(n, ["vertexDatasetResource"]) !== void 0)
    throw new Error("vertexDatasetResource parameter is not supported in Gemini API.");
  const o = s(n, ["examples"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => r)), l(t, ["examples", "examples"], i);
  }
  return t;
}
function Qd(n, e, t) {
  const o = {};
  let i = s(t, [
    "config",
    "method"
  ]);
  if (i === void 0 && (i = "SUPERVISED_FINE_TUNING"), i === "SUPERVISED_FINE_TUNING") {
    const a = s(n, ["gcsUri"]);
    e !== void 0 && a != null && l(e, ["supervisedTuningSpec", "trainingDatasetUri"], a);
  } else if (i === "PREFERENCE_TUNING") {
    const a = s(n, ["gcsUri"]);
    e !== void 0 && a != null && l(e, ["preferenceOptimizationSpec", "trainingDatasetUri"], a);
  } else if (i === "DISTILLATION") {
    const a = s(n, ["gcsUri"]);
    e !== void 0 && a != null && l(e, ["distillationSpec", "promptDatasetUri"], a);
  }
  let r = s(t, [
    "config",
    "method"
  ]);
  if (r === void 0 && (r = "SUPERVISED_FINE_TUNING"), r === "SUPERVISED_FINE_TUNING") {
    const a = s(n, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && l(e, ["supervisedTuningSpec", "trainingDatasetUri"], a);
  } else if (r === "PREFERENCE_TUNING") {
    const a = s(n, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && l(e, ["preferenceOptimizationSpec", "trainingDatasetUri"], a);
  } else if (r === "DISTILLATION") {
    const a = s(n, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && l(e, ["distillationSpec", "promptDatasetUri"], a);
  }
  if (s(n, ["examples"]) !== void 0)
    throw new Error("examples parameter is not supported in Vertex AI.");
  return o;
}
function Jo(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["name"]);
  i != null && l(t, ["name"], i);
  const r = s(n, ["state"]);
  r != null && l(t, ["state"], io(r));
  const a = s(n, ["createTime"]);
  a != null && l(t, ["createTime"], a);
  const u = s(n, [
    "tuningTask",
    "startTime"
  ]);
  u != null && l(t, ["startTime"], u);
  const c = s(n, [
    "tuningTask",
    "completeTime"
  ]);
  c != null && l(t, ["endTime"], c);
  const d = s(n, ["updateTime"]);
  d != null && l(t, ["updateTime"], d);
  const f = s(n, ["description"]);
  f != null && l(t, ["description"], f);
  const m = s(n, ["baseModel"]);
  m != null && l(t, ["baseModel"], m);
  const p = s(n, ["_self"]);
  return p != null && l(t, ["tunedModel"], zd(p)), t;
}
function nn(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["name"]);
  i != null && l(t, ["name"], i);
  const r = s(n, ["state"]);
  r != null && l(t, ["state"], io(r));
  const a = s(n, ["createTime"]);
  a != null && l(t, ["createTime"], a);
  const u = s(n, ["startTime"]);
  u != null && l(t, ["startTime"], u);
  const c = s(n, ["endTime"]);
  c != null && l(t, ["endTime"], c);
  const d = s(n, ["updateTime"]);
  d != null && l(t, ["updateTime"], d);
  const f = s(n, ["error"]);
  f != null && l(t, ["error"], f);
  const m = s(n, ["description"]);
  m != null && l(t, ["description"], m);
  const p = s(n, ["baseModel"]);
  p != null && l(t, ["baseModel"], p);
  const h = s(n, ["tunedModel"]);
  h != null && l(t, ["tunedModel"], h);
  const g = s(n, [
    "preTunedModel"
  ]);
  g != null && l(t, ["preTunedModel"], g);
  const _ = s(n, [
    "supervisedTuningSpec"
  ]);
  _ != null && l(t, ["supervisedTuningSpec"], _);
  const T = s(n, [
    "preferenceOptimizationSpec"
  ]);
  T != null && l(t, ["preferenceOptimizationSpec"], T);
  const C = s(n, [
    "distillationSpec"
  ]);
  C != null && l(t, ["distillationSpec"], C);
  const S = s(n, [
    "tuningDataStats"
  ]);
  S != null && l(t, ["tuningDataStats"], S);
  const E = s(n, [
    "encryptionSpec"
  ]);
  E != null && l(t, ["encryptionSpec"], E);
  const I = s(n, [
    "partnerModelTuningSpec"
  ]);
  I != null && l(t, ["partnerModelTuningSpec"], I);
  const y = s(n, [
    "customBaseModel"
  ]);
  y != null && l(t, ["customBaseModel"], y);
  const R = s(n, ["experiment"]);
  R != null && l(t, ["experiment"], R);
  const M = s(n, ["labels"]);
  M != null && l(t, ["labels"], M);
  const D = s(n, ["outputUri"]);
  D != null && l(t, ["outputUri"], D);
  const A = s(n, ["pipelineJob"]);
  A != null && l(t, ["pipelineJob"], A);
  const N = s(n, [
    "serviceAccount"
  ]);
  N != null && l(t, ["serviceAccount"], N);
  const k = s(n, [
    "tunedModelDisplayName"
  ]);
  k != null && l(t, ["tunedModelDisplayName"], k);
  const q = s(n, [
    "veoTuningSpec"
  ]);
  return q != null && l(t, ["veoTuningSpec"], q), t;
}
function Zd(n, e) {
  const t = {}, o = s(n, [
    "sdkHttpResponse"
  ]);
  o != null && l(t, ["sdkHttpResponse"], o);
  const i = s(n, ["name"]);
  i != null && l(t, ["name"], i);
  const r = s(n, ["metadata"]);
  r != null && l(t, ["metadata"], r);
  const a = s(n, ["done"]);
  a != null && l(t, ["done"], a);
  const u = s(n, ["error"]);
  return u != null && l(t, ["error"], u), t;
}
function He(n, e) {
  const t = {}, o = s(n, ["gcsUri"]);
  o != null && l(t, ["validationDatasetUri"], o);
  const i = s(n, [
    "vertexDatasetResource"
  ]);
  return i != null && l(t, ["validationDatasetUri"], i), t;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class jd extends z {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (t = {}) => new te(Y.PAGED_ITEM_TUNING_JOBS, (o) => this.listInternal(o), await this.listInternal(t), t), this.get = async (t) => await this.getInternal(t), this.tune = async (t) => {
      var o;
      if (this.apiClient.isVertexAI())
        if (t.baseModel.startsWith("projects/")) {
          const i = {
            tunedModelName: t.baseModel
          };
          !((o = t.config) === null || o === void 0) && o.preTunedModelCheckpointId && (i.checkpointId = t.config.preTunedModelCheckpointId);
          const r = Object.assign(Object.assign({}, t), { preTunedModel: i });
          return r.baseModel = void 0, await this.tuneInternal(r);
        } else {
          const i = Object.assign({}, t);
          return await this.tuneInternal(i);
        }
      else {
        const i = Object.assign({}, t), r = await this.tuneMldevInternal(i);
        let a = "";
        return r.metadata !== void 0 && r.metadata.tunedModel !== void 0 ? a = r.metadata.tunedModel : r.name !== void 0 && r.name.includes("/operations/") && (a = r.name.split("/operations/")[0]), {
          name: a,
          state: Be.JOB_STATE_QUEUED
        };
      }
    };
  }
  async getInternal(e) {
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Bd(e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => nn(f));
    } else {
      const d = bd(e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => Jo(f));
    }
  }
  async listInternal(e) {
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Wd(e);
      return u = v("tuningJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Yd(f), p = new St();
        return Object.assign(p, m), p;
      });
    } else {
      const d = $d(e);
      return u = v("tunedModels", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Kd(f), p = new St();
        return Object.assign(p, m), p;
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
    var t, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Ud(e);
      return u = v("{name}:cancel", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Fd(f), p = new It();
        return Object.assign(p, m), p;
      });
    } else {
      const d = kd(e);
      return u = v("{name}:cancel", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((m) => {
        const p = m;
        return p.sdkHttpResponse = {
          headers: f.headers
        }, p;
      })), a.then((f) => {
        const m = Ld(f), p = new It();
        return Object.assign(p, m), p;
      });
    }
  }
  async tuneInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = qd(e, e);
      return r = v("tuningJobs", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => nn(c));
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  async tuneMldevInternal(e) {
    var t, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = Hd(e);
      return r = v("tunedModels", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (t = e.config) === null || t === void 0 ? void 0 : t.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json().then((d) => {
        const f = d;
        return f.sdkHttpResponse = {
          headers: c.headers
        }, f;
      })), i.then((c) => Zd(c));
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class ec {
  async download(e, t) {
    throw new Error("Download to file is not supported in the browser, please use a browser compliant download like an <a> tag.");
  }
}
const nc = 1024 * 1024 * 8, tc = 3, oc = 1e3, ic = 2, Me = "x-goog-upload-status";
async function sc(n, e, t) {
  var o;
  const i = await Oo(n, e, t), r = await (i == null ? void 0 : i.json());
  if (((o = i == null ? void 0 : i.headers) === null || o === void 0 ? void 0 : o[Me]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  return r.file;
}
async function rc(n, e, t) {
  var o;
  const i = await Oo(n, e, t), r = await (i == null ? void 0 : i.json());
  if (((o = i == null ? void 0 : i.headers) === null || o === void 0 ? void 0 : o[Me]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  const a = Zt(r), u = new rn();
  return Object.assign(u, a), u;
}
async function Oo(n, e, t) {
  var o, i;
  let r = 0, a = 0, u = new Oe(new Response()), c = "upload";
  for (r = n.size; a < r; ) {
    const d = Math.min(nc, r - a), f = n.slice(a, a + d);
    a + d >= r && (c += ", finalize");
    let m = 0, p = oc;
    for (; m < tc && (u = await t.request({
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
    }), !(!((o = u == null ? void 0 : u.headers) === null || o === void 0) && o[Me])); )
      m++, await ac(p), p = p * ic;
    if (a += d, ((i = u == null ? void 0 : u.headers) === null || i === void 0 ? void 0 : i[Me]) !== "active")
      break;
    if (r <= a)
      throw new Error("All content has been uploaded, but the upload status is not finalized.");
  }
  return u;
}
async function lc(n) {
  return { size: n.size, type: n.type };
}
function ac(n) {
  return new Promise((e) => setTimeout(e, n));
}
class uc {
  async upload(e, t, o) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await sc(e, t, o);
  }
  async uploadToFileSearchStore(e, t, o) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await rc(e, t, o);
  }
  async stat(e) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await lc(e);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class dc {
  create(e, t, o) {
    return new cc(e, t, o);
  }
}
class cc {
  constructor(e, t, o) {
    this.url = e, this.headers = t, this.callbacks = o;
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
const Xt = "x-goog-api-key";
class fc {
  constructor(e) {
    this.apiKey = e;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addAuthHeaders(e, t) {
    if (e.get(Xt) === null) {
      if (this.apiKey.startsWith("auth_tokens/"))
        throw new Error("Ephemeral tokens are only supported by the live API.");
      if (!this.apiKey)
        throw new Error("API key is missing. Please provide a valid API key.");
      e.append(Xt, this.apiKey);
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const pc = "gl-node/";
class mc {
  get interactions() {
    if (this._interactions !== void 0)
      return this._interactions;
    console.warn("GoogleGenAI.interactions: Interactions usage is experimental and may change in future versions.");
    const e = this.httpOptions;
    e != null && e.extraBody && console.warn("GoogleGenAI.interactions: Client level httpOptions.extraBody is not supported by the interactions client and will be ignored.");
    const t = new U({
      baseURL: this.apiClient.getBaseUrl(),
      apiKey: this.apiKey,
      apiVersion: this.apiClient.getApiVersion(),
      clientAdapter: this.apiClient,
      defaultHeaders: this.apiClient.getDefaultHeaders(),
      timeout: e == null ? void 0 : e.timeout
    });
    return this._interactions = t.interactions, this._interactions;
  }
  constructor(e) {
    var t;
    if (e.apiKey == null)
      throw new Error("An API Key must be set when running in a browser");
    if (e.project || e.location)
      throw new Error("Vertex AI project based authentication is not supported on browser runtimes. Please do not provide a project or location.");
    this.vertexai = (t = e.vertexai) !== null && t !== void 0 ? t : !1, this.apiKey = e.apiKey;
    const o = ii(
      e.httpOptions,
      e.vertexai,
      /*vertexBaseUrlFromEnv*/
      void 0,
      /*geminiBaseUrlFromEnv*/
      void 0
    );
    o && (e.httpOptions ? e.httpOptions.baseUrl = o : e.httpOptions = { baseUrl: o }), this.apiVersion = e.apiVersion, this.httpOptions = e.httpOptions;
    const i = new fc(this.apiKey);
    this.apiClient = new lu({
      auth: i,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
      vertexai: this.vertexai,
      httpOptions: this.httpOptions,
      userAgentExtra: pc + "web",
      uploader: new uc(),
      downloader: new ec()
    }), this.models = new Ru(this.apiClient), this.live = new Cu(this.apiClient, i, new dc()), this.batches = new Us(this.apiClient), this.chats = new hr(this.models, this.apiClient), this.caches = new fr(this.apiClient), this.files = new Pr(this.apiClient), this.operations = new Pu(this.apiClient), this.authTokens = new Ju(this.apiClient), this.tunings = new jd(this.apiClient), this.fileSearchStores = new Qu(this.apiClient);
  }
}
class qe {
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
    const i = {
      contents: e.messages.filter((a) => a.role !== "system").map((a) => this.mapMessage(a))
    };
    e.system && (i.systemInstruction = {
      parts: [{ text: e.system }]
    });
    const r = {};
    return e.temperature !== void 0 && (r.temperature = e.temperature), e.maxTokens !== void 0 && (r.maxOutputTokens = e.maxTokens), e.topP !== void 0 && (r.topP = e.topP), e.stop !== void 0 && (r.stopSequences = e.stop), Object.keys(r).length > 0 && (i.generationConfig = r), i;
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
        t = i;
      }
    } catch (i) {
      console.error("[GeminiConverter] Failed to parse error:", i);
    }
    return t;
  }
}
class hc {
  constructor(e, t) {
    P(this, "client");
    P(this, "apiEndpoint");
    P(this, "tokenCallback");
    this.client = e, this.apiEndpoint = t;
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
  async makeRequest(e, t, o, i, r) {
    console.log("[GeminiToolHandler] makeRequest called", {
      model: e,
      messagesCount: t.length,
      toolsCount: o.length,
      threadContext: i,
      shouldStream: r
    });
    const a = o.map((d) => ({
      name: d.name,
      description: d.description,
      parameters: d.parameters
    })), u = [{
      functionDeclarations: a
    }];
    console.log("[GeminiToolHandler] Converted tools to Gemini format", {
      functionDeclarationsCount: a.length,
      functions: a.map((d) => d.name)
    });
    const c = {
      model: e,
      contents: t,
      tools: u
    };
    return console.log("[GeminiToolHandler] Making API request", {
      shouldStream: r,
      hasTools: u.length > 0
    }), r ? await this.makeStreamingRequest(c) : await this.makeNonStreamingRequest(c);
  }
  /**
   * Make a streaming request to Gemini
   */
  async makeStreamingRequest(e) {
    var r, a, u, c;
    console.log("[GeminiToolHandler] Starting streaming request");
    const t = await this.client.models.generateContentStream(e);
    let o = 0, i = null;
    try {
      for await (const d of t) {
        o++, i = d, console.log("[GeminiToolHandler] Received streaming chunk", {
          chunkCount: o,
          hasText: !!d.text,
          finishReason: (a = (r = d.candidates) == null ? void 0 : r[0]) == null ? void 0 : a.finishReason
        });
        const f = d.text;
        f && this.tokenCallback && this.tokenCallback(f);
        const m = (c = (u = d.candidates) == null ? void 0 : u[0]) == null ? void 0 : c.finishReason;
        if (m) {
          console.log("[GeminiToolHandler] Detected finish reason, breaking loop", { finishReason: m });
          break;
        }
      }
    } catch (d) {
      throw console.error("[GeminiToolHandler] Error during streaming", d), d;
    }
    return console.log("[GeminiToolHandler] Stream completed", { chunkCount: o }), console.log("[GeminiToolHandler] Returning last chunk as result"), i;
  }
  /**
   * Make a non-streaming request to Gemini
   */
  async makeNonStreamingRequest(e) {
    console.log("[GeminiToolHandler] Starting non-streaming request");
    const t = await this.client.models.generateContent(e);
    return console.log("[GeminiToolHandler] Non-streaming response received", {
      hasResponse: !!t
    }), t;
  }
  /**
   * Extract tool uses (function calls) from Gemini's response
   */
  extractToolUses(e) {
    var r;
    console.log("[GeminiToolHandler] Extracting tool uses from response");
    const t = [], o = e.candidates;
    if (!o || o.length === 0)
      return console.log("[GeminiToolHandler] No candidates found in response"), t;
    const i = (r = o[0].content) == null ? void 0 : r.parts;
    if (!i)
      return console.log("[GeminiToolHandler] No parts found in candidate content"), t;
    console.log("[GeminiToolHandler] Checking parts for function calls", {
      partsCount: i.length
    });
    for (const a of i)
      if (a.functionCall) {
        const u = a.functionCall;
        console.log("[GeminiToolHandler] Found function call", {
          name: u.name,
          args: u.args
        }), t.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: u.name,
          input: u.args || {}
        });
      }
    return console.log("[GeminiToolHandler] Extracted tool uses", {
      count: t.length,
      tools: t.map((a) => ({ id: a.id, name: a.name }))
    }), t;
  }
  /**
   * Extract text content from Gemini's response
   */
  extractTextContent(e) {
    console.log("[GeminiToolHandler] Extracting text content from response");
    try {
      const t = e.text;
      return console.log("[GeminiToolHandler] Text content extracted", {
        hasText: !!t,
        textLength: (t == null ? void 0 : t.length) || 0
      }), t || null;
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
    const o = e.map((i, r) => {
      const a = t[r];
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
  appendMessages(e, t, o) {
    var c;
    console.log("[GeminiToolHandler] Appending messages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length
    });
    const i = t.candidates;
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
class gc {
  constructor(e, t, o, i = [], r) {
    P(this, "client");
    P(this, "defaultModel");
    P(this, "apiEndpoint");
    P(this, "tools");
    P(this, "onToolUse");
    P(this, "toolHandler");
    this.client = new mc({
      apiKey: t,
      httpOptions: {
        baseUrl: e
      }
    }), this.defaultModel = o || "gemini-pro", this.apiEndpoint = e, this.tools = i, this.onToolUse = r, i.length > 0 && (this.toolHandler = new hc(this.client, this.apiEndpoint)), console.log(`GeminiChatProvider initialized url: ${e} with model ${this.defaultModel}${i.length > 0 ? ` and ${i.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Gemini
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    var u, c, d, f, m, p, h, g, _, T;
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
    let i = {};
    if (o.thread_id) {
      const C = W.setBranchIteration(e.branch_id, 0);
      i = {
        thread_id: o.thread_id,
        branch_id: C
      };
    }
    const r = e.model || this.defaultModel, a = qe.toGeminiRequest({ ...e, model: r });
    console.log("[GeminiChatProvider] Converted request", {
      model: r,
      hasSystemInstruction: !!a.systemInstruction,
      contentsCount: a.contents.length,
      threadContext: i,
      streaming: e.streaming !== !1
    });
    try {
      if (e.streaming !== !1) {
        console.log("[GeminiChatProvider] Using streaming mode");
        const C = await this.client.models.generateContentStream({
          model: r,
          ...a
        });
        console.log("[GeminiChatProvider] Stream started, processing chunks");
        let S = 0, E = !1, I = null;
        try {
          for await (const y of C) {
            S++;
            const R = (d = (c = (u = y.candidates) == null ? void 0 : u[0]) == null ? void 0 : c.content) == null ? void 0 : d.parts;
            if (R)
              for (const A of R)
                A.inlineData && A.inlineData.mimeType && (I = {
                  mimeType: A.inlineData.mimeType,
                  data: A.inlineData.data || ""
                }, console.log("[GeminiChatProvider] Detected inline data", {
                  mimeType: I.mimeType,
                  dataLength: I.data.length
                }));
            console.log("[GeminiChatProvider] Received chunk", {
              chunkCount: S,
              hasText: !!y.text,
              hasInlineData: !!I,
              finishReason: (m = (f = y.candidates) == null ? void 0 : f[0]) == null ? void 0 : m.finishReason
            });
            const M = y.text;
            M && t && t(M);
            const D = (h = (p = y.candidates) == null ? void 0 : p[0]) == null ? void 0 : h.finishReason;
            if (D) {
              console.log("[GeminiChatProvider] Detected finish reason, breaking loop", { finishReason: D }), E = !0;
              break;
            }
          }
        } catch (y) {
          throw console.error("[GeminiChatProvider] Error during streaming", y), y;
        }
        if (console.log("[GeminiChatProvider] Stream loop exited", { chunkCount: S, isDone: E, hasInlineData: !!I }), I && t) {
          const y = `![](data:${I.mimeType};base64,${I.data})`;
          console.log("[GeminiChatProvider] Appending inline data as markdown", {
            mimeType: I.mimeType,
            dataLength: I.data.length
          });
          const R = `

${y}`;
          t(R);
        }
        console.log("[GeminiChatProvider] Stream completed");
      } else {
        console.log("[GeminiChatProvider] Using non-streaming mode");
        const C = await this.client.models.generateContent({
          model: r,
          ...a
        }), S = C.text;
        let E = null;
        const I = (T = (_ = (g = C.candidates) == null ? void 0 : g[0]) == null ? void 0 : _.content) == null ? void 0 : T.parts;
        if (I)
          for (const y of I)
            y.inlineData && y.inlineData.mimeType && (E = {
              mimeType: y.inlineData.mimeType,
              data: y.inlineData.data || ""
            }, console.log("[GeminiChatProvider] Detected inline data in non-streaming response", {
              mimeType: E.mimeType,
              dataLength: E.data.length
            }));
        if (console.log("[GeminiChatProvider] Response received", {
          textLength: (S == null ? void 0 : S.length) || 0,
          hasText: !!S,
          hasInlineData: !!E
        }), S && t && t(S), E && t) {
          const y = `![](data:${E.mimeType};base64,${E.data})`;
          console.log("[GeminiChatProvider] Appending inline data as markdown", {
            mimeType: E.mimeType,
            dataLength: E.data.length
          });
          const R = `

${y}`;
          t(R);
        }
      }
    } catch (C) {
      console.error("[GeminiChatProvider] Error in Gemini API call:", C);
      const S = qe.mapError(C);
      throw console.log("[GeminiChatProvider] Decoded error message:", S), t && t(`

**Error:** ${S}`), C;
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
    const o = e.model || this.defaultModel, i = qe.toGeminiRequest({ ...e, model: o }), r = this.convertToolsToGeminiFormat(this.tools);
    await W.handleToolLoop(
      this.toolHandler,
      o,
      i.contents,
      r,
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
var Ie = /* @__PURE__ */ ((n) => (n.OLLAMA = "ollama", n.OPENAI = "openai", n.CLAUDE = "claude", n.PERPLEXITY = "perplexity", n.GEMINI = "gemini", n))(Ie || {});
class yc {
  /**
   * Creates an appropriate chat provider based on the provider type
   */
  static createProvider(e, t, o, i) {
    switch (e) {
      case "ollama":
        if (!t.apiKey)
          throw new Error("API key is required for Ollama provider");
        return new Xo(t.url, t.apiKey, t.model, o || [], i);
      case "openai":
        if (!t.apiKey)
          throw new Error("API key is required for OpenAI provider");
        return new Zo(t.url, t.apiKey, t.model, o || [], i);
      case "claude":
        if (!t.apiKey)
          throw new Error("API key is required for Claude provider");
        return new ei(t.url, t.apiKey, t.model, o || [], i);
      case "gemini":
        if (!t.apiKey)
          throw new Error("API key is required for Gemini provider");
        return new gc(t.url, t.apiKey, t.model, o || [], i);
      case "perplexity":
        throw new Error("PerplexityChatProvider not implemented yet");
      default:
        throw new Error(`Unsupported provider type: ${e}`);
    }
  }
}
class Tc {
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
class _c {
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
class Cc {
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
class Ec {
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
function Sc(n) {
  switch (n.toLowerCase()) {
    case Ie.OPENAI:
      return new Tc();
    case Ie.CLAUDE:
      return new _c();
    case Ie.OLLAMA:
      return new Cc();
    default:
      return new Ec();
  }
}
class Ic {
  constructor(e, t, o, i, r) {
    P(this, "accumulatedResponse", "");
    P(this, "requestStartTime");
    P(this, "firstTokenTime");
    P(this, "tokenCounter");
    P(this, "originalCallback");
    P(this, "totalTokens", 0);
    P(this, "tokensReceived", 0);
    P(this, "isFirstToken", !0);
    this.provider = e, this.model = t, this.prompt = o, this.onComplete = i, this.requestStartTime = Date.now(), this.originalCallback = r, this.tokenCounter = Sc(e);
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
    const t = Date.now(), o = ((a = this.tokenCounter) == null ? void 0 : a.countPromptTokens(this.prompt)) ?? 0, i = ((u = this.tokenCounter) == null ? void 0 : u.estimateResponseTokens(this.accumulatedResponse)) ?? 0, r = {
      requestId: crypto.randomUUID(),
      provider: this.provider,
      model: this.model,
      requestTimestamp: this.requestStartTime,
      firstTokenTimestamp: this.firstTokenTime,
      completionTimestamp: t,
      totalDuration: t - this.requestStartTime,
      timeToFirstToken: this.firstTokenTime ? this.firstTokenTime - this.requestStartTime : void 0,
      promptTokenCount: o,
      completionTokenCount: i,
      totalTokenCount: o + i,
      tokensPerSecond: this.calculateTokensPerSecond(t),
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
    const t = (e - this.firstTokenTime) / 1e3;
    return t > 0 ? this.tokensReceived / t : void 0;
  }
}
const ne = class ne {
  constructor(e) {
    P(this, "config");
    P(this, "auditLogs", []);
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
  createAccumulator(e, t, o, i) {
    return new Ic(
      e,
      t,
      o,
      (r) => this.logChatAudit(r),
      i
    );
  }
  /**
   * Create a wrapped token callback that accumulates tokens
   */
  createWrappedCallback(e, t, o) {
    const i = this.createAccumulator(
      t,
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
P(ne, "instance");
let tn = ne;
class Mc {
  /**
   * Create a ChatService with the specified provider and configuration
   */
  constructor(e, t, o = !0, i, r) {
    P(this, "provider");
    P(this, "providerType");
    P(this, "config");
    P(this, "auditService");
    P(this, "tools");
    P(this, "onToolUse");
    this.providerType = e, this.config = t, this.tools = i, this.onToolUse = r, this.provider = this.initializeProvider(), this.auditService = tn.getInstance({
      enabled: o,
      logToConsole: !0,
      logToServer: !1
    });
  }
  /**
   * Initialize the appropriate provider based on provider type
   */
  initializeProvider() {
    return yc.createProvider(this.providerType, this.config, this.tools, this.onToolUse);
  }
  /**
   * Send a chat request and handle streaming response
   */
  async chat(e, t) {
    const { callback: o, complete: i } = this.auditService.createWrappedCallback(
      e,
      this.providerType,
      t
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
class vc {
  static toOllamaRequest(e) {
    return {
      model: e.model,
      messages: e.messages.map((t) => ({ role: t.role, content: t.content }))
    };
  }
}
class Nc {
  constructor(e, t) {
    P(this, "url");
    P(this, "model");
    P(this, "ollama");
    this.url = e, this.model = t, this.ollama = new Qt({ host: e }), console.log("in constructor creating ollama client...");
  }
  async chat(e, t) {
    vc.toOllamaRequest(e);
    const o = await this.ollama.chat({ model: e.model, messages: e.messages, stream: !0 });
    for await (const i of o) {
      const r = i.message.content;
      t && t(r);
    }
  }
}
export {
  tn as AuditService,
  Nc as ChatApiService,
  yc as ChatProviderFactory,
  W as ChatProviderUtils,
  Mc as ChatService,
  ei as ClaudeChatProvider,
  jo as ClaudeToolHandler,
  gc as GeminiChatProvider,
  hc as GeminiToolHandler,
  Xo as OllamaChatProvider,
  zo as OllamaToolHandler,
  Zo as OpenAIChatProvider,
  Qo as OpenAIToolHandler,
  Ie as ProviderType,
  Ic as TokenAccumulator
};
