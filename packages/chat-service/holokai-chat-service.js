var Ko = Object.defineProperty;
var Yo = (t, e, n) => e in t ? Ko(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var w = (t, e, n) => Yo(t, typeof e != "symbol" ? e + "" : e, n);
import { Ollama as Qn } from "ollama/browser";
import Zn, { AzureOpenAI as zo } from "openai";
import Xo from "@anthropic-ai/sdk";
class mt {
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
      const h = {};
      r.thread_id && (h.thread_id = r.thread_id), d && (h.branch_id = d), console.log("[ChatProviderUtils] handleToolLoop - Thread context for iteration", {
        iteration: p,
        threadContext: h
      });
      const m = "setTokenCallback" in e && typeof e.setTokenCallback == "function";
      m ? (console.log("[ChatProviderUtils] handleToolLoop - Setting token callback"), e.setTokenCallback(u)) : console.log("[ChatProviderUtils] handleToolLoop - Handler does not support streaming callback"), console.log("[ChatProviderUtils] handleToolLoop - Making request to handler");
      const g = await e.makeRequest(
        n,
        f,
        i,
        h,
        c
      );
      console.log("[ChatProviderUtils] handleToolLoop - Request completed", {
        iteration: p,
        hasResponse: !!g
      });
      const T = !c || !m;
      if (console.log("[ChatProviderUtils] handleToolLoop - Text content handling", {
        iteration: p,
        shouldSendTextContent: T,
        hasStreamingCallback: m,
        shouldStream: c
      }), T) {
        const E = e.extractTextContent(g);
        console.log("[ChatProviderUtils] handleToolLoop - Extracted text content", {
          iteration: p,
          hasTextContent: !!E,
          textContentLength: (E == null ? void 0 : E.length) || 0,
          textPreview: (E == null ? void 0 : E.substring(0, 100)) + "...",
          willCallOnTokenReceived: !!(E && u)
        }), E && u && u(E);
      }
      console.log("[ChatProviderUtils] handleToolLoop - Extracting tool uses");
      const y = e.extractToolUses(g);
      console.log("[ChatProviderUtils] handleToolLoop - Tool uses extracted", {
        iteration: p,
        toolUsesCount: y.length,
        toolUses: y.map((E) => ({ id: E.id, name: E.name, inputKeys: Object.keys(E.input) }))
      });
      const C = g.stop_reason;
      if (C === "tool_use" && y.length === 0 && (console.warn('[ChatProviderUtils] handleToolLoop - MISMATCH: stop_reason="tool_use" but no tool_use blocks found in content', {
        iteration: p,
        stopReason: C,
        responseId: g.id,
        contentBlocks: g.content
      }), console.warn("[ChatProviderUtils] handleToolLoop - This may indicate a proxy is modifying Claude responses")), y.length === 0) {
        console.log("[ChatProviderUtils] handleToolLoop - No tool uses found, ending loop", {
          iteration: p,
          stopReason: C
        });
        return;
      }
      console.log("[ChatProviderUtils] handleToolLoop - Executing tools", {
        iteration: p,
        toolUsesCount: y.length
      });
      const S = [];
      for (const E of y) {
        console.log("[ChatProviderUtils] handleToolLoop - Executing tool", {
          iteration: p,
          toolId: E.id,
          toolName: E.name,
          inputKeys: Object.keys(E.input)
        });
        const _ = await a(E);
        console.log("[ChatProviderUtils] handleToolLoop - Tool execution completed", {
          iteration: p,
          toolId: E.id,
          toolName: E.name,
          resultSuccess: _ == null ? void 0 : _.success,
          hasResultData: !!(_ != null && _.data),
          hasResultError: !!(_ != null && _.error)
        }), S.push(_);
      }
      console.log("[ChatProviderUtils] handleToolLoop - All tools executed", {
        iteration: p,
        toolResultsCount: S.length
      }), console.log("[ChatProviderUtils] handleToolLoop - Formatting tool results");
      const I = e.formatToolResults(y, S);
      console.log("[ChatProviderUtils] handleToolLoop - Appending messages"), f = e.appendMessages(f, g, I), console.log("[ChatProviderUtils] handleToolLoop - Iteration complete, continuing loop", {
        iteration: p,
        newMessagesCount: f.length
      });
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
class Qo {
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
    return console.log("[OllamaToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: n.length
    }), e.map((o, i) => ({
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
    var o;
    if (console.log("[OllamaToolHandler] extractToolCalls", {
      hasMessage: !!e,
      hasToolCalls: !!(e != null && e.tool_calls),
      isArray: Array.isArray(e == null ? void 0 : e.tool_calls),
      toolCallsLength: ((o = e == null ? void 0 : e.tool_calls) == null ? void 0 : o.length) || 0,
      messageKeys: e ? Object.keys(e) : []
    }), !(e != null && e.tool_calls) || !Array.isArray(e.tool_calls))
      return [];
    const n = e.tool_calls.map((i, r) => {
      var a, u;
      return {
        id: i.id || `tool_${r}`,
        name: ((a = i.function) == null ? void 0 : a.name) || i.name || "",
        arguments: ((u = i.function) == null ? void 0 : u.arguments) || i.arguments || {}
      };
    });
    return console.log("[OllamaToolHandler] extractToolCalls result", {
      extractedCount: n.length,
      calls: n.map((i) => ({ id: i.id, name: i.name }))
    }), n;
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
class Zo {
  constructor(e, n, o) {
    w(this, "ollama");
    w(this, "defaultModel");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "toolHandler");
    this.ollama = new Qn({ host: e, headers: {
      "X-api-key": n
    } }), this.defaultModel = o, console.log(`OllamaChatProvider initialized with endpoint ${e} and model ${o}`);
  }
  setTools(e = [], n) {
    this.tools = e, this.onToolUse = n, this.toolHandler = new Qo(this.ollama);
  }
  /**
   * Send a chat request to Ollama
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    var a, u;
    if (console.log("[OllamaChatProvider] chat called", {
      hasThreadId: !!e.thread_id,
      thread_id: e.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, n);
      return;
    }
    const o = e.model || this.defaultModel, i = { ...e, model: o }, r = mt.toOllamaRequest(i);
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
    const o = e.model || this.defaultModel, i = { ...e, model: o }, r = mt.toOllamaRequest(i), a = this.convertToolsToOllamaFormat(this.tools);
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
class gt {
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
  static toOpenAIRequest(e, n) {
    if (e) {
      let o;
      if (n.system) {
        const r = n.messages.filter((a) => a.role !== "system");
        o = [
          { role: "system", content: n.system },
          ...r.map((a) => this.mapMessage(a))
        ];
      } else
        o = n.messages.map((r) => this.mapMessage(r));
      const i = {
        model: n.model,
        input: o,
        // Responses API uses 'input' not 'messages'
        stream: n.streaming !== !1
      };
      return n.maxTokens !== void 0 && (i.max_completion_tokens = n.maxTokens), n.thread_id !== void 0 && (i.thread_id = n.thread_id), n.branch_id !== void 0 && (i.branch_id = n.branch_id), i;
    } else {
      let o;
      if (n.system) {
        const r = n.messages.filter((a) => a.role !== "system");
        o = [
          { role: "system", content: n.system },
          ...r.map((a) => this.mapMessage(a))
        ];
      } else
        o = n.messages.map((r) => this.mapMessage(r));
      const i = {
        model: n.model,
        messages: o,
        stream: n.streaming !== !1
      };
      return n.temperature !== void 0 && (i.temperature = n.temperature), n.maxTokens !== void 0 && (i.max_completion_tokens = n.maxTokens), n.topP !== void 0 && (i.top_p = n.topP), n.frequencyPenalty !== void 0 && (i.frequency_penalty = n.frequencyPenalty), n.presencePenalty !== void 0 && (i.presence_penalty = n.presencePenalty), n.stop !== void 0 && (i.stop = n.stop), n.responseFormat !== void 0 && (i.response_format = n.responseFormat), n.thread_id !== void 0 && (i.thread_id = n.thread_id), n.branch_id !== void 0 && (i.branch_id = n.branch_id), n.responseFormat !== void 0 && (i.response_format = {
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
class jo {
  constructor(e) {
    w(this, "onTokenReceived");
    this.client = e;
  }
  /**
   * Set the token callback for streaming responses
   */
  setTokenCallback(e) {
    this.onTokenReceived = e;
  }
  async makeRequest(e, n, o, i, r) {
    return console.log("[OpenAIToolHandler] makeRequest called", {
      model: e,
      shouldStream: r,
      toolsCount: o.length,
      messagesCount: n.length,
      threadContext: i
    }), r ? (console.log("[OpenAIToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, n, o, i)) : (console.log("[OpenAIToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, n, o, i));
  }
  extractToolUses(e) {
    var o, i, r, a, u, c, d;
    const n = e.choices[0];
    if (console.log("[OpenAIToolHandler] extractToolUses", {
      hasChoice: !!n,
      finishReason: n == null ? void 0 : n.finish_reason,
      hasToolCalls: !!((o = n == null ? void 0 : n.message) != null && o.tool_calls),
      toolCallsCount: ((r = (i = n == null ? void 0 : n.message) == null ? void 0 : i.tool_calls) == null ? void 0 : r.length) || 0,
      hasFunctionCall: !!((a = n == null ? void 0 : n.message) != null && a.function_call)
    }), (n == null ? void 0 : n.finish_reason) === "tool_calls" || (u = n == null ? void 0 : n.message) != null && u.tool_calls) {
      const f = (c = n == null ? void 0 : n.message) == null ? void 0 : c.tool_calls;
      if (f && f.length > 0) {
        const p = f.map((h) => ({
          id: h.id,
          name: h.function.name,
          input: this.parseToolArguments(h.function.arguments)
        }));
        return console.log("[OpenAIToolHandler] Extracted tool uses (tool_calls format)", {
          count: p.length,
          tools: p.map((h) => ({ id: h.id, name: h.name }))
        }), p;
      }
    }
    if ((n == null ? void 0 : n.finish_reason) === "function_call") {
      const f = (d = n == null ? void 0 : n.message) == null ? void 0 : d.function_call;
      if (f) {
        const p = {
          id: `call_${Date.now()}`,
          name: f.name,
          input: this.parseToolArguments(f.arguments || "{}")
        };
        return console.log("[OpenAIToolHandler] Extracted tool use (function_call format)", {
          id: p.id,
          name: p.name
        }), [p];
      }
    }
    return console.log("[OpenAIToolHandler] No tool uses found"), [];
  }
  extractTextContent(e) {
    var o, i;
    const n = (i = (o = e.choices[0]) == null ? void 0 : o.message) == null ? void 0 : i.content;
    return console.log("[OpenAIToolHandler] extractTextContent", {
      hasContent: !!n,
      contentLength: (n == null ? void 0 : n.length) || 0
    }), n || null;
  }
  formatToolResults(e, n) {
    return console.log("[OpenAIToolHandler] formatToolResults", {
      toolUsesCount: e.length,
      resultsCount: n.length
    }), e.map((o, i) => ({
      role: "tool",
      tool_call_id: o.id,
      content: JSON.stringify(n[i])
    }));
  }
  appendMessages(e, n, o) {
    var a;
    console.log("[OpenAIToolHandler] appendMessages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length,
      hasResponseMessage: !!((a = n.choices[0]) != null && a.message)
    });
    const i = {
      role: "assistant",
      content: n.choices[0].message.content,
      tool_calls: n.choices[0].message.tool_calls
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
  async makeStreamingRequest(e, n, o, i) {
    var r, a, u, c;
    console.log("[OpenAIToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: n.length,
      toolsCount: o.length,
      threadContext: i
    });
    try {
      const d = Date.now(), f = await this.client.chat.completions.create({
        ...i,
        model: e,
        messages: n,
        tools: o,
        stream: !0
      });
      console.log("[OpenAIToolHandler] Stream received, processing chunks");
      let p = "", h = [], m = null, g = 0;
      for await (const y of f) {
        g++;
        const C = y.choices[0], S = C == null ? void 0 : C.delta;
        if (S != null && S.content && (p += S.content, this.onTokenReceived && this.onTokenReceived(S.content)), S != null && S.tool_calls)
          for (const I of S.tool_calls) {
            const E = I.index;
            h[E] ? (I.id && (h[E].id += I.id), (u = I.function) != null && u.name && (h[E].function.name += I.function.name), (c = I.function) != null && c.arguments && (h[E].function.arguments += I.function.arguments)) : h[E] = {
              id: I.id || "",
              type: "function",
              function: {
                name: ((r = I.function) == null ? void 0 : r.name) || "",
                arguments: ((a = I.function) == null ? void 0 : a.arguments) || ""
              }
            };
          }
        C != null && C.finish_reason && (m = C.finish_reason);
      }
      const T = Date.now() - d;
      return console.log("[OpenAIToolHandler] makeStreamingRequest complete", {
        duration: `${T}ms`,
        chunkCount: g,
        accumulatedContentLength: p.length,
        toolCallsCount: h.length,
        finishReason: m
      }), {
        choices: [
          {
            finish_reason: m || "stop",
            message: {
              role: "assistant",
              content: p || null,
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
  async makeNonStreamingRequest(e, n, o, i) {
    var r, a, u, c, d, f, p, h, m, g, T, y, C;
    console.log("[OpenAIToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: n.length,
      toolsCount: o.length,
      threadContext: i
    });
    try {
      const S = Date.now(), I = await this.client.chat.completions.create({
        ...i,
        model: e,
        messages: n,
        tools: o,
        stream: !1
      }), E = Date.now() - S;
      return console.log("[OpenAIToolHandler] makeNonStreamingRequest response received", {
        duration: `${E}ms`,
        hasResponse: !!I,
        hasChoices: !!I.choices,
        choicesCount: ((r = I.choices) == null ? void 0 : r.length) || 0,
        finishReason: (u = (a = I.choices) == null ? void 0 : a[0]) == null ? void 0 : u.finish_reason,
        hasContent: !!((f = (d = (c = I.choices) == null ? void 0 : c[0]) == null ? void 0 : d.message) != null && f.content),
        hasToolCalls: !!((m = (h = (p = I.choices) == null ? void 0 : p[0]) == null ? void 0 : h.message) != null && m.tool_calls),
        toolCallsCount: ((C = (y = (T = (g = I.choices) == null ? void 0 : g[0]) == null ? void 0 : T.message) == null ? void 0 : y.tool_calls) == null ? void 0 : C.length) || 0
      }), I;
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
      const n = JSON.parse(e);
      return n && typeof n == "object" && !Array.isArray(n) ? n : {};
    } catch (n) {
      return console.warn("[OpenAIToolHandler] Failed to parse tool arguments", { error: n, raw: e }), {};
    }
  }
}
class jn {
  constructor(e, n, o) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "toolHandler");
    w(this, "endpointType", "CHAT");
    this.client = new Zn({ apiKey: n, baseURL: e, dangerouslyAllowBrowser: !0 }), this.defaultModel = o || "gpt-5.2-chat-latest", console.log(`OpenAIChatProvider initialized url: ${e} with model ${this.defaultModel}`);
  }
  setTools(e = [], n) {
    this.tools = e, this.onToolUse = n, this.toolHandler = new jo(this.client);
  }
  /**
   * Determines the appropriate endpoint type based on the model name
   * @param modelName - The OpenAI model name
   * @returns The endpoint type (CHAT or RESPONSE)
   */
  getEndpointType(e) {
    const n = e.toLowerCase();
    return n.includes("-chat") || n.startsWith("gpt-4") || n.startsWith("gpt-3.5") || n.startsWith("chatgpt") ? "CHAT" : (n.includes("-pro") || n.includes("-reasoning") || n.startsWith("gpt-5") && !n.includes("-chat") || n.startsWith("o"), "RESPONSE");
  }
  /**
   * Send a chat request to OpenAI
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    var a, u, c, d;
    this.endpointType = this.getEndpointType(e.model);
    const o = this.endpointType === "RESPONSE";
    if (console.log("[OpenAIChatProvider] chat called", {
      chatOrResponse: this.endpointType,
      hasThreadId: !!e.thread_id,
      thread_id: e.thread_id,
      branch_id: e.branch_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, n);
      return;
    }
    const i = e.model || this.defaultModel, r = gt.toOpenAIRequest(o, { ...e, model: i });
    try {
      if (e.streaming !== !1)
        if (o) {
          const f = await this.client.responses.create(r);
          for await (const p of f) {
            if (p.type === "text_delta") {
              p.text && n && n(p.text);
              continue;
            }
            if (p.type === "done") {
              console.log("[OpenAIChatProvider] Response stream completed");
              break;
            }
            const h = p.event || p;
            if (h.type === "response.content_part.added") {
              const m = h.part;
              (m == null ? void 0 : m.type) === "output_text" && m.text && n && n(m.text);
            } else if (h.type === "response.output_text.delta")
              h.delta && n && n(h.delta);
            else if (h.type === "response.content_part.delta") {
              const m = h.delta;
              m != null && m.text && n && n(m.text);
            } else if (h.type === "response.output_item.done") {
              const m = h.item;
              if ((m == null ? void 0 : m.type) === "message" && m.content && Array.isArray(m.content))
                for (const g of m.content)
                  g.type === "output_text" && g.text && n && n(g.text);
            }
          }
        } else {
          const f = await this.client.chat.completions.create(r);
          for await (const p of f) {
            const h = ((u = (a = p.choices[0]) == null ? void 0 : a.delta) == null ? void 0 : u.content) || "";
            h && n && n(h);
          }
        }
      else if (o) {
        const p = (await this.client.responses.create(r)).output_text;
        p && n && n(p);
      } else {
        const p = ((d = (c = (await this.client.chat.completions.create(r)).choices[0]) == null ? void 0 : c.message) == null ? void 0 : d.content) || "";
        p && n && n(p);
      }
    } catch (f) {
      throw console.error("Error in OpenAI API call:", f), f;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, n) {
    this.endpointType = this.getEndpointType(e.model);
    const o = this.endpointType === "RESPONSE";
    if (console.log("[OpenAIChatProvider] chatWithTools called", {
      hasToolHandler: !!this.toolHandler,
      hasOnToolUse: !!this.onToolUse,
      toolsCount: this.tools.length
    }), !this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const i = e.model || this.defaultModel, r = gt.toOpenAIRequest(o, { ...e, model: i }), a = this.convertToolsToOpenAIFormat(this.tools);
    console.log("[OpenAIChatProvider] Converted request", {
      model: r.model,
      messagesCount: r.messages.length,
      toolsCount: a.length,
      shouldStream: e.streaming !== !1
    });
    try {
      console.log("[OpenAIChatProvider] Calling ChatProviderUtils.handleToolLoop"), await Z.handleToolLoop(
        this.toolHandler,
        r.model,
        r.messages,
        a,
        e,
        this.onToolUse,
        n,
        e.streaming !== !1
      ), console.log("[OpenAIChatProvider] handleToolLoop completed");
    } catch (u) {
      throw console.error("[OpenAIChatProvider] Tool-enabled chat failed:", u), u;
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
class yt {
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
class ei {
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
    return console.log("[ClaudeToolHandler] makeRequest called", {
      model: e,
      shouldStream: r,
      toolsCount: o.length,
      messagesCount: n.length,
      threadContext: i,
      tools: o.map((a) => {
        var u;
        return {
          name: a.name,
          description: ((u = a.description) == null ? void 0 : u.substring(0, 50)) + "..."
        };
      }),
      messages: n.map((a) => ({
        role: a.role,
        contentType: Array.isArray(a.content) ? "array" : typeof a.content,
        contentPreview: Array.isArray(a.content) ? `[${a.content.length} blocks]` : typeof a.content == "string" ? a.content.substring(0, 50) + "..." : "N/A"
      }))
    }), r ? (console.log("[ClaudeToolHandler] Using streaming mode"), await this.makeStreamingRequest(e, n, o, i)) : (console.log("[ClaudeToolHandler] Using non-streaming mode"), await this.makeNonStreamingRequest(e, n, o, i));
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
    console.log("[ClaudeToolHandler] formatToolResults - Input", {
      toolUsesCount: e.length,
      resultsCount: n.length,
      toolUses: e.map((i) => ({ id: i.id, name: i.name })),
      results: n.map((i) => ({
        success: i == null ? void 0 : i.success,
        hasData: !!(i != null && i.data),
        hasError: !!(i != null && i.error)
      }))
    });
    const o = e.map((i, r) => {
      const a = n[r], u = {
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
  appendMessages(e, n, o) {
    console.log("[ClaudeToolHandler] appendMessages - Input state", {
      currentMessagesCount: e.length,
      currentMessages: e.map((u) => ({
        role: u.role,
        contentType: Array.isArray(u.content) ? "array" : typeof u.content,
        contentLength: Array.isArray(u.content) || typeof u.content == "string" ? u.content.length : "N/A"
      })),
      responseContentBlocks: n.content.length,
      responseContentTypes: n.content.map((u) => u.type),
      toolResultsCount: o.length
    });
    const i = {
      role: "assistant",
      content: n.content
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
          contentTypes: y.content.map((C) => C.type)
        });
      }).on("error", (y) => {
        console.error("[ClaudeToolHandler] Stream error event", {
          error: y,
          errorMessage: y instanceof Error ? y.message : String(y)
        });
      }), console.log("[ClaudeToolHandler] Stream started, waiting for final message");
      const h = 3e4, m = new Promise((y, C) => {
        setTimeout(() => C(new Error(`Stream timeout after ${h}ms`)), h);
      }), g = await Promise.race([
        p.finalMessage(),
        m
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
    console.log("[ClaudeToolHandler] makeNonStreamingRequest calling API", {
      model: e,
      messagesCount: n.length,
      toolsCount: o.length,
      threadContext: i
    });
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
class ti {
  constructor(e, n, o) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "toolHandler");
    this.client = new Xo({
      apiKey: n,
      dangerouslyAllowBrowser: !0
    }), e && (this.client.baseURL = e), this.defaultModel = o || "claude-3-opus-20240229", console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}`);
  }
  setTools(e = [], n) {
    this.tools = e, this.onToolUse = n, this.toolHandler = new ei(this.client);
  }
  /**
   * Send a chat request to Claude
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    if (console.log("[ClaudeChatProvider] chat called", {
      hasThreadId: !!e.thread_id,
      thread_id: e.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, n);
      return;
    }
    const o = e.model || this.defaultModel, i = yt.toClaudeRequest({ ...e, model: o });
    try {
      if (e.streaming !== !1) {
        const r = this.client.messages.stream(i).on("text", (u) => {
          n && n(u);
        });
        console.log("waiting for final message");
        const a = await r.finalMessage();
        console.log(a);
      } else {
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
    const o = e.model || this.defaultModel, i = yt.toClaudeRequest({ ...e, model: o }), r = this.convertToolsToClaudeFormat(this.tools);
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
      hasOnTokenReceived: !!n
    });
    try {
      console.log("[ClaudeChatProvider] Calling ChatProviderUtils.handleToolLoop");
      const u = !1;
      console.log("[ClaudeChatProvider] Using streaming:", u), await Z.handleToolLoop(
        this.toolHandler,
        i.model,
        i.messages,
        r,
        e,
        this.onToolUse,
        n,
        u
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
let ni, oi;
function ii() {
  return {
    geminiUrl: ni,
    vertexUrl: oi
  };
}
function si(t, e, n, o) {
  var i, r;
  if (!(t != null && t.baseUrl)) {
    const a = ii();
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
function v(t, e) {
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
function ri(t, e) {
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
    Je(t, i, r, 0, a);
  }
}
function Je(t, e, n, o, i) {
  if (o >= e.length || typeof t != "object" || t === null)
    return;
  const r = e[o];
  if (r.endsWith("[]")) {
    const a = r.slice(0, -2), u = t;
    if (a in u && Array.isArray(u[a]))
      for (const c of u[a])
        Je(c, e, n, o + 1, i);
  } else if (r === "*") {
    if (typeof t == "object" && t !== null && !Array.isArray(t)) {
      const a = t, u = Object.keys(a).filter((d) => !d.startsWith("_") && !i.has(d)), c = {};
      for (const d of u)
        c[d] = a[d];
      for (const [d, f] of Object.entries(c)) {
        const p = [];
        for (const h of n.slice(o))
          h === "*" ? p.push(d) : p.push(h);
        l(a, p, f);
      }
      for (const d of u)
        delete a[d];
    }
  } else {
    const a = t;
    r in a && Je(a[r], e, n, o + 1, i);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function st(t) {
  if (typeof t != "string")
    throw new Error("fromImageBytes must be a string");
  return t;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function li(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  n != null && l(e, ["operationName"], n);
  const o = s(t, ["resourceName"]);
  return o != null && l(e, ["_url", "resourceName"], o), e;
}
function ai(t) {
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
  return a != null && l(e, ["response"], di(a)), e;
}
function ui(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], ci(a)), e;
}
function di(t) {
  const e = {}, n = s(t, [
    "generatedSamples"
  ]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((a) => fi(a))), l(e, ["generatedVideos"], r);
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
function ci(t) {
  const e = {}, n = s(t, ["videos"]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((a) => pi(a))), l(e, ["generatedVideos"], r);
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
function fi(t) {
  const e = {}, n = s(t, ["video"]);
  return n != null && l(e, ["video"], Ci(n)), e;
}
function pi(t) {
  const e = {}, n = s(t, ["_self"]);
  return n != null && l(e, ["video"], _i(n)), e;
}
function hi(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  return n != null && l(e, ["_url", "operationName"], n), e;
}
function mi(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  return n != null && l(e, ["_url", "operationName"], n), e;
}
function gi(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], yi(a)), e;
}
function yi(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(t, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function eo(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], Ti(a)), e;
}
function Ti(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(t, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function Ci(t) {
  const e = {}, n = s(t, ["uri"]);
  n != null && l(e, ["uri"], n);
  const o = s(t, ["encodedVideo"]);
  o != null && l(e, ["videoBytes"], st(o));
  const i = s(t, ["encoding"]);
  return i != null && l(e, ["mimeType"], i), e;
}
function _i(t) {
  const e = {}, n = s(t, ["gcsUri"]);
  n != null && l(e, ["uri"], n);
  const o = s(t, [
    "bytesBase64Encoded"
  ]);
  o != null && l(e, ["videoBytes"], st(o));
  const i = s(t, ["mimeType"]);
  return i != null && l(e, ["mimeType"], i), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var Tt;
(function(t) {
  t.OUTCOME_UNSPECIFIED = "OUTCOME_UNSPECIFIED", t.OUTCOME_OK = "OUTCOME_OK", t.OUTCOME_FAILED = "OUTCOME_FAILED", t.OUTCOME_DEADLINE_EXCEEDED = "OUTCOME_DEADLINE_EXCEEDED";
})(Tt || (Tt = {}));
var Ct;
(function(t) {
  t.LANGUAGE_UNSPECIFIED = "LANGUAGE_UNSPECIFIED", t.PYTHON = "PYTHON";
})(Ct || (Ct = {}));
var _t;
(function(t) {
  t.SCHEDULING_UNSPECIFIED = "SCHEDULING_UNSPECIFIED", t.SILENT = "SILENT", t.WHEN_IDLE = "WHEN_IDLE", t.INTERRUPT = "INTERRUPT";
})(_t || (_t = {}));
var q;
(function(t) {
  t.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", t.STRING = "STRING", t.NUMBER = "NUMBER", t.INTEGER = "INTEGER", t.BOOLEAN = "BOOLEAN", t.ARRAY = "ARRAY", t.OBJECT = "OBJECT", t.NULL = "NULL";
})(q || (q = {}));
var Et;
(function(t) {
  t.API_SPEC_UNSPECIFIED = "API_SPEC_UNSPECIFIED", t.SIMPLE_SEARCH = "SIMPLE_SEARCH", t.ELASTIC_SEARCH = "ELASTIC_SEARCH";
})(Et || (Et = {}));
var St;
(function(t) {
  t.AUTH_TYPE_UNSPECIFIED = "AUTH_TYPE_UNSPECIFIED", t.NO_AUTH = "NO_AUTH", t.API_KEY_AUTH = "API_KEY_AUTH", t.HTTP_BASIC_AUTH = "HTTP_BASIC_AUTH", t.GOOGLE_SERVICE_ACCOUNT_AUTH = "GOOGLE_SERVICE_ACCOUNT_AUTH", t.OAUTH = "OAUTH", t.OIDC_AUTH = "OIDC_AUTH";
})(St || (St = {}));
var It;
(function(t) {
  t.HTTP_IN_UNSPECIFIED = "HTTP_IN_UNSPECIFIED", t.HTTP_IN_QUERY = "HTTP_IN_QUERY", t.HTTP_IN_HEADER = "HTTP_IN_HEADER", t.HTTP_IN_PATH = "HTTP_IN_PATH", t.HTTP_IN_BODY = "HTTP_IN_BODY", t.HTTP_IN_COOKIE = "HTTP_IN_COOKIE";
})(It || (It = {}));
var vt;
(function(t) {
  t.PHISH_BLOCK_THRESHOLD_UNSPECIFIED = "PHISH_BLOCK_THRESHOLD_UNSPECIFIED", t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_HIGH_AND_ABOVE = "BLOCK_HIGH_AND_ABOVE", t.BLOCK_HIGHER_AND_ABOVE = "BLOCK_HIGHER_AND_ABOVE", t.BLOCK_VERY_HIGH_AND_ABOVE = "BLOCK_VERY_HIGH_AND_ABOVE", t.BLOCK_ONLY_EXTREMELY_HIGH = "BLOCK_ONLY_EXTREMELY_HIGH";
})(vt || (vt = {}));
var At;
(function(t) {
  t.UNSPECIFIED = "UNSPECIFIED", t.BLOCKING = "BLOCKING", t.NON_BLOCKING = "NON_BLOCKING";
})(At || (At = {}));
var Rt;
(function(t) {
  t.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", t.MODE_DYNAMIC = "MODE_DYNAMIC";
})(Rt || (Rt = {}));
var Pt;
(function(t) {
  t.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", t.AUTO = "AUTO", t.ANY = "ANY", t.NONE = "NONE", t.VALIDATED = "VALIDATED";
})(Pt || (Pt = {}));
var wt;
(function(t) {
  t.THINKING_LEVEL_UNSPECIFIED = "THINKING_LEVEL_UNSPECIFIED", t.LOW = "LOW", t.MEDIUM = "MEDIUM", t.HIGH = "HIGH", t.MINIMAL = "MINIMAL";
})(wt || (wt = {}));
var Mt;
(function(t) {
  t.HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED", t.HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT", t.HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH", t.HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT", t.HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT", t.HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY", t.HARM_CATEGORY_IMAGE_HATE = "HARM_CATEGORY_IMAGE_HATE", t.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT = "HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT", t.HARM_CATEGORY_IMAGE_HARASSMENT = "HARM_CATEGORY_IMAGE_HARASSMENT", t.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT = "HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT", t.HARM_CATEGORY_JAILBREAK = "HARM_CATEGORY_JAILBREAK";
})(Mt || (Mt = {}));
var Nt;
(function(t) {
  t.HARM_BLOCK_METHOD_UNSPECIFIED = "HARM_BLOCK_METHOD_UNSPECIFIED", t.SEVERITY = "SEVERITY", t.PROBABILITY = "PROBABILITY";
})(Nt || (Nt = {}));
var xt;
(function(t) {
  t.HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED", t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", t.BLOCK_NONE = "BLOCK_NONE", t.OFF = "OFF";
})(xt || (xt = {}));
var Dt;
(function(t) {
  t.FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED", t.STOP = "STOP", t.MAX_TOKENS = "MAX_TOKENS", t.SAFETY = "SAFETY", t.RECITATION = "RECITATION", t.LANGUAGE = "LANGUAGE", t.OTHER = "OTHER", t.BLOCKLIST = "BLOCKLIST", t.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", t.SPII = "SPII", t.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", t.IMAGE_SAFETY = "IMAGE_SAFETY", t.UNEXPECTED_TOOL_CALL = "UNEXPECTED_TOOL_CALL", t.IMAGE_PROHIBITED_CONTENT = "IMAGE_PROHIBITED_CONTENT", t.NO_IMAGE = "NO_IMAGE", t.IMAGE_RECITATION = "IMAGE_RECITATION", t.IMAGE_OTHER = "IMAGE_OTHER";
})(Dt || (Dt = {}));
var kt;
(function(t) {
  t.HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED", t.NEGLIGIBLE = "NEGLIGIBLE", t.LOW = "LOW", t.MEDIUM = "MEDIUM", t.HIGH = "HIGH";
})(kt || (kt = {}));
var Ut;
(function(t) {
  t.HARM_SEVERITY_UNSPECIFIED = "HARM_SEVERITY_UNSPECIFIED", t.HARM_SEVERITY_NEGLIGIBLE = "HARM_SEVERITY_NEGLIGIBLE", t.HARM_SEVERITY_LOW = "HARM_SEVERITY_LOW", t.HARM_SEVERITY_MEDIUM = "HARM_SEVERITY_MEDIUM", t.HARM_SEVERITY_HIGH = "HARM_SEVERITY_HIGH";
})(Ut || (Ut = {}));
var Lt;
(function(t) {
  t.URL_RETRIEVAL_STATUS_UNSPECIFIED = "URL_RETRIEVAL_STATUS_UNSPECIFIED", t.URL_RETRIEVAL_STATUS_SUCCESS = "URL_RETRIEVAL_STATUS_SUCCESS", t.URL_RETRIEVAL_STATUS_ERROR = "URL_RETRIEVAL_STATUS_ERROR", t.URL_RETRIEVAL_STATUS_PAYWALL = "URL_RETRIEVAL_STATUS_PAYWALL", t.URL_RETRIEVAL_STATUS_UNSAFE = "URL_RETRIEVAL_STATUS_UNSAFE";
})(Lt || (Lt = {}));
var Gt;
(function(t) {
  t.BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED", t.SAFETY = "SAFETY", t.OTHER = "OTHER", t.BLOCKLIST = "BLOCKLIST", t.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", t.IMAGE_SAFETY = "IMAGE_SAFETY", t.MODEL_ARMOR = "MODEL_ARMOR", t.JAILBREAK = "JAILBREAK";
})(Gt || (Gt = {}));
var Ft;
(function(t) {
  t.TRAFFIC_TYPE_UNSPECIFIED = "TRAFFIC_TYPE_UNSPECIFIED", t.ON_DEMAND = "ON_DEMAND", t.PROVISIONED_THROUGHPUT = "PROVISIONED_THROUGHPUT";
})(Ft || (Ft = {}));
var Pe;
(function(t) {
  t.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", t.TEXT = "TEXT", t.IMAGE = "IMAGE", t.AUDIO = "AUDIO";
})(Pe || (Pe = {}));
var Ht;
(function(t) {
  t.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", t.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", t.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", t.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH";
})(Ht || (Ht = {}));
var Vt;
(function(t) {
  t.TUNING_MODE_UNSPECIFIED = "TUNING_MODE_UNSPECIFIED", t.TUNING_MODE_FULL = "TUNING_MODE_FULL", t.TUNING_MODE_PEFT_ADAPTER = "TUNING_MODE_PEFT_ADAPTER";
})(Vt || (Vt = {}));
var bt;
(function(t) {
  t.ADAPTER_SIZE_UNSPECIFIED = "ADAPTER_SIZE_UNSPECIFIED", t.ADAPTER_SIZE_ONE = "ADAPTER_SIZE_ONE", t.ADAPTER_SIZE_TWO = "ADAPTER_SIZE_TWO", t.ADAPTER_SIZE_FOUR = "ADAPTER_SIZE_FOUR", t.ADAPTER_SIZE_EIGHT = "ADAPTER_SIZE_EIGHT", t.ADAPTER_SIZE_SIXTEEN = "ADAPTER_SIZE_SIXTEEN", t.ADAPTER_SIZE_THIRTY_TWO = "ADAPTER_SIZE_THIRTY_TWO";
})(bt || (bt = {}));
var Oe;
(function(t) {
  t.JOB_STATE_UNSPECIFIED = "JOB_STATE_UNSPECIFIED", t.JOB_STATE_QUEUED = "JOB_STATE_QUEUED", t.JOB_STATE_PENDING = "JOB_STATE_PENDING", t.JOB_STATE_RUNNING = "JOB_STATE_RUNNING", t.JOB_STATE_SUCCEEDED = "JOB_STATE_SUCCEEDED", t.JOB_STATE_FAILED = "JOB_STATE_FAILED", t.JOB_STATE_CANCELLING = "JOB_STATE_CANCELLING", t.JOB_STATE_CANCELLED = "JOB_STATE_CANCELLED", t.JOB_STATE_PAUSED = "JOB_STATE_PAUSED", t.JOB_STATE_EXPIRED = "JOB_STATE_EXPIRED", t.JOB_STATE_UPDATING = "JOB_STATE_UPDATING", t.JOB_STATE_PARTIALLY_SUCCEEDED = "JOB_STATE_PARTIALLY_SUCCEEDED";
})(Oe || (Oe = {}));
var qt;
(function(t) {
  t.TUNING_TASK_UNSPECIFIED = "TUNING_TASK_UNSPECIFIED", t.TUNING_TASK_I2V = "TUNING_TASK_I2V", t.TUNING_TASK_T2V = "TUNING_TASK_T2V", t.TUNING_TASK_R2V = "TUNING_TASK_R2V";
})(qt || (qt = {}));
var Bt;
(function(t) {
  t.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", t.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", t.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", t.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH", t.MEDIA_RESOLUTION_ULTRA_HIGH = "MEDIA_RESOLUTION_ULTRA_HIGH";
})(Bt || (Bt = {}));
var $e;
(function(t) {
  t.COLLECTION = "COLLECTION";
})($e || ($e = {}));
var Jt;
(function(t) {
  t.FEATURE_SELECTION_PREFERENCE_UNSPECIFIED = "FEATURE_SELECTION_PREFERENCE_UNSPECIFIED", t.PRIORITIZE_QUALITY = "PRIORITIZE_QUALITY", t.BALANCED = "BALANCED", t.PRIORITIZE_COST = "PRIORITIZE_COST";
})(Jt || (Jt = {}));
var Ot;
(function(t) {
  t.ENVIRONMENT_UNSPECIFIED = "ENVIRONMENT_UNSPECIFIED", t.ENVIRONMENT_BROWSER = "ENVIRONMENT_BROWSER";
})(Ot || (Ot = {}));
var $t;
(function(t) {
  t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", t.BLOCK_NONE = "BLOCK_NONE";
})($t || ($t = {}));
var Wt;
(function(t) {
  t.DONT_ALLOW = "DONT_ALLOW", t.ALLOW_ADULT = "ALLOW_ADULT", t.ALLOW_ALL = "ALLOW_ALL";
})(Wt || (Wt = {}));
var Kt;
(function(t) {
  t.auto = "auto", t.en = "en", t.ja = "ja", t.ko = "ko", t.hi = "hi", t.zh = "zh", t.pt = "pt", t.es = "es";
})(Kt || (Kt = {}));
var Yt;
(function(t) {
  t.MASK_MODE_DEFAULT = "MASK_MODE_DEFAULT", t.MASK_MODE_USER_PROVIDED = "MASK_MODE_USER_PROVIDED", t.MASK_MODE_BACKGROUND = "MASK_MODE_BACKGROUND", t.MASK_MODE_FOREGROUND = "MASK_MODE_FOREGROUND", t.MASK_MODE_SEMANTIC = "MASK_MODE_SEMANTIC";
})(Yt || (Yt = {}));
var zt;
(function(t) {
  t.CONTROL_TYPE_DEFAULT = "CONTROL_TYPE_DEFAULT", t.CONTROL_TYPE_CANNY = "CONTROL_TYPE_CANNY", t.CONTROL_TYPE_SCRIBBLE = "CONTROL_TYPE_SCRIBBLE", t.CONTROL_TYPE_FACE_MESH = "CONTROL_TYPE_FACE_MESH";
})(zt || (zt = {}));
var Xt;
(function(t) {
  t.SUBJECT_TYPE_DEFAULT = "SUBJECT_TYPE_DEFAULT", t.SUBJECT_TYPE_PERSON = "SUBJECT_TYPE_PERSON", t.SUBJECT_TYPE_ANIMAL = "SUBJECT_TYPE_ANIMAL", t.SUBJECT_TYPE_PRODUCT = "SUBJECT_TYPE_PRODUCT";
})(Xt || (Xt = {}));
var Qt;
(function(t) {
  t.EDIT_MODE_DEFAULT = "EDIT_MODE_DEFAULT", t.EDIT_MODE_INPAINT_REMOVAL = "EDIT_MODE_INPAINT_REMOVAL", t.EDIT_MODE_INPAINT_INSERTION = "EDIT_MODE_INPAINT_INSERTION", t.EDIT_MODE_OUTPAINT = "EDIT_MODE_OUTPAINT", t.EDIT_MODE_CONTROLLED_EDITING = "EDIT_MODE_CONTROLLED_EDITING", t.EDIT_MODE_STYLE = "EDIT_MODE_STYLE", t.EDIT_MODE_BGSWAP = "EDIT_MODE_BGSWAP", t.EDIT_MODE_PRODUCT_IMAGE = "EDIT_MODE_PRODUCT_IMAGE";
})(Qt || (Qt = {}));
var Zt;
(function(t) {
  t.FOREGROUND = "FOREGROUND", t.BACKGROUND = "BACKGROUND", t.PROMPT = "PROMPT", t.SEMANTIC = "SEMANTIC", t.INTERACTIVE = "INTERACTIVE";
})(Zt || (Zt = {}));
var jt;
(function(t) {
  t.ASSET = "ASSET", t.STYLE = "STYLE";
})(jt || (jt = {}));
var en;
(function(t) {
  t.INSERT = "INSERT", t.REMOVE = "REMOVE", t.REMOVE_STATIC = "REMOVE_STATIC", t.OUTPAINT = "OUTPAINT";
})(en || (en = {}));
var tn;
(function(t) {
  t.OPTIMIZED = "OPTIMIZED", t.LOSSLESS = "LOSSLESS";
})(tn || (tn = {}));
var nn;
(function(t) {
  t.SUPERVISED_FINE_TUNING = "SUPERVISED_FINE_TUNING", t.PREFERENCE_TUNING = "PREFERENCE_TUNING", t.DISTILLATION = "DISTILLATION";
})(nn || (nn = {}));
var on;
(function(t) {
  t.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", t.STATE_PENDING = "STATE_PENDING", t.STATE_ACTIVE = "STATE_ACTIVE", t.STATE_FAILED = "STATE_FAILED";
})(on || (on = {}));
var sn;
(function(t) {
  t.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", t.PROCESSING = "PROCESSING", t.ACTIVE = "ACTIVE", t.FAILED = "FAILED";
})(sn || (sn = {}));
var rn;
(function(t) {
  t.SOURCE_UNSPECIFIED = "SOURCE_UNSPECIFIED", t.UPLOADED = "UPLOADED", t.GENERATED = "GENERATED", t.REGISTERED = "REGISTERED";
})(rn || (rn = {}));
var ln;
(function(t) {
  t.TURN_COMPLETE_REASON_UNSPECIFIED = "TURN_COMPLETE_REASON_UNSPECIFIED", t.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", t.RESPONSE_REJECTED = "RESPONSE_REJECTED", t.NEED_MORE_INPUT = "NEED_MORE_INPUT";
})(ln || (ln = {}));
var an;
(function(t) {
  t.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", t.TEXT = "TEXT", t.IMAGE = "IMAGE", t.VIDEO = "VIDEO", t.AUDIO = "AUDIO", t.DOCUMENT = "DOCUMENT";
})(an || (an = {}));
var un;
(function(t) {
  t.VAD_SIGNAL_TYPE_UNSPECIFIED = "VAD_SIGNAL_TYPE_UNSPECIFIED", t.VAD_SIGNAL_TYPE_SOS = "VAD_SIGNAL_TYPE_SOS", t.VAD_SIGNAL_TYPE_EOS = "VAD_SIGNAL_TYPE_EOS";
})(un || (un = {}));
var dn;
(function(t) {
  t.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", t.ACTIVITY_START = "ACTIVITY_START", t.ACTIVITY_END = "ACTIVITY_END";
})(dn || (dn = {}));
var cn;
(function(t) {
  t.START_SENSITIVITY_UNSPECIFIED = "START_SENSITIVITY_UNSPECIFIED", t.START_SENSITIVITY_HIGH = "START_SENSITIVITY_HIGH", t.START_SENSITIVITY_LOW = "START_SENSITIVITY_LOW";
})(cn || (cn = {}));
var fn;
(function(t) {
  t.END_SENSITIVITY_UNSPECIFIED = "END_SENSITIVITY_UNSPECIFIED", t.END_SENSITIVITY_HIGH = "END_SENSITIVITY_HIGH", t.END_SENSITIVITY_LOW = "END_SENSITIVITY_LOW";
})(fn || (fn = {}));
var pn;
(function(t) {
  t.ACTIVITY_HANDLING_UNSPECIFIED = "ACTIVITY_HANDLING_UNSPECIFIED", t.START_OF_ACTIVITY_INTERRUPTS = "START_OF_ACTIVITY_INTERRUPTS", t.NO_INTERRUPTION = "NO_INTERRUPTION";
})(pn || (pn = {}));
var hn;
(function(t) {
  t.TURN_COVERAGE_UNSPECIFIED = "TURN_COVERAGE_UNSPECIFIED", t.TURN_INCLUDES_ONLY_ACTIVITY = "TURN_INCLUDES_ONLY_ACTIVITY", t.TURN_INCLUDES_ALL_INPUT = "TURN_INCLUDES_ALL_INPUT";
})(hn || (hn = {}));
var mn;
(function(t) {
  t.SCALE_UNSPECIFIED = "SCALE_UNSPECIFIED", t.C_MAJOR_A_MINOR = "C_MAJOR_A_MINOR", t.D_FLAT_MAJOR_B_FLAT_MINOR = "D_FLAT_MAJOR_B_FLAT_MINOR", t.D_MAJOR_B_MINOR = "D_MAJOR_B_MINOR", t.E_FLAT_MAJOR_C_MINOR = "E_FLAT_MAJOR_C_MINOR", t.E_MAJOR_D_FLAT_MINOR = "E_MAJOR_D_FLAT_MINOR", t.F_MAJOR_D_MINOR = "F_MAJOR_D_MINOR", t.G_FLAT_MAJOR_E_FLAT_MINOR = "G_FLAT_MAJOR_E_FLAT_MINOR", t.G_MAJOR_E_MINOR = "G_MAJOR_E_MINOR", t.A_FLAT_MAJOR_F_MINOR = "A_FLAT_MAJOR_F_MINOR", t.A_MAJOR_G_FLAT_MINOR = "A_MAJOR_G_FLAT_MINOR", t.B_FLAT_MAJOR_G_MINOR = "B_FLAT_MAJOR_G_MINOR", t.B_MAJOR_A_FLAT_MINOR = "B_MAJOR_A_FLAT_MINOR";
})(mn || (mn = {}));
var gn;
(function(t) {
  t.MUSIC_GENERATION_MODE_UNSPECIFIED = "MUSIC_GENERATION_MODE_UNSPECIFIED", t.QUALITY = "QUALITY", t.DIVERSITY = "DIVERSITY", t.VOCALIZATION = "VOCALIZATION";
})(gn || (gn = {}));
var re;
(function(t) {
  t.PLAYBACK_CONTROL_UNSPECIFIED = "PLAYBACK_CONTROL_UNSPECIFIED", t.PLAY = "PLAY", t.PAUSE = "PAUSE", t.STOP = "STOP", t.RESET_CONTEXT = "RESET_CONTEXT";
})(re || (re = {}));
class We {
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
    for (const h of (c = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) !== null && c !== void 0 ? c : []) {
      for (const [m, g] of Object.entries(h))
        m !== "text" && m !== "thought" && m !== "thoughtSignature" && (g !== null || g !== void 0) && p.push(m);
      if (typeof h.text == "string") {
        if (typeof h.thought == "boolean" && h.thought)
          continue;
        f = !0, d += h.text;
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
      for (const [h, m] of Object.entries(p))
        h !== "inlineData" && (m !== null || m !== void 0) && f.push(h);
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
class yn {
}
class Tn {
}
class Ei {
}
class Si {
}
class Ii {
}
class vi {
}
class Cn {
}
class _n {
}
class En {
}
class Ai {
}
class we {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new we();
    let i;
    const r = e;
    return n ? i = ui(r) : i = ai(r), Object.assign(o, i), o;
  }
}
class Sn {
}
class In {
}
class vn {
}
class An {
}
class Ri {
}
class Pi {
}
class wi {
}
class rt {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new rt(), r = gi(e);
    return Object.assign(o, r), o;
  }
}
class Mi {
}
class Ni {
}
class xi {
}
class Di {
}
class Rn {
}
class ki {
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
class Ui {
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
class lt {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new lt(), r = eo(e);
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
function to(t, e) {
  const n = D(t, e);
  return n ? n.startsWith("publishers/") && t.isVertexAI() ? `projects/${t.getProject()}/locations/${t.getLocation()}/${n}` : n.startsWith("models/") && t.isVertexAI() ? `projects/${t.getProject()}/locations/${t.getLocation()}/publishers/google/${n}` : n : "";
}
function no(t) {
  return Array.isArray(t) ? t.map((e) => Me(e)) : [Me(t)];
}
function Me(t) {
  if (typeof t == "object" && t !== null)
    return t;
  throw new Error(`Could not parse input as Blob. Unsupported blob type: ${typeof t}`);
}
function oo(t) {
  const e = Me(t);
  if (e.mimeType && e.mimeType.startsWith("image/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function io(t) {
  const e = Me(t);
  if (e.mimeType && e.mimeType.startsWith("audio/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function Pn(t) {
  if (t == null)
    throw new Error("PartUnion is required");
  if (typeof t == "object")
    return t;
  if (typeof t == "string")
    return { text: t };
  throw new Error(`Unsupported part type: ${typeof t}`);
}
function so(t) {
  if (t == null || Array.isArray(t) && t.length === 0)
    throw new Error("PartListUnion is required");
  return Array.isArray(t) ? t.map((e) => Pn(e)) : [Pn(t)];
}
function Ke(t) {
  return t != null && typeof t == "object" && "parts" in t && Array.isArray(t.parts);
}
function wn(t) {
  return t != null && typeof t == "object" && "functionCall" in t;
}
function Mn(t) {
  return t != null && typeof t == "object" && "functionResponse" in t;
}
function H(t) {
  if (t == null)
    throw new Error("ContentUnion is required");
  return Ke(t) ? t : {
    role: "user",
    parts: so(t)
  };
}
function at(t, e) {
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
    if (wn(t) || Mn(t))
      throw new Error("To specify functionCall or functionResponse parts, please wrap them in a Content object, specifying the role for them");
    return [H(t)];
  }
  const e = [], n = [], o = Ke(t[0]);
  for (const i of t) {
    const r = Ke(i);
    if (r != o)
      throw new Error("Mixing Content and Parts is not supported, please group the parts into a the appropriate Content objects and specify the roles for them");
    if (r)
      e.push(i);
    else {
      if (wn(i) || Mn(i))
        throw new Error("To specify functionCall or functionResponse parts, please wrap them, and any other parts, in Content objects as appropriate, specifying the role for them");
      n.push(i);
    }
  }
  return o || e.push({ role: "user", parts: so(n) }), e;
}
function Li(t, e) {
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
function ae(t) {
  const e = {}, n = ["items"], o = ["anyOf"], i = ["properties"];
  if (t.type && t.anyOf)
    throw new Error("type and anyOf cannot be both populated.");
  const r = t.anyOf;
  r != null && r.length == 2 && (r[0].type === "null" ? (e.nullable = !0, t = r[1]) : r[1].type === "null" && (e.nullable = !0, t = r[0])), t.type instanceof Array && Li(t.type, e);
  for (const [a, u] of Object.entries(t))
    if (u != null)
      if (a == "type") {
        if (u === "null")
          throw new Error("type: null can not be the only possible type for the field.");
        if (u instanceof Array)
          continue;
        e.type = Object.values(q).includes(u.toUpperCase()) ? u.toUpperCase() : q.TYPE_UNSPECIFIED;
      } else if (n.includes(a))
        e[a] = ae(u);
      else if (o.includes(a)) {
        const c = [];
        for (const d of u) {
          if (d.type == "null") {
            e.nullable = !0;
            continue;
          }
          c.push(ae(d));
        }
        e[a] = c;
      } else if (i.includes(a)) {
        const c = {};
        for (const [d, f] of Object.entries(u))
          c[d] = ae(f);
        e[a] = c;
      } else {
        if (a === "additionalProperties")
          continue;
        e[a] = u;
      }
  return e;
}
function ut(t) {
  return ae(t);
}
function dt(t) {
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
function ct(t) {
  if ("multiSpeakerVoiceConfig" in t)
    throw new Error("multiSpeakerVoiceConfig is not supported in the live API.");
  return t;
}
function de(t) {
  if (t.functionDeclarations)
    for (const e of t.functionDeclarations)
      e.parameters && (Object.keys(e.parameters).includes("$schema") ? e.parametersJsonSchema || (e.parametersJsonSchema = e.parameters, delete e.parameters) : e.parameters = ae(e.parameters)), e.response && (Object.keys(e.response).includes("$schema") ? e.responseJsonSchema || (e.responseJsonSchema = e.response, delete e.response) : e.response = ae(e.response));
  return t;
}
function ce(t) {
  if (t == null)
    throw new Error("tools is required");
  if (!Array.isArray(t))
    throw new Error("tools is required and must be an array of Tools");
  const e = [];
  for (const n of t)
    e.push(n);
  return e;
}
function Gi(t, e, n, o = 1) {
  const i = !e.startsWith(`${n}/`) && e.split("/").length === o;
  return t.isVertexAI() ? e.startsWith("projects/") ? e : e.startsWith("locations/") ? `projects/${t.getProject()}/${e}` : e.startsWith(`${n}/`) ? `projects/${t.getProject()}/locations/${t.getLocation()}/${e}` : i ? `projects/${t.getProject()}/locations/${t.getLocation()}/${n}/${e}` : e : i ? `${n}/${e}` : e;
}
function Q(t, e) {
  if (typeof e != "string")
    throw new Error("name must be a string");
  return Gi(t, e, "cachedContents");
}
function ro(t) {
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
  return st(t);
}
function Fi(t) {
  return t != null && typeof t == "object" && "name" in t;
}
function Hi(t) {
  return t != null && typeof t == "object" && "video" in t;
}
function Vi(t) {
  return t != null && typeof t == "object" && "uri" in t;
}
function lo(t) {
  var e;
  let n;
  if (Fi(t) && (n = t.name), !(Vi(t) && (n = t.uri, n === void 0)) && !(Hi(t) && (n = (e = t.video) === null || e === void 0 ? void 0 : e.uri, n === void 0))) {
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
function ao(t, e) {
  let n;
  return t.isVertexAI() ? n = e ? "publishers/google/models" : "models" : n = e ? "models" : "tunedModels", n;
}
function uo(t) {
  for (const e of ["models", "tunedModels", "publisherModels"])
    if (bi(t, e))
      return t[e];
  return [];
}
function bi(t, e) {
  return t !== null && typeof t == "object" && e in t;
}
function qi(t, e = {}) {
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
function Bi(t, e = {}) {
  const n = [], o = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = i.name;
    if (o.has(r))
      throw new Error(`Duplicate function name ${r} found in MCP tools. Please ensure function names are unique.`);
    o.add(r);
    const a = qi(i, e);
    a.functionDeclarations && n.push(...a.functionDeclarations);
  }
  return { functionDeclarations: n };
}
function co(t, e) {
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
function Ji(t) {
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
function fo(t) {
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
function fe(t, e) {
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
function po(t) {
  const e = t;
  return e === "BATCH_STATE_UNSPECIFIED" ? "JOB_STATE_UNSPECIFIED" : e === "BATCH_STATE_PENDING" ? "JOB_STATE_PENDING" : e === "BATCH_STATE_RUNNING" ? "JOB_STATE_RUNNING" : e === "BATCH_STATE_SUCCEEDED" ? "JOB_STATE_SUCCEEDED" : e === "BATCH_STATE_FAILED" ? "JOB_STATE_FAILED" : e === "BATCH_STATE_CANCELLED" ? "JOB_STATE_CANCELLED" : e === "BATCH_STATE_EXPIRED" ? "JOB_STATE_EXPIRED" : e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Oi(t) {
  const e = {}, n = s(t, ["responsesFile"]);
  n != null && l(e, ["fileName"], n);
  const o = s(t, [
    "inlinedResponses",
    "inlinedResponses"
  ]);
  if (o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => vs(a))), l(e, ["inlinedResponses"], r);
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
function $i(t) {
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
function Wi(t) {
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
function ve(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, [
    "metadata",
    "displayName"
  ]);
  o != null && l(e, ["displayName"], o);
  const i = s(t, ["metadata", "state"]);
  i != null && l(e, ["state"], po(i));
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
  return d != null && l(e, ["dest"], Oi(fo(d))), e;
}
function Ye(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["displayName"]);
  o != null && l(e, ["displayName"], o);
  const i = s(t, ["state"]);
  i != null && l(e, ["state"], po(i));
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
  p != null && l(e, ["src"], Ki(p));
  const h = s(t, ["outputConfig"]);
  h != null && l(e, ["dest"], $i(fo(h)));
  const m = s(t, [
    "completionStats"
  ]);
  return m != null && l(e, ["completionStats"], m), e;
}
function Ki(t) {
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
function Yi(t, e) {
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
    Array.isArray(r) && (r = r.map((a) => Is(t, a))), l(n, ["requests", "requests"], r);
  }
  return n;
}
function zi(t) {
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
function Xi(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && l(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Qi(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function Zi(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function ji(t) {
  const e = {}, n = s(t, ["content"]);
  n != null && l(e, ["content"], n);
  const o = s(t, [
    "citationMetadata"
  ]);
  o != null && l(e, ["citationMetadata"], es(o));
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
    let h = f;
    Array.isArray(h) && (h = h.map((m) => m)), l(e, ["safetyRatings"], h);
  }
  const p = s(t, [
    "urlContextMetadata"
  ]);
  return p != null && l(e, ["urlContextMetadata"], p), e;
}
function es(t) {
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
    Array.isArray(i) && (i = i.map((r) => xs(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function ts(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  if (e !== void 0 && o != null && l(e, ["batch", "displayName"], o), s(t, ["dest"]) !== void 0)
    throw new Error("dest parameter is not supported in Gemini API.");
  return n;
}
function ns(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  e !== void 0 && o != null && l(e, ["displayName"], o);
  const i = s(t, ["dest"]);
  return e !== void 0 && i != null && l(e, ["outputConfig"], Wi(Ji(i))), n;
}
function Nn(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["_url", "model"], D(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["batch", "inputConfig"], Yi(t, co(t, i)));
  const r = s(e, ["config"]);
  return r != null && ts(r, n), n;
}
function os(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], D(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["inputConfig"], zi(co(t, i)));
  const r = s(e, ["config"]);
  return r != null && ns(r, n), n;
}
function is(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  return e !== void 0 && o != null && l(e, ["batch", "displayName"], o), n;
}
function ss(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["_url", "model"], D(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["batch", "inputConfig"], fs(t, i));
  const r = s(e, ["config"]);
  return r != null && is(r, n), n;
}
function rs(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function ls(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function as(t) {
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
function us(t) {
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
function ds(t, e) {
  const n = {}, o = s(e, ["contents"]);
  if (o != null) {
    let r = at(t, o);
    Array.isArray(r) && (r = r.map((a) => a)), l(n, ["requests[]", "request", "content"], r);
  }
  const i = s(e, ["config"]);
  return i != null && (l(n, ["_self"], cs(i, n)), ri(n, { "requests[].*": "requests[].request.*" })), n;
}
function cs(t, e) {
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
function fs(t, e) {
  const n = {}, o = s(e, ["fileName"]);
  o != null && l(n, ["file_name"], o);
  const i = s(e, [
    "inlinedRequests"
  ]);
  return i != null && l(n, ["requests"], ds(t, i)), n;
}
function ps(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function hs(t) {
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
function ms(t) {
  const e = {}, n = s(t, [
    "allowedFunctionNames"
  ]);
  n != null && l(e, ["allowedFunctionNames"], n);
  const o = s(t, ["mode"]);
  if (o != null && l(e, ["mode"], o), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return e;
}
function gs(t, e, n) {
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
  const h = s(e, ["logprobs"]);
  h != null && l(o, ["logprobs"], h);
  const m = s(e, [
    "presencePenalty"
  ]);
  m != null && l(o, ["presencePenalty"], m);
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
  const C = s(e, [
    "responseSchema"
  ]);
  C != null && l(o, ["responseSchema"], ut(C));
  const S = s(e, [
    "responseJsonSchema"
  ]);
  if (S != null && l(o, ["responseJsonSchema"], S), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const I = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && I != null) {
    let U = I;
    Array.isArray(U) && (U = U.map((L) => Ds(L))), l(n, ["safetySettings"], U);
  }
  const E = s(e, ["tools"]);
  if (n !== void 0 && E != null) {
    let U = ce(E);
    Array.isArray(U) && (U = U.map((L) => Us(de(L)))), l(n, ["tools"], U);
  }
  const _ = s(e, ["toolConfig"]);
  if (n !== void 0 && _ != null && l(n, ["toolConfig"], ks(_)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const A = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && A != null && l(n, ["cachedContent"], Q(t, A));
  const P = s(e, [
    "responseModalities"
  ]);
  P != null && l(o, ["responseModalities"], P);
  const N = s(e, [
    "mediaResolution"
  ]);
  N != null && l(o, ["mediaResolution"], N);
  const R = s(e, ["speechConfig"]);
  if (R != null && l(o, ["speechConfig"], dt(R)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const x = s(e, [
    "thinkingConfig"
  ]);
  x != null && l(o, ["thinkingConfig"], x);
  const k = s(e, ["imageConfig"]);
  k != null && l(o, ["imageConfig"], Ss(k));
  const G = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (G != null && l(o, ["enableEnhancedCivicAnswers"], G), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return o;
}
function ys(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["candidates"]);
  if (o != null) {
    let c = o;
    Array.isArray(c) && (c = c.map((d) => ji(d))), l(e, ["candidates"], c);
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
function Ts(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function Cs(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function _s(t) {
  const e = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const n = s(t, ["enableWidget"]);
  return n != null && l(e, ["enableWidget"], n), e;
}
function Es(t) {
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
function Ss(t) {
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
function Is(t, e) {
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
  return a != null && l(n, ["request", "generationConfig"], gs(t, a, s(n, ["request"], {}))), n;
}
function vs(t) {
  const e = {}, n = s(t, ["response"]);
  n != null && l(e, ["response"], ys(n));
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["error"]);
  return i != null && l(e, ["error"], i), e;
}
function As(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  if (e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), s(t, ["filter"]) !== void 0)
    throw new Error("filter parameter is not supported in Gemini API.");
  return n;
}
function Rs(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  e !== void 0 && i != null && l(e, ["_query", "pageToken"], i);
  const r = s(t, ["filter"]);
  return e !== void 0 && r != null && l(e, ["_query", "filter"], r), n;
}
function Ps(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && As(n, e), e;
}
function ws(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Rs(n, e), e;
}
function Ms(t) {
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
    Array.isArray(r) && (r = r.map((a) => ve(a))), l(e, ["batchJobs"], r);
  }
  return e;
}
function Ns(t) {
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
    Array.isArray(r) && (r = r.map((a) => Ye(a))), l(e, ["batchJobs"], r);
  }
  return e;
}
function xs(t) {
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
  r != null && l(e, ["fileData"], ps(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], hs(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(t, ["inlineData"]);
  c != null && l(e, ["inlineData"], Xi(c));
  const d = s(t, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(t, ["thought"]);
  f != null && l(e, ["thought"], f);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && l(e, ["thoughtSignature"], p);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && l(e, ["videoMetadata"], h), e;
}
function Ds(t) {
  const e = {}, n = s(t, ["category"]);
  if (n != null && l(e, ["category"], n), s(t, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const o = s(t, ["threshold"]);
  return o != null && l(e, ["threshold"], o), e;
}
function ks(t) {
  const e = {}, n = s(t, [
    "retrievalConfig"
  ]);
  n != null && l(e, ["retrievalConfig"], n);
  const o = s(t, [
    "functionCallingConfig"
  ]);
  return o != null && l(e, ["functionCallingConfig"], ms(o)), e;
}
function Us(t) {
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
  a != null && l(e, ["googleMaps"], _s(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Es(u));
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
class Ls extends X {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new oe(z.PAGED_ITEM_BATCH_JOBS, (o) => this.listInternal(o), await this.listInternal(n), n), this.create = async (n) => (this.apiClient.isVertexAI() && (n.config = this.formatDestination(n.src, n.config)), this.createInternal(n)), this.createEmbeddings = async (n) => {
      if (console.warn("batches.createEmbeddings() is experimental and may change without notice."), this.apiClient.isVertexAI())
        throw new Error("Vertex AI does not support batches.createEmbeddings.");
      return this.createEmbeddingsInternal(n);
    };
  }
  // Helper function to handle inlined generate content requests
  createInlinedGenerateContentRequest(e) {
    const n = Nn(
      this.apiClient,
      // Use instance apiClient
      e
    ), o = n._url, i = v("{model}:batchGenerateContent", o), u = n.batch.inputConfig.requests, c = u.requests, d = [];
    for (const f of c) {
      const p = Object.assign({}, f);
      if (p.systemInstruction) {
        const h = p.systemInstruction;
        delete p.systemInstruction;
        const m = p.request;
        m.systemInstruction = h, p.request = m;
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
      const d = os(this.apiClient, e);
      return u = v("batchPredictionJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Ye(f));
    } else {
      const d = Nn(this.apiClient, e);
      return u = v("{model}:batchGenerateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => ve(f));
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
      const u = ss(this.apiClient, e);
      return r = v("{model}:asyncBatchEmbedContent", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => ve(c));
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
      const d = Cs(this.apiClient, e);
      return u = v("batchPredictionJobs/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Ye(f));
    } else {
      const d = Ts(this.apiClient, e);
      return u = v("batches/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => ve(f));
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
      const c = Zi(this.apiClient, e);
      a = v("batchPredictionJobs/{name}:cancel", c._url), u = c._query, delete c._url, delete c._query, await this.apiClient.request({
        path: a,
        queryParams: u,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    } else {
      const c = Qi(this.apiClient, e);
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
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = ws(e);
      return u = v("batchPredictionJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Ns(f), h = new Rn();
        return Object.assign(h, p), h;
      });
    } else {
      const d = Ps(e);
      return u = v("batches", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Ms(f), h = new Rn();
        return Object.assign(h, p), h;
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
      const d = ls(this.apiClient, e);
      return u = v("batchPredictionJobs/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => us(f));
    } else {
      const d = rs(this.apiClient, e);
      return u = v("batches/{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => as(f));
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Gs(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && l(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function xn(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => sr(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function Fs(t, e) {
  const n = {}, o = s(t, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(t, ["expireTime"]);
  e !== void 0 && i != null && l(e, ["expireTime"], i);
  const r = s(t, ["displayName"]);
  e !== void 0 && r != null && l(e, ["displayName"], r);
  const a = s(t, ["contents"]);
  if (e !== void 0 && a != null) {
    let f = B(a);
    Array.isArray(f) && (f = f.map((p) => xn(p))), l(e, ["contents"], f);
  }
  const u = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && u != null && l(e, ["systemInstruction"], xn(H(u)));
  const c = s(t, ["tools"]);
  if (e !== void 0 && c != null) {
    let f = c;
    Array.isArray(f) && (f = f.map((p) => lr(p))), l(e, ["tools"], f);
  }
  const d = s(t, ["toolConfig"]);
  if (e !== void 0 && d != null && l(e, ["toolConfig"], rr(d)), s(t, ["kmsKeyName"]) !== void 0)
    throw new Error("kmsKeyName parameter is not supported in Gemini API.");
  return n;
}
function Hs(t, e) {
  const n = {}, o = s(t, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(t, ["expireTime"]);
  e !== void 0 && i != null && l(e, ["expireTime"], i);
  const r = s(t, ["displayName"]);
  e !== void 0 && r != null && l(e, ["displayName"], r);
  const a = s(t, ["contents"]);
  if (e !== void 0 && a != null) {
    let p = B(a);
    Array.isArray(p) && (p = p.map((h) => h)), l(e, ["contents"], p);
  }
  const u = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && u != null && l(e, ["systemInstruction"], H(u));
  const c = s(t, ["tools"]);
  if (e !== void 0 && c != null) {
    let p = c;
    Array.isArray(p) && (p = p.map((h) => ar(h))), l(e, ["tools"], p);
  }
  const d = s(t, ["toolConfig"]);
  e !== void 0 && d != null && l(e, ["toolConfig"], d);
  const f = s(t, ["kmsKeyName"]);
  return e !== void 0 && f != null && l(e, ["encryption_spec", "kmsKeyName"], f), n;
}
function Vs(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], to(t, o));
  const i = s(e, ["config"]);
  return i != null && Fs(i, n), n;
}
function bs(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], to(t, o));
  const i = s(e, ["config"]);
  return i != null && Hs(i, n), n;
}
function qs(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], Q(t, o)), n;
}
function Bs(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], Q(t, o)), n;
}
function Js(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function Os(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function $s(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Ws(t) {
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
function Ks(t) {
  const e = {}, n = s(t, [
    "allowedFunctionNames"
  ]);
  n != null && l(e, ["allowedFunctionNames"], n);
  const o = s(t, ["mode"]);
  if (o != null && l(e, ["mode"], o), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return e;
}
function Ys(t) {
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
function zs(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], Q(t, o)), n;
}
function Xs(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], Q(t, o)), n;
}
function Qs(t) {
  const e = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const n = s(t, ["enableWidget"]);
  return n != null && l(e, ["enableWidget"], n), e;
}
function Zs(t) {
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
function js(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function er(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function tr(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && js(n, e), e;
}
function nr(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && er(n, e), e;
}
function or(t) {
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
function ir(t) {
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
function sr(t) {
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
  r != null && l(e, ["fileData"], $s(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], Ws(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(t, ["inlineData"]);
  c != null && l(e, ["inlineData"], Gs(c));
  const d = s(t, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(t, ["thought"]);
  f != null && l(e, ["thought"], f);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && l(e, ["thoughtSignature"], p);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && l(e, ["videoMetadata"], h), e;
}
function rr(t) {
  const e = {}, n = s(t, [
    "retrievalConfig"
  ]);
  n != null && l(e, ["retrievalConfig"], n);
  const o = s(t, [
    "functionCallingConfig"
  ]);
  return o != null && l(e, ["functionCallingConfig"], Ks(o)), e;
}
function lr(t) {
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
  a != null && l(e, ["googleMaps"], Qs(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Zs(u));
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(t, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
function ar(t) {
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
    Array.isArray(p) && (p = p.map((h) => Ys(h))), l(e, ["functionDeclarations"], p);
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
function ur(t, e) {
  const n = {}, o = s(t, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(t, ["expireTime"]);
  return e !== void 0 && i != null && l(e, ["expireTime"], i), n;
}
function dr(t, e) {
  const n = {}, o = s(t, ["ttl"]);
  e !== void 0 && o != null && l(e, ["ttl"], o);
  const i = s(t, ["expireTime"]);
  return e !== void 0 && i != null && l(e, ["expireTime"], i), n;
}
function cr(t, e) {
  const n = {}, o = s(e, ["name"]);
  o != null && l(n, ["_url", "name"], Q(t, o));
  const i = s(e, ["config"]);
  return i != null && ur(i, n), n;
}
function fr(t, e) {
  const n = {}, o = s(e, ["name"]);
  o != null && l(n, ["_url", "name"], Q(t, o));
  const i = s(e, ["config"]);
  return i != null && dr(i, n), n;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class pr extends X {
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
      const d = bs(this.apiClient, e);
      return u = v("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
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
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Xs(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const d = zs(this.apiClient, e);
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
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Bs(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Os(f), h = new vn();
        return Object.assign(h, p), h;
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
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Js(f), h = new vn();
        return Object.assign(h, p), h;
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
      const d = fr(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const d = cr(this.apiClient, e);
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
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = nr(e);
      return u = v("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = ir(f), h = new An();
        return Object.assign(h, p), h;
      });
    } else {
      const d = tr(e);
      return u = v("cachedContents", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = or(f), h = new An();
        return Object.assign(h, p), h;
      });
    }
  }
}
function Ne(t, e) {
  var n = {};
  for (var o in t) Object.prototype.hasOwnProperty.call(t, o) && e.indexOf(o) < 0 && (n[o] = t[o]);
  if (t != null && typeof Object.getOwnPropertySymbols == "function")
    for (var i = 0, o = Object.getOwnPropertySymbols(t); i < o.length; i++)
      e.indexOf(o[i]) < 0 && Object.prototype.propertyIsEnumerable.call(t, o[i]) && (n[o[i]] = t[o[i]]);
  return n;
}
function Dn(t) {
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
  function a(m) {
    return function(g) {
      return Promise.resolve(g).then(m, p);
    };
  }
  function u(m, g) {
    o[m] && (i[m] = function(T) {
      return new Promise(function(y, C) {
        r.push([m, T, y, C]) > 1 || c(m, T);
      });
    }, g && (i[m] = g(i[m])));
  }
  function c(m, g) {
    try {
      d(o[m](g));
    } catch (T) {
      h(r[0][3], T);
    }
  }
  function d(m) {
    m.value instanceof M ? Promise.resolve(m.value.v).then(f, p) : h(r[0][2], m);
  }
  function f(m) {
    c("next", m);
  }
  function p(m) {
    c("throw", m);
  }
  function h(m, g) {
    m(g), r.shift(), r.length && c(r[0][0], r[0][1]);
  }
}
function $(t) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var e = t[Symbol.asyncIterator], n;
  return e ? e.call(t) : (t = typeof Dn == "function" ? Dn(t) : t[Symbol.iterator](), n = {}, o("next"), o("throw"), o("return"), n[Symbol.asyncIterator] = function() {
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
function hr(t) {
  var e;
  if (t.candidates == null || t.candidates.length === 0)
    return !1;
  const n = (e = t.candidates[0]) === null || e === void 0 ? void 0 : e.content;
  return n === void 0 ? !1 : mo(n);
}
function mo(t) {
  if (t.parts === void 0 || t.parts.length === 0)
    return !1;
  for (const e of t.parts)
    if (e === void 0 || Object.keys(e).length === 0)
      return !1;
  return !0;
}
function mr(t) {
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
        i.push(t[o]), r && !mo(t[o]) && (r = !1), o++;
      r ? e.push(...i) : e.pop();
    }
  return e;
}
class gr {
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
    return new yr(
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
class yr {
  constructor(e, n, o, i = {}, r = []) {
    this.apiClient = e, this.modelsModule = n, this.model = o, this.config = i, this.history = r, this.sendPromise = Promise.resolve(), mr(r);
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
      let h = [];
      f != null && (h = (u = f.slice(p)) !== null && u !== void 0 ? u : []);
      const m = d ? [d] : [];
      this.recordHistory(o, m, h);
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
        for (var p = !0, h = $(e), m; m = yield M(h.next()), i = m.done, !i; p = !0) {
          u = m.value, p = !1;
          const g = u;
          if (hr(g)) {
            const T = (d = (c = g.candidates) === null || c === void 0 ? void 0 : c[0]) === null || d === void 0 ? void 0 : d.content;
            T !== void 0 && f.push(T);
          }
          yield yield M(g);
        }
      } catch (g) {
        r = { error: g };
      } finally {
        try {
          !p && !i && (a = h.return) && (yield M(a.call(h)));
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
class Te extends Error {
  constructor(e) {
    super(e.message), this.name = "ApiError", this.status = e.status, Object.setPrototypeOf(this, Te.prototype);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Tr(t) {
  const e = {}, n = s(t, ["file"]);
  return n != null && l(e, ["file"], n), e;
}
function Cr(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function _r(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "file"], lo(n)), e;
}
function Er(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function Sr(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "file"], lo(n)), e;
}
function Ir(t) {
  const e = {}, n = s(t, ["uris"]);
  return n != null && l(e, ["uris"], n), e;
}
function vr(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function Ar(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && vr(n, e), e;
}
function Rr(t) {
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
function Pr(t) {
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
class wr extends X {
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
      const u = Ar(e);
      return r = v("files", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
        const d = Rr(c), f = new Mi();
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
      const u = Tr(e);
      return r = v("upload/v1beta/files", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Cr(c), f = new Ni();
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
      const u = Sr(e);
      return r = v("files/{file}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
      const u = _r(e);
      return r = v("files/{file}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
        const d = Er(c), f = new xi();
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
      const u = Ir(e);
      return r = v("files:register", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Pr(c), f = new Di();
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
function Ae(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && l(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Mr(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => $r(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function Nr(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function xr(t) {
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
function Dr(t) {
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
function kr(t) {
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
  const h = s(t, [
    "responseLogprobs"
  ]);
  h != null && l(e, ["responseLogprobs"], h);
  const m = s(t, [
    "responseMimeType"
  ]);
  m != null && l(e, ["responseMimeType"], m);
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
  const C = s(t, ["seed"]);
  C != null && l(e, ["seed"], C);
  const S = s(t, ["speechConfig"]);
  S != null && l(e, ["speechConfig"], S);
  const I = s(t, [
    "stopSequences"
  ]);
  I != null && l(e, ["stopSequences"], I);
  const E = s(t, ["temperature"]);
  E != null && l(e, ["temperature"], E);
  const _ = s(t, [
    "thinkingConfig"
  ]);
  _ != null && l(e, ["thinkingConfig"], _);
  const A = s(t, ["topK"]);
  A != null && l(e, ["topK"], A);
  const P = s(t, ["topP"]);
  if (P != null && l(e, ["topP"], P), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return e;
}
function Ur(t) {
  const e = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const n = s(t, ["enableWidget"]);
  return n != null && l(e, ["enableWidget"], n), e;
}
function Lr(t) {
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
function Gr(t, e) {
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
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], ct(p));
  const h = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "thinkingConfig"], h);
  const m = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], m);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], Mr(H(g)));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let A = ce(T);
    Array.isArray(A) && (A = A.map((P) => Kr(de(P)))), l(e, ["setup", "tools"], A);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], Wr(y));
  const C = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && C != null && l(e, ["setup", "inputAudioTranscription"], C);
  const S = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const I = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "realtimeInputConfig"], I);
  const E = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "contextWindowCompression"], E);
  const _ = s(t, ["proactivity"]);
  if (e !== void 0 && _ != null && l(e, ["setup", "proactivity"], _), s(t, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return n;
}
function Fr(t, e) {
  const n = {}, o = s(t, [
    "generationConfig"
  ]);
  e !== void 0 && o != null && l(e, ["setup", "generationConfig"], kr(o));
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
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], ct(p));
  const h = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "thinkingConfig"], h);
  const m = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], m);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], H(g));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let P = ce(T);
    Array.isArray(P) && (P = P.map((N) => Yr(de(N)))), l(e, ["setup", "tools"], P);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], y);
  const C = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && C != null && l(e, ["setup", "inputAudioTranscription"], C);
  const S = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const I = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "realtimeInputConfig"], I);
  const E = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "contextWindowCompression"], E);
  const _ = s(t, ["proactivity"]);
  e !== void 0 && _ != null && l(e, ["setup", "proactivity"], _);
  const A = s(t, [
    "explicitVadSignal"
  ]);
  return e !== void 0 && A != null && l(e, ["setup", "explicitVadSignal"], A), n;
}
function Hr(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["setup", "model"], D(t, o));
  const i = s(e, ["config"]);
  return i != null && l(n, ["config"], Gr(i, n)), n;
}
function Vr(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["setup", "model"], D(t, o));
  const i = s(e, ["config"]);
  return i != null && l(n, ["config"], Fr(i, n)), n;
}
function br(t) {
  const e = {}, n = s(t, [
    "musicGenerationConfig"
  ]);
  return n != null && l(e, ["musicGenerationConfig"], n), e;
}
function qr(t) {
  const e = {}, n = s(t, [
    "weightedPrompts"
  ]);
  if (n != null) {
    let o = n;
    Array.isArray(o) && (o = o.map((i) => i)), l(e, ["weightedPrompts"], o);
  }
  return e;
}
function Br(t) {
  const e = {}, n = s(t, ["media"]);
  if (n != null) {
    let d = no(n);
    Array.isArray(d) && (d = d.map((f) => Ae(f))), l(e, ["mediaChunks"], d);
  }
  const o = s(t, ["audio"]);
  o != null && l(e, ["audio"], Ae(io(o)));
  const i = s(t, [
    "audioStreamEnd"
  ]);
  i != null && l(e, ["audioStreamEnd"], i);
  const r = s(t, ["video"]);
  r != null && l(e, ["video"], Ae(oo(r)));
  const a = s(t, ["text"]);
  a != null && l(e, ["text"], a);
  const u = s(t, [
    "activityStart"
  ]);
  u != null && l(e, ["activityStart"], u);
  const c = s(t, ["activityEnd"]);
  return c != null && l(e, ["activityEnd"], c), e;
}
function Jr(t) {
  const e = {}, n = s(t, ["media"]);
  if (n != null) {
    let d = no(n);
    Array.isArray(d) && (d = d.map((f) => f)), l(e, ["mediaChunks"], d);
  }
  const o = s(t, ["audio"]);
  o != null && l(e, ["audio"], io(o));
  const i = s(t, [
    "audioStreamEnd"
  ]);
  i != null && l(e, ["audioStreamEnd"], i);
  const r = s(t, ["video"]);
  r != null && l(e, ["video"], oo(r));
  const a = s(t, ["text"]);
  a != null && l(e, ["text"], a);
  const u = s(t, [
    "activityStart"
  ]);
  u != null && l(e, ["activityStart"], u);
  const c = s(t, ["activityEnd"]);
  return c != null && l(e, ["activityEnd"], c), e;
}
function Or(t) {
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
  a != null && l(e, ["usageMetadata"], zr(a));
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
  return f != null && l(e, ["voiceActivity"], Xr(f)), e;
}
function $r(t) {
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
  r != null && l(e, ["fileData"], Nr(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], xr(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(t, ["inlineData"]);
  c != null && l(e, ["inlineData"], Ae(c));
  const d = s(t, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(t, ["thought"]);
  f != null && l(e, ["thought"], f);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && l(e, ["thoughtSignature"], p);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && l(e, ["videoMetadata"], h), e;
}
function Wr(t) {
  const e = {}, n = s(t, ["handle"]);
  if (n != null && l(e, ["handle"], n), s(t, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return e;
}
function Kr(t) {
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
  a != null && l(e, ["googleMaps"], Ur(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Lr(u));
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
  const d = s(t, ["urlContext"]);
  return d != null && l(e, ["urlContext"], d), e;
}
function Yr(t) {
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
    Array.isArray(p) && (p = p.map((h) => Dr(h))), l(e, ["functionDeclarations"], p);
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
function zr(t) {
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
    let m = c;
    Array.isArray(m) && (m = m.map((g) => g)), l(e, ["promptTokensDetails"], m);
  }
  const d = s(t, [
    "cacheTokensDetails"
  ]);
  if (d != null) {
    let m = d;
    Array.isArray(m) && (m = m.map((g) => g)), l(e, ["cacheTokensDetails"], m);
  }
  const f = s(t, [
    "candidatesTokensDetails"
  ]);
  if (f != null) {
    let m = f;
    Array.isArray(m) && (m = m.map((g) => g)), l(e, ["responseTokensDetails"], m);
  }
  const p = s(t, [
    "toolUsePromptTokensDetails"
  ]);
  if (p != null) {
    let m = p;
    Array.isArray(m) && (m = m.map((g) => g)), l(e, ["toolUsePromptTokensDetails"], m);
  }
  const h = s(t, ["trafficType"]);
  return h != null && l(e, ["trafficType"], h), e;
}
function Xr(t) {
  const e = {}, n = s(t, ["type"]);
  return n != null && l(e, ["voiceActivityType"], n), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Qr(t, e) {
  const n = {}, o = s(t, ["data"]);
  if (o != null && l(n, ["data"], o), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(t, ["mimeType"]);
  return i != null && l(n, ["mimeType"], i), n;
}
function Zr(t, e) {
  const n = {}, o = s(t, ["content"]);
  o != null && l(n, ["content"], o);
  const i = s(t, [
    "citationMetadata"
  ]);
  i != null && l(n, ["citationMetadata"], jr(i));
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
    let m = p;
    Array.isArray(m) && (m = m.map((g) => g)), l(n, ["safetyRatings"], m);
  }
  const h = s(t, [
    "urlContextMetadata"
  ]);
  return h != null && l(n, ["urlContextMetadata"], h), n;
}
function jr(t, e) {
  const n = {}, o = s(t, ["citationSources"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => r)), l(n, ["citations"], i);
  }
  return n;
}
function el(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let a = B(r);
    Array.isArray(a) && (a = a.map((u) => u)), l(o, ["contents"], a);
  }
  return o;
}
function tl(t, e) {
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
function nl(t, e) {
  const n = {}, o = s(t, ["values"]);
  o != null && l(n, ["values"], o);
  const i = s(t, ["statistics"]);
  return i != null && l(n, ["statistics"], ol(i)), n;
}
function ol(t, e) {
  const n = {}, o = s(t, ["truncated"]);
  o != null && l(n, ["truncated"], o);
  const i = s(t, ["token_count"]);
  return i != null && l(n, ["tokenCount"], i), n;
}
function ke(t, e) {
  const n = {}, o = s(t, ["parts"]);
  if (o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => fa(a))), l(n, ["parts"], r);
  }
  const i = s(t, ["role"]);
  return i != null && l(n, ["role"], i), n;
}
function il(t, e) {
  const n = {}, o = s(t, ["controlType"]);
  o != null && l(n, ["controlType"], o);
  const i = s(t, [
    "enableControlImageComputation"
  ]);
  return i != null && l(n, ["computeControl"], i), n;
}
function sl(t, e) {
  const n = {};
  if (s(t, ["systemInstruction"]) !== void 0)
    throw new Error("systemInstruction parameter is not supported in Gemini API.");
  if (s(t, ["tools"]) !== void 0)
    throw new Error("tools parameter is not supported in Gemini API.");
  if (s(t, ["generationConfig"]) !== void 0)
    throw new Error("generationConfig parameter is not supported in Gemini API.");
  return n;
}
function rl(t, e, n) {
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
  return e !== void 0 && a != null && l(e, ["generationConfig"], Ql(a)), o;
}
function ll(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = B(r);
    Array.isArray(u) && (u = u.map((c) => ke(c))), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && sl(a), o;
}
function al(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = B(r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && rl(a, o), o;
}
function ul(t, e) {
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
function dl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["totalTokens"]);
  return i != null && l(n, ["totalTokens"], i), n;
}
function cl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], D(t, i)), o;
}
function fl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], D(t, i)), o;
}
function pl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  return o != null && l(n, ["sdkHttpResponse"], o), n;
}
function hl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  return o != null && l(n, ["sdkHttpResponse"], o), n;
}
function ml(t, e, n) {
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
  const h = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "includeSafetyAttributes"], h);
  const m = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "includeRaiReason"], m);
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
  const C = s(t, ["addWatermark"]);
  e !== void 0 && C != null && l(e, ["parameters", "addWatermark"], C);
  const S = s(t, ["labels"]);
  e !== void 0 && S != null && l(e, ["labels"], S);
  const I = s(t, ["editMode"]);
  e !== void 0 && I != null && l(e, ["parameters", "editMode"], I);
  const E = s(t, ["baseSteps"]);
  return e !== void 0 && E != null && l(e, ["parameters", "editConfig", "baseSteps"], E), o;
}
function gl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, [
    "referenceImages"
  ]);
  if (a != null) {
    let c = a;
    Array.isArray(c) && (c = c.map((d) => Ta(d))), l(o, ["instances[0]", "referenceImages"], c);
  }
  const u = s(e, ["config"]);
  return u != null && ml(u, o), o;
}
function yl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Ue(a))), l(n, ["generatedImages"], r);
  }
  return n;
}
function Tl(t, e, n) {
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
function Cl(t, e, n) {
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
function _l(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let c = at(t, r);
    Array.isArray(c) && (c = c.map((d) => d)), l(o, ["requests[]", "content"], c);
  }
  const a = s(e, ["config"]);
  a != null && Tl(a, o);
  const u = s(e, ["model"]);
  return u !== void 0 && l(o, ["requests[]", "model"], D(t, u)), o;
}
function El(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = at(t, r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["instances[]", "content"], u);
  }
  const a = s(e, ["config"]);
  return a != null && Cl(a, o), o;
}
function Sl(t, e) {
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
function Il(t, e) {
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
    Array.isArray(a) && (a = a.map((u) => nl(u))), l(n, ["embeddings"], a);
  }
  const r = s(t, ["metadata"]);
  return r != null && l(n, ["metadata"], r), n;
}
function vl(t, e) {
  const n = {}, o = s(t, ["endpoint"]);
  o != null && l(n, ["name"], o);
  const i = s(t, [
    "deployedModelId"
  ]);
  return i != null && l(n, ["deployedModelId"], i), n;
}
function Al(t, e) {
  const n = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["fileUri"]);
  o != null && l(n, ["fileUri"], o);
  const i = s(t, ["mimeType"]);
  return i != null && l(n, ["mimeType"], i), n;
}
function Rl(t, e) {
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
function Pl(t, e) {
  const n = {}, o = s(t, [
    "allowedFunctionNames"
  ]);
  o != null && l(n, ["allowedFunctionNames"], o);
  const i = s(t, ["mode"]);
  if (i != null && l(n, ["mode"], i), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return n;
}
function wl(t, e) {
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
function Ml(t, e, n, o) {
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
  const h = s(e, [
    "responseLogprobs"
  ]);
  h != null && l(i, ["responseLogprobs"], h);
  const m = s(e, ["logprobs"]);
  m != null && l(i, ["logprobs"], m);
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
  const C = s(e, [
    "responseMimeType"
  ]);
  C != null && l(i, ["responseMimeType"], C);
  const S = s(e, [
    "responseSchema"
  ]);
  S != null && l(i, ["responseSchema"], ut(S));
  const I = s(e, [
    "responseJsonSchema"
  ]);
  if (I != null && l(i, ["responseJsonSchema"], I), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const E = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && E != null) {
    let L = E;
    Array.isArray(L) && (L = L.map((K) => Ca(K))), l(n, ["safetySettings"], L);
  }
  const _ = s(e, ["tools"]);
  if (n !== void 0 && _ != null) {
    let L = ce(_);
    Array.isArray(L) && (L = L.map((K) => Ra(de(K)))), l(n, ["tools"], L);
  }
  const A = s(e, ["toolConfig"]);
  if (n !== void 0 && A != null && l(n, ["toolConfig"], Aa(A)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const P = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && P != null && l(n, ["cachedContent"], Q(t, P));
  const N = s(e, [
    "responseModalities"
  ]);
  N != null && l(i, ["responseModalities"], N);
  const R = s(e, [
    "mediaResolution"
  ]);
  R != null && l(i, ["mediaResolution"], R);
  const x = s(e, ["speechConfig"]);
  if (x != null && l(i, ["speechConfig"], dt(x)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const k = s(e, [
    "thinkingConfig"
  ]);
  k != null && l(i, ["thinkingConfig"], k);
  const G = s(e, ["imageConfig"]);
  G != null && l(i, ["imageConfig"], na(G));
  const U = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (U != null && l(i, ["enableEnhancedCivicAnswers"], U), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return i;
}
function Nl(t, e, n, o) {
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
  const h = s(e, [
    "responseLogprobs"
  ]);
  h != null && l(i, ["responseLogprobs"], h);
  const m = s(e, ["logprobs"]);
  m != null && l(i, ["logprobs"], m);
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
  const C = s(e, [
    "responseMimeType"
  ]);
  C != null && l(i, ["responseMimeType"], C);
  const S = s(e, [
    "responseSchema"
  ]);
  S != null && l(i, ["responseSchema"], ut(S));
  const I = s(e, [
    "responseJsonSchema"
  ]);
  I != null && l(i, ["responseJsonSchema"], I);
  const E = s(e, [
    "routingConfig"
  ]);
  E != null && l(i, ["routingConfig"], E);
  const _ = s(e, [
    "modelSelectionConfig"
  ]);
  _ != null && l(i, ["modelConfig"], _);
  const A = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && A != null) {
    let Y = A;
    Array.isArray(Y) && (Y = Y.map((Ve) => Ve)), l(n, ["safetySettings"], Y);
  }
  const P = s(e, ["tools"]);
  if (n !== void 0 && P != null) {
    let Y = ce(P);
    Array.isArray(Y) && (Y = Y.map((Ve) => Co(de(Ve)))), l(n, ["tools"], Y);
  }
  const N = s(e, ["toolConfig"]);
  n !== void 0 && N != null && l(n, ["toolConfig"], N);
  const R = s(e, ["labels"]);
  n !== void 0 && R != null && l(n, ["labels"], R);
  const x = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && x != null && l(n, ["cachedContent"], Q(t, x));
  const k = s(e, [
    "responseModalities"
  ]);
  k != null && l(i, ["responseModalities"], k);
  const G = s(e, [
    "mediaResolution"
  ]);
  G != null && l(i, ["mediaResolution"], G);
  const U = s(e, ["speechConfig"]);
  U != null && l(i, ["speechConfig"], dt(U));
  const L = s(e, [
    "audioTimestamp"
  ]);
  L != null && l(i, ["audioTimestamp"], L);
  const K = s(e, [
    "thinkingConfig"
  ]);
  K != null && l(i, ["thinkingConfig"], K);
  const pe = s(e, ["imageConfig"]);
  if (pe != null && l(i, ["imageConfig"], oa(pe)), s(e, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  const ie = s(e, [
    "modelArmorConfig"
  ]);
  return n !== void 0 && ie != null && l(n, ["modelArmorConfig"], ie), i;
}
function Un(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = B(r);
    Array.isArray(u) && (u = u.map((c) => ke(c))), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && l(o, ["generationConfig"], Ml(t, a, o)), o;
}
function Ln(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = B(r);
    Array.isArray(u) && (u = u.map((c) => c)), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && l(o, ["generationConfig"], Nl(t, a, o)), o;
}
function Gn(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["candidates"]);
  if (i != null) {
    let d = i;
    Array.isArray(d) && (d = d.map((f) => Zr(f))), l(n, ["candidates"], d);
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
function Fn(t, e) {
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
function xl(t, e, n) {
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
  const h = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "outputOptions", "mimeType"], h);
  const m = s(t, [
    "outputCompressionQuality"
  ]);
  if (e !== void 0 && m != null && l(e, ["parameters", "outputOptions", "compressionQuality"], m), s(t, ["addWatermark"]) !== void 0)
    throw new Error("addWatermark parameter is not supported in Gemini API.");
  if (s(t, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const g = s(t, ["imageSize"]);
  if (e !== void 0 && g != null && l(e, ["parameters", "sampleImageSize"], g), s(t, ["enhancePrompt"]) !== void 0)
    throw new Error("enhancePrompt parameter is not supported in Gemini API.");
  return o;
}
function Dl(t, e, n) {
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
  const h = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "includeSafetyAttributes"], h);
  const m = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "includeRaiReason"], m);
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
  const C = s(t, ["addWatermark"]);
  e !== void 0 && C != null && l(e, ["parameters", "addWatermark"], C);
  const S = s(t, ["labels"]);
  e !== void 0 && S != null && l(e, ["labels"], S);
  const I = s(t, ["imageSize"]);
  e !== void 0 && I != null && l(e, ["parameters", "sampleImageSize"], I);
  const E = s(t, [
    "enhancePrompt"
  ]);
  return e !== void 0 && E != null && l(e, ["parameters", "enhancePrompt"], E), o;
}
function kl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["config"]);
  return a != null && xl(a, o), o;
}
function Ul(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["config"]);
  return a != null && Dl(a, o), o;
}
function Ll(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => Kl(u))), l(n, ["generatedImages"], a);
  }
  const r = s(t, [
    "positivePromptSafetyAttributes"
  ]);
  return r != null && l(n, ["positivePromptSafetyAttributes"], yo(r)), n;
}
function Gl(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((u) => Ue(u))), l(n, ["generatedImages"], a);
  }
  const r = s(t, [
    "positivePromptSafetyAttributes"
  ]);
  return r != null && l(n, ["positivePromptSafetyAttributes"], To(r)), n;
}
function Fl(t, e, n) {
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
  e !== void 0 && p != null && l(e, ["instances[0]", "lastFrame"], Le(p));
  const h = s(t, [
    "referenceImages"
  ]);
  if (e !== void 0 && h != null) {
    let m = h;
    Array.isArray(m) && (m = m.map((g) => Va(g))), l(e, ["instances[0]", "referenceImages"], m);
  }
  if (s(t, ["mask"]) !== void 0)
    throw new Error("mask parameter is not supported in Gemini API.");
  if (s(t, ["compressionQuality"]) !== void 0)
    throw new Error("compressionQuality parameter is not supported in Gemini API.");
  return o;
}
function Hl(t, e, n) {
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
  const h = s(t, ["pubsubTopic"]);
  e !== void 0 && h != null && l(e, ["parameters", "pubsubTopic"], h);
  const m = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "negativePrompt"], m);
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
  const C = s(t, [
    "referenceImages"
  ]);
  if (e !== void 0 && C != null) {
    let E = C;
    Array.isArray(E) && (E = E.map((_) => ba(_))), l(e, ["instances[0]", "referenceImages"], E);
  }
  const S = s(t, ["mask"]);
  e !== void 0 && S != null && l(e, ["instances[0]", "mask"], Ha(S));
  const I = s(t, [
    "compressionQuality"
  ]);
  return e !== void 0 && I != null && l(e, ["parameters", "compressionQuality"], I), o;
}
function Vl(t, e) {
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
  return u != null && l(n, ["response"], Jl(u)), n;
}
function bl(t, e) {
  const n = {}, o = s(t, ["name"]);
  o != null && l(n, ["name"], o);
  const i = s(t, ["metadata"]);
  i != null && l(n, ["metadata"], i);
  const r = s(t, ["done"]);
  r != null && l(n, ["done"], r);
  const a = s(t, ["error"]);
  a != null && l(n, ["error"], a);
  const u = s(t, ["response"]);
  return u != null && l(n, ["response"], Ol(u)), n;
}
function ql(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["image"]);
  a != null && l(o, ["instances[0]", "image"], Le(a));
  const u = s(e, ["video"]);
  u != null && l(o, ["instances[0]", "video"], _o(u));
  const c = s(e, ["source"]);
  c != null && $l(c, o);
  const d = s(e, ["config"]);
  return d != null && Fl(d, o), o;
}
function Bl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["image"]);
  a != null && l(o, ["instances[0]", "image"], W(a));
  const u = s(e, ["video"]);
  u != null && l(o, ["instances[0]", "video"], Eo(u));
  const c = s(e, ["source"]);
  c != null && Wl(c, o);
  const d = s(e, ["config"]);
  return d != null && Hl(d, o), o;
}
function Jl(t, e) {
  const n = {}, o = s(t, [
    "generatedSamples"
  ]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((u) => zl(u))), l(n, ["generatedVideos"], a);
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
function Ol(t, e) {
  const n = {}, o = s(t, ["videos"]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((u) => Xl(u))), l(n, ["generatedVideos"], a);
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
function $l(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], Le(r));
  const a = s(t, ["video"]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "video"], _o(a)), o;
}
function Wl(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], W(r));
  const a = s(t, ["video"]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "video"], Eo(a)), o;
}
function Kl(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["image"], ia(o));
  const i = s(t, [
    "raiFilteredReason"
  ]);
  i != null && l(n, ["raiFilteredReason"], i);
  const r = s(t, ["_self"]);
  return r != null && l(n, ["safetyAttributes"], yo(r)), n;
}
function Ue(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["image"], go(o));
  const i = s(t, [
    "raiFilteredReason"
  ]);
  i != null && l(n, ["raiFilteredReason"], i);
  const r = s(t, ["_self"]);
  r != null && l(n, ["safetyAttributes"], To(r));
  const a = s(t, ["prompt"]);
  return a != null && l(n, ["enhancedPrompt"], a), n;
}
function Yl(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["mask"], go(o));
  const i = s(t, ["labels"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => a)), l(n, ["labels"], r);
  }
  return n;
}
function zl(t, e) {
  const n = {}, o = s(t, ["video"]);
  return o != null && l(n, ["video"], Ga(o)), n;
}
function Xl(t, e) {
  const n = {}, o = s(t, ["_self"]);
  return o != null && l(n, ["video"], Fa(o)), n;
}
function Ql(t, e) {
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
  const h = s(t, [
    "presencePenalty"
  ]);
  h != null && l(n, ["presencePenalty"], h);
  const m = s(t, [
    "responseLogprobs"
  ]);
  m != null && l(n, ["responseLogprobs"], m);
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
  const C = s(t, [
    "routingConfig"
  ]);
  C != null && l(n, ["routingConfig"], C);
  const S = s(t, ["seed"]);
  S != null && l(n, ["seed"], S);
  const I = s(t, ["speechConfig"]);
  I != null && l(n, ["speechConfig"], I);
  const E = s(t, [
    "stopSequences"
  ]);
  E != null && l(n, ["stopSequences"], E);
  const _ = s(t, ["temperature"]);
  _ != null && l(n, ["temperature"], _);
  const A = s(t, [
    "thinkingConfig"
  ]);
  A != null && l(n, ["thinkingConfig"], A);
  const P = s(t, ["topK"]);
  P != null && l(n, ["topK"], P);
  const N = s(t, ["topP"]);
  if (N != null && l(n, ["topP"], N), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return n;
}
function Zl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], D(t, i)), o;
}
function jl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], D(t, i)), o;
}
function ea(t, e) {
  const n = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const o = s(t, ["enableWidget"]);
  return o != null && l(n, ["enableWidget"], o), n;
}
function ta(t, e) {
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
function na(t, e) {
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
function oa(t, e) {
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
function ia(t, e) {
  const n = {}, o = s(t, [
    "bytesBase64Encoded"
  ]);
  o != null && l(n, ["imageBytes"], j(o));
  const i = s(t, ["mimeType"]);
  return i != null && l(n, ["mimeType"], i), n;
}
function go(t, e) {
  const n = {}, o = s(t, ["gcsUri"]);
  o != null && l(n, ["gcsUri"], o);
  const i = s(t, [
    "bytesBase64Encoded"
  ]);
  i != null && l(n, ["imageBytes"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["mimeType"], r), n;
}
function Le(t, e) {
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
function sa(t, e, n, o) {
  const i = {}, r = s(e, ["pageSize"]);
  n !== void 0 && r != null && l(n, ["_query", "pageSize"], r);
  const a = s(e, ["pageToken"]);
  n !== void 0 && a != null && l(n, ["_query", "pageToken"], a);
  const u = s(e, ["filter"]);
  n !== void 0 && u != null && l(n, ["_query", "filter"], u);
  const c = s(e, ["queryBase"]);
  return n !== void 0 && c != null && l(n, ["_url", "models_url"], ao(t, c)), i;
}
function ra(t, e, n, o) {
  const i = {}, r = s(e, ["pageSize"]);
  n !== void 0 && r != null && l(n, ["_query", "pageSize"], r);
  const a = s(e, ["pageToken"]);
  n !== void 0 && a != null && l(n, ["_query", "pageToken"], a);
  const u = s(e, ["filter"]);
  n !== void 0 && u != null && l(n, ["_query", "filter"], u);
  const c = s(e, ["queryBase"]);
  return n !== void 0 && c != null && l(n, ["_url", "models_url"], ao(t, c)), i;
}
function la(t, e, n) {
  const o = {}, i = s(e, ["config"]);
  return i != null && sa(t, i, o), o;
}
function aa(t, e, n) {
  const o = {}, i = s(e, ["config"]);
  return i != null && ra(t, i, o), o;
}
function ua(t, e) {
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
    let a = uo(r);
    Array.isArray(a) && (a = a.map((u) => ze(u))), l(n, ["models"], a);
  }
  return n;
}
function da(t, e) {
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
    let a = uo(r);
    Array.isArray(a) && (a = a.map((u) => Xe(u))), l(n, ["models"], a);
  }
  return n;
}
function ca(t, e) {
  const n = {}, o = s(t, ["maskMode"]);
  o != null && l(n, ["maskMode"], o);
  const i = s(t, [
    "segmentationClasses"
  ]);
  i != null && l(n, ["maskClasses"], i);
  const r = s(t, ["maskDilation"]);
  return r != null && l(n, ["dilation"], r), n;
}
function ze(t, e) {
  const n = {}, o = s(t, ["name"]);
  o != null && l(n, ["name"], o);
  const i = s(t, ["displayName"]);
  i != null && l(n, ["displayName"], i);
  const r = s(t, ["description"]);
  r != null && l(n, ["description"], r);
  const a = s(t, ["version"]);
  a != null && l(n, ["version"], a);
  const u = s(t, ["_self"]);
  u != null && l(n, ["tunedModelInfo"], Pa(u));
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
  const h = s(t, [
    "maxTemperature"
  ]);
  h != null && l(n, ["maxTemperature"], h);
  const m = s(t, ["topP"]);
  m != null && l(n, ["topP"], m);
  const g = s(t, ["topK"]);
  g != null && l(n, ["topK"], g);
  const T = s(t, ["thinking"]);
  return T != null && l(n, ["thinking"], T), n;
}
function Xe(t, e) {
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
    let h = u;
    Array.isArray(h) && (h = h.map((m) => vl(m))), l(n, ["endpoints"], h);
  }
  const c = s(t, ["labels"]);
  c != null && l(n, ["labels"], c);
  const d = s(t, ["_self"]);
  d != null && l(n, ["tunedModelInfo"], wa(d));
  const f = s(t, [
    "defaultCheckpointId"
  ]);
  f != null && l(n, ["defaultCheckpointId"], f);
  const p = s(t, ["checkpoints"]);
  if (p != null) {
    let h = p;
    Array.isArray(h) && (h = h.map((m) => m)), l(n, ["checkpoints"], h);
  }
  return n;
}
function fa(t, e) {
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
  a != null && l(n, ["fileData"], Al(a));
  const u = s(t, ["functionCall"]);
  u != null && l(n, ["functionCall"], Rl(u));
  const c = s(t, [
    "functionResponse"
  ]);
  c != null && l(n, ["functionResponse"], c);
  const d = s(t, ["inlineData"]);
  d != null && l(n, ["inlineData"], Qr(d));
  const f = s(t, ["text"]);
  f != null && l(n, ["text"], f);
  const p = s(t, ["thought"]);
  p != null && l(n, ["thought"], p);
  const h = s(t, [
    "thoughtSignature"
  ]);
  h != null && l(n, ["thoughtSignature"], h);
  const m = s(t, [
    "videoMetadata"
  ]);
  return m != null && l(n, ["videoMetadata"], m), n;
}
function pa(t, e) {
  const n = {}, o = s(t, ["productImage"]);
  return o != null && l(n, ["image"], W(o)), n;
}
function ha(t, e, n) {
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
  const h = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && h != null && l(e, ["parameters", "outputOptions", "compressionQuality"], h);
  const m = s(t, [
    "enhancePrompt"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "enhancePrompt"], m);
  const g = s(t, ["labels"]);
  return e !== void 0 && g != null && l(e, ["labels"], g), o;
}
function ma(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["source"]);
  r != null && ya(r, o);
  const a = s(e, ["config"]);
  return a != null && ha(a, o), o;
}
function ga(t, e) {
  const n = {}, o = s(t, [
    "predictions"
  ]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => Ue(r))), l(n, ["generatedImages"], i);
  }
  return n;
}
function ya(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["personImage"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "personImage", "image"], W(r));
  const a = s(t, [
    "productImages"
  ]);
  if (e !== void 0 && a != null) {
    let u = a;
    Array.isArray(u) && (u = u.map((c) => pa(c))), l(e, ["instances[0]", "productImages"], u);
  }
  return o;
}
function Ta(t, e) {
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
  a != null && l(n, ["maskImageConfig"], ca(a));
  const u = s(t, [
    "controlImageConfig"
  ]);
  u != null && l(n, ["controlImageConfig"], il(u));
  const c = s(t, [
    "styleImageConfig"
  ]);
  c != null && l(n, ["styleImageConfig"], c);
  const d = s(t, [
    "subjectImageConfig"
  ]);
  return d != null && l(n, ["subjectImageConfig"], d), n;
}
function yo(t, e) {
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
function Ca(t, e) {
  const n = {}, o = s(t, ["category"]);
  if (o != null && l(n, ["category"], o), s(t, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const i = s(t, ["threshold"]);
  return i != null && l(n, ["threshold"], i), n;
}
function _a(t, e) {
  const n = {}, o = s(t, ["image"]);
  return o != null && l(n, ["image"], W(o)), n;
}
function Ea(t, e, n) {
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
function Sa(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["source"]);
  r != null && va(r, o);
  const a = s(e, ["config"]);
  return a != null && Ea(a, o), o;
}
function Ia(t, e) {
  const n = {}, o = s(t, ["predictions"]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => Yl(r))), l(n, ["generatedMasks"], i);
  }
  return n;
}
function va(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], W(r));
  const a = s(t, [
    "scribbleImage"
  ]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "scribble"], _a(a)), o;
}
function Aa(t, e) {
  const n = {}, o = s(t, [
    "retrievalConfig"
  ]);
  o != null && l(n, ["retrievalConfig"], o);
  const i = s(t, [
    "functionCallingConfig"
  ]);
  return i != null && l(n, ["functionCallingConfig"], Pl(i)), n;
}
function Ra(t, e) {
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
    Array.isArray(p) && (p = p.map((h) => h)), l(n, ["functionDeclarations"], p);
  }
  const u = s(t, ["googleMaps"]);
  u != null && l(n, ["googleMaps"], ea(u));
  const c = s(t, ["googleSearch"]);
  c != null && l(n, ["googleSearch"], ta(c));
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
    let h = u;
    Array.isArray(h) && (h = h.map((m) => wl(m))), l(n, ["functionDeclarations"], h);
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
function Pa(t, e) {
  const n = {}, o = s(t, ["baseModel"]);
  o != null && l(n, ["baseModel"], o);
  const i = s(t, ["createTime"]);
  i != null && l(n, ["createTime"], i);
  const r = s(t, ["updateTime"]);
  return r != null && l(n, ["updateTime"], r), n;
}
function wa(t, e) {
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
function Ma(t, e, n) {
  const o = {}, i = s(t, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(t, ["description"]);
  e !== void 0 && r != null && l(e, ["description"], r);
  const a = s(t, [
    "defaultCheckpointId"
  ]);
  return e !== void 0 && a != null && l(e, ["defaultCheckpointId"], a), o;
}
function Na(t, e, n) {
  const o = {}, i = s(t, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(t, ["description"]);
  e !== void 0 && r != null && l(e, ["description"], r);
  const a = s(t, [
    "defaultCheckpointId"
  ]);
  return e !== void 0 && a != null && l(e, ["defaultCheckpointId"], a), o;
}
function xa(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "name"], D(t, i));
  const r = s(e, ["config"]);
  return r != null && Ma(r, o), o;
}
function Da(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["config"]);
  return r != null && Na(r, o), o;
}
function ka(t, e, n) {
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
  const h = s(t, ["labels"]);
  e !== void 0 && h != null && l(e, ["labels"], h);
  const m = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && m != null && l(e, ["parameters", "sampleCount"], m);
  const g = s(t, ["mode"]);
  return e !== void 0 && g != null && l(e, ["parameters", "mode"], g), o;
}
function Ua(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], D(t, i));
  const r = s(e, ["image"]);
  r != null && l(o, ["instances[0]", "image"], W(r));
  const a = s(e, [
    "upscaleFactor"
  ]);
  a != null && l(o, ["parameters", "upscaleConfig", "upscaleFactor"], a);
  const u = s(e, ["config"]);
  return u != null && ka(u, o), o;
}
function La(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => Ue(a))), l(n, ["generatedImages"], r);
  }
  return n;
}
function Ga(t, e) {
  const n = {}, o = s(t, ["uri"]);
  o != null && l(n, ["uri"], o);
  const i = s(t, ["encodedVideo"]);
  i != null && l(n, ["videoBytes"], j(i));
  const r = s(t, ["encoding"]);
  return r != null && l(n, ["mimeType"], r), n;
}
function Fa(t, e) {
  const n = {}, o = s(t, ["gcsUri"]);
  o != null && l(n, ["uri"], o);
  const i = s(t, [
    "bytesBase64Encoded"
  ]);
  i != null && l(n, ["videoBytes"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["mimeType"], r), n;
}
function Ha(t, e) {
  const n = {}, o = s(t, ["image"]);
  o != null && l(n, ["_self"], W(o));
  const i = s(t, ["maskMode"]);
  return i != null && l(n, ["maskMode"], i), n;
}
function Va(t, e) {
  const n = {}, o = s(t, ["image"]);
  o != null && l(n, ["image"], Le(o));
  const i = s(t, [
    "referenceType"
  ]);
  return i != null && l(n, ["referenceType"], i), n;
}
function ba(t, e) {
  const n = {}, o = s(t, ["image"]);
  o != null && l(n, ["image"], W(o));
  const i = s(t, [
    "referenceType"
  ]);
  return i != null && l(n, ["referenceType"], i), n;
}
function _o(t, e) {
  const n = {}, o = s(t, ["uri"]);
  o != null && l(n, ["uri"], o);
  const i = s(t, ["videoBytes"]);
  i != null && l(n, ["encodedVideo"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["encoding"], r), n;
}
function Eo(t, e) {
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
function qa(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  return e !== void 0 && o != null && l(e, ["displayName"], o), n;
}
function Ba(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && qa(n, e), e;
}
function Ja(t, e) {
  const n = {}, o = s(t, ["force"]);
  return e !== void 0 && o != null && l(e, ["_query", "force"], o), n;
}
function Oa(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["_url", "name"], n);
  const o = s(t, ["config"]);
  return o != null && Ja(o, e), e;
}
function $a(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "name"], n), e;
}
function Wa(t, e) {
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
function Ka(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], za(a)), e;
}
function Ya(t) {
  const e = {}, n = s(t, [
    "fileSearchStoreName"
  ]);
  n != null && l(e, ["_url", "file_search_store_name"], n);
  const o = s(t, ["fileName"]);
  o != null && l(e, ["fileName"], o);
  const i = s(t, ["config"]);
  return i != null && Wa(i, e), e;
}
function za(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(t, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function Xa(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function Qa(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Xa(n, e), e;
}
function Za(t) {
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
function So(t, e) {
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
function ja(t) {
  const e = {}, n = s(t, [
    "fileSearchStoreName"
  ]);
  n != null && l(e, ["_url", "file_search_store_name"], n);
  const o = s(t, ["config"]);
  return o != null && So(o, e), e;
}
function eu(t) {
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
const tu = "Content-Type", nu = "X-Server-Timeout", ou = "User-Agent", Qe = "x-goog-api-client", iu = "1.40.0", su = `google-genai-sdk/${iu}`, ru = "v1beta1", lu = "v1beta";
class au {
  constructor(e) {
    var n, o, i;
    this.clientOptions = Object.assign({}, e), this.customBaseUrl = (n = e.httpOptions) === null || n === void 0 ? void 0 : n.baseUrl, this.clientOptions.vertexai && (this.clientOptions.project && this.clientOptions.location ? this.clientOptions.apiKey = void 0 : this.clientOptions.apiKey && (this.clientOptions.project = void 0, this.clientOptions.location = void 0));
    const r = {};
    if (this.clientOptions.vertexai) {
      if (!this.clientOptions.location && !this.clientOptions.apiKey && !this.customBaseUrl && (this.clientOptions.location = "global"), !(this.clientOptions.project && this.clientOptions.location || this.clientOptions.apiKey) && !this.customBaseUrl)
        throw new Error("Authentication is not set up. Please provide either a project and location, or an API key, or a custom base URL.");
      const u = e.project && e.location || !!e.apiKey;
      this.customBaseUrl && !u ? (r.baseUrl = this.customBaseUrl, this.clientOptions.project = void 0, this.clientOptions.location = void 0) : this.clientOptions.apiKey || this.clientOptions.location === "global" ? r.baseUrl = "https://aiplatform.googleapis.com/" : this.clientOptions.project && this.clientOptions.location && (r.baseUrl = `https://${this.clientOptions.location}-aiplatform.googleapis.com/`), r.apiVersion = (o = this.clientOptions.apiVersion) !== null && o !== void 0 ? o : ru;
    } else {
      if (!this.clientOptions.apiKey)
        throw new Te({
          message: "API key must be set when using the Gemini API.",
          status: 403
        });
      r.apiVersion = (i = this.clientOptions.apiVersion) !== null && i !== void 0 ? i : lu, r.baseUrl = "https://generativelanguage.googleapis.com/";
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
    return !(n.baseUrl && n.baseUrlResourceScope === $e.COLLECTION || this.clientOptions.apiKey || !this.clientOptions.vertexai || e.path.startsWith("projects/") || e.httpMethod === "GET" && e.path.startsWith("publishers/google/models"));
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
    return n && n.extraBody !== null && uu(e, n.extraBody), e.headers = await this.getHeadersInternal(n, o), e;
  }
  async unaryApiCall(e, n, o) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, n), { method: o })).then(async (i) => (await Hn(i), new We(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  async streamApiCall(e, n, o) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, n), { method: o })).then(async (i) => (await Hn(i), this.processStreamResponse(i))).catch((i) => {
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
              const T = JSON.parse(JSON.stringify(g.error)), y = T.status, C = T.code, S = `got status: ${y}. ${JSON.stringify(g)}`;
              if (C >= 400 && C < 600)
                throw new Te({
                  message: S,
                  status: C
                });
            }
          } catch (g) {
            if (g.name === "ApiError")
              throw g;
          }
          a += p;
          let h = -1, m = 0;
          for (; ; ) {
            h = -1, m = 0;
            for (const y of c) {
              const C = a.indexOf(y);
              C !== -1 && (h === -1 || C < h) && (h = C, m = y.length);
            }
            if (h === -1)
              break;
            const g = a.substring(0, h);
            a = a.substring(h + m);
            const T = g.trim();
            if (T.startsWith(u)) {
              const y = T.substring(u.length).trim();
              try {
                const C = new Response(y, {
                  headers: e == null ? void 0 : e.headers,
                  status: e == null ? void 0 : e.status,
                  statusText: e == null ? void 0 : e.statusText
                });
                yield yield M(new We(C));
              } catch (C) {
                throw new Error(`exception parsing stream chunk ${y}. ${C}`);
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
    const e = {}, n = su + " " + this.clientOptions.userAgentExtra;
    return e[ou] = n, e[Qe] = n, e[tu] = "application/json", e;
  }
  async getHeadersInternal(e, n) {
    const o = new Headers();
    if (e && e.headers) {
      for (const [i, r] of Object.entries(e.headers))
        o.append(i, r);
      e.timeout && e.timeout > 0 && o.append(nu, String(Math.ceil(e.timeout / 1e3)));
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
    }, d = this.getFileName(e), f = v("upload/v1beta/files", c._url), p = await this.fetchUploadUrl(f, i.sizeBytes, i.mimeType, d, c, n == null ? void 0 : n.httpOptions);
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
    o != null && So(o, p);
    const h = await this.fetchUploadUrl(d, u, c, f, p, o == null ? void 0 : o.httpOptions);
    return r.uploadToFileSearchStore(n, h, this);
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
async function Hn(t) {
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
    throw n >= 400 && n < 600 ? new Te({
      message: i,
      status: n
    }) : new Error(i);
  }
}
function uu(t, e) {
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
const du = "mcp_used/unknown";
let cu = !1;
function Io(t) {
  for (const e of t)
    if (fu(e) || typeof e == "object" && "inputSchema" in e)
      return !0;
  return cu;
}
function vo(t) {
  var e;
  const n = (e = t[Qe]) !== null && e !== void 0 ? e : "";
  t[Qe] = (n + ` ${du}`).trimStart();
}
function fu(t) {
  return t !== null && typeof t == "object" && t instanceof ft;
}
function pu(t) {
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
class ft {
  constructor(e = [], n) {
    this.mcpTools = [], this.functionNameToMcpClient = {}, this.mcpClients = e, this.config = n;
  }
  /**
   * Creates a McpCallableTool.
   */
  static create(e, n) {
    return new ft(e, n);
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
        for (var u = !0, c = (n = void 0, $(pu(f))), d; d = await c.next(), e = d.done, !e; u = !0) {
          i = d.value, u = !1;
          const p = i;
          a.push(p);
          const h = p.name;
          if (r[h])
            throw new Error(`Duplicate function name ${h} found in MCP tools. Please ensure function names are unique.`);
          r[h] = f;
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
    return await this.initialize(), Bi(this.mcpTools, this.config);
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
async function hu(t, e, n) {
  const o = new Ui();
  let i;
  n.data instanceof Blob ? i = JSON.parse(await n.data.text()) : i = JSON.parse(n.data), Object.assign(o, i), e(o);
}
class mu {
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
    const i = this.apiClient.getWebsocketBaseUrl(), r = this.apiClient.getApiVersion(), a = Tu(this.apiClient.getDefaultHeaders()), u = this.apiClient.getApiKey(), c = `${i}/ws/google.ai.generativelanguage.${r}.GenerativeService.BidiGenerateMusic?key=${u}`;
    let d = () => {
    };
    const f = new Promise((I) => {
      d = I;
    }), p = e.callbacks, h = function() {
      d({});
    }, m = this.apiClient, g = {
      onopen: h,
      onmessage: (I) => {
        hu(m, p.onmessage, I);
      },
      onerror: (n = p == null ? void 0 : p.onerror) !== null && n !== void 0 ? n : function(I) {
      },
      onclose: (o = p == null ? void 0 : p.onclose) !== null && o !== void 0 ? o : function(I) {
      }
    }, T = this.webSocketFactory.create(c, yu(a), g);
    T.connect(), await f;
    const S = { setup: { model: D(this.apiClient, e.model) } };
    return T.send(JSON.stringify(S)), new gu(T, this.apiClient);
  }
}
class gu {
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
    const n = qr(e);
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
    const n = br(e);
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
    this.sendPlaybackControl(re.PLAY);
  }
  /**
   * Temporarily halt the music stream. Use `play` to resume from the current
   * position.
   *
   * @experimental
   */
  pause() {
    this.sendPlaybackControl(re.PAUSE);
  }
  /**
   * Stop the music stream and reset the state. Retains the current prompts
   * and config.
   *
   * @experimental
   */
  stop() {
    this.sendPlaybackControl(re.STOP);
  }
  /**
   * Resets the context of the music generation without stopping it.
   * Retains the current prompts and config.
   *
   * @experimental
   */
  resetContext() {
    this.sendPlaybackControl(re.RESET_CONTEXT);
  }
  /**
       Terminates the WebSocket connection.
  
       @experimental
     */
  close() {
    this.conn.close();
  }
}
function yu(t) {
  const e = {};
  return t.forEach((n, o) => {
    e[o] = n;
  }), e;
}
function Tu(t) {
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
const Cu = "FunctionResponse request must have an `id` field from the response of a ToolCall.FunctionalCalls in Google AI.";
async function _u(t, e, n) {
  const o = new ki();
  let i;
  n.data instanceof Blob ? i = await n.data.text() : n.data instanceof ArrayBuffer ? i = new TextDecoder().decode(n.data) : i = n.data;
  const r = JSON.parse(i);
  if (t.isVertexAI()) {
    const a = Or(r);
    Object.assign(o, a);
  } else
    Object.assign(o, r);
  e(o);
}
class Eu {
  constructor(e, n, o) {
    this.apiClient = e, this.auth = n, this.webSocketFactory = o, this.music = new mu(this.apiClient, this.auth, this.webSocketFactory);
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
    e.config && e.config.tools && Io(e.config.tools) && vo(p);
    const h = Au(p);
    if (this.apiClient.isVertexAI()) {
      const R = this.apiClient.getProject(), x = this.apiClient.getLocation(), k = this.apiClient.getApiKey(), G = !!R && !!x || !!k;
      this.apiClient.getCustomBaseUrl() && !G ? f = c : (f = `${c}/ws/google.cloud.aiplatform.${d}.LlmBidiService/BidiGenerateContent`, await this.auth.addAuthHeaders(h, f));
    } else {
      const R = this.apiClient.getApiKey();
      let x = "BidiGenerateContent", k = "key";
      R != null && R.startsWith("auth_tokens/") && (console.warn("Warning: Ephemeral token support is experimental and may change in future versions."), d !== "v1alpha" && console.warn("Warning: The SDK's ephemeral token support is in v1alpha only. Please use const ai = new GoogleGenAI({apiKey: token.name, httpOptions: { apiVersion: 'v1alpha' }}); before session connection."), x = "BidiGenerateContentConstrained", k = "access_token"), f = `${c}/ws/google.ai.generativelanguage.${d}.GenerativeService.${x}?${k}=${R}`;
    }
    let m = () => {
    };
    const g = new Promise((R) => {
      m = R;
    }), T = e.callbacks, y = function() {
      var R;
      (R = T == null ? void 0 : T.onopen) === null || R === void 0 || R.call(T), m({});
    }, C = this.apiClient, S = {
      onopen: y,
      onmessage: (R) => {
        _u(C, T.onmessage, R);
      },
      onerror: (n = T == null ? void 0 : T.onerror) !== null && n !== void 0 ? n : function(R) {
      },
      onclose: (o = T == null ? void 0 : T.onclose) !== null && o !== void 0 ? o : function(R) {
      }
    }, I = this.webSocketFactory.create(f, vu(h), S);
    I.connect(), await g;
    let E = D(this.apiClient, e.model);
    if (this.apiClient.isVertexAI() && E.startsWith("publishers/")) {
      const R = this.apiClient.getProject(), x = this.apiClient.getLocation();
      R && x && (E = `projects/${R}/locations/${x}/` + E);
    }
    let _ = {};
    this.apiClient.isVertexAI() && ((i = e.config) === null || i === void 0 ? void 0 : i.responseModalities) === void 0 && (e.config === void 0 ? e.config = { responseModalities: [Pe.AUDIO] } : e.config.responseModalities = [Pe.AUDIO]), !((r = e.config) === null || r === void 0) && r.generationConfig && console.warn("Setting `LiveConnectConfig.generation_config` is deprecated, please set the fields on `LiveConnectConfig` directly. This will become an error in a future version (not before Q3 2025).");
    const A = (u = (a = e.config) === null || a === void 0 ? void 0 : a.tools) !== null && u !== void 0 ? u : [], P = [];
    for (const R of A)
      if (this.isCallableTool(R)) {
        const x = R;
        P.push(await x.tool());
      } else
        P.push(R);
    P.length > 0 && (e.config.tools = P);
    const N = {
      model: E,
      config: e.config,
      callbacks: e.callbacks
    };
    return this.apiClient.isVertexAI() ? _ = Vr(this.apiClient, N) : _ = Hr(this.apiClient, N), delete _.config, I.send(JSON.stringify(_)), new Iu(I, this.apiClient);
  }
  // TODO: b/416041229 - Abstract this method to a common place.
  isCallableTool(e) {
    return "callTool" in e && typeof e.callTool == "function";
  }
}
const Su = {
  turnComplete: !0
};
class Iu {
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
        throw new Error(Cu);
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
    e = Object.assign(Object.assign({}, Su), e);
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
      realtimeInput: Jr(e)
    } : n = {
      realtimeInput: Br(e)
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
function vu(t) {
  const e = {};
  return t.forEach((n, o) => {
    e[o] = n;
  }), e;
}
function Au(t) {
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
const Vn = 10;
function bn(t) {
  var e, n, o;
  if (!((e = t == null ? void 0 : t.automaticFunctionCalling) === null || e === void 0) && e.disable)
    return !0;
  let i = !1;
  for (const a of (n = t == null ? void 0 : t.tools) !== null && n !== void 0 ? n : [])
    if (ue(a)) {
      i = !0;
      break;
    }
  if (!i)
    return !0;
  const r = (o = t == null ? void 0 : t.automaticFunctionCalling) === null || o === void 0 ? void 0 : o.maximumRemoteCalls;
  return r && (r < 0 || !Number.isInteger(r)) || r == 0 ? (console.warn("Invalid maximumRemoteCalls value provided for automatic function calling. Disabled automatic function calling. Please provide a valid integer value greater than 0. maximumRemoteCalls provided:", r), !0) : !1;
}
function ue(t) {
  return "callTool" in t && typeof t.callTool == "function";
}
function Ru(t) {
  var e, n, o;
  return (o = (n = (e = t.config) === null || e === void 0 ? void 0 : e.tools) === null || n === void 0 ? void 0 : n.some((i) => ue(i))) !== null && o !== void 0 ? o : !1;
}
function qn(t) {
  var e;
  const n = [];
  return !((e = t == null ? void 0 : t.config) === null || e === void 0) && e.tools && t.config.tools.forEach((o, i) => {
    if (ue(o))
      return;
    const r = o;
    r.functionDeclarations && r.functionDeclarations.length > 0 && n.push(i);
  }), n;
}
function Bn(t) {
  var e;
  return !(!((e = t == null ? void 0 : t.automaticFunctionCalling) === null || e === void 0) && e.ignoreCallHistory);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Pu extends X {
  constructor(e) {
    super(), this.apiClient = e, this.generateContent = async (n) => {
      var o, i, r, a, u;
      const c = await this.processParamsMaybeAddMcpUsage(n);
      if (this.maybeMoveToResponseJsonSchem(n), !Ru(n) || bn(n.config))
        return await this.generateContentInternal(c);
      const d = qn(n);
      if (d.length > 0) {
        const T = d.map((y) => `tools[${y}]`).join(", ");
        throw new Error(`Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations is not yet supported. Incompatible tools found at ${T}.`);
      }
      let f, p;
      const h = B(c.contents), m = (r = (i = (o = c.config) === null || o === void 0 ? void 0 : o.automaticFunctionCalling) === null || i === void 0 ? void 0 : i.maximumRemoteCalls) !== null && r !== void 0 ? r : Vn;
      let g = 0;
      for (; g < m && (f = await this.generateContentInternal(c), !(!f.functionCalls || f.functionCalls.length === 0)); ) {
        const T = f.candidates[0].content, y = [];
        for (const C of (u = (a = n.config) === null || a === void 0 ? void 0 : a.tools) !== null && u !== void 0 ? u : [])
          if (ue(C)) {
            const I = await C.callTool(f.functionCalls);
            y.push(...I);
          }
        g++, p = {
          role: "user",
          parts: y
        }, c.contents = B(c.contents), c.contents.push(T), c.contents.push(p), Bn(c.config) && (h.push(T), h.push(p));
      }
      return Bn(c.config) && (f.automaticFunctionCallingHistory = h), f;
    }, this.generateContentStream = async (n) => {
      var o, i, r, a, u;
      if (this.maybeMoveToResponseJsonSchem(n), bn(n.config)) {
        const p = await this.processParamsMaybeAddMcpUsage(n);
        return await this.generateContentStreamInternal(p);
      }
      const c = qn(n);
      if (c.length > 0) {
        const p = c.map((h) => `tools[${h}]`).join(", ");
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
    const a = await Promise.all(r.map(async (c) => ue(c) ? await c.tool() : c)), u = {
      model: e.model,
      contents: e.contents,
      config: Object.assign(Object.assign({}, e.config), { tools: a })
    };
    if (u.config.tools = a, e.config && e.config.tools && Io(e.config.tools)) {
      const c = (i = (o = e.config.httpOptions) === null || o === void 0 ? void 0 : o.headers) !== null && i !== void 0 ? i : {};
      let d = Object.assign({}, c);
      Object.keys(d).length === 0 && (d = this.apiClient.getDefaultHeaders()), vo(d), u.config.httpOptions = Object.assign(Object.assign({}, e.config.httpOptions), { headers: d });
    }
    return u;
  }
  async initAfcToolsMap(e) {
    var n, o, i;
    const r = /* @__PURE__ */ new Map();
    for (const a of (o = (n = e.config) === null || n === void 0 ? void 0 : n.tools) !== null && o !== void 0 ? o : [])
      if (ue(a)) {
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
    const r = (i = (o = (n = e.config) === null || n === void 0 ? void 0 : n.automaticFunctionCalling) === null || o === void 0 ? void 0 : o.maximumRemoteCalls) !== null && i !== void 0 ? i : Vn;
    let a = !1, u = 0;
    const c = await this.initAfcToolsMap(e);
    return function(d, f, p) {
      return O(this, arguments, function* () {
        for (var h, m, g, T, y, C; u < r; ) {
          a && (u++, a = !1);
          const _ = yield M(d.processParamsMaybeAddMcpUsage(p)), A = yield M(d.generateContentStreamInternal(_)), P = [], N = [];
          try {
            for (var S = !0, I = (m = void 0, $(A)), E; E = yield M(I.next()), h = E.done, !h; S = !0) {
              T = E.value, S = !1;
              const R = T;
              if (yield yield M(R), R.candidates && (!((y = R.candidates[0]) === null || y === void 0) && y.content)) {
                N.push(R.candidates[0].content);
                for (const x of (C = R.candidates[0].content.parts) !== null && C !== void 0 ? C : [])
                  if (u < r && x.functionCall) {
                    if (!x.functionCall.name)
                      throw new Error("Function call name was not returned by the model.");
                    if (f.has(x.functionCall.name)) {
                      const k = yield M(f.get(x.functionCall.name).callTool([x.functionCall]));
                      P.push(...k);
                    } else
                      throw new Error(`Automatic function calling was requested, but not all the tools the model used implement the CallableTool interface. Available tools: ${f.keys()}, mising tool: ${x.functionCall.name}`);
                  }
              }
            }
          } catch (R) {
            m = { error: R };
          } finally {
            try {
              !S && !h && (g = I.return) && (yield M(g.call(I)));
            } finally {
              if (m) throw m.error;
            }
          }
          if (P.length > 0) {
            a = !0;
            const R = new he();
            R.candidates = [
              {
                content: {
                  role: "user",
                  parts: P
                }
              }
            ], yield yield M(R);
            const x = [];
            x.push(...N), x.push({
              role: "user",
              parts: P
            });
            const k = B(p.contents).concat(x);
            p.contents = k;
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
      const d = Ln(this.apiClient, e);
      return u = v("{model}:generateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Fn(f), h = new he();
        return Object.assign(h, p), h;
      });
    } else {
      const d = Un(this.apiClient, e);
      return u = v("{model}:generateContent", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Gn(f), h = new he();
        return Object.assign(h, p), h;
      });
    }
  }
  async generateContentStreamInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Ln(this.apiClient, e);
      return u = v("{model}:streamGenerateContent?alt=sse", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.requestStream({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }), a.then(function(p) {
        return O(this, arguments, function* () {
          var h, m, g, T;
          try {
            for (var y = !0, C = $(p), S; S = yield M(C.next()), h = S.done, !h; y = !0) {
              T = S.value, y = !1;
              const I = T, E = Fn(yield M(I.json()), e);
              E.sdkHttpResponse = {
                headers: I.headers
              };
              const _ = new he();
              Object.assign(_, E), yield yield M(_);
            }
          } catch (I) {
            m = { error: I };
          } finally {
            try {
              !y && !h && (g = C.return) && (yield M(g.call(C)));
            } finally {
              if (m) throw m.error;
            }
          }
        });
      });
    } else {
      const d = Un(this.apiClient, e);
      return u = v("{model}:streamGenerateContent?alt=sse", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.requestStream({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }), a.then(function(p) {
        return O(this, arguments, function* () {
          var h, m, g, T;
          try {
            for (var y = !0, C = $(p), S; S = yield M(C.next()), h = S.done, !h; y = !0) {
              T = S.value, y = !1;
              const I = T, E = Gn(yield M(I.json()), e);
              E.sdkHttpResponse = {
                headers: I.headers
              };
              const _ = new he();
              Object.assign(_, E), yield yield M(_);
            }
          } catch (I) {
            m = { error: I };
          } finally {
            try {
              !y && !h && (g = C.return) && (yield M(g.call(C)));
            } finally {
              if (m) throw m.error;
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
      const d = El(this.apiClient, e);
      return u = v("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Il(f), h = new yn();
        return Object.assign(h, p), h;
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
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Sl(f), h = new yn();
        return Object.assign(h, p), h;
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
      const d = Ul(this.apiClient, e);
      return u = v("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Gl(f), h = new Tn();
        return Object.assign(h, p), h;
      });
    } else {
      const d = kl(this.apiClient, e);
      return u = v("{model}:predict", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Ll(f), h = new Tn();
        return Object.assign(h, p), h;
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
      const u = gl(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
        const d = yl(c), f = new Ei();
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
      const u = Ua(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
        const d = La(c), f = new Si();
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
      const u = ma(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = ga(c), f = new Ii();
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
      const u = Sa(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Ia(c), f = new vi();
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
      const d = jl(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Xe(f));
    } else {
      const d = Zl(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => ze(f));
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = aa(this.apiClient, e);
      return u = v("{models_url}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = da(f), h = new Cn();
        return Object.assign(h, p), h;
      });
    } else {
      const d = la(this.apiClient, e);
      return u = v("{models_url}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = ua(f), h = new Cn();
        return Object.assign(h, p), h;
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
      const d = Da(this.apiClient, e);
      return u = v("{model}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Xe(f));
    } else {
      const d = xa(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "PATCH",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => ze(f));
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
      const d = fl(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = hl(f), h = new _n();
        return Object.assign(h, p), h;
      });
    } else {
      const d = cl(this.apiClient, e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = pl(f), h = new _n();
        return Object.assign(h, p), h;
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
      const d = al(this.apiClient, e);
      return u = v("{model}:countTokens", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = dl(f), h = new En();
        return Object.assign(h, p), h;
      });
    } else {
      const d = ll(this.apiClient, e);
      return u = v("{model}:countTokens", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = ul(f), h = new En();
        return Object.assign(h, p), h;
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
      const u = el(this.apiClient, e);
      return r = v("{model}:computeTokens", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
        const d = tl(c), f = new Ai();
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
      const d = Bl(this.apiClient, e);
      return u = v("{model}:predictLongRunning", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const p = bl(f), h = new we();
        return Object.assign(h, p), h;
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
        const p = Vl(f), h = new we();
        return Object.assign(h, p), h;
      });
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class wu extends X {
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
      const d = mi(e);
      return u = v("{operationName}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a;
    } else {
      const d = hi(e);
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
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = li(e);
      return r = v("{resourceName}:fetchPredictOperation", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
function Mu(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && l(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Nu(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => Vu(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function xu(t, e, n) {
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
  n !== void 0 && u != null && l(n, ["bidiGenerateContentSetup"], Hu(t, u));
  const c = s(e, [
    "lockAdditionalFields"
  ]);
  return n !== void 0 && c != null && l(n, ["fieldMask"], c), o;
}
function Du(t, e) {
  const n = {}, o = s(e, ["config"]);
  return o != null && l(n, ["config"], xu(t, o, n)), n;
}
function ku(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Uu(t) {
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
function Lu(t) {
  const e = {};
  if (s(t, ["authConfig"]) !== void 0)
    throw new Error("authConfig parameter is not supported in Gemini API.");
  const n = s(t, ["enableWidget"]);
  return n != null && l(e, ["enableWidget"], n), e;
}
function Gu(t) {
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
function Fu(t, e) {
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
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], ct(p));
  const h = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && h != null && l(e, ["setup", "generationConfig", "thinkingConfig"], h);
  const m = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && m != null && l(e, ["setup", "generationConfig", "enableAffectiveDialog"], m);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], Nu(H(g)));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let A = ce(T);
    Array.isArray(A) && (A = A.map((P) => qu(de(P)))), l(e, ["setup", "tools"], A);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], bu(y));
  const C = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && C != null && l(e, ["setup", "inputAudioTranscription"], C);
  const S = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const I = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "realtimeInputConfig"], I);
  const E = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "contextWindowCompression"], E);
  const _ = s(t, ["proactivity"]);
  if (e !== void 0 && _ != null && l(e, ["setup", "proactivity"], _), s(t, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return n;
}
function Hu(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["setup", "model"], D(t, o));
  const i = s(e, ["config"]);
  return i != null && l(n, ["config"], Fu(i, n)), n;
}
function Vu(t) {
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
  r != null && l(e, ["fileData"], ku(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], Uu(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const c = s(t, ["inlineData"]);
  c != null && l(e, ["inlineData"], Mu(c));
  const d = s(t, ["text"]);
  d != null && l(e, ["text"], d);
  const f = s(t, ["thought"]);
  f != null && l(e, ["thought"], f);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && l(e, ["thoughtSignature"], p);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && l(e, ["videoMetadata"], h), e;
}
function bu(t) {
  const e = {}, n = s(t, ["handle"]);
  if (n != null && l(e, ["handle"], n), s(t, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return e;
}
function qu(t) {
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
  a != null && l(e, ["googleMaps"], Lu(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Gu(u));
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
function Bu(t) {
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
function Ju(t, e) {
  let n = null;
  const o = t.bidiGenerateContentSetup;
  if (typeof o == "object" && o !== null && "setup" in o) {
    const r = o.setup;
    typeof r == "object" && r !== null ? (t.bidiGenerateContentSetup = r, n = r) : delete t.bidiGenerateContentSetup;
  } else o !== void 0 && delete t.bidiGenerateContentSetup;
  const i = t.fieldMask;
  if (n) {
    const r = Bu(n);
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
class Ou extends X {
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
      const u = Du(this.apiClient, e);
      r = v("auth_tokens", u._url), a = u._query, delete u.config, delete u._url, delete u._query;
      const c = Ju(u, e.config);
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
function $u(t, e) {
  const n = {}, o = s(t, ["force"]);
  return e !== void 0 && o != null && l(e, ["_query", "force"], o), n;
}
function Wu(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["_url", "name"], n);
  const o = s(t, ["config"]);
  return o != null && $u(o, e), e;
}
function Ku(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "name"], n), e;
}
function Yu(t, e) {
  const n = {}, o = s(t, ["pageSize"]);
  e !== void 0 && o != null && l(e, ["_query", "pageSize"], o);
  const i = s(t, ["pageToken"]);
  return e !== void 0 && i != null && l(e, ["_query", "pageToken"], i), n;
}
function zu(t) {
  const e = {}, n = s(t, ["parent"]);
  n != null && l(e, ["_url", "parent"], n);
  const o = s(t, ["config"]);
  return o != null && Yu(o, e), e;
}
function Xu(t) {
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
class Qu extends X {
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
      const u = Ku(e);
      return r = v("{name}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
      const a = Wu(e);
      i = v("{name}", a._url), r = a._query, delete a._url, delete a._query, await this.apiClient.request({
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
      const u = zu(e);
      return r = v("{parent}/documents", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Xu(c), f = new Ri();
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
class Zu extends X {
  constructor(e, n = new Qu(e)) {
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
      const u = Ba(e);
      return r = v("fileSearchStores", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
      const u = $a(e);
      return r = v("{name}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
      const a = Oa(e);
      i = v("{name}", a._url), r = a._query, delete a._url, delete a._query, await this.apiClient.request({
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
      const u = Qa(e);
      return r = v("fileSearchStores", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Za(c), f = new Pi();
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
      const u = ja(e);
      return r = v("upload/v1beta/{file_search_store_name}:uploadToFileSearchStore", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = eu(c), f = new wi();
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
      const u = Ya(e);
      return r = v("{file_search_store_name}:importFile", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => {
        const d = Ka(c), f = new rt();
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
let Ao = function() {
  const { crypto: t } = globalThis;
  if (t != null && t.randomUUID)
    return Ao = t.randomUUID.bind(t), t.randomUUID();
  const e = new Uint8Array(1), n = t ? () => t.getRandomValues(e)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (o) => (+o ^ n() & 15 >> +o / 4).toString(16));
};
const ju = () => Ao();
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Ze(t) {
  return typeof t == "object" && t !== null && // Spec-compliant fetch implementations
  ("name" in t && t.name === "AbortError" || // Expo fetch
  "message" in t && String(t.message).includes("FetchRequestCanceledException"));
}
const je = (t) => {
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
      return new Ge({ message: o, cause: je(n) });
    const r = n;
    return e === 400 ? new Po(e, r, o, i) : e === 401 ? new wo(e, r, o, i) : e === 403 ? new Mo(e, r, o, i) : e === 404 ? new No(e, r, o, i) : e === 409 ? new xo(e, r, o, i) : e === 422 ? new Do(e, r, o, i) : e === 429 ? new ko(e, r, o, i) : e >= 500 ? new Uo(e, r, o, i) : new b(e, r, o, i);
  }
}
class et extends b {
  constructor({ message: e } = {}) {
    super(void 0, void 0, e || "Request was aborted.", void 0);
  }
}
class Ge extends b {
  constructor({ message: e, cause: n }) {
    super(void 0, void 0, e || "Connection error.", void 0), n && (this.cause = n);
  }
}
class Ro extends Ge {
  constructor({ message: e } = {}) {
    super({ message: e ?? "Request timed out." });
  }
}
class Po extends b {
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
class ko extends b {
}
class Uo extends b {
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const ed = /^[a-z][a-z0-9+.-]*:/i, td = (t) => ed.test(t);
let tt = (t) => (tt = Array.isArray, tt(t));
const nd = tt;
let od = nd;
const Jn = od;
function id(t) {
  if (!t)
    return !0;
  for (const e in t)
    return !1;
  return !0;
}
function sd(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
const rd = (t, e) => {
  if (typeof e != "number" || !Number.isInteger(e))
    throw new J(`${t} must be an integer`);
  if (e < 0)
    throw new J(`${t} must be a positive integer`);
  return e;
}, ld = (t) => {
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
const ad = (t) => new Promise((e) => setTimeout(e, t));
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const se = "0.0.1";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function ud() {
  return typeof Deno < "u" && Deno.build != null ? "deno" : typeof EdgeRuntime < "u" ? "edge" : Object.prototype.toString.call(typeof globalThis.process < "u" ? globalThis.process : 0) === "[object process]" ? "node" : "unknown";
}
const dd = () => {
  var t, e, n, o, i;
  const r = ud();
  if (r === "deno")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": se,
      "X-Stainless-OS": $n(Deno.build.os),
      "X-Stainless-Arch": On(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version == "string" ? Deno.version : (e = (t = Deno.version) === null || t === void 0 ? void 0 : t.deno) !== null && e !== void 0 ? e : "unknown"
    };
  if (typeof EdgeRuntime < "u")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": se,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  if (r === "node")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": se,
      "X-Stainless-OS": $n((n = globalThis.process.platform) !== null && n !== void 0 ? n : "unknown"),
      "X-Stainless-Arch": On((o = globalThis.process.arch) !== null && o !== void 0 ? o : "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": (i = globalThis.process.version) !== null && i !== void 0 ? i : "unknown"
    };
  const a = cd();
  return a ? {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": se,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": `browser:${a.browser}`,
    "X-Stainless-Runtime-Version": a.version
  } : {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": se,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function cd() {
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
const On = (t) => t === "x32" ? "x32" : t === "x86_64" || t === "x64" ? "x64" : t === "arm" ? "arm" : t === "aarch64" || t === "arm64" ? "arm64" : t ? `other:${t}` : "unknown", $n = (t) => (t = t.toLowerCase(), t.includes("ios") ? "iOS" : t === "android" ? "Android" : t === "darwin" ? "MacOS" : t === "win32" ? "Windows" : t === "freebsd" ? "FreeBSD" : t === "openbsd" ? "OpenBSD" : t === "linux" ? "Linux" : t ? `Other:${t}` : "Unknown");
let Ce;
const fd = () => Ce ?? (Ce = dd());
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function pd() {
  if (typeof fetch < "u")
    return fetch;
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new GeminiNextGenAPIClient({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function Lo(...t) {
  const e = globalThis.ReadableStream;
  if (typeof e > "u")
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  return new e(...t);
}
function hd(t) {
  let e = Symbol.asyncIterator in t ? t[Symbol.asyncIterator]() : t[Symbol.iterator]();
  return Lo({
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
async function md(t) {
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
const gd = ({ headers: t, body: e }) => ({
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
const Fo = () => {
  var t;
  if (typeof File > "u") {
    const { process: e } = globalThis, n = typeof ((t = e == null ? void 0 : e.versions) === null || t === void 0 ? void 0 : t.node) == "string" && parseInt(e.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (n ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function be(t, e, n) {
  return Fo(), new File(t, e ?? "unknown_file", n);
}
function yd(t) {
  return (typeof t == "object" && t !== null && ("name" in t && t.name && String(t.name) || "url" in t && t.url && String(t.url) || "filename" in t && t.filename && String(t.filename) || "path" in t && t.path && String(t.path)) || "").split(/[\\/]/).pop() || void 0;
}
const Td = (t) => t != null && typeof t == "object" && typeof t[Symbol.asyncIterator] == "function";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Ho = (t) => t != null && typeof t == "object" && typeof t.size == "number" && typeof t.type == "string" && typeof t.text == "function" && typeof t.slice == "function" && typeof t.arrayBuffer == "function", Cd = (t) => t != null && typeof t == "object" && typeof t.name == "string" && typeof t.lastModified == "number" && Ho(t), _d = (t) => t != null && typeof t == "object" && typeof t.url == "string" && typeof t.blob == "function";
async function Ed(t, e, n) {
  if (Fo(), t = await t, Cd(t))
    return t instanceof File ? t : be([await t.arrayBuffer()], t.name);
  if (_d(t)) {
    const i = await t.blob();
    return e || (e = new URL(t.url).pathname.split(/[\\/]/).pop()), be(await nt(i), e, n);
  }
  const o = await nt(t);
  if (e || (e = yd(t)), !(n != null && n.type)) {
    const i = o.find((r) => typeof r == "object" && "type" in r && r.type);
    typeof i == "string" && (n = Object.assign(Object.assign({}, n), { type: i }));
  }
  return be(o, e, n);
}
async function nt(t) {
  var e, n, o, i, r;
  let a = [];
  if (typeof t == "string" || ArrayBuffer.isView(t) || // includes Uint8Array, Buffer, etc.
  t instanceof ArrayBuffer)
    a.push(t);
  else if (Ho(t))
    a.push(t instanceof Blob ? t : await t.arrayBuffer());
  else if (Td(t))
    try {
      for (var u = !0, c = $(t), d; d = await c.next(), e = d.done, !e; u = !0) {
        i = d.value, u = !1;
        const f = i;
        a.push(...await nt(f));
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
    throw new Error(`Unexpected data type: ${typeof t}${f ? `; constructor: ${f}` : ""}${Sd(t)}`);
  }
  return a;
}
function Sd(t) {
  return typeof t != "object" || t === null ? "" : `; props: [${Object.getOwnPropertyNames(t).map((n) => `"${n}"`).join(", ")}]`;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Vo {
  constructor(e) {
    this._client = e;
  }
}
Vo._key = [];
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function bo(t) {
  return t.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const Wn = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null)), Id = (t = bo) => function(n, ...o) {
  if (n.length === 1)
    return n[0];
  let i = !1;
  const r = [], a = n.reduce((f, p, h) => {
    var m, g, T;
    /[?#]/.test(p) && (i = !0);
    const y = o[h];
    let C = (i ? encodeURIComponent : t)("" + y);
    return h !== o.length && (y == null || typeof y == "object" && // handle values from other realms
    y.toString === ((T = Object.getPrototypeOf((g = Object.getPrototypeOf((m = y.hasOwnProperty) !== null && m !== void 0 ? m : Wn)) !== null && g !== void 0 ? g : Wn)) === null || T === void 0 ? void 0 : T.toString)) && (C = y + "", r.push({
      start: f.length + p.length,
      length: C.length,
      error: `Value of type ${Object.prototype.toString.call(y).slice(8, -1)} is not a valid path parameter`
    })), f + p + (h === o.length ? "" : C);
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
    const p = r.reduce((h, m) => {
      const g = " ".repeat(m.start - f), T = "^".repeat(m.length);
      return f = m.start + m.length, h + g + T;
    }, "");
    throw new J(`Path parameters result in path with invalid segments:
${r.map((h) => h.error).join(`
`)}
${a}
${p}`);
  }
  return a;
}, _e = /* @__PURE__ */ Id(bo);
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class qo extends Vo {
  create(e, n) {
    var o;
    const { api_version: i = this._client.apiVersion } = e, r = Ne(e, ["api_version"]);
    if ("model" in r && "agent_config" in r)
      throw new J("Invalid request: specified `model` and `agent_config`. If specifying `model`, use `generation_config`.");
    if ("agent" in r && "generation_config" in r)
      throw new J("Invalid request: specified `agent` and `generation_config`. If specifying `agent`, use `agent_config`.");
    return this._client.post(_e`/${i}/interactions`, Object.assign(Object.assign({ body: r }, n), { stream: (o = e.stream) !== null && o !== void 0 ? o : !1 }));
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
    return this._client.delete(_e`/${i}/interactions/${e}`, o);
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
    return this._client.post(_e`/${i}/interactions/${e}/cancel`, o);
  }
  get(e, n = {}, o) {
    var i;
    const r = n ?? {}, { api_version: a = this._client.apiVersion } = r, u = Ne(r, ["api_version"]);
    return this._client.get(_e`/${a}/interactions/${e}`, Object.assign(Object.assign({ query: u }, o), { stream: (i = n == null ? void 0 : n.stream) !== null && i !== void 0 ? i : !1 }));
  }
}
qo._key = Object.freeze(["interactions"]);
class Bo extends qo {
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function vd(t) {
  let e = 0;
  for (const i of t)
    e += i.length;
  const n = new Uint8Array(e);
  let o = 0;
  for (const i of t)
    n.set(i, o), o += i.length;
  return n;
}
let Ee;
function pt(t) {
  let e;
  return (Ee ?? (e = new globalThis.TextEncoder(), Ee = e.encode.bind(e)))(t);
}
let Se;
function Kn(t) {
  let e;
  return (Se ?? (e = new globalThis.TextDecoder(), Se = e.decode.bind(e)))(t);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Fe {
  constructor() {
    this.buffer = new Uint8Array(), this.carriageReturnIndex = null;
  }
  decode(e) {
    if (e == null)
      return [];
    const n = e instanceof ArrayBuffer ? new Uint8Array(e) : typeof e == "string" ? pt(e) : e;
    this.buffer = vd([this.buffer, n]);
    const o = [];
    let i;
    for (; (i = Ad(this.buffer, this.carriageReturnIndex)) != null; ) {
      if (i.carriage && this.carriageReturnIndex == null) {
        this.carriageReturnIndex = i.index;
        continue;
      }
      if (this.carriageReturnIndex != null && (i.index !== this.carriageReturnIndex + 1 || i.carriage)) {
        o.push(Kn(this.buffer.subarray(0, this.carriageReturnIndex - 1))), this.buffer = this.buffer.subarray(this.carriageReturnIndex), this.carriageReturnIndex = null;
        continue;
      }
      const r = this.carriageReturnIndex !== null ? i.preceding - 1 : i.preceding, a = Kn(this.buffer.subarray(0, r));
      o.push(a), this.buffer = this.buffer.subarray(i.index), this.carriageReturnIndex = null;
    }
    return o;
  }
  flush() {
    return this.buffer.length ? this.decode(`
`) : [];
  }
}
Fe.NEWLINE_CHARS = /* @__PURE__ */ new Set([`
`, "\r"]);
Fe.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function Ad(t, e) {
  for (let i = e ?? 0; i < t.length; i++) {
    if (t[i] === 10)
      return { preceding: i, index: i + 1, carriage: !1 };
    if (t[i] === 13)
      return { preceding: i, index: i + 1, carriage: !0 };
  }
  return null;
}
function Rd(t) {
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
const xe = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
}, Yn = (t, e, n) => {
  if (t) {
    if (sd(xe, t))
      return t;
    V(n).warn(`${e} was set to ${JSON.stringify(t)}, expected one of ${JSON.stringify(Object.keys(xe))}`);
  }
};
function ye() {
}
function Ie(t, e, n) {
  return !e || xe[t] > xe[n] ? ye : e[t].bind(e);
}
const Pd = {
  error: ye,
  warn: ye,
  info: ye,
  debug: ye
};
let zn = /* @__PURE__ */ new WeakMap();
function V(t) {
  var e;
  const n = t.logger, o = (e = t.logLevel) !== null && e !== void 0 ? e : "off";
  if (!n)
    return Pd;
  const i = zn.get(n);
  if (i && i[0] === o)
    return i[1];
  const r = {
    error: Ie("error", n, o),
    warn: Ie("warn", n, o),
    info: Ie("info", n, o),
    debug: Ie("debug", n, o)
  };
  return zn.set(n, [o, r]), r;
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
class le {
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
        let h = !1;
        try {
          try {
            for (var m = !0, g = $(wd(e, n)), T; T = yield M(g.next()), c = T.done, !c; m = !0) {
              p = T.value, m = !1;
              const y = p;
              if (!h)
                if (y.data.startsWith("[DONE]")) {
                  h = !0;
                  continue;
                } else
                  try {
                    yield yield M(JSON.parse(y.data));
                  } catch (C) {
                    throw r.error("Could not parse message into JSON:", y.data), r.error("From chunk:", y.raw), C;
                  }
            }
          } catch (y) {
            d = { error: y };
          } finally {
            try {
              !m && !c && (f = g.return) && (yield M(f.call(g)));
            } finally {
              if (d) throw d.error;
            }
          }
          h = !0;
        } catch (y) {
          if (Ze(y))
            return yield M(void 0);
          throw y;
        } finally {
          h || n.abort();
        }
      });
    }
    return new le(a, n, o);
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
        const h = new Fe(), m = Go(e);
        try {
          for (var g = !0, T = $(m), y; y = yield M(T.next()), c = y.done, !c; g = !0) {
            p = y.value, g = !1;
            const C = p;
            for (const S of h.decode(C))
              yield yield M(S);
          }
        } catch (C) {
          d = { error: C };
        } finally {
          try {
            !g && !c && (f = T.return) && (yield M(f.call(T)));
          } finally {
            if (d) throw d.error;
          }
        }
        for (const C of h.flush())
          yield yield M(C);
      });
    }
    function a() {
      return O(this, arguments, function* () {
        var c, d, f, p;
        if (i)
          throw new J("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let h = !1;
        try {
          try {
            for (var m = !0, g = $(r()), T; T = yield M(g.next()), c = T.done, !c; m = !0) {
              p = T.value, m = !1;
              const y = p;
              h || y && (yield yield M(JSON.parse(y)));
            }
          } catch (y) {
            d = { error: y };
          } finally {
            try {
              !m && !c && (f = g.return) && (yield M(f.call(g)));
            } finally {
              if (d) throw d.error;
            }
          }
          h = !0;
        } catch (y) {
          if (Ze(y))
            return yield M(void 0);
          throw y;
        } finally {
          h || n.abort();
        }
      });
    }
    return new le(a, n, o);
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
      new le(() => i(e), this.controller, this.client),
      new le(() => i(n), this.controller, this.client)
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
    return Lo({
      async start() {
        n = e[Symbol.asyncIterator]();
      },
      async pull(o) {
        try {
          const { value: i, done: r } = await n.next();
          if (r)
            return o.close();
          const a = pt(JSON.stringify(i) + `
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
function wd(t, e) {
  return O(this, arguments, function* () {
    var o, i, r, a;
    if (!t.body)
      throw e.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new J("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new J("Attempted to iterate over a response with no body");
    const u = new Nd(), c = new Fe(), d = Go(t.body);
    try {
      for (var f = !0, p = $(Md(d)), h; h = yield M(p.next()), o = h.done, !o; f = !0) {
        a = h.value, f = !1;
        const m = a;
        for (const g of c.decode(m)) {
          const T = u.decode(g);
          T && (yield yield M(T));
        }
      }
    } catch (m) {
      i = { error: m };
    } finally {
      try {
        !f && !o && (r = p.return) && (yield M(r.call(p)));
      } finally {
        if (i) throw i.error;
      }
    }
    for (const m of c.flush()) {
      const g = u.decode(m);
      g && (yield yield M(g));
    }
  });
}
function Md(t) {
  return O(this, arguments, function* () {
    var n, o, i, r;
    let a = new Uint8Array();
    try {
      for (var u = !0, c = $(t), d; d = yield M(c.next()), n = d.done, !n; u = !0) {
        r = d.value, u = !1;
        const f = r;
        if (f == null)
          continue;
        const p = f instanceof ArrayBuffer ? new Uint8Array(f) : typeof f == "string" ? pt(f) : f;
        let h = new Uint8Array(a.length + p.length);
        h.set(a), h.set(p, a.length), a = h;
        let m;
        for (; (m = Rd(a)) !== -1; )
          yield yield M(a.slice(0, m)), a = a.slice(m);
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
class Nd {
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
    let [n, o, i] = xd(e, ":");
    return i.startsWith(" ") && (i = i.substring(1)), n === "event" ? this.event = i : n === "data" && this.data.push(i), null;
  }
}
function xd(t, e) {
  const n = t.indexOf(e);
  return n !== -1 ? [t.substring(0, n), e, t.substring(n + e.length)] : [t, "", ""];
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
async function Dd(t, e) {
  const { response: n, requestLogID: o, retryOfRequestLogID: i, startTime: r } = e, a = await (async () => {
    var u;
    if (e.options.stream)
      return V(t).debug("response", n.status, n.url, n.headers, n.body), e.options.__streamClass ? e.options.__streamClass.fromSSEResponse(n, e.controller, t) : le.fromSSEResponse(n, e.controller, t);
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
class ht extends Promise {
  constructor(e, n, o = Dd) {
    super((i) => {
      i(null);
    }), this.responsePromise = n, this.parseResponse = o, this.client = e;
  }
  _thenUnwrap(e) {
    return new ht(this.client, this.responsePromise, async (n, o) => e(await this.parseResponse(n, o), o));
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
const Jo = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* kd(t) {
  if (!t)
    return;
  if (Jo in t) {
    const { values: o, nulls: i } = t;
    yield* o.entries();
    for (const r of i)
      yield [r, null];
    return;
  }
  let e = !1, n;
  t instanceof Headers ? n = t.entries() : Jn(t) ? n = t : (e = !0, n = Object.entries(t ?? {}));
  for (let o of n) {
    const i = o[0];
    if (typeof i != "string")
      throw new TypeError("expected header name to be a string");
    const r = Jn(o[1]) ? o[1] : [o[1]];
    let a = !1;
    for (const u of r)
      u !== void 0 && (e && !a && (a = !0, yield [i, null]), yield [i, u]);
  }
}
const me = (t) => {
  const e = new Headers(), n = /* @__PURE__ */ new Set();
  for (const o of t) {
    const i = /* @__PURE__ */ new Set();
    for (const [r, a] of kd(o)) {
      const u = r.toLowerCase();
      i.has(u) || (e.delete(r), i.add(u)), a === null ? (e.delete(r), n.add(u)) : (e.append(r, a), n.delete(u));
    }
  }
  return { [Jo]: !0, values: e, nulls: n };
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const qe = (t) => {
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
var Oo;
class He {
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
    var n, o, i, r, a, u, c, { baseURL: d = qe("GEMINI_NEXT_GEN_API_BASE_URL"), apiKey: f = (n = qe("GEMINI_API_KEY")) !== null && n !== void 0 ? n : null, apiVersion: p = "v1beta" } = e, h = Ne(e, ["baseURL", "apiKey", "apiVersion"]);
    const m = Object.assign(Object.assign({
      apiKey: f,
      apiVersion: p
    }, h), { baseURL: d || "https://generativelanguage.googleapis.com" });
    this.baseURL = m.baseURL, this.timeout = (o = m.timeout) !== null && o !== void 0 ? o : He.DEFAULT_TIMEOUT, this.logger = (i = m.logger) !== null && i !== void 0 ? i : console;
    const g = "warn";
    this.logLevel = g, this.logLevel = (a = (r = Yn(m.logLevel, "ClientOptions.logLevel", this)) !== null && r !== void 0 ? r : Yn(qe("GEMINI_NEXT_GEN_API_LOG"), "process.env['GEMINI_NEXT_GEN_API_LOG']", this)) !== null && a !== void 0 ? a : g, this.fetchOptions = m.fetchOptions, this.maxRetries = (u = m.maxRetries) !== null && u !== void 0 ? u : 2, this.fetch = (c = m.fetch) !== null && c !== void 0 ? c : pd(), this.encoder = gd, this._options = m, this.apiKey = f, this.apiVersion = p, this.clientAdapter = m.clientAdapter;
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
    const n = me([e.headers]);
    if (!(n.values.has("authorization") || n.values.has("x-goog-api-key"))) {
      if (this.apiKey)
        return me([{ "x-goog-api-key": this.apiKey }]);
      if (this.clientAdapter.isVertexAI())
        return me([await this.clientAdapter.getAuthHeaders()]);
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
    return `${this.constructor.name}/JS ${se}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${ju()}`;
  }
  makeStatusError(e, n, o, i) {
    return b.generate(e, n, o, i);
  }
  buildURL(e, n, o) {
    const i = !this.baseURLOverridden() && o || this.baseURL, r = td(e) ? new URL(e) : new URL(i + (i.endsWith("/") && e.startsWith("/") ? e.slice(1) : e)), a = this.defaultQuery();
    return id(a) || (n = Object.assign(Object.assign({}, a), n)), typeof n == "object" && n && !Array.isArray(n) && (r.search = this.stringifyQuery(n)), r.toString();
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
    return new ht(this, this.makeRequest(e, n, void 0));
  }
  async makeRequest(e, n, o) {
    var i, r, a;
    const u = await e, c = (i = u.maxRetries) !== null && i !== void 0 ? i : this.maxRetries;
    n == null && (n = c), await this.prepareOptions(u);
    const { req: d, url: f, timeout: p } = await this.buildRequest(u, {
      retryCount: c - n
    });
    await this.prepareRequest(d, { url: f, options: u });
    const h = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0"), m = o === void 0 ? "" : `, retryOf: ${o}`, g = Date.now();
    if (V(this).debug(`[${h}] sending request`, ee({
      retryOfRequestLogID: o,
      method: u.method,
      url: f,
      options: u,
      headers: d.headers
    })), !((r = u.signal) === null || r === void 0) && r.aborted)
      throw new et();
    const T = new AbortController(), y = await this.fetchWithTimeout(f, d, p, T).catch(je), C = Date.now();
    if (y instanceof globalThis.Error) {
      const I = `retrying, ${n} attempts remaining`;
      if (!((a = u.signal) === null || a === void 0) && a.aborted)
        throw new et();
      const E = Ze(y) || /timed? ?out/i.test(String(y) + ("cause" in y ? String(y.cause) : ""));
      if (n)
        return V(this).info(`[${h}] connection ${E ? "timed out" : "failed"} - ${I}`), V(this).debug(`[${h}] connection ${E ? "timed out" : "failed"} (${I})`, ee({
          retryOfRequestLogID: o,
          url: f,
          durationMs: C - g,
          message: y.message
        })), this.retryRequest(u, n, o ?? h);
      throw V(this).info(`[${h}] connection ${E ? "timed out" : "failed"} - error; no more retries left`), V(this).debug(`[${h}] connection ${E ? "timed out" : "failed"} (error; no more retries left)`, ee({
        retryOfRequestLogID: o,
        url: f,
        durationMs: C - g,
        message: y.message
      })), E ? new Ro() : new Ge({ cause: y });
    }
    const S = `[${h}${m}] ${d.method} ${f} ${y.ok ? "succeeded" : "failed"} with status ${y.status} in ${C - g}ms`;
    if (!y.ok) {
      const I = await this.shouldRetry(y);
      if (n && I) {
        const R = `retrying, ${n} attempts remaining`;
        return await md(y.body), V(this).info(`${S} - ${R}`), V(this).debug(`[${h}] response error (${R})`, ee({
          retryOfRequestLogID: o,
          url: y.url,
          status: y.status,
          headers: y.headers,
          durationMs: C - g
        })), this.retryRequest(u, n, o ?? h, y.headers);
      }
      const E = I ? "error; no more retries left" : "error; not retryable";
      V(this).info(`${S} - ${E}`);
      const _ = await y.text().catch((R) => je(R).message), A = ld(_), P = A ? void 0 : _;
      throw V(this).debug(`[${h}] response error (${E})`, ee({
        retryOfRequestLogID: o,
        url: y.url,
        status: y.status,
        headers: y.headers,
        message: P,
        durationMs: Date.now() - g
      })), this.makeStatusError(y.status, A, P, y.headers);
    }
    return V(this).info(S), V(this).debug(`[${h}] response start`, ee({
      retryOfRequestLogID: o,
      url: y.url,
      status: y.status,
      headers: y.headers,
      durationMs: C - g
    })), { response: y, options: u, controller: T, requestLogID: h, retryOfRequestLogID: o, startTime: g };
  }
  async fetchWithTimeout(e, n, o, i) {
    const r = n || {}, { signal: a, method: u } = r, c = Ne(r, ["signal", "method"]), d = i.abort.bind(i);
    a && a.addEventListener("abort", d, { once: !0 });
    const f = setTimeout(d, o), p = globalThis.ReadableStream && c.body instanceof globalThis.ReadableStream || typeof c.body == "object" && c.body !== null && Symbol.asyncIterator in c.body, h = Object.assign(Object.assign(Object.assign({ signal: i.signal }, p ? { duplex: "half" } : {}), { method: "GET" }), c);
    u && (h.method = u.toUpperCase());
    try {
      return await this.fetch.call(void 0, e, h);
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
    return await ad(a), this.makeRequest(e, n - 1, o);
  }
  calculateDefaultRetryTimeoutMillis(e, n) {
    const r = n - e, a = Math.min(0.5 * Math.pow(2, r), 8), u = 1 - Math.random() * 0.25;
    return a * u * 1e3;
  }
  async buildRequest(e, { retryCount: n = 0 } = {}) {
    var o, i, r;
    const a = Object.assign({}, e), { method: u, path: c, query: d, defaultBaseURL: f } = a, p = this.buildURL(c, d, f);
    "timeout" in a && rd("timeout", a.timeout), a.timeout = (o = a.timeout) !== null && o !== void 0 ? o : this.timeout;
    const { bodyHeaders: h, body: m } = this.buildBody({ options: a }), g = await this.buildHeaders({ options: e, method: u, bodyHeaders: h, retryCount: n });
    return { req: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ method: u, headers: g }, a.signal && { signal: a.signal }), globalThis.ReadableStream && m instanceof globalThis.ReadableStream && { duplex: "half" }), m && { body: m }), (i = this.fetchOptions) !== null && i !== void 0 ? i : {}), (r = a.fetchOptions) !== null && r !== void 0 ? r : {}), url: p, timeout: a.timeout };
  }
  async buildHeaders({ options: e, method: n, bodyHeaders: o, retryCount: i }) {
    let r = {};
    this.idempotencyHeader && n !== "get" && (e.idempotencyKey || (e.idempotencyKey = this.defaultIdempotencyKey()), r[this.idempotencyHeader] = e.idempotencyKey);
    const a = await this.authHeaders(e);
    let u = me([
      r,
      Object.assign(Object.assign({ Accept: "application/json", "User-Agent": this.getUserAgent(), "X-Stainless-Retry-Count": String(i) }, e.timeout ? { "X-Stainless-Timeout": String(Math.trunc(e.timeout / 1e3)) } : {}), fd()),
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
    const o = me([n]);
    return (
      // Pass raw type verbatim
      ArrayBuffer.isView(e) || e instanceof ArrayBuffer || e instanceof DataView || typeof e == "string" && // Preserve legacy string encoding behavior for now
      o.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && e instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      e instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      e instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && e instanceof globalThis.ReadableStream ? { bodyHeaders: void 0, body: e } : typeof e == "object" && (Symbol.asyncIterator in e || Symbol.iterator in e && "next" in e && typeof e.next == "function") ? { bodyHeaders: void 0, body: hd(e) } : this.encoder({ body: e, headers: o })
    );
  }
}
He.DEFAULT_TIMEOUT = 6e4;
class F extends He {
  constructor() {
    super(...arguments), this.interactions = new Bo(this);
  }
}
Oo = F;
F.GeminiNextGenAPIClient = Oo;
F.GeminiNextGenAPIClientError = J;
F.APIError = b;
F.APIConnectionError = Ge;
F.APIConnectionTimeoutError = Ro;
F.APIUserAbortError = et;
F.NotFoundError = No;
F.ConflictError = xo;
F.RateLimitError = ko;
F.BadRequestError = Po;
F.AuthenticationError = wo;
F.InternalServerError = Uo;
F.PermissionDeniedError = Mo;
F.UnprocessableEntityError = Do;
F.toFile = Ed;
F.Interactions = Bo;
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Ud(t, e) {
  const n = {}, o = s(t, ["name"]);
  return o != null && l(n, ["_url", "name"], o), n;
}
function Ld(t, e) {
  const n = {}, o = s(t, ["name"]);
  return o != null && l(n, ["_url", "name"], o), n;
}
function Gd(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  return o != null && l(n, ["sdkHttpResponse"], o), n;
}
function Fd(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  return o != null && l(n, ["sdkHttpResponse"], o), n;
}
function Hd(t, e, n) {
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
function Vd(t, e, n) {
  const o = {};
  let i = s(n, [
    "config",
    "method"
  ]);
  if (i === void 0 && (i = "SUPERVISED_FINE_TUNING"), i === "SUPERVISED_FINE_TUNING") {
    const _ = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && _ != null && l(e, ["supervisedTuningSpec"], Be(_));
  } else if (i === "PREFERENCE_TUNING") {
    const _ = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && _ != null && l(e, ["preferenceOptimizationSpec"], Be(_));
  } else if (i === "DISTILLATION") {
    const _ = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && _ != null && l(e, ["distillationSpec"], Be(_));
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
    const _ = s(t, ["epochCount"]);
    e !== void 0 && _ != null && l(e, ["supervisedTuningSpec", "hyperParameters", "epochCount"], _);
  } else if (u === "PREFERENCE_TUNING") {
    const _ = s(t, ["epochCount"]);
    e !== void 0 && _ != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "epochCount"], _);
  } else if (u === "DISTILLATION") {
    const _ = s(t, ["epochCount"]);
    e !== void 0 && _ != null && l(e, ["distillationSpec", "hyperParameters", "epochCount"], _);
  }
  let c = s(n, [
    "config",
    "method"
  ]);
  if (c === void 0 && (c = "SUPERVISED_FINE_TUNING"), c === "SUPERVISED_FINE_TUNING") {
    const _ = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && _ != null && l(e, ["supervisedTuningSpec", "hyperParameters", "learningRateMultiplier"], _);
  } else if (c === "PREFERENCE_TUNING") {
    const _ = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && _ != null && l(e, [
      "preferenceOptimizationSpec",
      "hyperParameters",
      "learningRateMultiplier"
    ], _);
  } else if (c === "DISTILLATION") {
    const _ = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && _ != null && l(e, ["distillationSpec", "hyperParameters", "learningRateMultiplier"], _);
  }
  let d = s(n, ["config", "method"]);
  if (d === void 0 && (d = "SUPERVISED_FINE_TUNING"), d === "SUPERVISED_FINE_TUNING") {
    const _ = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && _ != null && l(e, ["supervisedTuningSpec", "exportLastCheckpointOnly"], _);
  } else if (d === "PREFERENCE_TUNING") {
    const _ = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && _ != null && l(e, ["preferenceOptimizationSpec", "exportLastCheckpointOnly"], _);
  } else if (d === "DISTILLATION") {
    const _ = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && _ != null && l(e, ["distillationSpec", "exportLastCheckpointOnly"], _);
  }
  let f = s(n, [
    "config",
    "method"
  ]);
  if (f === void 0 && (f = "SUPERVISED_FINE_TUNING"), f === "SUPERVISED_FINE_TUNING") {
    const _ = s(t, ["adapterSize"]);
    e !== void 0 && _ != null && l(e, ["supervisedTuningSpec", "hyperParameters", "adapterSize"], _);
  } else if (f === "PREFERENCE_TUNING") {
    const _ = s(t, ["adapterSize"]);
    e !== void 0 && _ != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "adapterSize"], _);
  } else if (f === "DISTILLATION") {
    const _ = s(t, ["adapterSize"]);
    e !== void 0 && _ != null && l(e, ["distillationSpec", "hyperParameters", "adapterSize"], _);
  }
  let p = s(n, [
    "config",
    "method"
  ]);
  if (p === void 0 && (p = "SUPERVISED_FINE_TUNING"), p === "SUPERVISED_FINE_TUNING") {
    const _ = s(t, ["tuningMode"]);
    e !== void 0 && _ != null && l(e, ["supervisedTuningSpec", "tuningMode"], _);
  }
  const h = s(t, [
    "customBaseModel"
  ]);
  e !== void 0 && h != null && l(e, ["customBaseModel"], h);
  let m = s(n, [
    "config",
    "method"
  ]);
  if (m === void 0 && (m = "SUPERVISED_FINE_TUNING"), m === "SUPERVISED_FINE_TUNING") {
    const _ = s(t, ["batchSize"]);
    e !== void 0 && _ != null && l(e, ["supervisedTuningSpec", "hyperParameters", "batchSize"], _);
  }
  let g = s(n, [
    "config",
    "method"
  ]);
  if (g === void 0 && (g = "SUPERVISED_FINE_TUNING"), g === "SUPERVISED_FINE_TUNING") {
    const _ = s(t, [
      "learningRate"
    ]);
    e !== void 0 && _ != null && l(e, ["supervisedTuningSpec", "hyperParameters", "learningRate"], _);
  }
  const T = s(t, ["labels"]);
  e !== void 0 && T != null && l(e, ["labels"], T);
  const y = s(t, ["beta"]);
  e !== void 0 && y != null && l(e, ["preferenceOptimizationSpec", "hyperParameters", "beta"], y);
  const C = s(t, [
    "baseTeacherModel"
  ]);
  e !== void 0 && C != null && l(e, ["distillationSpec", "baseTeacherModel"], C);
  const S = s(t, [
    "tunedTeacherModelSource"
  ]);
  e !== void 0 && S != null && l(e, ["distillationSpec", "tunedTeacherModelSource"], S);
  const I = s(t, [
    "sftLossWeightMultiplier"
  ]);
  e !== void 0 && I != null && l(e, ["distillationSpec", "hyperParameters", "sftLossWeightMultiplier"], I);
  const E = s(t, ["outputUri"]);
  return e !== void 0 && E != null && l(e, ["outputUri"], E), o;
}
function bd(t, e) {
  const n = {}, o = s(t, ["baseModel"]);
  o != null && l(n, ["baseModel"], o);
  const i = s(t, [
    "preTunedModel"
  ]);
  i != null && l(n, ["preTunedModel"], i);
  const r = s(t, [
    "trainingDataset"
  ]);
  r != null && Qd(r);
  const a = s(t, ["config"]);
  return a != null && Hd(a, n), n;
}
function qd(t, e) {
  const n = {}, o = s(t, ["baseModel"]);
  o != null && l(n, ["baseModel"], o);
  const i = s(t, [
    "preTunedModel"
  ]);
  i != null && l(n, ["preTunedModel"], i);
  const r = s(t, [
    "trainingDataset"
  ]);
  r != null && Zd(r, n, e);
  const a = s(t, ["config"]);
  return a != null && Vd(a, n, e), n;
}
function Bd(t, e) {
  const n = {}, o = s(t, ["name"]);
  return o != null && l(n, ["_url", "name"], o), n;
}
function Jd(t, e) {
  const n = {}, o = s(t, ["name"]);
  return o != null && l(n, ["_url", "name"], o), n;
}
function Od(t, e, n) {
  const o = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && l(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  e !== void 0 && r != null && l(e, ["_query", "pageToken"], r);
  const a = s(t, ["filter"]);
  return e !== void 0 && a != null && l(e, ["_query", "filter"], a), o;
}
function $d(t, e, n) {
  const o = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && l(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  e !== void 0 && r != null && l(e, ["_query", "pageToken"], r);
  const a = s(t, ["filter"]);
  return e !== void 0 && a != null && l(e, ["_query", "filter"], a), o;
}
function Wd(t, e) {
  const n = {}, o = s(t, ["config"]);
  return o != null && Od(o, n), n;
}
function Kd(t, e) {
  const n = {}, o = s(t, ["config"]);
  return o != null && $d(o, n), n;
}
function Yd(t, e) {
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
    Array.isArray(a) && (a = a.map((u) => $o(u))), l(n, ["tuningJobs"], a);
  }
  return n;
}
function zd(t, e) {
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
    Array.isArray(a) && (a = a.map((u) => ot(u))), l(n, ["tuningJobs"], a);
  }
  return n;
}
function Xd(t, e) {
  const n = {}, o = s(t, ["name"]);
  o != null && l(n, ["model"], o);
  const i = s(t, ["name"]);
  return i != null && l(n, ["endpoint"], i), n;
}
function Qd(t, e) {
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
function Zd(t, e, n) {
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
function $o(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["name"]);
  i != null && l(n, ["name"], i);
  const r = s(t, ["state"]);
  r != null && l(n, ["state"], ro(r));
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
  const h = s(t, ["_self"]);
  return h != null && l(n, ["tunedModel"], Xd(h)), n;
}
function ot(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["name"]);
  i != null && l(n, ["name"], i);
  const r = s(t, ["state"]);
  r != null && l(n, ["state"], ro(r));
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
  const h = s(t, ["baseModel"]);
  h != null && l(n, ["baseModel"], h);
  const m = s(t, ["tunedModel"]);
  m != null && l(n, ["tunedModel"], m);
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
  const C = s(t, [
    "distillationSpec"
  ]);
  C != null && l(n, ["distillationSpec"], C);
  const S = s(t, [
    "tuningDataStats"
  ]);
  S != null && l(n, ["tuningDataStats"], S);
  const I = s(t, [
    "encryptionSpec"
  ]);
  I != null && l(n, ["encryptionSpec"], I);
  const E = s(t, [
    "partnerModelTuningSpec"
  ]);
  E != null && l(n, ["partnerModelTuningSpec"], E);
  const _ = s(t, [
    "customBaseModel"
  ]);
  _ != null && l(n, ["customBaseModel"], _);
  const A = s(t, ["experiment"]);
  A != null && l(n, ["experiment"], A);
  const P = s(t, ["labels"]);
  P != null && l(n, ["labels"], P);
  const N = s(t, ["outputUri"]);
  N != null && l(n, ["outputUri"], N);
  const R = s(t, ["pipelineJob"]);
  R != null && l(n, ["pipelineJob"], R);
  const x = s(t, [
    "serviceAccount"
  ]);
  x != null && l(n, ["serviceAccount"], x);
  const k = s(t, [
    "tunedModelDisplayName"
  ]);
  k != null && l(n, ["tunedModelDisplayName"], k);
  const G = s(t, [
    "veoTuningSpec"
  ]);
  return G != null && l(n, ["veoTuningSpec"], G), n;
}
function jd(t, e) {
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
function Be(t, e) {
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
class ec extends X {
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
          state: Oe.JOB_STATE_QUEUED
        };
      }
    };
  }
  async getInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Jd(e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => ot(f));
    } else {
      const d = Bd(e);
      return u = v("{name}", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => $o(f));
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", c = {};
    if (this.apiClient.isVertexAI()) {
      const d = Kd(e);
      return u = v("tuningJobs", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = zd(f), h = new Sn();
        return Object.assign(h, p), h;
      });
    } else {
      const d = Wd(e);
      return u = v("tunedModels", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Yd(f), h = new Sn();
        return Object.assign(h, p), h;
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
      const d = Ld(e);
      return u = v("{name}:cancel", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Fd(f), h = new In();
        return Object.assign(h, p), h;
      });
    } else {
      const d = Ud(e);
      return u = v("{name}:cancel", d._url), c = d._query, delete d._url, delete d._query, a = this.apiClient.request({
        path: u,
        queryParams: c,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Gd(f), h = new In();
        return Object.assign(h, p), h;
      });
    }
  }
  async tuneInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = qd(e, e);
      return r = v("tuningJobs", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
      })), i.then((c) => ot(c));
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  async tuneMldevInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const u = bd(e);
      return r = v("tunedModels", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
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
      })), i.then((c) => jd(c));
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class tc {
  async download(e, n) {
    throw new Error("Download to file is not supported in the browser, please use a browser compliant download like an <a> tag.");
  }
}
const nc = 1024 * 1024 * 8, oc = 3, ic = 1e3, sc = 2, De = "x-goog-upload-status";
async function rc(t, e, n) {
  var o;
  const i = await Wo(t, e, n), r = await (i == null ? void 0 : i.json());
  if (((o = i == null ? void 0 : i.headers) === null || o === void 0 ? void 0 : o[De]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  return r.file;
}
async function lc(t, e, n) {
  var o;
  const i = await Wo(t, e, n), r = await (i == null ? void 0 : i.json());
  if (((o = i == null ? void 0 : i.headers) === null || o === void 0 ? void 0 : o[De]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  const a = eo(r), u = new lt();
  return Object.assign(u, a), u;
}
async function Wo(t, e, n) {
  var o, i;
  let r = 0, a = 0, u = new We(new Response()), c = "upload";
  for (r = t.size; a < r; ) {
    const d = Math.min(nc, r - a), f = t.slice(a, a + d);
    a + d >= r && (c += ", finalize");
    let p = 0, h = ic;
    for (; p < oc && (u = await n.request({
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
    }), !(!((o = u == null ? void 0 : u.headers) === null || o === void 0) && o[De])); )
      p++, await uc(h), h = h * sc;
    if (a += d, ((i = u == null ? void 0 : u.headers) === null || i === void 0 ? void 0 : i[De]) !== "active")
      break;
    if (r <= a)
      throw new Error("All content has been uploaded, but the upload status is not finalized.");
  }
  return u;
}
async function ac(t) {
  return { size: t.size, type: t.type };
}
function uc(t) {
  return new Promise((e) => setTimeout(e, t));
}
class dc {
  async upload(e, n, o) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await rc(e, n, o);
  }
  async uploadToFileSearchStore(e, n, o) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await lc(e, n, o);
  }
  async stat(e) {
    if (typeof e == "string")
      throw new Error("File path is not supported in browser uploader.");
    return await ac(e);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class cc {
  create(e, n, o) {
    return new fc(e, n, o);
  }
}
class fc {
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
const Xn = "x-goog-api-key";
class pc {
  constructor(e) {
    this.apiKey = e;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addAuthHeaders(e, n) {
    if (e.get(Xn) === null) {
      if (this.apiKey.startsWith("auth_tokens/"))
        throw new Error("Ephemeral tokens are only supported by the live API.");
      if (!this.apiKey)
        throw new Error("API key is missing. Please provide a valid API key.");
      e.append(Xn, this.apiKey);
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const hc = "gl-node/";
class mc {
  get interactions() {
    if (this._interactions !== void 0)
      return this._interactions;
    console.warn("GoogleGenAI.interactions: Interactions usage is experimental and may change in future versions.");
    const e = this.httpOptions;
    e != null && e.extraBody && console.warn("GoogleGenAI.interactions: Client level httpOptions.extraBody is not supported by the interactions client and will be ignored.");
    const n = new F({
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
    const o = si(
      e.httpOptions,
      e.vertexai,
      /*vertexBaseUrlFromEnv*/
      void 0,
      /*geminiBaseUrlFromEnv*/
      void 0
    );
    o && (e.httpOptions ? e.httpOptions.baseUrl = o : e.httpOptions = { baseUrl: o }), this.apiVersion = e.apiVersion, this.httpOptions = e.httpOptions;
    const i = new pc(this.apiKey);
    this.apiClient = new au({
      auth: i,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
      vertexai: this.vertexai,
      httpOptions: this.httpOptions,
      userAgentExtra: hc + "web",
      uploader: new dc(),
      downloader: new tc()
    }), this.models = new Pu(this.apiClient), this.live = new Eu(this.apiClient, i, new cc()), this.batches = new Ls(this.apiClient), this.chats = new gr(this.models, this.apiClient), this.caches = new pr(this.apiClient), this.files = new wr(this.apiClient), this.operations = new wu(this.apiClient), this.authTokens = new Ou(this.apiClient), this.tunings = new ec(this.apiClient), this.fileSearchStores = new Zu(this.apiClient);
  }
}
class ge {
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
      contents: e.messages.filter((c) => c.role !== "system").map((c) => this.mapMessage(c))
    }, u = {};
    return e.temperature !== void 0 && (u.temperature = e.temperature), e.maxTokens !== void 0 && (u.maxOutputTokens = e.maxTokens), e.topP !== void 0 && (u.topP = e.topP), e.stop !== void 0 && (u.stopSequences = e.stop), o && o.length > 0 && (u.tools = [{ functionDeclarations: o }]), e.system && (u.systemInstruction = {
      role: "user",
      parts: [{ text: e.system }]
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
class gc {
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
    var a, u, c, d, f, p, h, m, g, T, y, C, S, I;
    console.log("[GeminiToolHandler] Starting streaming request with tools", {
      model: e.model,
      contentsCount: (a = e.contents) == null ? void 0 : a.length,
      toolsCount: (u = e.tools) == null ? void 0 : u.length
    }), console.log("[GeminiToolHandler] Calling generateContentStream...");
    const n = await this.client.models.generateContentStream(e);
    console.log("[GeminiToolHandler] generateContentStream returned, starting iteration");
    let o = 0, i = null, r = "";
    try {
      for await (const E of n) {
        if (o++, i = E, console.log("[GeminiToolHandler] Chunk received", {
          chunkCount: o,
          chunkKeys: Object.keys(E || {}),
          hasText: !!E.text,
          textLength: ((c = E.text) == null ? void 0 : c.length) || 0,
          hasCandidates: !!E.candidates,
          candidatesCount: ((d = E.candidates) == null ? void 0 : d.length) || 0
        }), (f = E.candidates) != null && f[0]) {
          const P = E.candidates[0];
          console.log("[GeminiToolHandler] Candidate details", {
            chunkCount: o,
            hasContent: !!P.content,
            partsCount: ((h = (p = P.content) == null ? void 0 : p.parts) == null ? void 0 : h.length) || 0,
            finishReason: P.finishReason
          }), (m = P.content) != null && m.parts && P.content.parts.forEach((N, R) => {
            var x, k;
            console.log("[GeminiToolHandler] Part details", {
              chunkCount: o,
              partIndex: R,
              partKeys: Object.keys(N || {}),
              hasText: !!N.text,
              hasFunctionCall: !!N.functionCall,
              functionCallName: (x = N.functionCall) == null ? void 0 : x.name,
              functionCallArgsType: typeof ((k = N.functionCall) == null ? void 0 : k.args)
            });
          });
        }
        const _ = E.text;
        _ && this.tokenCallback && (r += _, this.tokenCallback(_), console.log("[GeminiToolHandler] Sent text to callback", {
          chunkCount: o,
          textLength: _.length,
          accumulatedLength: r.length
        }));
        const A = (T = (g = E.candidates) == null ? void 0 : g[0]) == null ? void 0 : T.finishReason;
        if (A) {
          console.log("[GeminiToolHandler] Detected finish reason, breaking loop", {
            chunkCount: o,
            finishReason: A,
            hasFunctionCall: !!((I = (S = (C = (y = E.candidates) == null ? void 0 : y[0]) == null ? void 0 : C.content) == null ? void 0 : S.parts) != null && I.some((P) => P.functionCall))
          });
          break;
        }
      }
      console.log("[GeminiToolHandler] Stream iteration completed successfully", {
        totalChunks: o
      });
    } catch (E) {
      throw console.error("[GeminiToolHandler] Error during streaming", {
        error: E,
        errorMessage: E instanceof Error ? E.message : String(E),
        errorStack: E instanceof Error ? E.stack : void 0,
        chunkCount: o,
        accumulatedTextLength: r.length
      }), E;
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
class yc {
  constructor(e, n, o) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "apiEndpoint");
    w(this, "tools", []);
    w(this, "onToolUse");
    w(this, "toolHandler");
    const i = e ? {
      apiKey: "placeholder",
      httpOptions: {
        baseUrl: e,
        headers: { Authorization: `Bearer ${n}` }
      }
    } : { apiKey: n };
    this.client = new mc(i), this.defaultModel = o || "gemini-pro", this.apiEndpoint = e, console.log(`GeminiChatProvider initialized with model ${this.defaultModel}, endpoint: ${e || "(default)"}`);
  }
  setTools(e = [], n) {
    this.tools = e, this.onToolUse = n, this.toolHandler = new gc(this.client, this.apiEndpoint);
  }
  /**
   * Send a chat request to Gemini
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    var r, a, u, c, d, f, p, h;
    if (console.log("[GeminiChatProvider] v1.03 chat called", {
      hasThreadId: !!e.thread_id,
      thread_id: e.thread_id,
      streaming: e.streaming !== !1,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, n);
      return;
    }
    const o = e.model || this.defaultModel;
    ge.convertToolsToGeminiFormat(this.tools);
    const i = ge.toGeminiRequest(e, o, []);
    console.log("[GeminiChatProvider] Converted request", {
      model: o,
      hasConfig: !!i.config,
      contentsCount: i.contents.length,
      streaming: e.streaming !== !1
    });
    try {
      if (e.streaming !== !1) {
        let m = "";
        console.log("[GeminiChatProvider] Using streaming mode");
        const g = await this.client.models.generateContentStream({
          model: o,
          ...i
        });
        console.log("[GeminiChatProvider] Stream started, processing chunks");
        let T = 0, y = !1, C = null;
        try {
          for await (const S of g) {
            if (T++, S.text && (m += S.text), S && S.candidates && S.candidates[0]) {
              const E = S.candidates[0];
              if ((r = E.content) != null && r.parts)
                for (const _ of E.content.parts) {
                  if (_.text) {
                    const A = _.text;
                    if (console.log("[GeminiChatProvider] Processing text chunk:", A.substring(0, 50), "length:", A.length), A && n)
                      try {
                        n(A), console.log("[GeminiChatProvider] Successfully called onTokenReceived for chunk");
                      } catch (P) {
                        console.error("[GeminiChatProvider] Error calling onTokenReceived:", P);
                      }
                    else
                      console.warn("[GeminiChatProvider] Skipping token - text:", !!A, "hasCallback:", !!n);
                    console.log("Text:", _.text);
                  }
                  _.inlineData && _.inlineData.mimeType && (C = {
                    mimeType: _.inlineData.mimeType,
                    data: _.inlineData.data || ""
                  }, console.log("[GeminiChatProvider] Detected inline data", {
                    mimeType: C.mimeType,
                    dataLength: C.data.length
                  }));
                }
            }
            console.log("[GeminiChatProvider] Received chunk", {
              chunkCount: T,
              hasText: !!S.text,
              hasInlineData: !!C,
              finishReason: (u = (a = S.candidates) == null ? void 0 : a[0]) == null ? void 0 : u.finishReason
            });
            const I = (d = (c = S.candidates) == null ? void 0 : c[0]) == null ? void 0 : d.finishReason;
            if (I) {
              console.log("[GeminiChatProvider] Detected finish reason, breaking loop", { finishReason: I }), y = !0;
              break;
            }
          }
        } catch (S) {
          throw console.error("[GeminiChatProvider] Error during streaming", S), S;
        }
        if (console.log("[GeminiChatProvider] Stream loop exited", { chunkCount: T, isDone: y, hasInlineData: !!C }), C && n) {
          const S = `![](data:${C.mimeType};base64,${C.data})`;
          console.log("[GeminiChatProvider] Appending inline data as markdown", {
            mimeType: C.mimeType,
            dataLength: C.data.length
          });
          const I = `

${S}`;
          n(I);
        }
        console.log("[GeminiChatProvider] Stream completed");
      } else {
        console.log("[GeminiChatProvider] Using non-streaming mode");
        const m = await this.client.models.generateContent({
          model: o,
          ...i
        }), g = m.text;
        let T = null;
        const y = (h = (p = (f = m.candidates) == null ? void 0 : f[0]) == null ? void 0 : p.content) == null ? void 0 : h.parts;
        if (y)
          for (const C of y)
            C.inlineData && C.inlineData.mimeType && (T = {
              mimeType: C.inlineData.mimeType,
              data: C.inlineData.data || ""
            }, console.log("[GeminiChatProvider] Detected inline data in non-streaming response", {
              mimeType: T.mimeType,
              dataLength: T.data.length
            }));
        if (console.log("[GeminiChatProvider] Response received", {
          textLength: (g == null ? void 0 : g.length) || 0,
          hasText: !!g,
          hasInlineData: !!T
        }), g && n && n(g), T && n) {
          const C = `![](data:${T.mimeType};base64,${T.data})`;
          console.log("[GeminiChatProvider] Appending inline data as markdown", {
            mimeType: T.mimeType,
            dataLength: T.data.length
          });
          const S = `

${C}`;
          n(S);
        }
      }
    } catch (m) {
      console.error("[GeminiChatProvider] Error in Gemini API call:", m);
      const g = ge.mapError(m);
      throw console.log("[GeminiChatProvider] Decoded error message:", g), n && n(`

**Error:** ${g}`), m;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   * Implements streaming tool orchestration loop with multiple sequential tool calls
   */
  async chatWithTools(e, n) {
    var p, h, m, g, T, y, C, S, I, E, _;
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
    const o = e.model || this.defaultModel, i = ge.convertToolsToGeminiFormat(this.tools), r = ge.toGeminiRequest(e, o, i), a = e.streaming !== !1;
    let u = { model: o, ...r }, c = r.contents, d = 0;
    console.log("[GeminiChatProvider] Starting tool orchestration loop", {
      initialMessagesCount: c.length,
      toolsCount: i.length,
      shouldStream: a,
      threadId: e.thread_id,
      branchId: e.branch_id
    });
    let f = e.branch_id || "";
    for (; d < Z.MAX_TOOL_ITERATIONS; ) {
      d++, f = Z.setBranchIteration(f, d), e.branch_id = f, console.log("[GeminiChatProvider] Tool loop iteration", {
        iteration: d,
        this_branch_id: f,
        messagesCount: c.length
      }), u = { ...u, contents: c };
      try {
        if (a) {
          console.log("[GeminiChatProvider] Making streaming request with tools:"), console.log("  Iteration:", d), console.log("  Tools count:", i.length), console.log("  Messages count:", c.length);
          let A = null, P = !1;
          try {
            const k = await this.client.models.generateContentStream(u);
            console.log("[GeminiChatProvider] Started streaming, consuming chunks", { iteration: d });
            try {
              let G = 0;
              const U = [];
              for await (const L of k) {
                if (G++, A = L, L && L.candidates && L.candidates[0]) {
                  const pe = L.candidates[0];
                  if ((p = pe.content) != null && p.parts)
                    for (const ie of pe.content.parts)
                      U.push(ie), ie.text && n && n(ie.text);
                }
                const K = (m = (h = L.candidates) == null ? void 0 : h[0]) == null ? void 0 : m.finishReason;
                if (K) {
                  console.log("[GeminiChatProvider] Stream finish", { chunkCount: G, finishReason: K });
                  break;
                }
              }
              U.length > 0 && (A = {
                candidates: [{
                  content: { role: "model", parts: U },
                  finishReason: (T = (g = A == null ? void 0 : A.candidates) == null ? void 0 : g[0]) == null ? void 0 : T.finishReason
                }]
              });
            } catch (G) {
              const U = G instanceof Error ? G.message : String(G);
              if (U.includes("Incomplete JSON") || U.includes("invalid chunk"))
                console.warn("[GeminiChatProvider] JSON streaming error, falling back to non-streaming", {
                  iteration: d,
                  errorMessage: U
                }), P = !0;
              else
                throw G;
            }
          } catch (k) {
            console.warn("[GeminiChatProvider] Stream error, will retry non-streaming", { iteration: d, error: k }), P = !0;
          }
          if (P) {
            console.log("[GeminiChatProvider] Retrying with non-streaming mode", { iteration: d }), A = await this.client.models.generateContent(u);
            const k = this.toolHandler.extractTextContent(A);
            k && n && n(k);
          }
          const N = this.toolHandler.extractToolUses(A);
          if (console.log("[GeminiChatProvider] Extracted tool uses", {
            iteration: d,
            toolUsesCount: N.length,
            usedFallback: P
          }), N.length === 0) {
            console.log("[GeminiChatProvider] No tool calls, ending loop", { iteration: d });
            return;
          }
          c = this.appendMessage(c, {
            role: "model",
            parts: ((S = (C = (y = A.candidates) == null ? void 0 : y[0]) == null ? void 0 : C.content) == null ? void 0 : S.parts) || []
          }), console.log("[GeminiChatProvider] Executing tools", {
            iteration: d,
            toolUsesCount: N.length
          });
          const R = await this.executeTools(N);
          console.log("[GeminiChatProvider] Formatting tool results for Gemini", {
            iteration: d,
            toolUsesCount: N.length,
            resultsCount: R.length
          });
          const x = this.toolHandler.formatToolResults(N, R);
          console.log("[GeminiChatProvider] Tool results formatted", {
            iteration: d,
            formattedResultsCount: x.length
          }), c = this.appendMessage(c, {
            role: "user",
            parts: x
          }), console.log("[GeminiChatProvider] Tool results added to messages, continuing loop", {
            iteration: d,
            newMessagesCount: c.length
          });
        } else {
          console.log("[GeminiChatProvider] Making non-streaming request with tools", {
            iteration: d,
            messagesCount: c.length
          });
          const A = await this.client.models.generateContent(u);
          console.log("[GeminiChatProvider] Non-streaming response received", {
            iteration: d
          });
          const P = this.toolHandler.extractTextContent(A);
          P && n && (n(P), console.log("[GeminiChatProvider] Sent text content", {
            iteration: d,
            textLength: P.length
          }));
          const N = this.toolHandler.extractToolUses(A);
          if (console.log("[GeminiChatProvider] Extracted tool uses", {
            iteration: d,
            toolUsesCount: N.length
          }), N.length === 0) {
            console.log("[GeminiChatProvider] No tool calls in response, ending loop", {
              iteration: d
            });
            return;
          }
          c = this.appendMessage(c, {
            role: "model",
            parts: ((_ = (E = (I = A.candidates) == null ? void 0 : I[0]) == null ? void 0 : E.content) == null ? void 0 : _.parts) || []
          }), console.log("[GeminiChatProvider] Executing tools", {
            iteration: d,
            toolUsesCount: N.length
          });
          const R = await this.executeTools(N);
          console.log("[GeminiChatProvider] Formatting tool results for Gemini", {
            iteration: d,
            toolUsesCount: N.length,
            resultsCount: R.length
          });
          const x = this.toolHandler.formatToolResults(N, R);
          console.log("[GeminiChatProvider] Tool results formatted", {
            iteration: d,
            formattedResultsCount: x.length
          }), c = this.appendMessage(c, {
            role: "user",
            parts: x
          }), console.log("[GeminiChatProvider] Tool results added to messages, continuing loop", {
            iteration: d,
            newMessagesCount: c.length
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
class Tc extends jn {
  constructor(e, n, o) {
    if (super(e, n, o), this.detectAzureEndpoint(e)) {
      const r = o, a = "2024-04-01-preview";
      this.client = new zo({
        endpoint: e,
        apiKey: n,
        deployment: r,
        apiVersion: a,
        defaultHeaders: { "api-key": n },
        dangerouslyAllowBrowser: !0
      }), console.log(`CopilotChatProvider initialized (Azure) endpoint: ${e} deployment: ${r} apiVersion: ${a}`);
    } else
      this.client = new Zn({
        apiKey: n,
        baseURL: e,
        dangerouslyAllowBrowser: !0
      }), console.log(`CopilotChatProvider initialized (proxy) endpoint: ${e} model: ${o}`);
  }
  setTools(e = [], n) {
    super.setTools(e, n);
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
var Re = /* @__PURE__ */ ((t) => (t.OLLAMA = "ollama", t.OPENAI = "openai", t.ANTHROPIC = "anthropic", t.PERPLEXITY = "perplexity", t.GEMINI = "gemini", t.COPILOT = "copilot", t))(Re || {});
class Cc {
  /**
   * Creates an appropriate chat provider based on the provider type
   */
  static createProvider(e, n) {
    switch (e) {
      case "ollama":
        return new Zo(n.url, n.apiKey || "", n.model);
      case "openai":
        if (!n.apiKey)
          throw new Error("API key is required for OpenAI provider");
        return new jn(n.url, n.apiKey, n.model);
      case "anthropic":
        if (!n.apiKey)
          throw new Error("API key is required for Claude provider");
        return new ti(n.url, n.apiKey, n.model);
      case "gemini":
        if (!n.apiKey)
          throw new Error("API key is required for Gemini provider");
        return new yc(n.url, n.apiKey, n.model);
      case "copilot":
        if (!n.apiKey)
          throw new Error("API key is required for Copilot provider");
        return new Tc(n.url, n.apiKey, n.model);
      case "perplexity":
        throw new Error("PerplexityChatProvider not implemented yet");
      default:
        throw new Error(`Unsupported provider type: ${e}`);
    }
  }
}
class _c {
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
class Sc {
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
class Ic {
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
function vc(t) {
  switch (t.toLowerCase()) {
    case Re.OPENAI:
      return new _c();
    case Re.ANTHROPIC:
      return new Ec();
    case Re.OLLAMA:
      return new Sc();
    default:
      return new Ic();
  }
}
class Ac {
  constructor(e, n, o, i, r) {
    w(this, "accumulatedResponse", "");
    w(this, "requestStartTime");
    w(this, "firstTokenTime");
    w(this, "tokenCounter");
    w(this, "originalCallback");
    w(this, "totalTokens", 0);
    w(this, "tokensReceived", 0);
    w(this, "isFirstToken", !0);
    this.provider = e, this.model = n, this.prompt = o, this.onComplete = i, this.requestStartTime = Date.now(), this.originalCallback = r, this.tokenCounter = vc(e);
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
    return new Ac(
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
let it = ne;
class xc {
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
    this.providerType = e, this.config = n, this.provider = this.initializeProvider(), this.auditService = it.getInstance({
      enabled: o,
      logToConsole: !0,
      logToServer: !1
    });
  }
  /**
   * Initialize the appropriate provider based on provider type
   */
  initializeProvider() {
    return Cc.createProvider(this.providerType, this.config);
  }
  setTools(e, n) {
    this.provider.setTools(e, n);
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
class Rc {
  static toOllamaRequest(e) {
    return {
      model: e.model,
      messages: e.messages.map((n) => ({ role: n.role, content: n.content }))
    };
  }
}
class Dc {
  constructor(e, n) {
    w(this, "url");
    w(this, "model");
    w(this, "ollama");
    this.url = e, this.model = n, this.ollama = new Qn({ host: e }), console.log("in constructor creating ollama client...");
  }
  async chat(e, n) {
    Rc.toOllamaRequest(e);
    const o = await this.ollama.chat({ model: e.model, messages: e.messages, stream: !0 });
    for await (const i of o) {
      const r = i.message.content;
      n && n(r);
    }
  }
}
export {
  it as AuditService,
  Dc as ChatApiService,
  Cc as ChatProviderFactory,
  Z as ChatProviderUtils,
  xc as ChatService,
  ti as ClaudeChatProvider,
  ei as ClaudeToolHandler,
  yc as GeminiChatProvider,
  gc as GeminiToolHandler,
  Zo as OllamaChatProvider,
  Qo as OllamaToolHandler,
  jn as OpenAIChatProvider,
  jo as OpenAIToolHandler,
  Re as ProviderType,
  Ac as TokenAccumulator
};
