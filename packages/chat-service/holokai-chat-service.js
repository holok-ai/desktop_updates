var M = Object.defineProperty;
var H = (d, e, o) => e in d ? M(d, e, { enumerable: !0, configurable: !0, writable: !0, value: o }) : d[e] = o;
var i = (d, e, o) => H(d, typeof e != "symbol" ? e + "" : e, o);
import { Ollama as I } from "ollama/browser";
import U from "openai";
import b from "@anthropic-ai/sdk";
class A {
  /**
   * Convert internal ChatRequest to Ollama-specific format
   */
  static toOllamaRequest(e) {
    const o = e.messages.filter((a) => a.role !== "system"), t = e.system ? [{ role: "system", content: e.system }, ...o.map((a) => ({ role: a.role, content: a.content }))] : o.map((a) => ({ role: a.role, content: a.content })), s = {
      model: e.model,
      messages: t,
      stream: e.streaming !== !1
    };
    return (e.temperature !== void 0 || e.maxTokens !== void 0 || e.topP !== void 0 || e.frequencyPenalty !== void 0 || e.presencePenalty !== void 0 || e.stop !== void 0) && (s.options = {}, e.temperature !== void 0 && (s.options.temperature = e.temperature), e.maxTokens !== void 0 && (s.options.num_predict = e.maxTokens), e.topP !== void 0 && (s.options.top_p = e.topP), e.frequencyPenalty !== void 0 && (s.options.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (s.options.presence_penalty = e.presencePenalty), e.stop !== void 0 && (s.options.stop = e.stop)), e.responseFormat && (s.format = e.responseFormat), s;
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
    return t.includes(",branch_id=") || (t = `${t},branch_id=1.0`), o > 0 && (t = `${t}.${Math.floor(o)}`), {
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
  static async handleToolLoop(e, o, t, s, n, a, l, c = !1) {
    let r = t;
    const p = n;
    for (let m = 0; m < _.MAX_TOOL_ITERATIONS; m++) {
      const h = _.addToolSeqToBranch(p, m);
      if ("setTokenCallback" in e && typeof e.setTokenCallback == "function") {
        console.log("[ChatProviderUtils] Setting token callback", {
          iteration: m,
          hasCallback: !!l
        });
        const u = l ? (y) => {
          console.log("[ChatProviderUtils] Token received from handler", {
            iteration: m,
            tokenLength: y.length,
            tokenPreview: y.substring(0, 50)
          }), l(y);
        } : void 0;
        e.setTokenCallback(u);
      }
      const C = await e.makeRequest(
        o,
        r,
        s,
        h,
        c
      ), f = "setTokenCallback" in e && typeof e.setTokenCallback == "function";
      if (!c || !f) {
        const u = e.extractTextContent(C);
        u && l && l(u);
      }
      const k = e.extractToolUses(C);
      if (k.length === 0)
        return;
      const T = [];
      for (const u of k) {
        const y = await a(u);
        T.push(y);
      }
      const g = e.formatToolResults(k, T);
      r = e.appendMessages(r, C, g);
    }
    throw new Error("Tool loop exceeded maximum iterations");
  }
};
/**
 * Maximum number of tool calling iterations to prevent infinite loops
 */
i(_, "MAX_TOOL_ITERATIONS", 10);
let O = _;
class E {
  constructor(e) {
    i(this, "onTokenReceived");
    this.ollama = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, o, t, s, n) {
    var a;
    if (console.log("[OllamaToolHandler] makeRequest called", {
      model: e,
      shouldStream: n,
      toolsCount: t.length,
      messagesCount: o.length,
      threadContext: s
    }), n) {
      console.log("[OllamaToolHandler] Using streaming mode");
      const l = await this.ollama.chat({
        ...s,
        model: e,
        messages: o,
        tools: t,
        stream: !0
      });
      let c = null, r = 0;
      for await (const p of l) {
        r++;
        const m = (a = p.message) == null ? void 0 : a.content;
        m && this.onTokenReceived && this.onTokenReceived(m), c = p;
      }
      return console.log("[OllamaToolHandler] Stream complete", {
        chunkCount: r,
        hasFinalMessage: !!c,
        finalMessageKeys: c ? Object.keys(c) : []
      }), c;
    } else {
      console.log("[OllamaToolHandler] Using non-streaming mode");
      const l = await this.ollama.chat({
        ...s,
        model: e,
        messages: o,
        tools: t,
        stream: !1
      });
      return console.log("[OllamaToolHandler] Non-streaming response received", {
        hasResponse: !!l,
        responseKeys: l ? Object.keys(l) : []
      }), l;
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
    }), e.map((t, s) => ({
      id: t.id,
      result: JSON.stringify(o[s])
    }));
  }
  appendMessages(e, o, t) {
    var n, a;
    console.log("[OllamaToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: t.length,
      hasResponseMessage: !!o.message
    });
    const s = [
      ...e,
      {
        role: "assistant",
        content: ((n = o.message) == null ? void 0 : n.content) || "",
        tool_calls: ((a = o.message) == null ? void 0 : a.tool_calls) || []
      }
    ];
    for (const l of t)
      s.push({
        role: "tool",
        content: l.result
      });
    return console.log("[OllamaToolHandler] appendMessages complete", {
      newMessagesCount: s.length
    }), s;
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
    const o = e.tool_calls.map((s, n) => {
      var a, l;
      return {
        id: s.id || `tool_${n}`,
        name: ((a = s.function) == null ? void 0 : a.name) || s.name || "",
        arguments: ((l = s.function) == null ? void 0 : l.arguments) || s.arguments || {}
      };
    });
    return console.log("[OllamaToolHandler] extractToolCalls result", {
      extractedCount: o.length,
      calls: o.map((s) => ({ id: s.id, name: s.name }))
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
class L {
  constructor(e, o, t, s = [], n) {
    i(this, "ollama");
    i(this, "defaultModel");
    i(this, "tools");
    i(this, "onToolUse");
    i(this, "toolHandler");
    this.ollama = new I({ host: e, headers: {
      "X-api-key": o
    } }), this.defaultModel = t, this.tools = s, this.onToolUse = n, s.length > 0 && (this.toolHandler = new E(this.ollama)), console.log(`OllamaChatProvider initialized with endpoint ${e} and model ${t}${s.length > 0 ? ` and ${s.length} tools` : ""}`);
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
    const s = e.model || this.defaultModel, n = { ...e, model: s }, a = A.toOllamaRequest(n), l = t.thread_id ? { thread_id: t.thread_id } : {};
    try {
      if (a.stream) {
        const c = await this.ollama.chat({
          ...l,
          ...a,
          stream: !0
        });
        for await (const r of c) {
          const p = r.message.content;
          o && o(p);
        }
      } else {
        const c = await this.ollama.chat({
          ...l,
          ...a,
          stream: !1
        });
        o && o(c.message.content);
      }
    } catch (c) {
      throw console.error("Error in Ollama API call:", c), c;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, o) {
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const t = e.model || this.defaultModel, s = { ...e, model: t }, n = A.toOllamaRequest(s), a = this.convertToolsToOllamaFormat(this.tools);
    try {
      await O.handleToolLoop(
        this.toolHandler,
        n.model,
        n.messages || [],
        a,
        e,
        this.onToolUse,
        o,
        e.streaming !== !1
      );
    } catch (l) {
      throw console.error("[OllamaChatProvider] Tool-enabled chat failed:", l), l;
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
  async handleToolLoop(e, o, t, s) {
    var c, r, p, m;
    let n = [...e.messages];
    const a = e.stream !== !1, l = s;
    console.log("[OllamaChatProvider] handleToolLoop starting", {
      shouldStream: a,
      toolsCount: o.length,
      messagesCount: n.length,
      hasThreadId: !!l.thread_id
    });
    for (let h = 0; h < O.MAX_TOOL_ITERATIONS; h++) {
      console.log("[OllamaChatProvider] Tool loop iteration", { iteration: h });
      const C = O.addToolSeqToBranch(l, h), f = await this.ollama.chat({
        ...C,
        model: e.model,
        messages: n,
        tools: o,
        stream: !1
        // Use non-streaming for tool calls
      });
      console.log("[OllamaChatProvider] Got response", {
        hasMessage: !!f.message,
        hasToolCalls: !!((c = f.message) != null && c.tool_calls),
        messageKeys: f.message ? Object.keys(f.message) : [],
        messageContent: (r = f.message) == null ? void 0 : r.content,
        toolCalls: (p = f.message) == null ? void 0 : p.tool_calls,
        fullResponse: JSON.stringify(f, null, 2)
      }), (m = f.message) != null && m.content && t && t(f.message.content);
      const v = this.extractToolCalls(f.message);
      if (v.length === 0) {
        console.log("[OllamaChatProvider] No tool calls found, ending loop");
        return;
      }
      console.log("[OllamaChatProvider] Found tool calls", { count: v.length });
      const k = [];
      for (const T of v) {
        console.log("[OllamaChatProvider] Executing tool", { name: T.name });
        const g = {
          id: T.id,
          name: T.name,
          input: this.parseToolArguments(T.arguments)
        }, u = await this.onToolUse(g);
        console.log("[OllamaChatProvider] Tool result", { success: u.success }), k.push({
          id: T.id,
          result: JSON.stringify(u)
        });
      }
      n.push({
        role: "assistant",
        content: f.message.content || "",
        tool_calls: f.message.tool_calls
      });
      for (const T of k)
        n.push({
          role: "tool",
          content: T.result
        });
    }
    throw new Error("Tool loop exceeded maximum iterations");
  }
}
class S {
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
      const s = e.messages.filter((n) => n.role !== "system");
      o = [
        { role: "system", content: e.system },
        ...s.map((n) => this.mapMessage(n))
      ];
    } else
      o = e.messages.map((s) => this.mapMessage(s));
    const t = {
      model: e.model,
      messages: o,
      stream: e.streaming !== !1
    };
    return e.temperature !== void 0 && (t.temperature = e.temperature), e.maxTokens !== void 0 && (t.max_tokens = e.maxTokens), e.topP !== void 0 && (t.top_p = e.topP), e.frequencyPenalty !== void 0 && (t.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (t.presence_penalty = e.presencePenalty), e.stop !== void 0 && (t.stop = e.stop), e.responseFormat !== void 0 && (t.response_format = e.responseFormat), t;
  }
}
class N {
  constructor(e) {
    i(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, o, t, s, n) {
    return console.log("[OpenAIToolHandler] makeRequest called", {
      model: e,
      shouldStream: n,
      toolsCount: t.length,
      messagesCount: o.length,
      threadContext: s
    }), n ? (console.log("[OpenAIToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, o, t, s)) : (console.log("[OpenAIToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, o, t, s));
  }
  extractToolUses(e) {
    var t, s, n, a, l, c, r;
    const o = e.choices[0];
    if (console.log("[OpenAIToolHandler] extractToolUses", {
      hasChoice: !!o,
      finishReason: o == null ? void 0 : o.finish_reason,
      hasToolCalls: !!((t = o == null ? void 0 : o.message) != null && t.tool_calls),
      toolCallsCount: ((n = (s = o == null ? void 0 : o.message) == null ? void 0 : s.tool_calls) == null ? void 0 : n.length) || 0,
      hasFunctionCall: !!((a = o == null ? void 0 : o.message) != null && a.function_call)
    }), (o == null ? void 0 : o.finish_reason) === "tool_calls" || (l = o == null ? void 0 : o.message) != null && l.tool_calls) {
      const p = (c = o == null ? void 0 : o.message) == null ? void 0 : c.tool_calls;
      if (p && p.length > 0) {
        const m = p.map((h) => ({
          id: h.id,
          name: h.function.name,
          input: this.parseToolArguments(h.function.arguments)
        }));
        return console.log("[OpenAIToolHandler] Extracted tool uses (tool_calls format)", {
          count: m.length,
          tools: m.map((h) => ({ id: h.id, name: h.name }))
        }), m;
      }
    }
    if ((o == null ? void 0 : o.finish_reason) === "function_call") {
      const p = (r = o == null ? void 0 : o.message) == null ? void 0 : r.function_call;
      if (p) {
        const m = {
          id: `call_${Date.now()}`,
          name: p.name,
          input: this.parseToolArguments(p.arguments || "{}")
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
    var t, s;
    const o = (s = (t = e.choices[0]) == null ? void 0 : t.message) == null ? void 0 : s.content;
    return console.log("[OpenAIToolHandler] extractTextContent", {
      hasContent: !!o,
      contentLength: (o == null ? void 0 : o.length) || 0
    }), o || null;
  }
  formatToolResults(e, o) {
    return console.log("[OpenAIToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: o.length
    }), e.map((t, s) => ({
      role: "tool",
      tool_call_id: t.id,
      content: JSON.stringify(o[s])
    }));
  }
  appendMessages(e, o, t) {
    var a;
    console.log("[OpenAIToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: t.length,
      hasResponseMessage: !!((a = o.choices[0]) != null && a.message)
    });
    const s = {
      role: "assistant",
      content: o.choices[0].message.content,
      tool_calls: o.choices[0].message.tool_calls
    }, n = [
      ...e,
      s,
      ...t
    ];
    return console.log("[OpenAIToolHandler] appendMessages complete", {
      newMessagesCount: n.length
    }), n;
  }
  /**
   * Make a streaming request to OpenAI API
   */
  async makeStreamingRequest(e, o, t, s) {
    var n, a, l, c;
    console.log("[OpenAIToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: o.length,
      toolsCount: t.length,
      threadContext: s
    });
    try {
      const r = Date.now(), p = await this.client.chat.completions.create({
        ...s,
        model: e,
        messages: o,
        tools: t,
        stream: !0
      });
      console.log("[OpenAIToolHandler] Stream received, processing chunks");
      let m = "", h = [], C = null, f = 0;
      for await (const k of p) {
        f++;
        const T = k.choices[0], g = T == null ? void 0 : T.delta;
        if (g != null && g.content && (m += g.content, this.onTokenReceived && this.onTokenReceived(g.content)), g != null && g.tool_calls)
          for (const u of g.tool_calls) {
            const y = u.index;
            h[y] ? (u.id && (h[y].id += u.id), (l = u.function) != null && l.name && (h[y].function.name += u.function.name), (c = u.function) != null && c.arguments && (h[y].function.arguments += u.function.arguments)) : h[y] = {
              id: u.id || "",
              type: "function",
              function: {
                name: ((n = u.function) == null ? void 0 : n.name) || "",
                arguments: ((a = u.function) == null ? void 0 : a.arguments) || ""
              }
            };
          }
        T != null && T.finish_reason && (C = T.finish_reason);
      }
      const v = Date.now() - r;
      return console.log("[OpenAIToolHandler] makeStreamingRequest complete", {
        duration: `${v}ms`,
        chunkCount: f,
        accumulatedContentLength: m.length,
        toolCallsCount: h.length,
        finishReason: C
      }), {
        choices: [
          {
            finish_reason: C || "stop",
            message: {
              role: "assistant",
              content: m || null,
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
    } catch (r) {
      throw console.error("[OpenAIToolHandler] makeStreamingRequest failed", {
        error: r,
        errorMessage: r instanceof Error ? r.message : String(r),
        errorStack: r instanceof Error ? r.stack : void 0
      }), r;
    }
  }
  /**
   * Make a non-streaming request to OpenAI API
   */
  async makeNonStreamingRequest(e, o, t, s) {
    var n, a, l, c, r, p, m, h, C, f, v, k, T;
    console.log("[OpenAIToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: o.length,
      toolsCount: t.length,
      threadContext: s
    });
    try {
      const g = Date.now(), u = await this.client.chat.completions.create({
        ...s,
        model: e,
        messages: o,
        tools: t,
        stream: !1
      }), y = Date.now() - g;
      return console.log("[OpenAIToolHandler] makeNonStreamingRequest response received", {
        duration: `${y}ms`,
        hasResponse: !!u,
        hasChoices: !!u.choices,
        choicesCount: ((n = u.choices) == null ? void 0 : n.length) || 0,
        finishReason: (l = (a = u.choices) == null ? void 0 : a[0]) == null ? void 0 : l.finish_reason,
        hasContent: !!((p = (r = (c = u.choices) == null ? void 0 : c[0]) == null ? void 0 : r.message) != null && p.content),
        hasToolCalls: !!((C = (h = (m = u.choices) == null ? void 0 : m[0]) == null ? void 0 : h.message) != null && C.tool_calls),
        toolCallsCount: ((T = (k = (v = (f = u.choices) == null ? void 0 : f[0]) == null ? void 0 : v.message) == null ? void 0 : k.tool_calls) == null ? void 0 : T.length) || 0
      }), u;
    } catch (g) {
      throw console.error("[OpenAIToolHandler] makeNonStreamingRequest failed", {
        error: g,
        errorMessage: g instanceof Error ? g.message : String(g),
        errorStack: g instanceof Error ? g.stack : void 0
      }), g;
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
class D {
  constructor(e, o, t, s = [], n) {
    i(this, "client");
    i(this, "defaultModel");
    i(this, "tools");
    i(this, "onToolUse");
    i(this, "toolHandler");
    this.client = new U({ apiKey: o, baseURL: e, dangerouslyAllowBrowser: !0 }), this.defaultModel = t || "gpt-3.5-turbo", this.tools = s, this.onToolUse = n, s.length > 0 && (this.toolHandler = new N(this.client)), console.log(`OpenAIChatProvider initialized with model ${this.defaultModel}${s.length > 0 ? ` and ${s.length} tools` : ""}`);
  }
  /**
   * Send a chat request to OpenAI
   * Automatically handles tools if configured in constructor
   */
  async chat(e, o) {
    var l, c, r, p;
    const t = e;
    if (console.log("[OpenAIChatProvider] chat called", {
      hasThreadId: !!t.thread_id,
      thread_id: t.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, o);
      return;
    }
    const s = e.model || this.defaultModel, n = S.toOpenAIRequest({ ...e, model: s }), a = t.thread_id ? { thread_id: t.thread_id } : {};
    try {
      if (e.streaming !== !1) {
        const m = await this.client.chat.completions.create({
          model: n.model,
          messages: n.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens,
          top_p: e.topP,
          frequency_penalty: e.frequencyPenalty,
          presence_penalty: e.presencePenalty,
          stop: e.stop,
          response_format: e.responseFormat,
          stream: !0,
          ...a
        });
        for await (const h of m) {
          const C = ((c = (l = h.choices[0]) == null ? void 0 : l.delta) == null ? void 0 : c.content) || "";
          C && o && o(C);
        }
      } else {
        const h = ((p = (r = (await this.client.chat.completions.create({
          model: n.model,
          messages: n.messages,
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
          ...a
        })).choices[0]) == null ? void 0 : r.message) == null ? void 0 : p.content) || "";
        h && o && o(h);
      }
    } catch (m) {
      throw console.error("Error in OpenAI API call:", m), m;
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
    const t = e.model || this.defaultModel, s = S.toOpenAIRequest({ ...e, model: t }), n = this.convertToolsToOpenAIFormat(this.tools);
    console.log("[OpenAIChatProvider] Converted request", {
      model: s.model,
      messagesCount: s.messages.length,
      toolsCount: n.length,
      shouldStream: e.streaming !== !1
    });
    try {
      console.log("[OpenAIChatProvider] Calling ChatProviderUtils.handleToolLoop"), await O.handleToolLoop(
        this.toolHandler,
        s.model,
        s.messages,
        n,
        e,
        this.onToolUse,
        o,
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
class x {
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
    const o = e.messages.filter((s) => s.role !== "system"), t = {
      model: e.model,
      messages: o.map((s) => this.mapMessage(s)),
      stream: e.streaming !== !1
    };
    if (e.system) {
      let s = e.system;
      if (e.responseFormat) {
        const n = `

You must respond with valid JSON that matches this exact schema:
\`\`\`json
${JSON.stringify(e.responseFormat, null, 2)}
\`\`\`

Respond only with the JSON, no other text.`;
        s += n;
      }
      t.system = s;
    }
    return e.temperature !== void 0 && (t.temperature = e.temperature), e.maxTokens !== void 0 && (t.max_tokens = e.maxTokens), e.topP !== void 0 && (t.top_p = e.topP), e.stop !== void 0 && (t.stop_sequences = e.stop), t;
  }
}
class $ {
  constructor(e) {
    i(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   * This is called before each tool loop iteration to update the callback
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, o, t, s, n) {
    return console.log("[ClaudeToolHandler] makeRequest called", {
      model: e,
      shouldStream: n,
      toolsCount: t.length,
      messagesCount: o.length,
      threadContext: s
    }), n ? (console.log("[ClaudeToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, o, t, s)) : (console.log("[ClaudeToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, o, t, s));
  }
  extractToolUses(e) {
    const o = this.extractToolUseBlocks(e.content);
    return console.log("[ClaudeToolHandler] extractToolUses", {
      contentBlocksCount: e.content.length,
      toolUseBlocksCount: o.length,
      toolUses: o.map((t) => ({ id: t.id, name: t.name }))
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
    return console.log("[ClaudeToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: o.length
    }), e.map((t, s) => {
      const n = o[s];
      return {
        type: "tool_result",
        tool_use_id: t.id,
        content: JSON.stringify({
          success: (n == null ? void 0 : n.success) ?? !1,
          data: (n == null ? void 0 : n.data) ?? null,
          error: (n == null ? void 0 : n.error) ?? null
        })
      };
    });
  }
  appendMessages(e, o, t) {
    console.log("[ClaudeToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: t.length,
      hasResponseContent: !!o.content
    });
    const s = [
      ...e,
      {
        role: "assistant",
        content: o.content
      },
      {
        role: "user",
        content: t
      }
    ];
    return console.log("[ClaudeToolHandler] appendMessages complete", {
      newMessagesCount: s.length
    }), s;
  }
  /**
   * Make a streaming request to Claude API
   * Streams text tokens in real-time while collecting the final message for tool extraction
   */
  async makeStreamingRequest(e, o, t, s) {
    var n;
    console.log("[ClaudeToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: o.length,
      toolsCount: t.length,
      threadContext: s
    });
    try {
      const a = Date.now();
      let l = 0;
      const c = this.client.messages.stream({
        model: e,
        messages: o,
        tools: t,
        max_tokens: 4096,
        stream: !0,
        ...s
      }).on("text", (m) => {
        l++, console.log("[ClaudeToolHandler] Streaming text token", {
          tokenCount: l,
          textLength: m.length,
          hasCallback: !!this.onTokenReceived
        }), this.onTokenReceived && this.onTokenReceived(m);
      });
      console.log("[ClaudeToolHandler] Stream started, waiting for final message");
      const r = await c.finalMessage(), p = Date.now() - a;
      return console.log("[ClaudeToolHandler] makeStreamingRequest complete", {
        duration: `${p}ms`,
        hasMessage: !!r,
        contentBlocksCount: ((n = r.content) == null ? void 0 : n.length) || 0,
        totalTokensStreamed: l
      }), r;
    } catch (a) {
      throw console.error("[ClaudeToolHandler] makeStreamingRequest failed", {
        error: a,
        errorMessage: a instanceof Error ? a.message : String(a),
        errorStack: a instanceof Error ? a.stack : void 0
      }), a;
    }
  }
  /**
   * Make a non-streaming request to Claude API
   */
  async makeNonStreamingRequest(e, o, t, s) {
    var n;
    console.log("[ClaudeToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: o.length,
      toolsCount: t.length,
      threadContext: s
    });
    try {
      const a = Date.now(), l = await this.client.messages.create({
        model: e,
        messages: o,
        tools: t,
        max_tokens: 4096,
        stream: !1,
        ...s
      }), c = Date.now() - a;
      return console.log("[ClaudeToolHandler] makeNonStreamingRequest response received", {
        duration: `${c}ms`,
        hasResponse: !!l,
        contentBlocksCount: ((n = l.content) == null ? void 0 : n.length) || 0,
        stopReason: l.stop_reason
      }), l;
    } catch (a) {
      throw console.error("[ClaudeToolHandler] makeNonStreamingRequest failed", {
        error: a,
        errorMessage: a instanceof Error ? a.message : String(a),
        errorStack: a instanceof Error ? a.stack : void 0
      }), a;
    }
  }
  /**
   * Extract tool_use blocks from response content
   */
  extractToolUseBlocks(e) {
    return e.filter((o) => o.type === "tool_use");
  }
}
class F {
  constructor(e, o, t, s = [], n) {
    i(this, "client");
    i(this, "defaultModel");
    i(this, "tools");
    i(this, "onToolUse");
    i(this, "toolHandler");
    this.client = new b({
      apiKey: o,
      dangerouslyAllowBrowser: !0
    }), e && (this.client.baseURL = e), this.defaultModel = t || "claude-3-opus-20240229", this.tools = s, this.onToolUse = n, s.length > 0 && (this.toolHandler = new $(this.client)), console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}${s.length > 0 ? ` and ${s.length} tools` : ""}`);
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
    const s = e.model || this.defaultModel, n = x.toClaudeRequest({ ...e, model: s }), a = t.thread_id ? { thread_id: t.thread_id } : {};
    try {
      if (e.streaming !== !1) {
        const l = this.client.messages.stream({
          ...a,
          model: n.model,
          messages: n.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          stream: !0,
          system: n.system
        }).on("text", (r) => {
          o && o(r);
        });
        console.log("waiting for final message");
        const c = await l.finalMessage();
        console.log(c);
      } else {
        const l = await this.client.messages.create({
          ...a,
          model: n.model,
          messages: n.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          system: n.system
        });
        if (l.content && l.content.length > 0) {
          const c = l.content.filter((r) => r.type === "text").map((r) => r.text).join("");
          o && o(c);
        }
      }
    } catch (l) {
      throw console.error("Error in Claude API call:", l), l;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, o) {
    if (console.log("[ClaudeChatProvider] chatWithTools called", {
      hasToolHandler: !!this.toolHandler,
      hasOnToolUse: !!this.onToolUse,
      toolsCount: this.tools.length
    }), !this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const t = e.model || this.defaultModel, s = x.toClaudeRequest({ ...e, model: t }), n = this.convertToolsToClaudeFormat(this.tools);
    console.log("[ClaudeChatProvider] Converted request", {
      model: s.model,
      messagesCount: s.messages.length,
      toolsCount: n.length,
      shouldStream: e.streaming !== !1
    });
    try {
      console.log("[ClaudeChatProvider] Calling ChatProviderUtils.handleToolLoop"), await O.handleToolLoop(
        this.toolHandler,
        s.model,
        s.messages,
        n,
        e,
        this.onToolUse,
        o,
        e.streaming !== !1
      ), console.log("[ClaudeChatProvider] handleToolLoop completed");
    } catch (a) {
      throw console.error("[ClaudeChatProvider] Tool-enabled chat failed:", a), a;
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
var R = /* @__PURE__ */ ((d) => (d.OLLAMA = "ollama", d.OPENAI = "openai", d.CLAUDE = "claude", d.PERPLEXITY = "perplexity", d))(R || {});
class J {
  /**
   * Creates an appropriate chat provider based on the provider type
   */
  static createProvider(e, o, t, s) {
    switch (e) {
      case "ollama":
        if (!o.apiKey)
          throw new Error("API key is required for Ollama provider");
        return new L(o.url, o.apiKey, o.model, t || [], s);
      case "openai":
        if (!o.apiKey)
          throw new Error("API key is required for OpenAI provider");
        return new D(o.url, o.apiKey, o.model, t || [], s);
      case "claude":
        if (!o.apiKey)
          throw new Error("API key is required for Claude provider");
        return new F(o.url, o.apiKey, o.model, t || [], s);
      case "perplexity":
        throw new Error("PerplexityChatProvider not implemented yet");
      default:
        throw new Error(`Unsupported provider type: ${e}`);
    }
  }
}
class W {
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
class j {
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
class B {
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
class K {
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
function z(d) {
  switch (d.toLowerCase()) {
    case R.OPENAI:
      return new W();
    case R.CLAUDE:
      return new j();
    case R.OLLAMA:
      return new B();
    default:
      return new K();
  }
}
class X {
  constructor(e, o, t, s, n) {
    i(this, "accumulatedResponse", "");
    i(this, "requestStartTime");
    i(this, "firstTokenTime");
    i(this, "tokenCounter");
    i(this, "originalCallback");
    i(this, "totalTokens", 0);
    i(this, "tokensReceived", 0);
    i(this, "isFirstToken", !0);
    this.provider = e, this.model = o, this.prompt = t, this.onComplete = s, this.requestStartTime = Date.now(), this.originalCallback = n, this.tokenCounter = z(e);
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
    var a, l;
    const o = Date.now(), t = ((a = this.tokenCounter) == null ? void 0 : a.countPromptTokens(this.prompt)) ?? 0, s = ((l = this.tokenCounter) == null ? void 0 : l.estimateResponseTokens(this.accumulatedResponse)) ?? 0, n = {
      requestId: crypto.randomUUID(),
      provider: this.provider,
      model: this.model,
      requestTimestamp: this.requestStartTime,
      firstTokenTimestamp: this.firstTokenTime,
      completionTimestamp: o,
      totalDuration: o - this.requestStartTime,
      timeToFirstToken: this.firstTokenTime ? this.firstTokenTime - this.requestStartTime : void 0,
      promptTokenCount: t,
      completionTokenCount: s,
      totalTokenCount: t + s,
      tokensPerSecond: this.calculateTokensPerSecond(o),
      promptText: JSON.stringify(this.prompt),
      completeResponse: this.accumulatedResponse,
      success: !e,
      error: e ? String(e) : void 0
    };
    return this.onComplete(n), n;
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
    i(this, "config");
    i(this, "auditLogs", []);
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
  createAccumulator(e, o, t, s) {
    return new X(
      e,
      o,
      t,
      (n) => this.logChatAudit(n),
      s
    );
  }
  /**
   * Create a wrapped token callback that accumulates tokens
   */
  createWrappedCallback(e, o, t) {
    const s = this.createAccumulator(
      o,
      e.model,
      e.messages,
      t
    );
    return {
      callback: (n) => s.handleToken(n),
      complete: (n) => s.complete(n)
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
i(w, "instance");
let P = w;
class q {
  /**
   * Create a ChatService with the specified provider and configuration
   */
  constructor(e, o, t = !0, s, n) {
    i(this, "provider");
    i(this, "providerType");
    i(this, "config");
    i(this, "auditService");
    i(this, "tools");
    i(this, "onToolUse");
    this.providerType = e, this.config = o, this.tools = s, this.onToolUse = n, this.provider = this.initializeProvider(), this.auditService = P.getInstance({
      enabled: t,
      logToConsole: !0,
      logToServer: !1
    });
  }
  /**
   * Initialize the appropriate provider based on provider type
   */
  initializeProvider() {
    return J.createProvider(this.providerType, this.config, this.tools, this.onToolUse);
  }
  /**
   * Send a chat request and handle streaming response
   */
  async chat(e, o) {
    const { callback: t, complete: s } = this.auditService.createWrappedCallback(
      e,
      this.providerType,
      o
    );
    try {
      await this.provider.chat(e, t), s();
    } catch (n) {
      throw s(n), n;
    }
  }
  /**
   * Get the audit logs for this chat service
   */
  getAuditLogs() {
    return this.auditService.getAuditLogs();
  }
}
class Y {
  static toOllamaRequest(e) {
    return {
      model: e.model,
      messages: e.messages.map((o) => ({ role: o.role, content: o.content }))
    };
  }
}
class ee {
  constructor(e, o) {
    i(this, "url");
    i(this, "model");
    i(this, "ollama");
    this.url = e, this.model = o, this.ollama = new I({ host: e }), console.log("in constructor creating ollama client...");
  }
  async chat(e, o) {
    Y.toOllamaRequest(e);
    const t = await this.ollama.chat({ model: e.model, messages: e.messages, stream: !0 });
    for await (const s of t) {
      const n = s.message.content;
      o && o(n);
    }
  }
}
export {
  P as AuditService,
  ee as ChatApiService,
  J as ChatProviderFactory,
  O as ChatProviderUtils,
  q as ChatService,
  F as ClaudeChatProvider,
  $ as ClaudeToolHandler,
  L as OllamaChatProvider,
  E as OllamaToolHandler,
  D as OpenAIChatProvider,
  N as OpenAIToolHandler,
  R as ProviderType,
  X as TokenAccumulator
};
