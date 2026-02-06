var Wo = Object.defineProperty;
var Ko = (t, e, n) => e in t ? Wo(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var w = (t, e, n) => Ko(t, typeof e != "symbol" ? e + "" : e, n);
import { Ollama as Zn } from "ollama/browser";
import Yo from "openai";
import zo from "@anthropic-ai/sdk";
class gt {
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
  static async handleToolLoop(e, n, o, i, r, a, u, d = !1) {
    var c = r.branch_id !== void 0 ? r.branch_id : "";
    console.log("[ChatProviderUtils] handleToolLoop starting", {
      model: n,
      initialMessagesCount: o.length,
      toolsCount: i.length,
      originalThreadId: r.thread_id,
      originalBranchId: c,
      shouldStream: d,
      hasOnTokenReceived: !!u,
      maxIterations: te.MAX_TOOL_ITERATIONS
    });
    let f = o;
    for (let p = 0; p < te.MAX_TOOL_ITERATIONS; p++) {
      console.log("[ChatProviderUtils] handleToolLoop - Starting iteration", {
        iteration: p,
        currentMessagesCount: f.length
      }), c = te.setBranchIteration(c, p);
      const h = {
        thread_id: r.thread_id,
        branch_id: c
      };
      console.log("[ChatProviderUtils] handleToolLoop - Thread context for iteration", {
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
        d
      );
      console.log("[ChatProviderUtils] handleToolLoop - Request completed", {
        iteration: p,
        hasResponse: !!g
      });
      const T = !d || !m;
      if (console.log("[ChatProviderUtils] handleToolLoop - Text content handling", {
        iteration: p,
        shouldSendTextContent: T,
        hasStreamingCallback: m,
        shouldStream: d
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
      const E = g.stop_reason;
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
      const S = [];
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
        }), S.push(C);
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
w(te, "MAX_TOOL_ITERATIONS", 25);
let Z = te;
class Xo {
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
      let d = null, c = 0;
      for await (const f of u) {
        c++;
        const p = (a = f.message) == null ? void 0 : a.content;
        p && this.onTokenReceived && this.onTokenReceived(p), d = f;
      }
      return console.log("[OllamaToolHandler] Stream complete", {
        chunkCount: c,
        hasFinalMessage: !!d,
        finalMessageKeys: d ? Object.keys(d) : []
      }), d;
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
class Qo {
  constructor(e, n, o, i = [], r) {
    w(this, "ollama");
    w(this, "defaultModel");
    w(this, "tools");
    w(this, "onToolUse");
    w(this, "toolHandler");
    this.ollama = new Zn({ host: e, headers: {
      "X-api-key": n
    } }), this.defaultModel = o, this.tools = i, this.onToolUse = r, i.length > 0 && (this.toolHandler = new Xo(this.ollama)), console.log(`OllamaChatProvider initialized with endpoint ${e} and model ${o}${i.length > 0 ? ` and ${i.length} tools` : ""}`);
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
    const o = e.model || this.defaultModel, i = { ...e, model: o }, r = gt.toOllamaRequest(i);
    try {
      if (r.stream) {
        const d = await this.ollama.chat(r);
        for await (const c of d) {
          const f = (a = c.message) == null ? void 0 : a.content;
          f && n && n(f);
        }
      } else {
        const c = (u = (await this.ollama.chat(r)).message) == null ? void 0 : u.content;
        c && n && n(c);
      }
    } catch (d) {
      throw console.error("Error in Ollama API call:", d), d;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, n) {
    if (!this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const o = e.model || this.defaultModel, i = { ...e, model: o }, r = gt.toOllamaRequest(i), a = this.convertToolsToOllamaFormat(this.tools);
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
class yt {
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
      return n.maxTokens !== void 0 && (i.max_tokens = n.maxTokens), n.thread_id !== void 0 && (i.thread_id = n.thread_id), n.branch_id !== void 0 && (i.branch_id = n.branch_id), i;
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
      return n.temperature !== void 0 && (i.temperature = n.temperature), n.maxTokens !== void 0 && (i.max_tokens = n.maxTokens), n.topP !== void 0 && (i.top_p = n.topP), n.frequencyPenalty !== void 0 && (i.frequency_penalty = n.frequencyPenalty), n.presencePenalty !== void 0 && (i.presence_penalty = n.presencePenalty), n.stop !== void 0 && (i.stop = n.stop), n.responseFormat !== void 0 && (i.response_format = n.responseFormat), n.thread_id !== void 0 && (i.thread_id = n.thread_id), n.branch_id !== void 0 && (i.branch_id = n.branch_id), n.responseFormat !== void 0 && (i.response_format = {
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
class Zo {
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
    var o, i, r, a, u, d, c;
    const n = e.choices[0];
    if (console.log("[OpenAIToolHandler] extractToolUses", {
      hasChoice: !!n,
      finishReason: n == null ? void 0 : n.finish_reason,
      hasToolCalls: !!((o = n == null ? void 0 : n.message) != null && o.tool_calls),
      toolCallsCount: ((r = (i = n == null ? void 0 : n.message) == null ? void 0 : i.tool_calls) == null ? void 0 : r.length) || 0,
      hasFunctionCall: !!((a = n == null ? void 0 : n.message) != null && a.function_call)
    }), (n == null ? void 0 : n.finish_reason) === "tool_calls" || (u = n == null ? void 0 : n.message) != null && u.tool_calls) {
      const f = (d = n == null ? void 0 : n.message) == null ? void 0 : d.tool_calls;
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
      const f = (c = n == null ? void 0 : n.message) == null ? void 0 : c.function_call;
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
    var r, a, u, d;
    console.log("[OpenAIToolHandler] makeStreamingRequest calling API", {
      model: e,
      messagesCount: n.length,
      toolsCount: o.length,
      threadContext: i
    });
    try {
      const c = Date.now(), f = await this.client.chat.completions.create({
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
        const E = y.choices[0], S = E == null ? void 0 : E.delta;
        if (S != null && S.content && (p += S.content, this.onTokenReceived && this.onTokenReceived(S.content)), S != null && S.tool_calls)
          for (const I of S.tool_calls) {
            const _ = I.index;
            h[_] ? (I.id && (h[_].id += I.id), (u = I.function) != null && u.name && (h[_].function.name += I.function.name), (d = I.function) != null && d.arguments && (h[_].function.arguments += I.function.arguments)) : h[_] = {
              id: I.id || "",
              type: "function",
              function: {
                name: ((r = I.function) == null ? void 0 : r.name) || "",
                arguments: ((a = I.function) == null ? void 0 : a.arguments) || ""
              }
            };
          }
        E != null && E.finish_reason && (m = E.finish_reason);
      }
      const T = Date.now() - c;
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
  async makeNonStreamingRequest(e, n, o, i) {
    var r, a, u, d, c, f, p, h, m, g, T, y, E;
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
      }), _ = Date.now() - S;
      return console.log("[OpenAIToolHandler] makeNonStreamingRequest response received", {
        duration: `${_}ms`,
        hasResponse: !!I,
        hasChoices: !!I.choices,
        choicesCount: ((r = I.choices) == null ? void 0 : r.length) || 0,
        finishReason: (u = (a = I.choices) == null ? void 0 : a[0]) == null ? void 0 : u.finish_reason,
        hasContent: !!((f = (c = (d = I.choices) == null ? void 0 : d[0]) == null ? void 0 : c.message) != null && f.content),
        hasToolCalls: !!((m = (h = (p = I.choices) == null ? void 0 : p[0]) == null ? void 0 : h.message) != null && m.tool_calls),
        toolCallsCount: ((E = (y = (T = (g = I.choices) == null ? void 0 : g[0]) == null ? void 0 : T.message) == null ? void 0 : y.tool_calls) == null ? void 0 : E.length) || 0
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
class jo {
  constructor(e) {
    this.client = e;
  }
  /**
   * Handle streaming Chat Completions request
   */
  async chatStreaming(e, n, o) {
    var i, r;
    try {
      const a = await this.client.chat.completions.create(e);
      for await (const u of a) {
        const d = ((r = (i = u.choices[0]) == null ? void 0 : i.delta) == null ? void 0 : r.content) || "";
        d && o && o(d);
      }
    } catch (a) {
      throw console.error("[ChatCompletionsHandler] Streaming request failed:", a), a;
    }
  }
  /**
   * Handle non-streaming Chat Completions request
   */
  async chatNonStreaming(e, n, o) {
    var i, r;
    try {
      const u = ((r = (i = (await this.client.chat.completions.create(e)).choices[0]) == null ? void 0 : i.message) == null ? void 0 : r.content) || "";
      u && o && o(u);
    } catch (a) {
      throw console.error("[ChatCompletionsHandler] Non-streaming request failed:", a), a;
    }
  }
}
class ei {
  constructor(e) {
    this.client = e;
  }
  /**
   * Handle streaming Responses API request
   * Responses API has a different event structure than Chat Completions
   */
  async chatStreaming(e, n, o) {
    try {
      const i = await this.client.responses.create(e);
      for await (const r of i) {
        if (r.type === "text_delta") {
          r.text && o && o(r.text);
          continue;
        }
        if (r.type === "done") {
          console.log("[ResponsesHandler] Response stream completed");
          break;
        }
        const a = r.event || r;
        if (a.type === "response.content_part.added") {
          const u = a.part;
          (u == null ? void 0 : u.type) === "output_text" && u.text && o && o(u.text);
        } else if (a.type === "response.output_text.delta")
          a.delta && o && o(a.delta);
        else if (a.type === "response.content_part.delta") {
          const u = a.delta;
          u != null && u.text && o && o(u.text);
        } else if (a.type === "response.output_item.done") {
          const u = a.item;
          if ((u == null ? void 0 : u.type) === "message" && u.content && Array.isArray(u.content))
            for (const d of u.content)
              d.type === "output_text" && d.text && o && o(d.text);
        }
      }
    } catch (i) {
      throw console.error("[ResponsesHandler] Streaming request failed:", i), i;
    }
  }
  /**
   * Handle non-streaming Responses API request
   */
  async chatNonStreaming(e, n, o) {
    try {
      const r = (await this.client.responses.create(e)).output_text;
      r && o && o(r);
    } catch (i) {
      throw console.error("[ResponsesHandler] Non-streaming request failed:", i), i;
    }
  }
}
var B = /* @__PURE__ */ ((t) => (t.CHAT = "CHAT", t.RESPONSE = "RESPONSE", t))(B || {});
class ti {
  /**
   * Create the appropriate handler based on endpoint type
   */
  static create(e, n) {
    return n === "RESPONSE" ? new ei(e) : new jo(e);
  }
}
class ni {
  constructor(e, n, o, i = [], r) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "tools");
    w(this, "onToolUse");
    w(this, "toolHandler");
    w(this, "endpointType", B.CHAT);
    this.client = new Yo({ apiKey: n, baseURL: e, dangerouslyAllowBrowser: !0 }), this.defaultModel = o || "gpt-5.2-chat-latest", this.tools = i, this.onToolUse = r, i.length > 0 && (this.toolHandler = new Zo(this.client)), console.log("OpenAIChatProvider initialized url: ${baseURL} with model ${this.defaultModel}${tools.length > 0 ? ` and ${tools.length} tools` : ''}");
  }
  /**
   * Determines the appropriate endpoint type based on the model name
   * @param modelName - The OpenAI model name
   * @returns The endpoint type (CHAT or RESPONSE)
   **/
  getEndpointType(e) {
    const n = e.toLowerCase();
    return n.includes("-chat") || n.startsWith("gpt-4") || n.startsWith("gpt-3.5") || n.startsWith("chatgpt") ? B.CHAT : (n.includes("-pro") || n.includes("-reasoning") || n.startsWith("gpt-5") && !n.includes("-chat") || n.startsWith("o"), B.RESPONSE);
  }
  /**
   * Send a chat request to OpenAI
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    if (console.log("[OpenAIChatProvider] chat called", {
      hasThreadId: !!e.thread_id,
      thread_id: e.thread_id,
      branch_id: e.branch_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, n);
      return;
    }
    this.endpointType = this.getEndpointType(e.model);
    const o = this.endpointType === B.RESPONSE, i = yt.toOpenAIRequest(o, e);
    try {
      const r = ti.create(this.client, this.endpointType);
      e.streaming !== !1 ? await r.chatStreaming(i, e.model, n) : await r.chatNonStreaming(i, e.model, n);
    } catch (r) {
      throw console.error("Error in OpenAI API call:", r), r;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, n) {
    var a;
    this.endpointType = this.getEndpointType(e.model);
    const o = this.endpointType === B.RESPONSE;
    if (console.log("[OpenAIChatProvider] chatWithTools called", {
      hasToolHandler: !!this.toolHandler,
      hasOnToolUse: !!this.onToolUse,
      toolsCount: ((a = this.tools) == null ? void 0 : a.length) || 0
    }), !this.toolHandler || !this.onToolUse)
      throw new Error("Tool handler not configured");
    const i = yt.toOpenAIRequest(o, e), r = this.convertToolsToOpenAIFormat(this.tools || []);
    console.log("[OpenAIChatProvider] Converted request", {
      model: i.model,
      messagesCount: i.messages.length,
      toolsCount: (r == null ? void 0 : r.length) || 0,
      shouldStream: e.streaming !== !1
    });
    try {
      console.log("[OpenAIChatProvider] Calling ChatProviderUtils.handleToolLoop"), await Z.handleToolLoop(
        this.toolHandler,
        i.model,
        i.messages,
        r,
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
    return e.temperature !== void 0 && (o.temperature = e.temperature), e.maxTokens !== void 0 && (o.max_tokens = e.maxTokens), e.topP !== void 0 && (o.top_p = e.topP), e.stop !== void 0 && (o.stop_sequences = e.stop), e.thread_id !== void 0 && (o.thread_id = e.thread_id), e.branch_id !== void 0 && (o.branch_id = e.branch_id), o;
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
      let d = 0, c = 0;
      const f = this.client.messages.stream({
        model: e,
        messages: n,
        tools: o,
        max_tokens: 4096,
        stream: !0,
        ...i
      }).on("text", (m) => {
        d++, this.onTokenReceived && this.onTokenReceived(m);
      }).on("contentBlock", (m) => {
        c++, console.log("[ClaudeToolHandler] Stream contentBlock event", {
          contentBlockCount: c,
          blockType: m.type,
          ...m.type === "tool_use" ? {
            toolId: m.id,
            toolName: m.name
          } : {}
        });
      }).on("message", (m) => {
        console.log("[ClaudeToolHandler] Stream message event", {
          messageId: m.id,
          stopReason: m.stop_reason,
          contentBlocksCount: m.content.length,
          contentTypes: m.content.map((g) => g.type)
        });
      });
      console.log("[ClaudeToolHandler] Stream started, waiting for final message");
      const p = await f.finalMessage(), h = Date.now() - u;
      return console.log("[ClaudeToolHandler] makeStreamingRequest complete", {
        duration: `${h}ms`,
        hasMessage: !!p,
        responseId: p.id,
        model: p.model,
        stopReason: p.stop_reason,
        contentBlocksCount: ((r = p.content) == null ? void 0 : r.length) || 0,
        contentBlockTypes: ((a = p.content) == null ? void 0 : a.map((m) => m.type)) || [],
        totalTokensStreamed: d,
        usage: p.usage
      }), p;
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
      const u = Date.now(), d = await this.client.messages.create({
        model: e,
        messages: n,
        tools: o,
        max_tokens: 4096,
        stream: !1,
        ...i
      }), c = Date.now() - u;
      return console.log("[ClaudeToolHandler] makeNonStreamingRequest response received", {
        duration: `${c}ms`,
        hasResponse: !!d,
        responseId: d.id,
        model: d.model,
        stopReason: d.stop_reason,
        contentBlocksCount: ((r = d.content) == null ? void 0 : r.length) || 0,
        contentBlockTypes: ((a = d.content) == null ? void 0 : a.map((f) => f.type)) || [],
        usage: d.usage
      }), d;
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
  constructor(e, n, o, i = [], r) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "tools");
    w(this, "onToolUse");
    w(this, "toolHandler");
    this.client = new zo({
      apiKey: n,
      dangerouslyAllowBrowser: !0
    }), e && (this.client.baseURL = e), this.defaultModel = o || "claude-3-opus-20240229", this.tools = i, this.onToolUse = r, i.length > 0 && (this.toolHandler = new oi(this.client)), console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}${i.length > 0 ? ` and ${i.length} tools` : ""}`);
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
    const o = e.model || this.defaultModel, i = Tt.toClaudeRequest({ ...e, model: o });
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
    const o = e.model || this.defaultModel, i = Tt.toClaudeRequest({ ...e, model: o }), r = this.convertToolsToClaudeFormat(this.tools);
    console.log("[ClaudeChatProvider] Converted request for tool loop", {
      model: i.model,
      system: ((a = i.system) == null ? void 0 : a.substring(0, 100)) + "...",
      messagesCount: i.messages.length,
      messages: i.messages.map((u) => {
        var d;
        return {
          role: u.role,
          contentType: typeof u.content,
          contentPreview: typeof u.content == "string" ? u.content.substring(0, 50) + "..." : `[${((d = u.content) == null ? void 0 : d.length) || 0} items]`
        };
      }),
      toolsCount: r.length,
      tools: r.map((u) => {
        var d;
        return {
          name: u.name,
          description: ((d = u.description) == null ? void 0 : d.substring(0, 50)) + "..."
        };
      }),
      shouldStream: e.streaming !== !1,
      hasOnTokenReceived: !!n
    });
    try {
      console.log("[ClaudeChatProvider] Calling ChatProviderUtils.handleToolLoop"), await Z.handleToolLoop(
        this.toolHandler,
        i.model,
        i.messages,
        r,
        e,
        this.onToolUse,
        n,
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
        const d = t[u];
        if (Array.isArray(n))
          for (let c = 0; c < d.length; c++) {
            const f = d[c];
            l(f, e.slice(r + 1), n[c]);
          }
        else
          for (const c of d)
            l(c, e.slice(r + 1), n);
      }
      return;
    } else if (a.endsWith("[0]")) {
      const u = a.slice(0, -3);
      u in t || (t[u] = [{}]);
      const d = t[u];
      l(d[0], e.slice(r + 1), n);
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
    for (let d = 0; d < i.length; d++)
      if (i[d] === "*") {
        u = d;
        break;
      }
    if (u !== -1 && r.length > u)
      for (let d = u; d < r.length; d++) {
        const c = r[d];
        c !== "*" && !c.endsWith("[]") && !c.endsWith("[0]") && a.add(c);
      }
    Be(t, i, r, 0, a);
  }
}
function Be(t, e, n, o, i) {
  if (o >= e.length || typeof t != "object" || t === null)
    return;
  const r = e[o];
  if (r.endsWith("[]")) {
    const a = r.slice(0, -2), u = t;
    if (a in u && Array.isArray(u[a]))
      for (const d of u[a])
        Be(d, e, n, o + 1, i);
  } else if (r === "*") {
    if (typeof t == "object" && t !== null && !Array.isArray(t)) {
      const a = t, u = Object.keys(a).filter((c) => !c.startsWith("_") && !i.has(c)), d = {};
      for (const c of u)
        d[c] = a[c];
      for (const [c, f] of Object.entries(d)) {
        const p = [];
        for (const h of n.slice(o))
          h === "*" ? p.push(c) : p.push(h);
        l(a, p, f);
      }
      for (const c of u)
        delete a[c];
    }
  } else {
    const a = t;
    r in a && Be(a[r], e, n, o + 1, i);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function it(t) {
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
  return a != null && l(e, ["response"], hi(a)), e;
}
function pi(t) {
  const e = {}, n = s(t, [
    "generatedSamples"
  ]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((a) => mi(a))), l(e, ["generatedVideos"], r);
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
function mi(t) {
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
function Ci(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["metadata"]);
  o != null && l(e, ["metadata"], o);
  const i = s(t, ["done"]);
  i != null && l(e, ["done"], i);
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["response"]);
  return a != null && l(e, ["response"], _i(a)), e;
}
function _i(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["parent"]);
  o != null && l(e, ["parent"], o);
  const i = s(t, ["documentName"]);
  return i != null && l(e, ["documentName"], i), e;
}
function jn(t) {
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
  o != null && l(e, ["videoBytes"], it(o));
  const i = s(t, ["encoding"]);
  return i != null && l(e, ["mimeType"], i), e;
}
function Ii(t) {
  const e = {}, n = s(t, ["gcsUri"]);
  n != null && l(e, ["uri"], n);
  const o = s(t, [
    "bytesBase64Encoded"
  ]);
  o != null && l(e, ["videoBytes"], it(o));
  const i = s(t, ["mimeType"]);
  return i != null && l(e, ["mimeType"], i), e;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var Ct;
(function(t) {
  t.OUTCOME_UNSPECIFIED = "OUTCOME_UNSPECIFIED", t.OUTCOME_OK = "OUTCOME_OK", t.OUTCOME_FAILED = "OUTCOME_FAILED", t.OUTCOME_DEADLINE_EXCEEDED = "OUTCOME_DEADLINE_EXCEEDED";
})(Ct || (Ct = {}));
var _t;
(function(t) {
  t.LANGUAGE_UNSPECIFIED = "LANGUAGE_UNSPECIFIED", t.PYTHON = "PYTHON";
})(_t || (_t = {}));
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
var kt;
(function(t) {
  t.FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED", t.STOP = "STOP", t.MAX_TOKENS = "MAX_TOKENS", t.SAFETY = "SAFETY", t.RECITATION = "RECITATION", t.LANGUAGE = "LANGUAGE", t.OTHER = "OTHER", t.BLOCKLIST = "BLOCKLIST", t.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", t.SPII = "SPII", t.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", t.IMAGE_SAFETY = "IMAGE_SAFETY", t.UNEXPECTED_TOOL_CALL = "UNEXPECTED_TOOL_CALL", t.IMAGE_PROHIBITED_CONTENT = "IMAGE_PROHIBITED_CONTENT", t.NO_IMAGE = "NO_IMAGE", t.IMAGE_RECITATION = "IMAGE_RECITATION", t.IMAGE_OTHER = "IMAGE_OTHER";
})(kt || (kt = {}));
var Ut;
(function(t) {
  t.HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED", t.NEGLIGIBLE = "NEGLIGIBLE", t.LOW = "LOW", t.MEDIUM = "MEDIUM", t.HIGH = "HIGH";
})(Ut || (Ut = {}));
var Lt;
(function(t) {
  t.HARM_SEVERITY_UNSPECIFIED = "HARM_SEVERITY_UNSPECIFIED", t.HARM_SEVERITY_NEGLIGIBLE = "HARM_SEVERITY_NEGLIGIBLE", t.HARM_SEVERITY_LOW = "HARM_SEVERITY_LOW", t.HARM_SEVERITY_MEDIUM = "HARM_SEVERITY_MEDIUM", t.HARM_SEVERITY_HIGH = "HARM_SEVERITY_HIGH";
})(Lt || (Lt = {}));
var Gt;
(function(t) {
  t.URL_RETRIEVAL_STATUS_UNSPECIFIED = "URL_RETRIEVAL_STATUS_UNSPECIFIED", t.URL_RETRIEVAL_STATUS_SUCCESS = "URL_RETRIEVAL_STATUS_SUCCESS", t.URL_RETRIEVAL_STATUS_ERROR = "URL_RETRIEVAL_STATUS_ERROR", t.URL_RETRIEVAL_STATUS_PAYWALL = "URL_RETRIEVAL_STATUS_PAYWALL", t.URL_RETRIEVAL_STATUS_UNSAFE = "URL_RETRIEVAL_STATUS_UNSAFE";
})(Gt || (Gt = {}));
var Ft;
(function(t) {
  t.BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED", t.SAFETY = "SAFETY", t.OTHER = "OTHER", t.BLOCKLIST = "BLOCKLIST", t.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", t.IMAGE_SAFETY = "IMAGE_SAFETY", t.MODEL_ARMOR = "MODEL_ARMOR", t.JAILBREAK = "JAILBREAK";
})(Ft || (Ft = {}));
var Ht;
(function(t) {
  t.TRAFFIC_TYPE_UNSPECIFIED = "TRAFFIC_TYPE_UNSPECIFIED", t.ON_DEMAND = "ON_DEMAND", t.PROVISIONED_THROUGHPUT = "PROVISIONED_THROUGHPUT";
})(Ht || (Ht = {}));
var Re;
(function(t) {
  t.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", t.TEXT = "TEXT", t.IMAGE = "IMAGE", t.AUDIO = "AUDIO";
})(Re || (Re = {}));
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
var Je;
(function(t) {
  t.JOB_STATE_UNSPECIFIED = "JOB_STATE_UNSPECIFIED", t.JOB_STATE_QUEUED = "JOB_STATE_QUEUED", t.JOB_STATE_PENDING = "JOB_STATE_PENDING", t.JOB_STATE_RUNNING = "JOB_STATE_RUNNING", t.JOB_STATE_SUCCEEDED = "JOB_STATE_SUCCEEDED", t.JOB_STATE_FAILED = "JOB_STATE_FAILED", t.JOB_STATE_CANCELLING = "JOB_STATE_CANCELLING", t.JOB_STATE_CANCELLED = "JOB_STATE_CANCELLED", t.JOB_STATE_PAUSED = "JOB_STATE_PAUSED", t.JOB_STATE_EXPIRED = "JOB_STATE_EXPIRED", t.JOB_STATE_UPDATING = "JOB_STATE_UPDATING", t.JOB_STATE_PARTIALLY_SUCCEEDED = "JOB_STATE_PARTIALLY_SUCCEEDED";
})(Je || (Je = {}));
var Bt;
(function(t) {
  t.TUNING_TASK_UNSPECIFIED = "TUNING_TASK_UNSPECIFIED", t.TUNING_TASK_I2V = "TUNING_TASK_I2V", t.TUNING_TASK_T2V = "TUNING_TASK_T2V", t.TUNING_TASK_R2V = "TUNING_TASK_R2V";
})(Bt || (Bt = {}));
var Jt;
(function(t) {
  t.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", t.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", t.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", t.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH", t.MEDIA_RESOLUTION_ULTRA_HIGH = "MEDIA_RESOLUTION_ULTRA_HIGH";
})(Jt || (Jt = {}));
var Oe;
(function(t) {
  t.COLLECTION = "COLLECTION";
})(Oe || (Oe = {}));
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
var hn;
(function(t) {
  t.ACTIVITY_HANDLING_UNSPECIFIED = "ACTIVITY_HANDLING_UNSPECIFIED", t.START_OF_ACTIVITY_INTERRUPTS = "START_OF_ACTIVITY_INTERRUPTS", t.NO_INTERRUPTION = "NO_INTERRUPTION";
})(hn || (hn = {}));
var mn;
(function(t) {
  t.TURN_COVERAGE_UNSPECIFIED = "TURN_COVERAGE_UNSPECIFIED", t.TURN_INCLUDES_ONLY_ACTIVITY = "TURN_INCLUDES_ONLY_ACTIVITY", t.TURN_INCLUDES_ALL_INPUT = "TURN_INCLUDES_ALL_INPUT";
})(mn || (mn = {}));
var gn;
(function(t) {
  t.SCALE_UNSPECIFIED = "SCALE_UNSPECIFIED", t.C_MAJOR_A_MINOR = "C_MAJOR_A_MINOR", t.D_FLAT_MAJOR_B_FLAT_MINOR = "D_FLAT_MAJOR_B_FLAT_MINOR", t.D_MAJOR_B_MINOR = "D_MAJOR_B_MINOR", t.E_FLAT_MAJOR_C_MINOR = "E_FLAT_MAJOR_C_MINOR", t.E_MAJOR_D_FLAT_MINOR = "E_MAJOR_D_FLAT_MINOR", t.F_MAJOR_D_MINOR = "F_MAJOR_D_MINOR", t.G_FLAT_MAJOR_E_FLAT_MINOR = "G_FLAT_MAJOR_E_FLAT_MINOR", t.G_MAJOR_E_MINOR = "G_MAJOR_E_MINOR", t.A_FLAT_MAJOR_F_MINOR = "A_FLAT_MAJOR_F_MINOR", t.A_MAJOR_G_FLAT_MINOR = "A_MAJOR_G_FLAT_MINOR", t.B_FLAT_MAJOR_G_MINOR = "B_FLAT_MAJOR_G_MINOR", t.B_MAJOR_A_FLAT_MINOR = "B_MAJOR_A_FLAT_MINOR";
})(gn || (gn = {}));
var yn;
(function(t) {
  t.MUSIC_GENERATION_MODE_UNSPECIFIED = "MUSIC_GENERATION_MODE_UNSPECIFIED", t.QUALITY = "QUALITY", t.DIVERSITY = "DIVERSITY", t.VOCALIZATION = "VOCALIZATION";
})(yn || (yn = {}));
var re;
(function(t) {
  t.PLAYBACK_CONTROL_UNSPECIFIED = "PLAYBACK_CONTROL_UNSPECIFIED", t.PLAY = "PLAY", t.PAUSE = "PAUSE", t.STOP = "STOP", t.RESET_CONTEXT = "RESET_CONTEXT";
})(re || (re = {}));
class $e {
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
class pe {
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
    var e, n, o, i, r, a, u, d;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning text from the first one.");
    let c = "", f = !1;
    const p = [];
    for (const h of (d = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) !== null && d !== void 0 ? d : []) {
      for (const [m, g] of Object.entries(h))
        m !== "text" && m !== "thought" && m !== "thoughtSignature" && (g !== null || g !== void 0) && p.push(m);
      if (typeof h.text == "string") {
        if (typeof h.thought == "boolean" && h.thought)
          continue;
        f = !0, c += h.text;
      }
    }
    return p.length > 0 && console.warn(`there are non-text parts ${p} in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.`), f ? c : void 0;
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
    var e, n, o, i, r, a, u, d;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning data from the first one.");
    let c = "";
    const f = [];
    for (const p of (d = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) !== null && d !== void 0 ? d : []) {
      for (const [h, m] of Object.entries(p))
        h !== "inlineData" && (m !== null || m !== void 0) && f.push(h);
      p.inlineData && typeof p.inlineData.data == "string" && (c += atob(p.inlineData.data));
    }
    return f.length > 0 && console.warn(`there are non-data parts ${f} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), c.length > 0 ? btoa(c) : void 0;
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
    var e, n, o, i, r, a, u, d;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning function calls from the first one.");
    const c = (d = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) === null || d === void 0 ? void 0 : d.filter((f) => f.functionCall).map((f) => f.functionCall).filter((f) => f !== void 0);
    if ((c == null ? void 0 : c.length) !== 0)
      return c;
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
    var e, n, o, i, r, a, u, d, c;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning executable code from the first one.");
    const f = (d = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) === null || d === void 0 ? void 0 : d.filter((p) => p.executableCode).map((p) => p.executableCode).filter((p) => p !== void 0);
    if ((f == null ? void 0 : f.length) !== 0)
      return (c = f == null ? void 0 : f[0]) === null || c === void 0 ? void 0 : c.code;
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
    var e, n, o, i, r, a, u, d, c;
    if (((i = (o = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || o === void 0 ? void 0 : o.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning code execution result from the first one.");
    const f = (d = (u = (a = (r = this.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content) === null || u === void 0 ? void 0 : u.parts) === null || d === void 0 ? void 0 : d.filter((p) => p.codeExecutionResult).map((p) => p.codeExecutionResult).filter((p) => p !== void 0);
    if ((f == null ? void 0 : f.length) !== 0)
      return (c = f == null ? void 0 : f[0]) === null || c === void 0 ? void 0 : c.output;
  }
}
class Tn {
}
class Cn {
}
class vi {
}
class Ai {
}
class Ri {
}
class Pi {
}
class _n {
}
class En {
}
class Sn {
}
class wi {
}
class Pe {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new Pe();
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
class st {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new st(), r = Ci(e);
    return Object.assign(o, r), o;
  }
}
class Di {
}
class ki {
}
class Ui {
}
class Li {
}
class Pn {
}
class Gi {
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
      for (const [d, c] of Object.entries(u))
        d !== "text" && d !== "thought" && c !== null && a.push(d);
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
      for (const [u, d] of Object.entries(a))
        u !== "inlineData" && d !== null && r.push(u);
      a.inlineData && typeof a.inlineData.data == "string" && (i += atob(a.inlineData.data));
    }
    return r.length > 0 && console.warn(`there are non-data parts ${r} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), i.length > 0 ? btoa(i) : void 0;
  }
}
class Fi {
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
class rt {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const o = new rt(), r = jn(e);
    return Object.assign(o, r), o;
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function k(t, e) {
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
function eo(t, e) {
  const n = k(t, e);
  return n ? n.startsWith("publishers/") && t.isVertexAI() ? `projects/${t.getProject()}/locations/${t.getLocation()}/${n}` : n.startsWith("models/") && t.isVertexAI() ? `projects/${t.getProject()}/locations/${t.getLocation()}/publishers/google/${n}` : n : "";
}
function to(t) {
  return Array.isArray(t) ? t.map((e) => we(e)) : [we(t)];
}
function we(t) {
  if (typeof t == "object" && t !== null)
    return t;
  throw new Error(`Could not parse input as Blob. Unsupported blob type: ${typeof t}`);
}
function no(t) {
  const e = we(t);
  if (e.mimeType && e.mimeType.startsWith("image/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function oo(t) {
  const e = we(t);
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
function io(t) {
  if (t == null || Array.isArray(t) && t.length === 0)
    throw new Error("PartListUnion is required");
  return Array.isArray(t) ? t.map((e) => wn(e)) : [wn(t)];
}
function We(t) {
  return t != null && typeof t == "object" && "parts" in t && Array.isArray(t.parts);
}
function Mn(t) {
  return t != null && typeof t == "object" && "functionCall" in t;
}
function Nn(t) {
  return t != null && typeof t == "object" && "functionResponse" in t;
}
function F(t) {
  if (t == null)
    throw new Error("ContentUnion is required");
  return We(t) ? t : {
    role: "user",
    parts: io(t)
  };
}
function lt(t, e) {
  if (!e)
    return [];
  if (t.isVertexAI() && Array.isArray(e))
    return e.flatMap((n) => {
      const o = F(n);
      return o.parts && o.parts.length > 0 && o.parts[0].text !== void 0 ? [o.parts[0].text] : [];
    });
  if (t.isVertexAI()) {
    const n = F(e);
    return n.parts && n.parts.length > 0 && n.parts[0].text !== void 0 ? [n.parts[0].text] : [];
  }
  return Array.isArray(e) ? e.map((n) => F(n)) : [F(e)];
}
function J(t) {
  if (t == null || Array.isArray(t) && t.length === 0)
    throw new Error("contents are required");
  if (!Array.isArray(t)) {
    if (Mn(t) || Nn(t))
      throw new Error("To specify functionCall or functionResponse parts, please wrap them in a Content object, specifying the role for them");
    return [F(t)];
  }
  const e = [], n = [], o = We(t[0]);
  for (const i of t) {
    const r = We(i);
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
  return o || e.push({ role: "user", parts: io(n) }), e;
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
function ae(t) {
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
        e[a] = ae(u);
      else if (o.includes(a)) {
        const d = [];
        for (const c of u) {
          if (c.type == "null") {
            e.nullable = !0;
            continue;
          }
          d.push(ae(c));
        }
        e[a] = d;
      } else if (i.includes(a)) {
        const d = {};
        for (const [c, f] of Object.entries(u))
          d[c] = ae(f);
        e[a] = d;
      } else {
        if (a === "additionalProperties")
          continue;
        e[a] = u;
      }
  return e;
}
function at(t) {
  return ae(t);
}
function ut(t) {
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
function dt(t) {
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
function Vi(t, e, n, o = 1) {
  const i = !e.startsWith(`${n}/`) && e.split("/").length === o;
  return t.isVertexAI() ? e.startsWith("projects/") ? e : e.startsWith("locations/") ? `projects/${t.getProject()}/${e}` : e.startsWith(`${n}/`) ? `projects/${t.getProject()}/locations/${t.getLocation()}/${e}` : i ? `projects/${t.getProject()}/locations/${t.getLocation()}/${n}/${e}` : e : i ? `${n}/${e}` : e;
}
function Q(t, e) {
  if (typeof e != "string")
    throw new Error("name must be a string");
  return Vi(t, e, "cachedContents");
}
function so(t) {
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
  return it(t);
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
function ro(t) {
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
function lo(t, e) {
  let n;
  return t.isVertexAI() ? n = e ? "publishers/google/models" : "models" : n = e ? "models" : "tunedModels", n;
}
function ao(t) {
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
function uo(t, e) {
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
function co(t) {
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
    const d = a.response;
    if (typeof d != "object" || d === null)
      continue;
    if (d.embedding !== void 0) {
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
function fo(t) {
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
function Ie(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, [
    "metadata",
    "displayName"
  ]);
  o != null && l(e, ["displayName"], o);
  const i = s(t, ["metadata", "state"]);
  i != null && l(e, ["state"], fo(i));
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
  const d = s(t, ["metadata", "model"]);
  d != null && l(e, ["model"], d);
  const c = s(t, ["metadata", "output"]);
  return c != null && l(e, ["dest"], Ki(co(c))), e;
}
function Ke(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && l(e, ["name"], n);
  const o = s(t, ["displayName"]);
  o != null && l(e, ["displayName"], o);
  const i = s(t, ["state"]);
  i != null && l(e, ["state"], fo(i));
  const r = s(t, ["error"]);
  r != null && l(e, ["error"], r);
  const a = s(t, ["createTime"]);
  a != null && l(e, ["createTime"], a);
  const u = s(t, ["startTime"]);
  u != null && l(e, ["startTime"], u);
  const d = s(t, ["endTime"]);
  d != null && l(e, ["endTime"], d);
  const c = s(t, ["updateTime"]);
  c != null && l(e, ["updateTime"], c);
  const f = s(t, ["model"]);
  f != null && l(e, ["model"], f);
  const p = s(t, ["inputConfig"]);
  p != null && l(e, ["src"], Xi(p));
  const h = s(t, ["outputConfig"]);
  h != null && l(e, ["dest"], Yi(co(h)));
  const m = s(t, [
    "completionStats"
  ]);
  return m != null && l(e, ["completionStats"], m), e;
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
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function ts(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
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
  const d = s(t, ["index"]);
  d != null && l(e, ["index"], d);
  const c = s(t, [
    "logprobsResult"
  ]);
  c != null && l(e, ["logprobsResult"], c);
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
function os(t) {
  const e = {}, n = s(t, ["citationSources"]);
  if (n != null) {
    let o = n;
    Array.isArray(o) && (o = o.map((i) => i)), l(e, ["citations"], o);
  }
  return e;
}
function po(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => Us(r))), l(e, ["parts"], i);
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
  o != null && l(n, ["_url", "model"], k(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["batch", "inputConfig"], Qi(t, uo(t, i)));
  const r = s(e, ["config"]);
  return r != null && is(r, n), n;
}
function rs(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], k(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["inputConfig"], Zi(uo(t, i)));
  const r = s(e, ["config"]);
  return r != null && ss(r, n), n;
}
function ls(t, e) {
  const n = {}, o = s(t, ["displayName"]);
  return e !== void 0 && o != null && l(e, ["batch", "displayName"], o), n;
}
function as(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["_url", "model"], k(t, o));
  const i = s(e, ["src"]);
  i != null && l(n, ["batch", "inputConfig"], ms(t, i));
  const r = s(e, ["config"]);
  return r != null && ls(r, n), n;
}
function us(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function ds(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
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
    let r = lt(t, o);
    Array.isArray(r) && (r = r.map((a) => a)), l(n, ["requests[]", "request", "content"], r);
  }
  const i = s(e, ["config"]);
  return i != null && (l(n, ["_self"], hs(i, n)), ui(n, { "requests[].*": "requests[].request.*" })), n;
}
function hs(t, e) {
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
function ms(t, e) {
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
function Cs(t, e, n) {
  const o = {}, i = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && i != null && l(n, ["systemInstruction"], po(F(i)));
  const r = s(e, ["temperature"]);
  r != null && l(o, ["temperature"], r);
  const a = s(e, ["topP"]);
  a != null && l(o, ["topP"], a);
  const u = s(e, ["topK"]);
  u != null && l(o, ["topK"], u);
  const d = s(e, [
    "candidateCount"
  ]);
  d != null && l(o, ["candidateCount"], d);
  const c = s(e, [
    "maxOutputTokens"
  ]);
  c != null && l(o, ["maxOutputTokens"], c);
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
  const E = s(e, [
    "responseSchema"
  ]);
  E != null && l(o, ["responseSchema"], at(E));
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
    let H = I;
    Array.isArray(H) && (H = H.map((G) => Ls(G))), l(n, ["safetySettings"], H);
  }
  const _ = s(e, ["tools"]);
  if (n !== void 0 && _ != null) {
    let H = ce(_);
    Array.isArray(H) && (H = H.map((G) => Fs(de(G)))), l(n, ["tools"], H);
  }
  const C = s(e, ["toolConfig"]);
  if (n !== void 0 && C != null && l(n, ["toolConfig"], Gs(C)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const R = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && R != null && l(n, ["cachedContent"], Q(t, R));
  const P = s(e, [
    "responseModalities"
  ]);
  P != null && l(o, ["responseModalities"], P);
  const D = s(e, [
    "mediaResolution"
  ]);
  D != null && l(o, ["mediaResolution"], D);
  const A = s(e, ["speechConfig"]);
  if (A != null && l(o, ["speechConfig"], ut(A)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const N = s(e, [
    "thinkingConfig"
  ]);
  N != null && l(o, ["thinkingConfig"], N);
  const x = s(e, ["imageConfig"]);
  x != null && l(o, ["imageConfig"], As(x));
  const U = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (U != null && l(o, ["enableEnhancedCivicAnswers"], U), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return o;
}
function _s(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && l(e, ["sdkHttpResponse"], n);
  const o = s(t, ["candidates"]);
  if (o != null) {
    let d = o;
    Array.isArray(d) && (d = d.map((c) => ns(c))), l(e, ["candidates"], d);
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
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
}
function Ss(t, e) {
  const n = {}, o = s(e, ["name"]);
  return o != null && l(n, ["_url", "name"], fe(t, o)), n;
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
  o != null && l(n, ["request", "model"], k(t, o));
  const i = s(e, ["contents"]);
  if (i != null) {
    let u = J(i);
    Array.isArray(u) && (u = u.map((d) => po(d))), l(n, ["request", "contents"], u);
  }
  const r = s(e, ["metadata"]);
  r != null && l(n, ["metadata"], r);
  const a = s(e, ["config"]);
  return a != null && l(n, ["request", "generationConfig"], Cs(t, a, s(n, ["request"], {}))), n;
}
function Ps(t) {
  const e = {}, n = s(t, ["response"]);
  n != null && l(e, ["response"], _s(n));
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
    Array.isArray(r) && (r = r.map((a) => Ie(a))), l(e, ["batchJobs"], r);
  }
  return e;
}
function ks(t) {
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
    Array.isArray(r) && (r = r.map((a) => Ke(a))), l(e, ["batchJobs"], r);
  }
  return e;
}
function Us(t) {
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
  const d = s(t, ["inlineData"]);
  d != null && l(e, ["inlineData"], ji(d));
  const c = s(t, ["text"]);
  c != null && l(e, ["text"], c);
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
function Ls(t) {
  const e = {}, n = s(t, ["category"]);
  if (n != null && l(e, ["category"], n), s(t, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const o = s(t, ["threshold"]);
  return o != null && l(e, ["threshold"], o), e;
}
function Gs(t) {
  const e = {}, n = s(t, [
    "retrievalConfig"
  ]);
  n != null && l(e, ["retrievalConfig"], n);
  const o = s(t, [
    "functionCallingConfig"
  ]);
  return o != null && l(e, ["functionCallingConfig"], Ts(o)), e;
}
function Fs(t) {
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
  const d = s(t, [
    "googleSearchRetrieval"
  ]);
  d != null && l(e, ["googleSearchRetrieval"], d);
  const c = s(t, ["urlContext"]);
  return c != null && l(e, ["urlContext"], c), e;
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
    ), o = n._url, i = v("{model}:batchGenerateContent", o), u = n.batch.inputConfig.requests, d = u.requests, c = [];
    for (const f of d) {
      const p = Object.assign({}, f);
      if (p.systemInstruction) {
        const h = p.systemInstruction;
        delete p.systemInstruction;
        const m = p.request;
        m.systemInstruction = h, p.request = m;
      }
      c.push(p);
    }
    return u.requests = c, delete n.config, delete n._url, delete n._query, { path: i, body: n };
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = rs(this.apiClient, e);
      return u = v("batchPredictionJobs", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Ke(f));
    } else {
      const c = xn(this.apiClient, e);
      return u = v("{model}:batchGenerateContent", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ie(f));
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
      return r = v("{model}:asyncBatchEmbedContent", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => Ie(d));
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Ss(this.apiClient, e);
      return u = v("batchPredictionJobs/{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Ke(f));
    } else {
      const c = Es(this.apiClient, e);
      return u = v("batches/{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ie(f));
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
      const d = ts(this.apiClient, e);
      a = v("batchPredictionJobs/{name}:cancel", d._url), u = d._query, delete d._url, delete d._query, await this.apiClient.request({
        path: a,
        queryParams: u,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    } else {
      const d = es(this.apiClient, e);
      a = v("batches/{name}:cancel", d._url), u = d._query, delete d._url, delete d._query, await this.apiClient.request({
        path: a,
        queryParams: u,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      });
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = xs(e);
      return u = v("batchPredictionJobs", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = ks(f), h = new Pn();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Ns(e);
      return u = v("batches", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Ds(f), h = new Pn();
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = ds(this.apiClient, e);
      return u = v("batchPredictionJobs/{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => fs(f));
    } else {
      const c = us(this.apiClient, e);
      return u = v("batches/{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
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
    let f = J(a);
    Array.isArray(f) && (f = f.map((p) => Dn(p))), l(e, ["contents"], f);
  }
  const u = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && u != null && l(e, ["systemInstruction"], Dn(F(u)));
  const d = s(t, ["tools"]);
  if (e !== void 0 && d != null) {
    let f = d;
    Array.isArray(f) && (f = f.map((p) => dr(p))), l(e, ["tools"], f);
  }
  const c = s(t, ["toolConfig"]);
  if (e !== void 0 && c != null && l(e, ["toolConfig"], ur(c)), s(t, ["kmsKeyName"]) !== void 0)
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
    let p = J(a);
    Array.isArray(p) && (p = p.map((h) => h)), l(e, ["contents"], p);
  }
  const u = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && u != null && l(e, ["systemInstruction"], F(u));
  const d = s(t, ["tools"]);
  if (e !== void 0 && d != null) {
    let p = d;
    Array.isArray(p) && (p = p.map((h) => cr(h))), l(e, ["tools"], p);
  }
  const c = s(t, ["toolConfig"]);
  e !== void 0 && c != null && l(e, ["toolConfig"], c);
  const f = s(t, ["kmsKeyName"]);
  return e !== void 0 && f != null && l(e, ["encryption_spec", "kmsKeyName"], f), n;
}
function Bs(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], eo(t, o));
  const i = s(e, ["config"]);
  return i != null && bs(i, n), n;
}
function Js(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["model"], eo(t, o));
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
  const d = s(t, ["inlineData"]);
  d != null && l(e, ["inlineData"], Vs(d));
  const c = s(t, ["text"]);
  c != null && l(e, ["text"], c);
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
  const d = s(t, [
    "googleSearchRetrieval"
  ]);
  d != null && l(e, ["googleSearchRetrieval"], d);
  const c = s(t, ["urlContext"]);
  return c != null && l(e, ["urlContext"], c), e;
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
    Array.isArray(p) && (p = p.map((h) => Qs(h))), l(e, ["functionDeclarations"], p);
  }
  const u = s(t, ["googleMaps"]);
  u != null && l(e, ["googleMaps"], u);
  const d = s(t, ["googleSearch"]);
  d != null && l(e, ["googleSearch"], d);
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
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
function hr(t, e) {
  const n = {}, o = s(e, ["name"]);
  o != null && l(n, ["_url", "name"], Q(t, o));
  const i = s(e, ["config"]);
  return i != null && fr(i, n), n;
}
function mr(t, e) {
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Js(this.apiClient, e);
      return u = v("cachedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const c = Bs(this.apiClient, e);
      return u = v("cachedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = js(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const c = Zs(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = $s(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Ks(f), h = new An();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Os(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Ws(f), h = new An();
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = mr(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const c = hr(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = sr(e);
      return u = v("cachedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = lr(f), h = new Rn();
        return Object.assign(h, p), h;
      });
    } else {
      const c = ir(e);
      return u = v("cachedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = rr(f), h = new Rn();
        return Object.assign(h, p), h;
      });
    }
  }
}
function Me(t, e) {
  var n = {};
  for (var o in t) Object.prototype.hasOwnProperty.call(t, o) && e.indexOf(o) < 0 && (n[o] = t[o]);
  if (t != null && typeof Object.getOwnPropertySymbols == "function")
    for (var i = 0, o = Object.getOwnPropertySymbols(t); i < o.length; i++)
      e.indexOf(o[i]) < 0 && Object.prototype.propertyIsEnumerable.call(t, o[i]) && (n[o[i]] = t[o[i]]);
  return n;
}
function kn(t) {
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
function $(t, e, n) {
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
      return new Promise(function(y, E) {
        r.push([m, T, y, E]) > 1 || d(m, T);
      });
    }, g && (i[m] = g(i[m])));
  }
  function d(m, g) {
    try {
      c(o[m](g));
    } catch (T) {
      h(r[0][3], T);
    }
  }
  function c(m) {
    m.value instanceof M ? Promise.resolve(m.value.v).then(f, p) : h(r[0][2], m);
  }
  function f(m) {
    d("next", m);
  }
  function p(m) {
    d("throw", m);
  }
  function h(m, g) {
    m(g), r.shift(), r.length && d(r[0][0], r[0][1]);
  }
}
function W(t) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var e = t[Symbol.asyncIterator], n;
  return e ? e.call(t) : (t = typeof kn == "function" ? kn(t) : t[Symbol.iterator](), n = {}, o("next"), o("throw"), o("return"), n[Symbol.asyncIterator] = function() {
    return this;
  }, n);
  function o(r) {
    n[r] = t[r] && function(a) {
      return new Promise(function(u, d) {
        a = t[r](a), i(u, d, a.done, a.value);
      });
    };
  }
  function i(r, a, u, d) {
    Promise.resolve(d).then(function(c) {
      r({ value: c, done: u });
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
  return n === void 0 ? !1 : ho(n);
}
function ho(t) {
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
function Un(t) {
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
        i.push(t[o]), r && !ho(t[o]) && (r = !1), o++;
      r ? e.push(...i) : e.pop();
    }
  return e;
}
class Cr {
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
    return new _r(
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
class _r {
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
    const o = F(e.message), i = this.modelsModule.generateContent({
      model: this.model,
      contents: this.getHistory(!0).concat(o),
      config: (n = e.config) !== null && n !== void 0 ? n : this.config
    });
    return this.sendPromise = (async () => {
      var r, a, u;
      const d = await i, c = (a = (r = d.candidates) === null || r === void 0 ? void 0 : r[0]) === null || a === void 0 ? void 0 : a.content, f = d.automaticFunctionCallingHistory, p = this.getHistory(!0).length;
      let h = [];
      f != null && (h = (u = f.slice(p)) !== null && u !== void 0 ? u : []);
      const m = c ? [c] : [];
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
    const o = F(e.message), i = this.modelsModule.generateContentStream({
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
    const n = e ? Un(this.history) : this.history;
    return structuredClone(n);
  }
  processStreamResponse(e, n) {
    return $(this, arguments, function* () {
      var i, r, a, u, d, c;
      const f = [];
      try {
        for (var p = !0, h = W(e), m; m = yield M(h.next()), i = m.done, !i; p = !0) {
          u = m.value, p = !1;
          const g = u;
          if (yr(g)) {
            const T = (c = (d = g.candidates) === null || d === void 0 ? void 0 : d[0]) === null || c === void 0 ? void 0 : c.content;
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
    }), o && o.length > 0 ? this.history.push(...Un(o)) : this.history.push(e), this.history.push(...i);
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class ge extends Error {
  constructor(e) {
    super(e.message), this.name = "ApiError", this.status = e.status, Object.setPrototypeOf(this, ge.prototype);
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
  return n != null && l(e, ["_url", "file"], ro(n)), e;
}
function vr(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && l(e, ["sdkHttpResponse"], n), e;
}
function Ar(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && l(e, ["_url", "file"], ro(n)), e;
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
      return r = v("files", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = Mr(d), f = new Di();
        return Object.assign(f, c), f;
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
      return r = v("upload/v1beta/files", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Sr(d), f = new ki();
        return Object.assign(f, c), f;
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
      return r = v("files/{file}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
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
      return r = v("files/{file}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = vr(d), f = new Ui();
        return Object.assign(f, c), f;
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
      return r = v("files:register", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Nr(d), f = new Li();
        return Object.assign(f, c), f;
      });
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function ve(t) {
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
function kr(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Ur(t) {
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
function Gr(t) {
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
  const d = s(t, ["logprobs"]);
  d != null && l(e, ["logprobs"], d);
  const c = s(t, [
    "maxOutputTokens"
  ]);
  c != null && l(e, ["maxOutputTokens"], c);
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
  const E = s(t, ["seed"]);
  E != null && l(e, ["seed"], E);
  const S = s(t, ["speechConfig"]);
  S != null && l(e, ["speechConfig"], S);
  const I = s(t, [
    "stopSequences"
  ]);
  I != null && l(e, ["stopSequences"], I);
  const _ = s(t, ["temperature"]);
  _ != null && l(e, ["temperature"], _);
  const C = s(t, [
    "thinkingConfig"
  ]);
  C != null && l(e, ["thinkingConfig"], C);
  const R = s(t, ["topK"]);
  R != null && l(e, ["topK"], R);
  const P = s(t, ["topP"]);
  if (P != null && l(e, ["topP"], P), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return e;
}
function Fr(t) {
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
  const d = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], d);
  const c = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "mediaResolution"], c);
  const f = s(t, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], dt(p));
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
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], Dr(F(g)));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let R = ce(T);
    Array.isArray(R) && (R = R.map((P) => Xr(de(P)))), l(e, ["setup", "tools"], R);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], zr(y));
  const E = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "inputAudioTranscription"], E);
  const S = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const I = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "realtimeInputConfig"], I);
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
  e !== void 0 && o != null && l(e, ["setup", "generationConfig"], Gr(o));
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
  const d = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], d);
  const c = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "mediaResolution"], c);
  const f = s(t, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], dt(p));
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
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], F(g));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let P = ce(T);
    Array.isArray(P) && (P = P.map((D) => Qr(de(D)))), l(e, ["setup", "tools"], P);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], y);
  const E = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "inputAudioTranscription"], E);
  const S = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const I = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "realtimeInputConfig"], I);
  const _ = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && _ != null && l(e, ["setup", "contextWindowCompression"], _);
  const C = s(t, ["proactivity"]);
  e !== void 0 && C != null && l(e, ["setup", "proactivity"], C);
  const R = s(t, [
    "explicitVadSignal"
  ]);
  return e !== void 0 && R != null && l(e, ["setup", "explicitVadSignal"], R), n;
}
function qr(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["setup", "model"], k(t, o));
  const i = s(e, ["config"]);
  return i != null && l(n, ["config"], Vr(i, n)), n;
}
function Br(t, e) {
  const n = {}, o = s(e, ["model"]);
  o != null && l(n, ["setup", "model"], k(t, o));
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
    let c = to(n);
    Array.isArray(c) && (c = c.map((f) => ve(f))), l(e, ["mediaChunks"], c);
  }
  const o = s(t, ["audio"]);
  o != null && l(e, ["audio"], ve(oo(o)));
  const i = s(t, [
    "audioStreamEnd"
  ]);
  i != null && l(e, ["audioStreamEnd"], i);
  const r = s(t, ["video"]);
  r != null && l(e, ["video"], ve(no(r)));
  const a = s(t, ["text"]);
  a != null && l(e, ["text"], a);
  const u = s(t, [
    "activityStart"
  ]);
  u != null && l(e, ["activityStart"], u);
  const d = s(t, ["activityEnd"]);
  return d != null && l(e, ["activityEnd"], d), e;
}
function Wr(t) {
  const e = {}, n = s(t, ["media"]);
  if (n != null) {
    let c = to(n);
    Array.isArray(c) && (c = c.map((f) => f)), l(e, ["mediaChunks"], c);
  }
  const o = s(t, ["audio"]);
  o != null && l(e, ["audio"], oo(o));
  const i = s(t, [
    "audioStreamEnd"
  ]);
  i != null && l(e, ["audioStreamEnd"], i);
  const r = s(t, ["video"]);
  r != null && l(e, ["video"], no(r));
  const a = s(t, ["text"]);
  a != null && l(e, ["text"], a);
  const u = s(t, [
    "activityStart"
  ]);
  u != null && l(e, ["activityStart"], u);
  const d = s(t, ["activityEnd"]);
  return d != null && l(e, ["activityEnd"], d), e;
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
  const d = s(t, [
    "sessionResumptionUpdate"
  ]);
  d != null && l(e, ["sessionResumptionUpdate"], d);
  const c = s(t, [
    "voiceActivityDetectionSignal"
  ]);
  c != null && l(e, ["voiceActivityDetectionSignal"], c);
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
  r != null && l(e, ["fileData"], kr(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], Ur(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const d = s(t, ["inlineData"]);
  d != null && l(e, ["inlineData"], ve(d));
  const c = s(t, ["text"]);
  c != null && l(e, ["text"], c);
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
  a != null && l(e, ["googleMaps"], Fr(a));
  const u = s(t, ["googleSearch"]);
  u != null && l(e, ["googleSearch"], Hr(u));
  const d = s(t, [
    "googleSearchRetrieval"
  ]);
  d != null && l(e, ["googleSearchRetrieval"], d);
  const c = s(t, ["urlContext"]);
  return c != null && l(e, ["urlContext"], c), e;
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
    Array.isArray(p) && (p = p.map((h) => Lr(h))), l(e, ["functionDeclarations"], p);
  }
  const u = s(t, ["googleMaps"]);
  u != null && l(e, ["googleMaps"], u);
  const d = s(t, ["googleSearch"]);
  d != null && l(e, ["googleSearch"], d);
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(e, ["googleSearchRetrieval"], c);
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
  const d = s(t, [
    "promptTokensDetails"
  ]);
  if (d != null) {
    let m = d;
    Array.isArray(m) && (m = m.map((g) => g)), l(e, ["promptTokensDetails"], m);
  }
  const c = s(t, [
    "cacheTokensDetails"
  ]);
  if (c != null) {
    let m = c;
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
  const d = s(t, [
    "groundingMetadata"
  ]);
  d != null && l(n, ["groundingMetadata"], d);
  const c = s(t, ["index"]);
  c != null && l(n, ["index"], c);
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
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let a = J(r);
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
function De(t, e) {
  const n = {}, o = s(t, ["parts"]);
  if (o != null) {
    let r = o;
    Array.isArray(r) && (r = r.map((a) => ma(a))), l(n, ["parts"], r);
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
  e !== void 0 && i != null && l(e, ["systemInstruction"], F(i));
  const r = s(t, ["tools"]);
  if (e !== void 0 && r != null) {
    let u = r;
    Array.isArray(u) && (u = u.map((d) => To(d))), l(e, ["tools"], u);
  }
  const a = s(t, [
    "generationConfig"
  ]);
  return e !== void 0 && a != null && l(e, ["generationConfig"], ea(a)), o;
}
function dl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = J(r);
    Array.isArray(u) && (u = u.map((d) => De(d))), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && al(a), o;
}
function cl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = J(r);
    Array.isArray(u) && (u = u.map((d) => d)), l(o, ["contents"], u);
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
function hl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], k(t, i)), o;
}
function ml(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], k(t, i)), o;
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
  const d = s(t, [
    "guidanceScale"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "guidanceScale"], d);
  const c = s(t, ["seed"]);
  e !== void 0 && c != null && l(e, ["parameters", "seed"], c);
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
  const E = s(t, ["addWatermark"]);
  e !== void 0 && E != null && l(e, ["parameters", "addWatermark"], E);
  const S = s(t, ["labels"]);
  e !== void 0 && S != null && l(e, ["labels"], S);
  const I = s(t, ["editMode"]);
  e !== void 0 && I != null && l(e, ["parameters", "editMode"], I);
  const _ = s(t, ["baseSteps"]);
  return e !== void 0 && _ != null && l(e, ["parameters", "editConfig", "baseSteps"], _), o;
}
function Cl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, [
    "referenceImages"
  ]);
  if (a != null) {
    let d = a;
    Array.isArray(d) && (d = d.map((c) => Ea(c))), l(o, ["instances[0]", "referenceImages"], d);
  }
  const u = s(e, ["config"]);
  return u != null && Tl(u, o), o;
}
function _l(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((a) => ke(a))), l(n, ["generatedImages"], r);
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
  const d = s(t, ["autoTruncate"]);
  return e !== void 0 && d != null && l(e, ["parameters", "autoTruncate"], d), o;
}
function Il(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let d = lt(t, r);
    Array.isArray(d) && (d = d.map((c) => c)), l(o, ["requests[]", "content"], d);
  }
  const a = s(e, ["config"]);
  a != null && El(a, o);
  const u = s(e, ["model"]);
  return u !== void 0 && l(o, ["requests[]", "model"], k(t, u)), o;
}
function vl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = lt(t, r);
    Array.isArray(u) && (u = u.map((d) => d)), l(o, ["instances[]", "content"], u);
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
  const d = s(t, [
    "responseJsonSchema"
  ]);
  if (d != null && l(n, ["responseJsonSchema"], d), s(t, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return n;
}
function Dl(t, e, n, o) {
  const i = {}, r = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && r != null && l(n, ["systemInstruction"], De(F(r)));
  const a = s(e, ["temperature"]);
  a != null && l(i, ["temperature"], a);
  const u = s(e, ["topP"]);
  u != null && l(i, ["topP"], u);
  const d = s(e, ["topK"]);
  d != null && l(i, ["topK"], d);
  const c = s(e, [
    "candidateCount"
  ]);
  c != null && l(i, ["candidateCount"], c);
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
  const E = s(e, [
    "responseMimeType"
  ]);
  E != null && l(i, ["responseMimeType"], E);
  const S = s(e, [
    "responseSchema"
  ]);
  S != null && l(i, ["responseSchema"], at(S));
  const I = s(e, [
    "responseJsonSchema"
  ]);
  if (I != null && l(i, ["responseJsonSchema"], I), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const _ = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && _ != null) {
    let G = _;
    Array.isArray(G) && (G = G.map((ie) => Sa(ie))), l(n, ["safetySettings"], G);
  }
  const C = s(e, ["tools"]);
  if (n !== void 0 && C != null) {
    let G = ce(C);
    Array.isArray(G) && (G = G.map((ie) => Ma(de(ie)))), l(n, ["tools"], G);
  }
  const R = s(e, ["toolConfig"]);
  if (n !== void 0 && R != null && l(n, ["toolConfig"], wa(R)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const P = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && P != null && l(n, ["cachedContent"], Q(t, P));
  const D = s(e, [
    "responseModalities"
  ]);
  D != null && l(i, ["responseModalities"], D);
  const A = s(e, [
    "mediaResolution"
  ]);
  A != null && l(i, ["mediaResolution"], A);
  const N = s(e, ["speechConfig"]);
  if (N != null && l(i, ["speechConfig"], ut(N)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const x = s(e, [
    "thinkingConfig"
  ]);
  x != null && l(i, ["thinkingConfig"], x);
  const U = s(e, ["imageConfig"]);
  U != null && l(i, ["imageConfig"], sa(U));
  const H = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (H != null && l(i, ["enableEnhancedCivicAnswers"], H), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return i;
}
function kl(t, e, n, o) {
  const i = {}, r = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && r != null && l(n, ["systemInstruction"], F(r));
  const a = s(e, ["temperature"]);
  a != null && l(i, ["temperature"], a);
  const u = s(e, ["topP"]);
  u != null && l(i, ["topP"], u);
  const d = s(e, ["topK"]);
  d != null && l(i, ["topK"], d);
  const c = s(e, [
    "candidateCount"
  ]);
  c != null && l(i, ["candidateCount"], c);
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
  const E = s(e, [
    "responseMimeType"
  ]);
  E != null && l(i, ["responseMimeType"], E);
  const S = s(e, [
    "responseSchema"
  ]);
  S != null && l(i, ["responseSchema"], at(S));
  const I = s(e, [
    "responseJsonSchema"
  ]);
  I != null && l(i, ["responseJsonSchema"], I);
  const _ = s(e, [
    "routingConfig"
  ]);
  _ != null && l(i, ["routingConfig"], _);
  const C = s(e, [
    "modelSelectionConfig"
  ]);
  C != null && l(i, ["modelConfig"], C);
  const R = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && R != null) {
    let Y = R;
    Array.isArray(Y) && (Y = Y.map((He) => He)), l(n, ["safetySettings"], Y);
  }
  const P = s(e, ["tools"]);
  if (n !== void 0 && P != null) {
    let Y = ce(P);
    Array.isArray(Y) && (Y = Y.map((He) => To(de(He)))), l(n, ["tools"], Y);
  }
  const D = s(e, ["toolConfig"]);
  n !== void 0 && D != null && l(n, ["toolConfig"], D);
  const A = s(e, ["labels"]);
  n !== void 0 && A != null && l(n, ["labels"], A);
  const N = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && N != null && l(n, ["cachedContent"], Q(t, N));
  const x = s(e, [
    "responseModalities"
  ]);
  x != null && l(i, ["responseModalities"], x);
  const U = s(e, [
    "mediaResolution"
  ]);
  U != null && l(i, ["mediaResolution"], U);
  const H = s(e, ["speechConfig"]);
  H != null && l(i, ["speechConfig"], ut(H));
  const G = s(e, [
    "audioTimestamp"
  ]);
  G != null && l(i, ["audioTimestamp"], G);
  const ie = s(e, [
    "thinkingConfig"
  ]);
  ie != null && l(i, ["thinkingConfig"], ie);
  const ht = s(e, ["imageConfig"]);
  if (ht != null && l(i, ["imageConfig"], ra(ht)), s(e, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  const mt = s(e, [
    "modelArmorConfig"
  ]);
  return n !== void 0 && mt != null && l(n, ["modelArmorConfig"], mt), i;
}
function Ln(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = J(r);
    Array.isArray(u) && (u = u.map((d) => De(d))), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && l(o, ["generationConfig"], Dl(t, a, o)), o;
}
function Gn(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let u = J(r);
    Array.isArray(u) && (u = u.map((d) => d)), l(o, ["contents"], u);
  }
  const a = s(e, ["config"]);
  return a != null && l(o, ["generationConfig"], kl(t, a, o)), o;
}
function Fn(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["candidates"]);
  if (i != null) {
    let c = i;
    Array.isArray(c) && (c = c.map((f) => tl(f))), l(n, ["candidates"], c);
  }
  const r = s(t, ["modelVersion"]);
  r != null && l(n, ["modelVersion"], r);
  const a = s(t, [
    "promptFeedback"
  ]);
  a != null && l(n, ["promptFeedback"], a);
  const u = s(t, ["responseId"]);
  u != null && l(n, ["responseId"], u);
  const d = s(t, [
    "usageMetadata"
  ]);
  return d != null && l(n, ["usageMetadata"], d), n;
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
  const d = s(t, ["responseId"]);
  d != null && l(n, ["responseId"], d);
  const c = s(t, [
    "usageMetadata"
  ]);
  return c != null && l(n, ["usageMetadata"], c), n;
}
function Ul(t, e, n) {
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
  const d = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "personGeneration"], d);
  const c = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "includeSafetyAttributes"], c);
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
  const d = s(t, [
    "guidanceScale"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "guidanceScale"], d);
  const c = s(t, ["seed"]);
  e !== void 0 && c != null && l(e, ["parameters", "seed"], c);
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
  const E = s(t, ["addWatermark"]);
  e !== void 0 && E != null && l(e, ["parameters", "addWatermark"], E);
  const S = s(t, ["labels"]);
  e !== void 0 && S != null && l(e, ["labels"], S);
  const I = s(t, ["imageSize"]);
  e !== void 0 && I != null && l(e, ["parameters", "sampleImageSize"], I);
  const _ = s(t, [
    "enhancePrompt"
  ]);
  return e !== void 0 && _ != null && l(e, ["parameters", "enhancePrompt"], _), o;
}
function Gl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["config"]);
  return a != null && Ul(a, o), o;
}
function Fl(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
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
  return r != null && l(n, ["positivePromptSafetyAttributes"], go(r)), n;
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
    Array.isArray(a) && (a = a.map((u) => ke(u))), l(n, ["generatedImages"], a);
  }
  const r = s(t, [
    "positivePromptSafetyAttributes"
  ]);
  return r != null && l(n, ["positivePromptSafetyAttributes"], yo(r)), n;
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
  const d = s(t, [
    "personGeneration"
  ]);
  if (e !== void 0 && d != null && l(e, ["parameters", "personGeneration"], d), s(t, ["pubsubTopic"]) !== void 0)
    throw new Error("pubsubTopic parameter is not supported in Gemini API.");
  const c = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "negativePrompt"], c);
  const f = s(t, [
    "enhancePrompt"
  ]);
  if (e !== void 0 && f != null && l(e, ["parameters", "enhancePrompt"], f), s(t, ["generateAudio"]) !== void 0)
    throw new Error("generateAudio parameter is not supported in Gemini API.");
  const p = s(t, ["lastFrame"]);
  e !== void 0 && p != null && l(e, ["instances[0]", "lastFrame"], Ue(p));
  const h = s(t, [
    "referenceImages"
  ]);
  if (e !== void 0 && h != null) {
    let m = h;
    Array.isArray(m) && (m = m.map((g) => Ba(g))), l(e, ["instances[0]", "referenceImages"], m);
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
  const d = s(t, ["seed"]);
  e !== void 0 && d != null && l(e, ["parameters", "seed"], d);
  const c = s(t, ["aspectRatio"]);
  e !== void 0 && c != null && l(e, ["parameters", "aspectRatio"], c);
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
  e !== void 0 && y != null && l(e, ["instances[0]", "lastFrame"], K(y));
  const E = s(t, [
    "referenceImages"
  ]);
  if (e !== void 0 && E != null) {
    let _ = E;
    Array.isArray(_) && (_ = _.map((C) => Ja(C))), l(e, ["instances[0]", "referenceImages"], _);
  }
  const S = s(t, ["mask"]);
  e !== void 0 && S != null && l(e, ["instances[0]", "mask"], qa(S));
  const I = s(t, [
    "compressionQuality"
  ]);
  return e !== void 0 && I != null && l(e, ["parameters", "compressionQuality"], I), o;
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
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["image"]);
  a != null && l(o, ["instances[0]", "image"], Ue(a));
  const u = s(e, ["video"]);
  u != null && l(o, ["instances[0]", "video"], Co(u));
  const d = s(e, ["source"]);
  d != null && Yl(d, o);
  const c = s(e, ["config"]);
  return c != null && bl(c, o), o;
}
function $l(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["prompt"]);
  r != null && l(o, ["instances[0]", "prompt"], r);
  const a = s(e, ["image"]);
  a != null && l(o, ["instances[0]", "image"], K(a));
  const u = s(e, ["video"]);
  u != null && l(o, ["instances[0]", "video"], _o(u));
  const d = s(e, ["source"]);
  d != null && zl(d, o);
  const c = s(e, ["config"]);
  return c != null && ql(c, o), o;
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
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], Ue(r));
  const a = s(t, ["video"]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "video"], Co(a)), o;
}
function zl(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["image"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], K(r));
  const a = s(t, ["video"]);
  return e !== void 0 && a != null && l(e, ["instances[0]", "video"], _o(a)), o;
}
function Xl(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["image"], la(o));
  const i = s(t, [
    "raiFilteredReason"
  ]);
  i != null && l(n, ["raiFilteredReason"], i);
  const r = s(t, ["_self"]);
  return r != null && l(n, ["safetyAttributes"], go(r)), n;
}
function ke(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["image"], mo(o));
  const i = s(t, [
    "raiFilteredReason"
  ]);
  i != null && l(n, ["raiFilteredReason"], i);
  const r = s(t, ["_self"]);
  r != null && l(n, ["safetyAttributes"], yo(r));
  const a = s(t, ["prompt"]);
  return a != null && l(n, ["enhancedPrompt"], a), n;
}
function Ql(t, e) {
  const n = {}, o = s(t, ["_self"]);
  o != null && l(n, ["mask"], mo(o));
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
  const d = s(t, [
    "frequencyPenalty"
  ]);
  d != null && l(n, ["frequencyPenalty"], d);
  const c = s(t, ["logprobs"]);
  c != null && l(n, ["logprobs"], c);
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
  const E = s(t, [
    "routingConfig"
  ]);
  E != null && l(n, ["routingConfig"], E);
  const S = s(t, ["seed"]);
  S != null && l(n, ["seed"], S);
  const I = s(t, ["speechConfig"]);
  I != null && l(n, ["speechConfig"], I);
  const _ = s(t, [
    "stopSequences"
  ]);
  _ != null && l(n, ["stopSequences"], _);
  const C = s(t, ["temperature"]);
  C != null && l(n, ["temperature"], C);
  const R = s(t, [
    "thinkingConfig"
  ]);
  R != null && l(n, ["thinkingConfig"], R);
  const P = s(t, ["topK"]);
  P != null && l(n, ["topK"], P);
  const D = s(t, ["topP"]);
  if (D != null && l(n, ["topP"], D), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return n;
}
function ta(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], k(t, i)), o;
}
function na(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  return i != null && l(o, ["_url", "name"], k(t, i)), o;
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
function mo(t, e) {
  const n = {}, o = s(t, ["gcsUri"]);
  o != null && l(n, ["gcsUri"], o);
  const i = s(t, [
    "bytesBase64Encoded"
  ]);
  i != null && l(n, ["imageBytes"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["mimeType"], r), n;
}
function Ue(t, e) {
  const n = {};
  if (s(t, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  const o = s(t, ["imageBytes"]);
  o != null && l(n, ["bytesBase64Encoded"], j(o));
  const i = s(t, ["mimeType"]);
  return i != null && l(n, ["mimeType"], i), n;
}
function K(t, e) {
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
  const d = s(e, ["queryBase"]);
  return n !== void 0 && d != null && l(n, ["_url", "models_url"], lo(t, d)), i;
}
function ua(t, e, n, o) {
  const i = {}, r = s(e, ["pageSize"]);
  n !== void 0 && r != null && l(n, ["_query", "pageSize"], r);
  const a = s(e, ["pageToken"]);
  n !== void 0 && a != null && l(n, ["_query", "pageToken"], a);
  const u = s(e, ["filter"]);
  n !== void 0 && u != null && l(n, ["_query", "filter"], u);
  const d = s(e, ["queryBase"]);
  return n !== void 0 && d != null && l(n, ["_url", "models_url"], lo(t, d)), i;
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
    let a = ao(r);
    Array.isArray(a) && (a = a.map((u) => Ye(u))), l(n, ["models"], a);
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
    let a = ao(r);
    Array.isArray(a) && (a = a.map((u) => ze(u))), l(n, ["models"], a);
  }
  return n;
}
function ha(t, e) {
  const n = {}, o = s(t, ["maskMode"]);
  o != null && l(n, ["maskMode"], o);
  const i = s(t, [
    "segmentationClasses"
  ]);
  i != null && l(n, ["maskClasses"], i);
  const r = s(t, ["maskDilation"]);
  return r != null && l(n, ["dilation"], r), n;
}
function Ye(t, e) {
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
  const d = s(t, [
    "inputTokenLimit"
  ]);
  d != null && l(n, ["inputTokenLimit"], d);
  const c = s(t, [
    "outputTokenLimit"
  ]);
  c != null && l(n, ["outputTokenLimit"], c);
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
function ze(t, e) {
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
    Array.isArray(h) && (h = h.map((m) => Pl(m))), l(n, ["endpoints"], h);
  }
  const d = s(t, ["labels"]);
  d != null && l(n, ["labels"], d);
  const c = s(t, ["_self"]);
  c != null && l(n, ["tunedModelInfo"], xa(c));
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
function ma(t, e) {
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
  const d = s(t, [
    "functionResponse"
  ]);
  d != null && l(n, ["functionResponse"], d);
  const c = s(t, ["inlineData"]);
  c != null && l(n, ["inlineData"], el(c));
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
function ga(t, e) {
  const n = {}, o = s(t, ["productImage"]);
  return o != null && l(n, ["image"], K(o)), n;
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
  const d = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "safetySetting"], d);
  const c = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "personGeneration"], c);
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
function Ta(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["source"]);
  r != null && _a(r, o);
  const a = s(e, ["config"]);
  return a != null && ya(a, o), o;
}
function Ca(t, e) {
  const n = {}, o = s(t, [
    "predictions"
  ]);
  if (o != null) {
    let i = o;
    Array.isArray(i) && (i = i.map((r) => ke(r))), l(n, ["generatedImages"], i);
  }
  return n;
}
function _a(t, e, n) {
  const o = {}, i = s(t, ["prompt"]);
  e !== void 0 && i != null && l(e, ["instances[0]", "prompt"], i);
  const r = s(t, ["personImage"]);
  e !== void 0 && r != null && l(e, ["instances[0]", "personImage", "image"], K(r));
  const a = s(t, [
    "productImages"
  ]);
  if (e !== void 0 && a != null) {
    let u = a;
    Array.isArray(u) && (u = u.map((d) => ga(d))), l(e, ["instances[0]", "productImages"], u);
  }
  return o;
}
function Ea(t, e) {
  const n = {}, o = s(t, [
    "referenceImage"
  ]);
  o != null && l(n, ["referenceImage"], K(o));
  const i = s(t, ["referenceId"]);
  i != null && l(n, ["referenceId"], i);
  const r = s(t, [
    "referenceType"
  ]);
  r != null && l(n, ["referenceType"], r);
  const a = s(t, [
    "maskImageConfig"
  ]);
  a != null && l(n, ["maskImageConfig"], ha(a));
  const u = s(t, [
    "controlImageConfig"
  ]);
  u != null && l(n, ["controlImageConfig"], ll(u));
  const d = s(t, [
    "styleImageConfig"
  ]);
  d != null && l(n, ["styleImageConfig"], d);
  const c = s(t, [
    "subjectImageConfig"
  ]);
  return c != null && l(n, ["subjectImageConfig"], c), n;
}
function go(t, e) {
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
function Sa(t, e) {
  const n = {}, o = s(t, ["category"]);
  if (o != null && l(n, ["category"], o), s(t, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const i = s(t, ["threshold"]);
  return i != null && l(n, ["threshold"], i), n;
}
function Ia(t, e) {
  const n = {}, o = s(t, ["image"]);
  return o != null && l(n, ["image"], K(o)), n;
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
  const d = s(t, [
    "binaryColorThreshold"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "binaryColorThreshold"], d);
  const c = s(t, ["labels"]);
  return e !== void 0 && c != null && l(e, ["labels"], c), o;
}
function Aa(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
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
  e !== void 0 && r != null && l(e, ["instances[0]", "image"], K(r));
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
    Array.isArray(p) && (p = p.map((h) => h)), l(n, ["functionDeclarations"], p);
  }
  const u = s(t, ["googleMaps"]);
  u != null && l(n, ["googleMaps"], oa(u));
  const d = s(t, ["googleSearch"]);
  d != null && l(n, ["googleSearch"], ia(d));
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && l(n, ["googleSearchRetrieval"], c);
  const f = s(t, ["urlContext"]);
  return f != null && l(n, ["urlContext"], f), n;
}
function To(t, e) {
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
    Array.isArray(h) && (h = h.map((m) => xl(m))), l(n, ["functionDeclarations"], h);
  }
  const d = s(t, ["googleMaps"]);
  d != null && l(n, ["googleMaps"], d);
  const c = s(t, ["googleSearch"]);
  c != null && l(n, ["googleSearch"], c);
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
function ka(t, e, n) {
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
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "name"], k(t, i));
  const r = s(e, ["config"]);
  return r != null && Da(r, o), o;
}
function La(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["config"]);
  return r != null && ka(r, o), o;
}
function Ga(t, e, n) {
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
  const d = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && d != null && l(e, ["parameters", "outputOptions", "mimeType"], d);
  const c = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && c != null && l(e, ["parameters", "outputOptions", "compressionQuality"], c);
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
function Fa(t, e, n) {
  const o = {}, i = s(e, ["model"]);
  i != null && l(o, ["_url", "model"], k(t, i));
  const r = s(e, ["image"]);
  r != null && l(o, ["instances[0]", "image"], K(r));
  const a = s(e, [
    "upscaleFactor"
  ]);
  a != null && l(o, ["parameters", "upscaleConfig", "upscaleFactor"], a);
  const u = s(e, ["config"]);
  return u != null && Ga(u, o), o;
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
    Array.isArray(r) && (r = r.map((a) => ke(a))), l(n, ["generatedImages"], r);
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
  o != null && l(n, ["_self"], K(o));
  const i = s(t, ["maskMode"]);
  return i != null && l(n, ["maskMode"], i), n;
}
function Ba(t, e) {
  const n = {}, o = s(t, ["image"]);
  o != null && l(n, ["image"], Ue(o));
  const i = s(t, [
    "referenceType"
  ]);
  return i != null && l(n, ["referenceType"], i), n;
}
function Ja(t, e) {
  const n = {}, o = s(t, ["image"]);
  o != null && l(n, ["image"], K(o));
  const i = s(t, [
    "referenceType"
  ]);
  return i != null && l(n, ["referenceType"], i), n;
}
function Co(t, e) {
  const n = {}, o = s(t, ["uri"]);
  o != null && l(n, ["uri"], o);
  const i = s(t, ["videoBytes"]);
  i != null && l(n, ["encodedVideo"], j(i));
  const r = s(t, ["mimeType"]);
  return r != null && l(n, ["encoding"], r), n;
}
function _o(t, e) {
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
function Eo(t, e) {
  const n = {}, o = s(t, ["mimeType"]);
  e !== void 0 && o != null && l(e, ["mimeType"], o);
  const i = s(t, ["displayName"]);
  e !== void 0 && i != null && l(e, ["displayName"], i);
  const r = s(t, [
    "customMetadata"
  ]);
  if (e !== void 0 && r != null) {
    let u = r;
    Array.isArray(u) && (u = u.map((d) => d)), l(e, ["customMetadata"], u);
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
  return o != null && Eo(o, e), e;
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
const iu = "Content-Type", su = "X-Server-Timeout", ru = "User-Agent", Xe = "x-goog-api-client", lu = "1.39.0", au = `google-genai-sdk/${lu}`, uu = "v1beta1", du = "v1beta";
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
        throw new ge({
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
    return !(n.baseUrl && n.baseUrlResourceScope === Oe.COLLECTION || this.clientOptions.apiKey || !this.clientOptions.vertexai || e.path.startsWith("projects/") || e.httpMethod === "GET" && e.path.startsWith("publishers/google/models"));
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
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, n), { method: o })).then(async (i) => (await Vn(i), new $e(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  async streamApiCall(e, n, o) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, n), { method: o })).then(async (i) => (await Vn(i), this.processStreamResponse(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  processStreamResponse(e) {
    return $(this, arguments, function* () {
      var o;
      const i = (o = e == null ? void 0 : e.body) === null || o === void 0 ? void 0 : o.getReader(), r = new TextDecoder("utf-8");
      if (!i)
        throw new Error("Response body is empty");
      try {
        let a = "";
        const u = "data:", d = [`

`, "\r\r", `\r
\r
`];
        for (; ; ) {
          const { done: c, value: f } = yield M(i.read());
          if (c) {
            if (a.trim().length > 0)
              throw new Error("Incomplete JSON segment at the end");
            break;
          }
          const p = r.decode(f, { stream: !0 });
          try {
            const g = JSON.parse(p);
            if ("error" in g) {
              const T = JSON.parse(JSON.stringify(g.error)), y = T.status, E = T.code, S = `got status: ${y}. ${JSON.stringify(g)}`;
              if (E >= 400 && E < 600)
                throw new ge({
                  message: S,
                  status: E
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
            for (const y of d) {
              const E = a.indexOf(y);
              E !== -1 && (h === -1 || E < h) && (h = E, m = y.length);
            }
            if (h === -1)
              break;
            const g = a.substring(0, h);
            a = a.substring(h + m);
            const T = g.trim();
            if (T.startsWith(u)) {
              const y = T.substring(u.length).trim();
              try {
                const E = new Response(y, {
                  headers: e == null ? void 0 : e.headers,
                  status: e == null ? void 0 : e.status,
                  statusText: e == null ? void 0 : e.statusText
                });
                yield yield M(new $e(E));
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
    return e[ru] = n, e[Xe] = n, e[iu] = "application/json", e;
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
    const d = {
      file: i
    }, c = this.getFileName(e), f = v("upload/v1beta/files", d._url), p = await this.fetchUploadUrl(f, i.sizeBytes, i.mimeType, c, d, n == null ? void 0 : n.httpOptions);
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
    const r = this.clientOptions.uploader, a = await r.stat(n), u = String(a.size), d = (i = o == null ? void 0 : o.mimeType) !== null && i !== void 0 ? i : a.type;
    if (d === void 0 || d === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    const c = `upload/v1beta/${e}:uploadToFileSearchStore`, f = this.getFileName(n), p = {};
    o != null && Eo(o, p);
    const h = await this.fetchUploadUrl(c, u, d, f, p, o == null ? void 0 : o.httpOptions);
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
    let d = {};
    a ? d = a : d = {
      apiVersion: "",
      // api-version is set in the path.
      headers: Object.assign({ "Content-Type": "application/json", "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": `${n}`, "X-Goog-Upload-Header-Content-Type": `${o}` }, i ? { "X-Goog-Upload-File-Name": i } : {})
    };
    const c = await this.request({
      path: e,
      body: JSON.stringify(r),
      httpMethod: "POST",
      httpOptions: d
    });
    if (!c || !(c != null && c.headers))
      throw new Error("Server did not return an HttpResponse or the returned HttpResponse did not have headers.");
    const f = (u = c == null ? void 0 : c.headers) === null || u === void 0 ? void 0 : u["x-goog-upload-url"];
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
    throw n >= 400 && n < 600 ? new ge({
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
    for (const d in a)
      if (Object.prototype.hasOwnProperty.call(a, d)) {
        const c = a[d], f = u[d];
        c && typeof c == "object" && !Array.isArray(c) && f && typeof f == "object" && !Array.isArray(f) ? u[d] = o(f, c) : (f && c && typeof f != typeof c && console.warn(`includeExtraBodyToRequestInit:deepMerge: Type mismatch for key "${d}". Original type: ${typeof f}, New type: ${typeof c}. Overwriting.`), u[d] = c);
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
let hu = !1;
function So(t) {
  for (const e of t)
    if (mu(e) || typeof e == "object" && "inputSchema" in e)
      return !0;
  return hu;
}
function Io(t) {
  var e;
  const n = (e = t[Xe]) !== null && e !== void 0 ? e : "";
  t[Xe] = (n + ` ${pu}`).trimStart();
}
function mu(t) {
  return t !== null && typeof t == "object" && t instanceof ct;
}
function gu(t) {
  return $(this, arguments, function* (n, o = 100) {
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
class ct {
  constructor(e = [], n) {
    this.mcpTools = [], this.functionNameToMcpClient = {}, this.mcpClients = e, this.config = n;
  }
  /**
   * Creates a McpCallableTool.
   */
  static create(e, n) {
    return new ct(e, n);
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
        for (var u = !0, d = (n = void 0, W(gu(f))), c; c = await d.next(), e = c.done, !e; u = !0) {
          i = c.value, u = !1;
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
          !u && !e && (o = d.return) && await o.call(d);
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
  const o = new Fi();
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
    const i = this.apiClient.getWebsocketBaseUrl(), r = this.apiClient.getApiVersion(), a = Eu(this.apiClient.getDefaultHeaders()), u = this.apiClient.getApiKey(), d = `${i}/ws/google.ai.generativelanguage.${r}.GenerativeService.BidiGenerateMusic?key=${u}`;
    let c = () => {
    };
    const f = new Promise((I) => {
      c = I;
    }), p = e.callbacks, h = function() {
      c({});
    }, m = this.apiClient, g = {
      onopen: h,
      onmessage: (I) => {
        yu(m, p.onmessage, I);
      },
      onerror: (n = p == null ? void 0 : p.onerror) !== null && n !== void 0 ? n : function(I) {
      },
      onclose: (o = p == null ? void 0 : p.onclose) !== null && o !== void 0 ? o : function(I) {
      }
    }, T = this.webSocketFactory.create(d, _u(a), g);
    T.connect(), await f;
    const S = { setup: { model: k(this.apiClient, e.model) } };
    return T.send(JSON.stringify(S)), new Cu(T, this.apiClient);
  }
}
class Cu {
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
function _u(t) {
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
  const o = new Gi();
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
    const d = this.apiClient.getWebsocketBaseUrl(), c = this.apiClient.getApiVersion();
    let f;
    const p = this.apiClient.getHeaders();
    e.config && e.config.tools && So(e.config.tools) && Io(p);
    const h = wu(p);
    if (this.apiClient.isVertexAI()) {
      const A = this.apiClient.getProject(), N = this.apiClient.getLocation(), x = this.apiClient.getApiKey(), U = !!A && !!N || !!x;
      this.apiClient.getCustomBaseUrl() && !U ? f = d : (f = `${d}/ws/google.cloud.aiplatform.${c}.LlmBidiService/BidiGenerateContent`, await this.auth.addAuthHeaders(h, f));
    } else {
      const A = this.apiClient.getApiKey();
      let N = "BidiGenerateContent", x = "key";
      A != null && A.startsWith("auth_tokens/") && (console.warn("Warning: Ephemeral token support is experimental and may change in future versions."), c !== "v1alpha" && console.warn("Warning: The SDK's ephemeral token support is in v1alpha only. Please use const ai = new GoogleGenAI({apiKey: token.name, httpOptions: { apiVersion: 'v1alpha' }}); before session connection."), N = "BidiGenerateContentConstrained", x = "access_token"), f = `${d}/ws/google.ai.generativelanguage.${c}.GenerativeService.${N}?${x}=${A}`;
    }
    let m = () => {
    };
    const g = new Promise((A) => {
      m = A;
    }), T = e.callbacks, y = function() {
      var A;
      (A = T == null ? void 0 : T.onopen) === null || A === void 0 || A.call(T), m({});
    }, E = this.apiClient, S = {
      onopen: y,
      onmessage: (A) => {
        Iu(E, T.onmessage, A);
      },
      onerror: (n = T == null ? void 0 : T.onerror) !== null && n !== void 0 ? n : function(A) {
      },
      onclose: (o = T == null ? void 0 : T.onclose) !== null && o !== void 0 ? o : function(A) {
      }
    }, I = this.webSocketFactory.create(f, Pu(h), S);
    I.connect(), await g;
    let _ = k(this.apiClient, e.model);
    if (this.apiClient.isVertexAI() && _.startsWith("publishers/")) {
      const A = this.apiClient.getProject(), N = this.apiClient.getLocation();
      A && N && (_ = `projects/${A}/locations/${N}/` + _);
    }
    let C = {};
    this.apiClient.isVertexAI() && ((i = e.config) === null || i === void 0 ? void 0 : i.responseModalities) === void 0 && (e.config === void 0 ? e.config = { responseModalities: [Re.AUDIO] } : e.config.responseModalities = [Re.AUDIO]), !((r = e.config) === null || r === void 0) && r.generationConfig && console.warn("Setting `LiveConnectConfig.generation_config` is deprecated, please set the fields on `LiveConnectConfig` directly. This will become an error in a future version (not before Q3 2025).");
    const R = (u = (a = e.config) === null || a === void 0 ? void 0 : a.tools) !== null && u !== void 0 ? u : [], P = [];
    for (const A of R)
      if (this.isCallableTool(A)) {
        const N = A;
        P.push(await N.tool());
      } else
        P.push(A);
    P.length > 0 && (e.config.tools = P);
    const D = {
      model: _,
      config: e.config,
      callbacks: e.callbacks
    };
    return this.apiClient.isVertexAI() ? C = Br(this.apiClient, D) : C = qr(this.apiClient, D), delete C.config, I.send(JSON.stringify(C)), new Ru(I, this.apiClient);
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
        o = J(n.turns), e.isVertexAI() || (o = o.map((i) => De(i)));
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
function Mu(t) {
  var e, n, o;
  return (o = (n = (e = t.config) === null || e === void 0 ? void 0 : e.tools) === null || n === void 0 ? void 0 : n.some((i) => ue(i))) !== null && o !== void 0 ? o : !1;
}
function Bn(t) {
  var e;
  const n = [];
  return !((e = t == null ? void 0 : t.config) === null || e === void 0) && e.tools && t.config.tools.forEach((o, i) => {
    if (ue(o))
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
      const d = await this.processParamsMaybeAddMcpUsage(n);
      if (this.maybeMoveToResponseJsonSchem(n), !Mu(n) || qn(n.config))
        return await this.generateContentInternal(d);
      const c = Bn(n);
      if (c.length > 0) {
        const T = c.map((y) => `tools[${y}]`).join(", ");
        throw new Error(`Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations is not yet supported. Incompatible tools found at ${T}.`);
      }
      let f, p;
      const h = J(d.contents), m = (r = (i = (o = d.config) === null || o === void 0 ? void 0 : o.automaticFunctionCalling) === null || i === void 0 ? void 0 : i.maximumRemoteCalls) !== null && r !== void 0 ? r : bn;
      let g = 0;
      for (; g < m && (f = await this.generateContentInternal(d), !(!f.functionCalls || f.functionCalls.length === 0)); ) {
        const T = f.candidates[0].content, y = [];
        for (const E of (u = (a = n.config) === null || a === void 0 ? void 0 : a.tools) !== null && u !== void 0 ? u : [])
          if (ue(E)) {
            const I = await E.callTool(f.functionCalls);
            y.push(...I);
          }
        g++, p = {
          role: "user",
          parts: y
        }, d.contents = J(d.contents), d.contents.push(T), d.contents.push(p), Jn(d.config) && (h.push(T), h.push(p));
      }
      return Jn(d.config) && (f.automaticFunctionCallingHistory = h), f;
    }, this.generateContentStream = async (n) => {
      var o, i, r, a, u;
      if (this.maybeMoveToResponseJsonSchem(n), qn(n.config)) {
        const p = await this.processParamsMaybeAddMcpUsage(n);
        return await this.generateContentStreamInternal(p);
      }
      const d = Bn(n);
      if (d.length > 0) {
        const p = d.map((h) => `tools[${h}]`).join(", ");
        throw new Error(`Incompatible tools found at ${p}. Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations" is not yet supported.`);
      }
      const c = (r = (i = (o = n == null ? void 0 : n.config) === null || o === void 0 ? void 0 : o.toolConfig) === null || i === void 0 ? void 0 : i.functionCallingConfig) === null || r === void 0 ? void 0 : r.streamFunctionCallArguments, f = (u = (a = n == null ? void 0 : n.config) === null || a === void 0 ? void 0 : a.automaticFunctionCalling) === null || u === void 0 ? void 0 : u.disable;
      if (c && !f)
        throw new Error("Running in streaming mode with 'streamFunctionCallArguments' enabled, this feature is not compatible with automatic function calling (AFC). Please set 'config.automaticFunctionCalling.disable' to true to disable AFC or leave 'config.toolConfig.functionCallingConfig.streamFunctionCallArguments' to be undefined or set to false to disable streaming function call arguments feature.");
      return await this.processAfcStream(n);
    }, this.generateImages = async (n) => await this.generateImagesInternal(n).then((o) => {
      var i;
      let r;
      const a = [];
      if (o != null && o.generatedImages)
        for (const d of o.generatedImages)
          d && (d != null && d.safetyAttributes) && ((i = d == null ? void 0 : d.safetyAttributes) === null || i === void 0 ? void 0 : i.contentType) === "Positive Prompt" ? r = d == null ? void 0 : d.safetyAttributes : a.push(d);
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
      var o, i, r, a, u, d;
      if ((n.prompt || n.image || n.video) && n.source)
        throw new Error("Source and prompt/image/video are mutually exclusive. Please only use source.");
      return this.apiClient.isVertexAI() || (!((o = n.video) === null || o === void 0) && o.uri && (!((i = n.video) === null || i === void 0) && i.videoBytes) ? n.video = {
        uri: n.video.uri,
        mimeType: n.video.mimeType
      } : !((a = (r = n.source) === null || r === void 0 ? void 0 : r.video) === null || a === void 0) && a.uri && (!((d = (u = n.source) === null || u === void 0 ? void 0 : u.video) === null || d === void 0) && d.videoBytes) && (n.source.video = {
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
    const a = await Promise.all(r.map(async (d) => ue(d) ? await d.tool() : d)), u = {
      model: e.model,
      contents: e.contents,
      config: Object.assign(Object.assign({}, e.config), { tools: a })
    };
    if (u.config.tools = a, e.config && e.config.tools && So(e.config.tools)) {
      const d = (i = (o = e.config.httpOptions) === null || o === void 0 ? void 0 : o.headers) !== null && i !== void 0 ? i : {};
      let c = Object.assign({}, d);
      Object.keys(c).length === 0 && (c = this.apiClient.getDefaultHeaders()), Io(c), u.config.httpOptions = Object.assign(Object.assign({}, e.config.httpOptions), { headers: c });
    }
    return u;
  }
  async initAfcToolsMap(e) {
    var n, o, i;
    const r = /* @__PURE__ */ new Map();
    for (const a of (o = (n = e.config) === null || n === void 0 ? void 0 : n.tools) !== null && o !== void 0 ? o : [])
      if (ue(a)) {
        const u = a, d = await u.tool();
        for (const c of (i = d.functionDeclarations) !== null && i !== void 0 ? i : []) {
          if (!c.name)
            throw new Error("Function declaration name is required.");
          if (r.has(c.name))
            throw new Error(`Duplicate tool declaration name: ${c.name}`);
          r.set(c.name, u);
        }
      }
    return r;
  }
  async processAfcStream(e) {
    var n, o, i;
    const r = (i = (o = (n = e.config) === null || n === void 0 ? void 0 : n.automaticFunctionCalling) === null || o === void 0 ? void 0 : o.maximumRemoteCalls) !== null && i !== void 0 ? i : bn;
    let a = !1, u = 0;
    const d = await this.initAfcToolsMap(e);
    return function(c, f, p) {
      return $(this, arguments, function* () {
        for (var h, m, g, T, y, E; u < r; ) {
          a && (u++, a = !1);
          const C = yield M(c.processParamsMaybeAddMcpUsage(p)), R = yield M(c.generateContentStreamInternal(C)), P = [], D = [];
          try {
            for (var S = !0, I = (m = void 0, W(R)), _; _ = yield M(I.next()), h = _.done, !h; S = !0) {
              T = _.value, S = !1;
              const A = T;
              if (yield yield M(A), A.candidates && (!((y = A.candidates[0]) === null || y === void 0) && y.content)) {
                D.push(A.candidates[0].content);
                for (const N of (E = A.candidates[0].content.parts) !== null && E !== void 0 ? E : [])
                  if (u < r && N.functionCall) {
                    if (!N.functionCall.name)
                      throw new Error("Function call name was not returned by the model.");
                    if (f.has(N.functionCall.name)) {
                      const x = yield M(f.get(N.functionCall.name).callTool([N.functionCall]));
                      P.push(...x);
                    } else
                      throw new Error(`Automatic function calling was requested, but not all the tools the model used implement the CallableTool interface. Available tools: ${f.keys()}, mising tool: ${N.functionCall.name}`);
                  }
              }
            }
          } catch (A) {
            m = { error: A };
          } finally {
            try {
              !S && !h && (g = I.return) && (yield M(g.call(I)));
            } finally {
              if (m) throw m.error;
            }
          }
          if (P.length > 0) {
            a = !0;
            const A = new pe();
            A.candidates = [
              {
                content: {
                  role: "user",
                  parts: P
                }
              }
            ], yield yield M(A);
            const N = [];
            N.push(...D), N.push({
              role: "user",
              parts: P
            });
            const x = J(p.contents).concat(N);
            p.contents = x;
          } else
            break;
        }
      });
    }(this, d, e);
  }
  async generateContentInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Gn(this.apiClient, e);
      return u = v("{model}:generateContent", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Hn(f), h = new pe();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Ln(this.apiClient, e);
      return u = v("{model}:generateContent", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Fn(f), h = new pe();
        return Object.assign(h, p), h;
      });
    }
  }
  async generateContentStreamInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Gn(this.apiClient, e);
      return u = v("{model}:streamGenerateContent?alt=sse", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.requestStream({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }), a.then(function(p) {
        return $(this, arguments, function* () {
          var h, m, g, T;
          try {
            for (var y = !0, E = W(p), S; S = yield M(E.next()), h = S.done, !h; y = !0) {
              T = S.value, y = !1;
              const I = T, _ = Hn(yield M(I.json()), e);
              _.sdkHttpResponse = {
                headers: I.headers
              };
              const C = new pe();
              Object.assign(C, _), yield yield M(C);
            }
          } catch (I) {
            m = { error: I };
          } finally {
            try {
              !y && !h && (g = E.return) && (yield M(g.call(E)));
            } finally {
              if (m) throw m.error;
            }
          }
        });
      });
    } else {
      const c = Ln(this.apiClient, e);
      return u = v("{model}:streamGenerateContent?alt=sse", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.requestStream({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }), a.then(function(p) {
        return $(this, arguments, function* () {
          var h, m, g, T;
          try {
            for (var y = !0, E = W(p), S; S = yield M(E.next()), h = S.done, !h; y = !0) {
              T = S.value, y = !1;
              const I = T, _ = Fn(yield M(I.json()), e);
              _.sdkHttpResponse = {
                headers: I.headers
              };
              const C = new pe();
              Object.assign(C, _), yield yield M(C);
            }
          } catch (I) {
            m = { error: I };
          } finally {
            try {
              !y && !h && (g = E.return) && (yield M(g.call(E)));
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = vl(this.apiClient, e);
      return u = v("{model}:predict", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Rl(f), h = new Tn();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Il(this.apiClient, e);
      return u = v("{model}:batchEmbedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Al(f), h = new Tn();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Private method for generating images.
   */
  async generateImagesInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Fl(this.apiClient, e);
      return u = v("{model}:predict", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Vl(f), h = new Cn();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Gl(this.apiClient, e);
      return u = v("{model}:predict", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Hl(f), h = new Cn();
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
      const u = Cl(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = _l(d), f = new vi();
        return Object.assign(f, c), f;
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
      const u = Fa(this.apiClient, e);
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = Ha(d), f = new Ai();
        return Object.assign(f, c), f;
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
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Ca(d), f = new Ri();
        return Object.assign(f, c), f;
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
      return r = v("{model}:predict", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Ra(d), f = new Pi();
        return Object.assign(f, c), f;
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = na(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => ze(f));
    } else {
      const c = ta(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ye(f));
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = ca(this.apiClient, e);
      return u = v("{models_url}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = pa(f), h = new _n();
        return Object.assign(h, p), h;
      });
    } else {
      const c = da(this.apiClient, e);
      return u = v("{models_url}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = fa(f), h = new _n();
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = La(this.apiClient, e);
      return u = v("{model}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => ze(f));
    } else {
      const c = Ua(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ye(f));
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = ml(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = yl(f), h = new En();
        return Object.assign(h, p), h;
      });
    } else {
      const c = hl(this.apiClient, e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = gl(f), h = new En();
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = cl(this.apiClient, e);
      return u = v("{model}:countTokens", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = pl(f), h = new Sn();
        return Object.assign(h, p), h;
      });
    } else {
      const c = dl(this.apiClient, e);
      return u = v("{model}:countTokens", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = fl(f), h = new Sn();
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
      const u = ol(this.apiClient, e);
      return r = v("{model}:computeTokens", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = il(d), f = new wi();
        return Object.assign(f, c), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for generating videos.
   */
  async generateVideosInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = $l(this.apiClient, e);
      return u = v("{model}:predictLongRunning", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const p = Jl(f), h = new Pe();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Ol(this.apiClient, e);
      return u = v("{model}:predictLongRunning", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const p = Bl(f), h = new Pe();
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Ti(e);
      return u = v("{operationName}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a;
    } else {
      const c = yi(e);
      return u = v("{operationName}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
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
      return r = v("{resourceName}:fetchPredictOperation", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i;
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
function ku(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => Bu(r))), l(e, ["parts"], i);
  }
  const o = s(t, ["role"]);
  return o != null && l(e, ["role"], o), e;
}
function Uu(t, e, n) {
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
  const d = s(e, [
    "lockAdditionalFields"
  ]);
  return n !== void 0 && d != null && l(n, ["fieldMask"], d), o;
}
function Lu(t, e) {
  const n = {}, o = s(e, ["config"]);
  return o != null && l(n, ["config"], Uu(t, o, n)), n;
}
function Gu(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && l(e, ["fileUri"], n);
  const o = s(t, ["mimeType"]);
  return o != null && l(e, ["mimeType"], o), e;
}
function Fu(t) {
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
  const d = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && d != null && l(e, ["setup", "generationConfig", "maxOutputTokens"], d);
  const c = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && c != null && l(e, ["setup", "generationConfig", "mediaResolution"], c);
  const f = s(t, ["seed"]);
  e !== void 0 && f != null && l(e, ["setup", "generationConfig", "seed"], f);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && l(e, ["setup", "generationConfig", "speechConfig"], dt(p));
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
  e !== void 0 && g != null && l(e, ["setup", "systemInstruction"], ku(F(g)));
  const T = s(t, ["tools"]);
  if (e !== void 0 && T != null) {
    let R = ce(T);
    Array.isArray(R) && (R = R.map((P) => Ou(de(P)))), l(e, ["setup", "tools"], R);
  }
  const y = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && y != null && l(e, ["setup", "sessionResumption"], Ju(y));
  const E = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && E != null && l(e, ["setup", "inputAudioTranscription"], E);
  const S = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && S != null && l(e, ["setup", "outputAudioTranscription"], S);
  const I = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && I != null && l(e, ["setup", "realtimeInputConfig"], I);
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
  o != null && l(n, ["setup", "model"], k(t, o));
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
  r != null && l(e, ["fileData"], Gu(r));
  const a = s(t, ["functionCall"]);
  a != null && l(e, ["functionCall"], Fu(a));
  const u = s(t, [
    "functionResponse"
  ]);
  u != null && l(e, ["functionResponse"], u);
  const d = s(t, ["inlineData"]);
  d != null && l(e, ["inlineData"], Du(d));
  const c = s(t, ["text"]);
  c != null && l(e, ["text"], c);
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
  const d = s(t, [
    "googleSearchRetrieval"
  ]);
  d != null && l(e, ["googleSearchRetrieval"], d);
  const c = s(t, ["urlContext"]);
  return c != null && l(e, ["urlContext"], c), e;
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
      i.length > 0 && (u = i.map((c) => a.includes(c) ? `generationConfig.${c}` : c));
      const d = [];
      r && d.push(r), u.length > 0 && d.push(...u), d.length > 0 ? t.fieldMask = d.join(",") : delete t.fieldMask;
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
      r = v("auth_tokens", u._url), a = u._query, delete u.config, delete u._url, delete u._query;
      const d = Wu(u, e.config);
      return i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((c) => c.json()), i.then((c) => c);
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
      return r = v("{name}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
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
      const u = Zu(e);
      return r = v("{parent}/documents", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = ju(d), f = new Mi();
        return Object.assign(f, c), f;
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
      return r = v("fileSearchStores", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
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
      return r = v("{name}", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
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
      const u = eu(e);
      return r = v("fileSearchStores", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = tu(d), f = new Ni();
        return Object.assign(f, c), f;
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
      return r = v("upload/v1beta/{file_search_store_name}:uploadToFileSearchStore", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = ou(d), f = new xi();
        return Object.assign(f, c), f;
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
      return r = v("{file_search_store_name}:importFile", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Xa(d), f = new st();
        return Object.assign(f, c), f;
      });
    }
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
let vo = function() {
  const { crypto: t } = globalThis;
  if (t != null && t.randomUUID)
    return vo = t.randomUUID.bind(t), t.randomUUID();
  const e = new Uint8Array(1), n = t ? () => t.getRandomValues(e)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (o) => (+o ^ n() & 15 >> +o / 4).toString(16));
};
const nd = () => vo();
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Qe(t) {
  return typeof t == "object" && t !== null && // Spec-compliant fetch implementations
  ("name" in t && t.name === "AbortError" || // Expo fetch
  "message" in t && String(t.message).includes("FetchRequestCanceledException"));
}
const Ze = (t) => {
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
class O extends Error {
}
class b extends O {
  constructor(e, n, o, i) {
    super(`${b.makeMessage(e, n, o)}`), this.status = e, this.headers = i, this.error = n;
  }
  static makeMessage(e, n, o) {
    const i = n != null && n.message ? typeof n.message == "string" ? n.message : JSON.stringify(n.message) : n ? JSON.stringify(n) : o;
    return e && i ? `${e} ${i}` : e ? `${e} status code (no body)` : i || "(no status code or body)";
  }
  static generate(e, n, o, i) {
    if (!e || !i)
      return new Le({ message: o, cause: Ze(n) });
    const r = n;
    return e === 400 ? new Ro(e, r, o, i) : e === 401 ? new Po(e, r, o, i) : e === 403 ? new wo(e, r, o, i) : e === 404 ? new Mo(e, r, o, i) : e === 409 ? new No(e, r, o, i) : e === 422 ? new xo(e, r, o, i) : e === 429 ? new Do(e, r, o, i) : e >= 500 ? new ko(e, r, o, i) : new b(e, r, o, i);
  }
}
class je extends b {
  constructor({ message: e } = {}) {
    super(void 0, void 0, e || "Request was aborted.", void 0);
  }
}
class Le extends b {
  constructor({ message: e, cause: n }) {
    super(void 0, void 0, e || "Connection error.", void 0), n && (this.cause = n);
  }
}
class Ao extends Le {
  constructor({ message: e } = {}) {
    super({ message: e ?? "Request timed out." });
  }
}
class Ro extends b {
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
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const od = /^[a-z][a-z0-9+.-]*:/i, id = (t) => od.test(t);
let et = (t) => (et = Array.isArray, et(t));
const sd = et;
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
    throw new O(`${t} must be an integer`);
  if (e < 0)
    throw new O(`${t} must be a positive integer`);
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
const se = "0.0.1";
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
      "X-Stainless-Package-Version": se,
      "X-Stainless-OS": Wn(Deno.build.os),
      "X-Stainless-Arch": $n(Deno.build.arch),
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
      "X-Stainless-OS": Wn((n = globalThis.process.platform) !== null && n !== void 0 ? n : "unknown"),
      "X-Stainless-Arch": $n((o = globalThis.process.arch) !== null && o !== void 0 ? o : "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": (i = globalThis.process.version) !== null && i !== void 0 ? i : "unknown"
    };
  const a = hd();
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
function hd() {
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
let ye;
const md = () => ye ?? (ye = pd());
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
function Uo(...t) {
  const e = globalThis.ReadableStream;
  if (typeof e > "u")
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  return new e(...t);
}
function yd(t) {
  let e = Symbol.asyncIterator in t ? t[Symbol.asyncIterator]() : t[Symbol.iterator]();
  return Uo({
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
function Lo(t) {
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
const Cd = ({ headers: t, body: e }) => ({
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
const Go = () => {
  var t;
  if (typeof File > "u") {
    const { process: e } = globalThis, n = typeof ((t = e == null ? void 0 : e.versions) === null || t === void 0 ? void 0 : t.node) == "string" && parseInt(e.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (n ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function Ve(t, e, n) {
  return Go(), new File(t, e ?? "unknown_file", n);
}
function _d(t) {
  return (typeof t == "object" && t !== null && ("name" in t && t.name && String(t.name) || "url" in t && t.url && String(t.url) || "filename" in t && t.filename && String(t.filename) || "path" in t && t.path && String(t.path)) || "").split(/[\\/]/).pop() || void 0;
}
const Ed = (t) => t != null && typeof t == "object" && typeof t[Symbol.asyncIterator] == "function";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const Fo = (t) => t != null && typeof t == "object" && typeof t.size == "number" && typeof t.type == "string" && typeof t.text == "function" && typeof t.slice == "function" && typeof t.arrayBuffer == "function", Sd = (t) => t != null && typeof t == "object" && typeof t.name == "string" && typeof t.lastModified == "number" && Fo(t), Id = (t) => t != null && typeof t == "object" && typeof t.url == "string" && typeof t.blob == "function";
async function vd(t, e, n) {
  if (Go(), t = await t, Sd(t))
    return t instanceof File ? t : Ve([await t.arrayBuffer()], t.name);
  if (Id(t)) {
    const i = await t.blob();
    return e || (e = new URL(t.url).pathname.split(/[\\/]/).pop()), Ve(await tt(i), e, n);
  }
  const o = await tt(t);
  if (e || (e = _d(t)), !(n != null && n.type)) {
    const i = o.find((r) => typeof r == "object" && "type" in r && r.type);
    typeof i == "string" && (n = Object.assign(Object.assign({}, n), { type: i }));
  }
  return Ve(o, e, n);
}
async function tt(t) {
  var e, n, o, i, r;
  let a = [];
  if (typeof t == "string" || ArrayBuffer.isView(t) || // includes Uint8Array, Buffer, etc.
  t instanceof ArrayBuffer)
    a.push(t);
  else if (Fo(t))
    a.push(t instanceof Blob ? t : await t.arrayBuffer());
  else if (Ed(t))
    try {
      for (var u = !0, d = W(t), c; c = await d.next(), e = c.done, !e; u = !0) {
        i = c.value, u = !1;
        const f = i;
        a.push(...await tt(f));
      }
    } catch (f) {
      n = { error: f };
    } finally {
      try {
        !u && !e && (o = d.return) && await o.call(d);
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
class Ho {
  constructor(e) {
    this._client = e;
  }
}
Ho._key = [];
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Vo(t) {
  return t.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const Kn = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null)), Rd = (t = Vo) => function(n, ...o) {
  if (n.length === 1)
    return n[0];
  let i = !1;
  const r = [], a = n.reduce((f, p, h) => {
    var m, g, T;
    /[?#]/.test(p) && (i = !0);
    const y = o[h];
    let E = (i ? encodeURIComponent : t)("" + y);
    return h !== o.length && (y == null || typeof y == "object" && // handle values from other realms
    y.toString === ((T = Object.getPrototypeOf((g = Object.getPrototypeOf((m = y.hasOwnProperty) !== null && m !== void 0 ? m : Kn)) !== null && g !== void 0 ? g : Kn)) === null || T === void 0 ? void 0 : T.toString)) && (E = y + "", r.push({
      start: f.length + p.length,
      length: E.length,
      error: `Value of type ${Object.prototype.toString.call(y).slice(8, -1)} is not a valid path parameter`
    })), f + p + (h === o.length ? "" : E);
  }, ""), u = a.split(/[?#]/, 1)[0], d = new RegExp("(?<=^|\\/)(?:\\.|%2e){1,2}(?=\\/|$)", "gi");
  let c;
  for (; (c = d.exec(u)) !== null; )
    r.push({
      start: c.index,
      length: c[0].length,
      error: `Value "${c[0]}" can't be safely passed as a path parameter`
    });
  if (r.sort((f, p) => f.start - p.start), r.length > 0) {
    let f = 0;
    const p = r.reduce((h, m) => {
      const g = " ".repeat(m.start - f), T = "^".repeat(m.length);
      return f = m.start + m.length, h + g + T;
    }, "");
    throw new O(`Path parameters result in path with invalid segments:
${r.map((h) => h.error).join(`
`)}
${a}
${p}`);
  }
  return a;
}, Te = /* @__PURE__ */ Rd(Vo);
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class bo extends Ho {
  create(e, n) {
    var o;
    const { api_version: i = this._client.apiVersion } = e, r = Me(e, ["api_version"]);
    if ("model" in r && "agent_config" in r)
      throw new O("Invalid request: specified `model` and `agent_config`. If specifying `model`, use `generation_config`.");
    if ("agent" in r && "generation_config" in r)
      throw new O("Invalid request: specified `agent` and `generation_config`. If specifying `agent`, use `agent_config`.");
    return this._client.post(Te`/${i}/interactions`, Object.assign(Object.assign({ body: r }, n), { stream: (o = e.stream) !== null && o !== void 0 ? o : !1 }));
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
    return this._client.delete(Te`/${i}/interactions/${e}`, o);
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
    return this._client.post(Te`/${i}/interactions/${e}/cancel`, o);
  }
  get(e, n = {}, o) {
    var i;
    const r = n ?? {}, { api_version: a = this._client.apiVersion } = r, u = Me(r, ["api_version"]);
    return this._client.get(Te`/${a}/interactions/${e}`, Object.assign(Object.assign({ query: u }, o), { stream: (i = n == null ? void 0 : n.stream) !== null && i !== void 0 ? i : !1 }));
  }
}
bo._key = Object.freeze(["interactions"]);
class qo extends bo {
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
let Ce;
function ft(t) {
  let e;
  return (Ce ?? (e = new globalThis.TextEncoder(), Ce = e.encode.bind(e)))(t);
}
let _e;
function Yn(t) {
  let e;
  return (_e ?? (e = new globalThis.TextDecoder(), _e = e.decode.bind(e)))(t);
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
class Ge {
  constructor() {
    this.buffer = new Uint8Array(), this.carriageReturnIndex = null;
  }
  decode(e) {
    if (e == null)
      return [];
    const n = e instanceof ArrayBuffer ? new Uint8Array(e) : typeof e == "string" ? ft(e) : e;
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
Ge.NEWLINE_CHARS = /* @__PURE__ */ new Set([`
`, "\r"]);
Ge.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
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
const Ne = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
}, zn = (t, e, n) => {
  if (t) {
    if (ad(Ne, t))
      return t;
    V(n).warn(`${e} was set to ${JSON.stringify(t)}, expected one of ${JSON.stringify(Object.keys(Ne))}`);
  }
};
function me() {
}
function Ee(t, e, n) {
  return !e || Ne[t] > Ne[n] ? me : e[t].bind(e);
}
const Nd = {
  error: me,
  warn: me,
  info: me,
  debug: me
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
    error: Ee("error", n, o),
    warn: Ee("warn", n, o),
    info: Ee("info", n, o),
    debug: Ee("debug", n, o)
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
class le {
  constructor(e, n, o) {
    this.iterator = e, this.controller = n, this.client = o;
  }
  static fromSSEResponse(e, n, o) {
    let i = !1;
    const r = o ? V(o) : console;
    function a() {
      return $(this, arguments, function* () {
        var d, c, f, p;
        if (i)
          throw new O("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let h = !1;
        try {
          try {
            for (var m = !0, g = W(xd(e, n)), T; T = yield M(g.next()), d = T.done, !d; m = !0) {
              p = T.value, m = !1;
              const y = p;
              if (!h)
                if (y.data.startsWith("[DONE]")) {
                  h = !0;
                  continue;
                } else
                  try {
                    yield yield M(JSON.parse(y.data));
                  } catch (E) {
                    throw r.error("Could not parse message into JSON:", y.data), r.error("From chunk:", y.raw), E;
                  }
            }
          } catch (y) {
            c = { error: y };
          } finally {
            try {
              !m && !d && (f = g.return) && (yield M(f.call(g)));
            } finally {
              if (c) throw c.error;
            }
          }
          h = !0;
        } catch (y) {
          if (Qe(y))
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
      return $(this, arguments, function* () {
        var d, c, f, p;
        const h = new Ge(), m = Lo(e);
        try {
          for (var g = !0, T = W(m), y; y = yield M(T.next()), d = y.done, !d; g = !0) {
            p = y.value, g = !1;
            const E = p;
            for (const S of h.decode(E))
              yield yield M(S);
          }
        } catch (E) {
          c = { error: E };
        } finally {
          try {
            !g && !d && (f = T.return) && (yield M(f.call(T)));
          } finally {
            if (c) throw c.error;
          }
        }
        for (const E of h.flush())
          yield yield M(E);
      });
    }
    function a() {
      return $(this, arguments, function* () {
        var d, c, f, p;
        if (i)
          throw new O("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let h = !1;
        try {
          try {
            for (var m = !0, g = W(r()), T; T = yield M(g.next()), d = T.done, !d; m = !0) {
              p = T.value, m = !1;
              const y = p;
              h || y && (yield yield M(JSON.parse(y)));
            }
          } catch (y) {
            c = { error: y };
          } finally {
            try {
              !m && !d && (f = g.return) && (yield M(f.call(g)));
            } finally {
              if (c) throw c.error;
            }
          }
          h = !0;
        } catch (y) {
          if (Qe(y))
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
    return Uo({
      async start() {
        n = e[Symbol.asyncIterator]();
      },
      async pull(o) {
        try {
          const { value: i, done: r } = await n.next();
          if (r)
            return o.close();
          const a = ft(JSON.stringify(i) + `
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
  return $(this, arguments, function* () {
    var o, i, r, a;
    if (!t.body)
      throw e.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new O("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new O("Attempted to iterate over a response with no body");
    const u = new kd(), d = new Ge(), c = Lo(t.body);
    try {
      for (var f = !0, p = W(Dd(c)), h; h = yield M(p.next()), o = h.done, !o; f = !0) {
        a = h.value, f = !1;
        const m = a;
        for (const g of d.decode(m)) {
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
    for (const m of d.flush()) {
      const g = u.decode(m);
      g && (yield yield M(g));
    }
  });
}
function Dd(t) {
  return $(this, arguments, function* () {
    var n, o, i, r;
    let a = new Uint8Array();
    try {
      for (var u = !0, d = W(t), c; c = yield M(d.next()), n = c.done, !n; u = !0) {
        r = c.value, u = !1;
        const f = r;
        if (f == null)
          continue;
        const p = f instanceof ArrayBuffer ? new Uint8Array(f) : typeof f == "string" ? ft(f) : f;
        let h = new Uint8Array(a.length + p.length);
        h.set(a), h.set(p, a.length), a = h;
        let m;
        for (; (m = Md(a)) !== -1; )
          yield yield M(a.slice(0, m)), a = a.slice(m);
      }
    } catch (f) {
      o = { error: f };
    } finally {
      try {
        !u && !n && (i = d.return) && (yield M(i.call(d)));
      } finally {
        if (o) throw o.error;
      }
    }
    a.length > 0 && (yield yield M(a));
  });
}
class kd {
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
    let [n, o, i] = Ud(e, ":");
    return i.startsWith(" ") && (i = i.substring(1)), n === "event" ? this.event = i : n === "data" && this.data.push(i), null;
  }
}
function Ud(t, e) {
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
      return V(t).debug("response", n.status, n.url, n.headers, n.body), e.options.__streamClass ? e.options.__streamClass.fromSSEResponse(n, e.controller, t) : le.fromSSEResponse(n, e.controller, t);
    if (n.status === 204)
      return null;
    if (e.options.__binaryResponse)
      return n;
    const d = n.headers.get("content-type"), c = (u = d == null ? void 0 : d.split(";")[0]) === null || u === void 0 ? void 0 : u.trim();
    return (c == null ? void 0 : c.includes("application/json")) || (c == null ? void 0 : c.endsWith("+json")) ? await n.json() : await n.text();
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
class pt extends Promise {
  constructor(e, n, o = Ld) {
    super((i) => {
      i(null);
    }), this.responsePromise = n, this.parseResponse = o, this.client = e;
  }
  _thenUnwrap(e) {
    return new pt(this.client, this.responsePromise, async (n, o) => e(await this.parseResponse(n, o), o));
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
const Bo = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* Gd(t) {
  if (!t)
    return;
  if (Bo in t) {
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
const he = (t) => {
  const e = new Headers(), n = /* @__PURE__ */ new Set();
  for (const o of t) {
    const i = /* @__PURE__ */ new Set();
    for (const [r, a] of Gd(o)) {
      const u = r.toLowerCase();
      i.has(u) || (e.delete(r), i.add(u)), a === null ? (e.delete(r), n.add(u)) : (e.append(r, a), n.delete(u));
    }
  }
  return { [Bo]: !0, values: e, nulls: n };
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const be = (t) => {
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
var Jo;
class Fe {
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
    var n, o, i, r, a, u, d, { baseURL: c = be("GEMINI_NEXT_GEN_API_BASE_URL"), apiKey: f = (n = be("GEMINI_API_KEY")) !== null && n !== void 0 ? n : null, apiVersion: p = "v1beta" } = e, h = Me(e, ["baseURL", "apiKey", "apiVersion"]);
    const m = Object.assign(Object.assign({
      apiKey: f,
      apiVersion: p
    }, h), { baseURL: c || "https://generativelanguage.googleapis.com" });
    this.baseURL = m.baseURL, this.timeout = (o = m.timeout) !== null && o !== void 0 ? o : Fe.DEFAULT_TIMEOUT, this.logger = (i = m.logger) !== null && i !== void 0 ? i : console;
    const g = "warn";
    this.logLevel = g, this.logLevel = (a = (r = zn(m.logLevel, "ClientOptions.logLevel", this)) !== null && r !== void 0 ? r : zn(be("GEMINI_NEXT_GEN_API_LOG"), "process.env['GEMINI_NEXT_GEN_API_LOG']", this)) !== null && a !== void 0 ? a : g, this.fetchOptions = m.fetchOptions, this.maxRetries = (u = m.maxRetries) !== null && u !== void 0 ? u : 2, this.fetch = (d = m.fetch) !== null && d !== void 0 ? d : gd(), this.encoder = Cd, this._options = m, this.apiKey = f, this.apiVersion = p, this.clientAdapter = m.clientAdapter;
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
    const n = he([e.headers]);
    if (!(n.values.has("authorization") || n.values.has("x-goog-api-key"))) {
      if (this.apiKey)
        return he([{ "x-goog-api-key": this.apiKey }]);
      if (this.clientAdapter.isVertexAI())
        return he([await this.clientAdapter.getAuthHeaders()]);
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
      throw new O(`Cannot stringify type ${typeof o}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
    }).join("&");
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${se}`;
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
    return new pt(this, this.makeRequest(e, n, void 0));
  }
  async makeRequest(e, n, o) {
    var i, r, a;
    const u = await e, d = (i = u.maxRetries) !== null && i !== void 0 ? i : this.maxRetries;
    n == null && (n = d), await this.prepareOptions(u);
    const { req: c, url: f, timeout: p } = await this.buildRequest(u, {
      retryCount: d - n
    });
    await this.prepareRequest(c, { url: f, options: u });
    const h = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0"), m = o === void 0 ? "" : `, retryOf: ${o}`, g = Date.now();
    if (V(this).debug(`[${h}] sending request`, ee({
      retryOfRequestLogID: o,
      method: u.method,
      url: f,
      options: u,
      headers: c.headers
    })), !((r = u.signal) === null || r === void 0) && r.aborted)
      throw new je();
    const T = new AbortController(), y = await this.fetchWithTimeout(f, c, p, T).catch(Ze), E = Date.now();
    if (y instanceof globalThis.Error) {
      const I = `retrying, ${n} attempts remaining`;
      if (!((a = u.signal) === null || a === void 0) && a.aborted)
        throw new je();
      const _ = Qe(y) || /timed? ?out/i.test(String(y) + ("cause" in y ? String(y.cause) : ""));
      if (n)
        return V(this).info(`[${h}] connection ${_ ? "timed out" : "failed"} - ${I}`), V(this).debug(`[${h}] connection ${_ ? "timed out" : "failed"} (${I})`, ee({
          retryOfRequestLogID: o,
          url: f,
          durationMs: E - g,
          message: y.message
        })), this.retryRequest(u, n, o ?? h);
      throw V(this).info(`[${h}] connection ${_ ? "timed out" : "failed"} - error; no more retries left`), V(this).debug(`[${h}] connection ${_ ? "timed out" : "failed"} (error; no more retries left)`, ee({
        retryOfRequestLogID: o,
        url: f,
        durationMs: E - g,
        message: y.message
      })), _ ? new Ao() : new Le({ cause: y });
    }
    const S = `[${h}${m}] ${c.method} ${f} ${y.ok ? "succeeded" : "failed"} with status ${y.status} in ${E - g}ms`;
    if (!y.ok) {
      const I = await this.shouldRetry(y);
      if (n && I) {
        const A = `retrying, ${n} attempts remaining`;
        return await Td(y.body), V(this).info(`${S} - ${A}`), V(this).debug(`[${h}] response error (${A})`, ee({
          retryOfRequestLogID: o,
          url: y.url,
          status: y.status,
          headers: y.headers,
          durationMs: E - g
        })), this.retryRequest(u, n, o ?? h, y.headers);
      }
      const _ = I ? "error; no more retries left" : "error; not retryable";
      V(this).info(`${S} - ${_}`);
      const C = await y.text().catch((A) => Ze(A).message), R = dd(C), P = R ? void 0 : C;
      throw V(this).debug(`[${h}] response error (${_})`, ee({
        retryOfRequestLogID: o,
        url: y.url,
        status: y.status,
        headers: y.headers,
        message: P,
        durationMs: Date.now() - g
      })), this.makeStatusError(y.status, R, P, y.headers);
    }
    return V(this).info(S), V(this).debug(`[${h}] response start`, ee({
      retryOfRequestLogID: o,
      url: y.url,
      status: y.status,
      headers: y.headers,
      durationMs: E - g
    })), { response: y, options: u, controller: T, requestLogID: h, retryOfRequestLogID: o, startTime: g };
  }
  async fetchWithTimeout(e, n, o, i) {
    const r = n || {}, { signal: a, method: u } = r, d = Me(r, ["signal", "method"]);
    a && a.addEventListener("abort", () => i.abort());
    const c = setTimeout(() => i.abort(), o), f = globalThis.ReadableStream && d.body instanceof globalThis.ReadableStream || typeof d.body == "object" && d.body !== null && Symbol.asyncIterator in d.body, p = Object.assign(Object.assign(Object.assign({ signal: i.signal }, f ? { duplex: "half" } : {}), { method: "GET" }), d);
    u && (p.method = u.toUpperCase());
    try {
      return await this.fetch.call(void 0, e, p);
    } finally {
      clearTimeout(c);
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
      const c = parseFloat(u);
      Number.isNaN(c) || (a = c);
    }
    const d = i == null ? void 0 : i.get("retry-after");
    if (d && !a) {
      const c = parseFloat(d);
      Number.isNaN(c) ? a = Date.parse(d) - Date.now() : a = c * 1e3;
    }
    if (!(a && 0 <= a && a < 60 * 1e3)) {
      const c = (r = e.maxRetries) !== null && r !== void 0 ? r : this.maxRetries;
      a = this.calculateDefaultRetryTimeoutMillis(n, c);
    }
    return await cd(a), this.makeRequest(e, n - 1, o);
  }
  calculateDefaultRetryTimeoutMillis(e, n) {
    const r = n - e, a = Math.min(0.5 * Math.pow(2, r), 8), u = 1 - Math.random() * 0.25;
    return a * u * 1e3;
  }
  async buildRequest(e, { retryCount: n = 0 } = {}) {
    var o, i, r;
    const a = Object.assign({}, e), { method: u, path: d, query: c, defaultBaseURL: f } = a, p = this.buildURL(d, c, f);
    "timeout" in a && ud("timeout", a.timeout), a.timeout = (o = a.timeout) !== null && o !== void 0 ? o : this.timeout;
    const { bodyHeaders: h, body: m } = this.buildBody({ options: a }), g = await this.buildHeaders({ options: e, method: u, bodyHeaders: h, retryCount: n });
    return { req: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ method: u, headers: g }, a.signal && { signal: a.signal }), globalThis.ReadableStream && m instanceof globalThis.ReadableStream && { duplex: "half" }), m && { body: m }), (i = this.fetchOptions) !== null && i !== void 0 ? i : {}), (r = a.fetchOptions) !== null && r !== void 0 ? r : {}), url: p, timeout: a.timeout };
  }
  async buildHeaders({ options: e, method: n, bodyHeaders: o, retryCount: i }) {
    let r = {};
    this.idempotencyHeader && n !== "get" && (e.idempotencyKey || (e.idempotencyKey = this.defaultIdempotencyKey()), r[this.idempotencyHeader] = e.idempotencyKey);
    const a = await this.authHeaders(e);
    let u = he([
      r,
      Object.assign(Object.assign({ Accept: "application/json", "User-Agent": this.getUserAgent(), "X-Stainless-Retry-Count": String(i) }, e.timeout ? { "X-Stainless-Timeout": String(Math.trunc(e.timeout / 1e3)) } : {}), md()),
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
    const o = he([n]);
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
Fe.DEFAULT_TIMEOUT = 6e4;
class L extends Fe {
  constructor() {
    super(...arguments), this.interactions = new qo(this);
  }
}
Jo = L;
L.GeminiNextGenAPIClient = Jo;
L.GeminiNextGenAPIClientError = O;
L.APIError = b;
L.APIConnectionError = Le;
L.APIConnectionTimeoutError = Ao;
L.APIUserAbortError = je;
L.NotFoundError = Mo;
L.ConflictError = No;
L.RateLimitError = Do;
L.BadRequestError = Ro;
L.AuthenticationError = Po;
L.InternalServerError = ko;
L.PermissionDeniedError = wo;
L.UnprocessableEntityError = xo;
L.toFile = vd;
L.Interactions = qo;
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function Fd(t, e) {
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
  const d = s(t, ["learningRate"]);
  if (e !== void 0 && d != null && l(e, ["tuningTask", "hyperparameters", "learningRate"], d), s(t, ["labels"]) !== void 0)
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
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec"], qe(C));
  } else if (i === "PREFERENCE_TUNING") {
    const C = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && C != null && l(e, ["preferenceOptimizationSpec"], qe(C));
  } else if (i === "DISTILLATION") {
    const C = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && C != null && l(e, ["distillationSpec"], qe(C));
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
  let d = s(n, [
    "config",
    "method"
  ]);
  if (d === void 0 && (d = "SUPERVISED_FINE_TUNING"), d === "SUPERVISED_FINE_TUNING") {
    const C = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "hyperParameters", "learningRateMultiplier"], C);
  } else if (d === "PREFERENCE_TUNING") {
    const C = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && C != null && l(e, [
      "preferenceOptimizationSpec",
      "hyperParameters",
      "learningRateMultiplier"
    ], C);
  } else if (d === "DISTILLATION") {
    const C = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && C != null && l(e, ["distillationSpec", "hyperParameters", "learningRateMultiplier"], C);
  }
  let c = s(n, ["config", "method"]);
  if (c === void 0 && (c = "SUPERVISED_FINE_TUNING"), c === "SUPERVISED_FINE_TUNING") {
    const C = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && C != null && l(e, ["supervisedTuningSpec", "exportLastCheckpointOnly"], C);
  } else if (c === "PREFERENCE_TUNING") {
    const C = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && C != null && l(e, ["preferenceOptimizationSpec", "exportLastCheckpointOnly"], C);
  } else if (c === "DISTILLATION") {
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
  const h = s(t, [
    "customBaseModel"
  ]);
  e !== void 0 && h != null && l(e, ["customBaseModel"], h);
  let m = s(n, [
    "config",
    "method"
  ]);
  if (m === void 0 && (m = "SUPERVISED_FINE_TUNING"), m === "SUPERVISED_FINE_TUNING") {
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
  const S = s(t, [
    "tunedTeacherModelSource"
  ]);
  e !== void 0 && S != null && l(e, ["distillationSpec", "tunedTeacherModelSource"], S);
  const I = s(t, [
    "sftLossWeightMultiplier"
  ]);
  e !== void 0 && I != null && l(e, ["distillationSpec", "hyperParameters", "sftLossWeightMultiplier"], I);
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
    Array.isArray(a) && (a = a.map((u) => Oo(u))), l(n, ["tuningJobs"], a);
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
    Array.isArray(a) && (a = a.map((u) => nt(u))), l(n, ["tuningJobs"], a);
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
function Oo(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["name"]);
  i != null && l(n, ["name"], i);
  const r = s(t, ["state"]);
  r != null && l(n, ["state"], so(r));
  const a = s(t, ["createTime"]);
  a != null && l(n, ["createTime"], a);
  const u = s(t, [
    "tuningTask",
    "startTime"
  ]);
  u != null && l(n, ["startTime"], u);
  const d = s(t, [
    "tuningTask",
    "completeTime"
  ]);
  d != null && l(n, ["endTime"], d);
  const c = s(t, ["updateTime"]);
  c != null && l(n, ["updateTime"], c);
  const f = s(t, ["description"]);
  f != null && l(n, ["description"], f);
  const p = s(t, ["baseModel"]);
  p != null && l(n, ["baseModel"], p);
  const h = s(t, ["_self"]);
  return h != null && l(n, ["tunedModel"], jd(h)), n;
}
function nt(t, e) {
  const n = {}, o = s(t, [
    "sdkHttpResponse"
  ]);
  o != null && l(n, ["sdkHttpResponse"], o);
  const i = s(t, ["name"]);
  i != null && l(n, ["name"], i);
  const r = s(t, ["state"]);
  r != null && l(n, ["state"], so(r));
  const a = s(t, ["createTime"]);
  a != null && l(n, ["createTime"], a);
  const u = s(t, ["startTime"]);
  u != null && l(n, ["startTime"], u);
  const d = s(t, ["endTime"]);
  d != null && l(n, ["endTime"], d);
  const c = s(t, ["updateTime"]);
  c != null && l(n, ["updateTime"], c);
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
  const E = s(t, [
    "distillationSpec"
  ]);
  E != null && l(n, ["distillationSpec"], E);
  const S = s(t, [
    "tuningDataStats"
  ]);
  S != null && l(n, ["tuningDataStats"], S);
  const I = s(t, [
    "encryptionSpec"
  ]);
  I != null && l(n, ["encryptionSpec"], I);
  const _ = s(t, [
    "partnerModelTuningSpec"
  ]);
  _ != null && l(n, ["partnerModelTuningSpec"], _);
  const C = s(t, [
    "customBaseModel"
  ]);
  C != null && l(n, ["customBaseModel"], C);
  const R = s(t, ["experiment"]);
  R != null && l(n, ["experiment"], R);
  const P = s(t, ["labels"]);
  P != null && l(n, ["labels"], P);
  const D = s(t, ["outputUri"]);
  D != null && l(n, ["outputUri"], D);
  const A = s(t, ["pipelineJob"]);
  A != null && l(n, ["pipelineJob"], A);
  const N = s(t, [
    "serviceAccount"
  ]);
  N != null && l(n, ["serviceAccount"], N);
  const x = s(t, [
    "tunedModelDisplayName"
  ]);
  x != null && l(n, ["tunedModelDisplayName"], x);
  const U = s(t, [
    "veoTuningSpec"
  ]);
  return U != null && l(n, ["veoTuningSpec"], U), n;
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
function qe(t, e) {
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
          state: Je.JOB_STATE_QUEUED
        };
      }
    };
  }
  async getInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Wd(e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => nt(f));
    } else {
      const c = $d(e);
      return u = v("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => Oo(f));
    }
  }
  async listInternal(e) {
    var n, o, i, r;
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Xd(e);
      return u = v("tuningJobs", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Zd(f), h = new In();
        return Object.assign(h, p), h;
      });
    } else {
      const c = zd(e);
      return u = v("tunedModels", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Qd(f), h = new In();
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
    let a, u = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Hd(e);
      return u = v("{name}:cancel", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = bd(f), h = new vn();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Fd(e);
      return u = v("{name}:cancel", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: u,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = e.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Vd(f), h = new vn();
        return Object.assign(h, p), h;
      });
    }
  }
  async tuneInternal(e) {
    var n, o;
    let i, r = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const u = Od(e, e);
      return r = v("tuningJobs", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => nt(d));
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
      return r = v("tunedModels", u._url), a = u._query, delete u._url, delete u._query, i = this.apiClient.request({
        path: r,
        queryParams: a,
        body: JSON.stringify(u),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => nc(d));
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
const sc = 1024 * 1024 * 8, rc = 3, lc = 1e3, ac = 2, xe = "x-goog-upload-status";
async function uc(t, e, n) {
  var o;
  const i = await $o(t, e, n), r = await (i == null ? void 0 : i.json());
  if (((o = i == null ? void 0 : i.headers) === null || o === void 0 ? void 0 : o[xe]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  return r.file;
}
async function dc(t, e, n) {
  var o;
  const i = await $o(t, e, n), r = await (i == null ? void 0 : i.json());
  if (((o = i == null ? void 0 : i.headers) === null || o === void 0 ? void 0 : o[xe]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  const a = jn(r), u = new rt();
  return Object.assign(u, a), u;
}
async function $o(t, e, n) {
  var o, i;
  let r = 0, a = 0, u = new $e(new Response()), d = "upload";
  for (r = t.size; a < r; ) {
    const c = Math.min(sc, r - a), f = t.slice(a, a + c);
    a + c >= r && (d += ", finalize");
    let p = 0, h = lc;
    for (; p < rc && (u = await n.request({
      path: "",
      body: f,
      httpMethod: "POST",
      httpOptions: {
        apiVersion: "",
        baseUrl: e,
        headers: {
          "X-Goog-Upload-Command": d,
          "X-Goog-Upload-Offset": String(a),
          "Content-Length": String(c)
        }
      }
    }), !(!((o = u == null ? void 0 : u.headers) === null || o === void 0) && o[xe])); )
      p++, await fc(h), h = h * ac;
    if (a += c, ((i = u == null ? void 0 : u.headers) === null || i === void 0 ? void 0 : i[xe]) !== "active")
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
class hc {
  create(e, n, o) {
    return new mc(e, n, o);
  }
}
class mc {
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
    const n = new L({
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
    }), this.models = new Nu(this.apiClient), this.live = new vu(this.apiClient, i, new hc()), this.batches = new Hs(this.apiClient), this.chats = new Cr(this.models, this.apiClient), this.caches = new gr(this.apiClient), this.files = new xr(this.apiClient), this.operations = new xu(this.apiClient), this.authTokens = new Ku(this.apiClient), this.tunings = new oc(this.apiClient), this.fileSearchStores = new td(this.apiClient);
  }
}
class Se {
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
      contents: e.messages.filter((d) => d.role !== "system").map((d) => this.mapMessage(d)),
      model: n
    }, u = {};
    return e.temperature !== void 0 && (u.temperature = e.temperature), e.maxTokens !== void 0 && (u.maxOutputTokens = e.maxTokens), e.topP !== void 0 && (u.topP = e.topP), e.stop !== void 0 && (u.stopSequences = e.stop), o && o.length > 0 && (u.tools = [{ functionDeclarations: o }]), e.system && (u.systemInstruction = e.system ? e.system : "You are an assistant with access to local file system tools. Always use the provided read_folder tool when a file path is mentioned"), u.thread_id = e.thread_id, u.branch_id = e.branch_id, u.httpOptions = {
      extraBody: {
        thread_id: e.thread_id,
        branch_id: e.branch_id
      }
    }, Object.keys(u).length > 0 && (a.config = u), a;
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
class Cc {
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
    })), u = [{
      functionDeclarations: a
    }];
    console.log("[GeminiToolHandler] Converted tools to Gemini format", {
      functionDeclarationsCount: a.length,
      functions: a.map((c) => c.name)
    });
    const d = {
      model: e,
      contents: n,
      tools: u
    };
    return console.log("[GeminiToolHandler] Request params prepared", {
      hasTools: u.length > 0,
      geminiToolsCount: u.length,
      functionDeclarationsCount: a.length,
      toolNames: a.map((c) => c.name),
      shouldStream: r
    }), r ? await this.makeStreamingRequest(d) : await this.makeNonStreamingRequest(d);
  }
  /**
   * Make a streaming request to Gemini
   * Note: For tool calling, we accumulate the complete response
   */
  async makeStreamingRequest(e) {
    var a, u, d, c, f, p, h, m, g, T, y, E, S, I;
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
          textLength: ((d = _.text) == null ? void 0 : d.length) || 0,
          hasCandidates: !!_.candidates,
          candidatesCount: ((c = _.candidates) == null ? void 0 : c.length) || 0
        }), (f = _.candidates) != null && f[0]) {
          const P = _.candidates[0];
          console.log("[GeminiToolHandler] Candidate details", {
            chunkCount: o,
            hasContent: !!P.content,
            partsCount: ((h = (p = P.content) == null ? void 0 : p.parts) == null ? void 0 : h.length) || 0,
            finishReason: P.finishReason
          }), (m = P.content) != null && m.parts && P.content.parts.forEach((D, A) => {
            var N, x;
            console.log("[GeminiToolHandler] Part details", {
              chunkCount: o,
              partIndex: A,
              partKeys: Object.keys(D || {}),
              hasText: !!D.text,
              hasFunctionCall: !!D.functionCall,
              functionCallName: (N = D.functionCall) == null ? void 0 : N.name,
              functionCallArgsType: typeof ((x = D.functionCall) == null ? void 0 : x.args)
            });
          });
        }
        const C = _.text;
        C && this.tokenCallback && (r += C, this.tokenCallback(C), console.log("[GeminiToolHandler] Sent text to callback", {
          chunkCount: o,
          textLength: C.length,
          accumulatedLength: r.length
        }));
        const R = (T = (g = _.candidates) == null ? void 0 : g[0]) == null ? void 0 : T.finishReason;
        if (R) {
          console.log("[GeminiToolHandler] Detected finish reason, breaking loop", {
            chunkCount: o,
            finishReason: R,
            hasFunctionCall: !!((I = (S = (E = (y = _.candidates) == null ? void 0 : y[0]) == null ? void 0 : E.content) == null ? void 0 : S.parts) != null && I.some((P) => P.functionCall))
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
    const n = [], o = e.candidates;
    if (!o || o.length === 0)
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
          let d = u.args || {};
          typeof d == "string" && (console.log("[GeminiToolHandler] Function call args is string, attempting to parse", {
            name: u.name,
            argsPreview: d.substring(0, 100)
          }), d = JSON.parse(d)), console.log("[GeminiToolHandler] Found function call", {
            name: u.name,
            argsType: typeof d,
            argsKeys: typeof d == "object" ? Object.keys(d) : []
          }), n.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: u.name,
            input: d
          });
        } catch (d) {
          console.error("[GeminiToolHandler] Error parsing function call arguments", {
            name: u.name,
            error: d instanceof Error ? d.message : String(d),
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
   */
  extractTextContent(e) {
    console.log("[GeminiToolHandler] Extracting text content from response");
    try {
      const n = e.text;
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
    var d;
    console.log("[GeminiToolHandler] Appending messages", {
      currentMessagesCount: e.length,
      toolResultsCount: o.length
    });
    const i = n.candidates;
    if (!i || i.length === 0)
      return console.warn("[GeminiToolHandler] No candidates in response, returning messages unchanged"), e;
    const r = {
      role: "model",
      parts: ((d = i[0].content) == null ? void 0 : d.parts) || []
    };
    console.log("[GeminiToolHandler] Model response parts", {
      partsCount: r.parts.length,
      partTypes: r.parts.map((c) => c.text ? "text" : c.functionCall ? "functionCall" : "unknown")
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
class _c {
  constructor(e, n, o, i = [], r) {
    w(this, "client");
    w(this, "defaultModel");
    w(this, "apiEndpoint");
    w(this, "tools");
    w(this, "onToolUse");
    w(this, "toolHandler");
    this.client = new Tc({
      apiKey: n,
      httpOptions: {
        baseUrl: e,
        headers: { Authorization: `Bearer ${n}` }
      }
    }), this.defaultModel = o || "gemini-pro", this.apiEndpoint = e, this.tools = i, this.onToolUse = r, i.length > 0 && (this.toolHandler = new Cc(this.client, this.apiEndpoint)), console.log(`GeminiChatProvider initialized url: ${e} with model ${this.defaultModel}${i.length > 0 ? ` and ${i.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Gemini
   * Automatically handles tools if configured in constructor
   */
  async chat(e, n) {
    var r, a, u, d, c, f, p, h;
    if (console.log("[GeminiChatProvider] v1.03 chat called", {
      hasThreadId: !!e.thread_id,
      thread_id: e.thread_id,
      streaming: e.streaming !== !1,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, n);
      return;
    }
    const o = e.model || this.defaultModel, i = Se.toGeminiRequest(e, o, []);
    console.log("[GeminiChatProvider] Converted request", {
      model: o,
      hasSystemInstruction: !!i.systemInstruction,
      contentsCount: i.contents.length,
      thread_id: i.thread_id,
      streaming: e.streaming !== !1
    });
    try {
      if (e.streaming = !1, e.streaming !== !1) {
        let m = "";
        console.log("[GeminiChatProvider] Using streaming mode");
        const g = await this.client.models.generateContentStream(i);
        console.log("[GeminiChatProvider] Stream started, processing chunks");
        let T = 0, y = !1, E = null;
        try {
          for await (const S of g) {
            if (T++, S.text && (m += S.text), S && S.candidates && S.candidates[0]) {
              const _ = S.candidates[0];
              if ((r = _.content) != null && r.parts)
                for (const C of _.content.parts) {
                  if (C.text) {
                    const R = C.text;
                    R && n && n(R), console.log("Text:", C.text);
                  }
                  C.inlineData && C.inlineData.mimeType && (E = {
                    mimeType: C.inlineData.mimeType,
                    data: C.inlineData.data || ""
                  }, console.log("[GeminiChatProvider] Detected inline data", {
                    mimeType: E.mimeType,
                    dataLength: E.data.length
                  }));
                }
            }
            console.log("[GeminiChatProvider] Received chunk", {
              chunkCount: T,
              hasText: !!S.text,
              hasInlineData: !!E,
              finishReason: (u = (a = S.candidates) == null ? void 0 : a[0]) == null ? void 0 : u.finishReason
            });
            const I = (c = (d = S.candidates) == null ? void 0 : d[0]) == null ? void 0 : c.finishReason;
            if (I) {
              console.log("[GeminiChatProvider] Detected finish reason, breaking loop", { finishReason: I }), y = !0;
              break;
            }
          }
        } catch (S) {
          throw console.error("[GeminiChatProvider] Error during streaming", S), S;
        }
        if (console.log("[GeminiChatProvider] Stream loop exited", { chunkCount: T, isDone: y, hasInlineData: !!E }), E && n) {
          const S = `![](data:${E.mimeType};base64,${E.data})`;
          console.log("[GeminiChatProvider] Appending inline data as markdown", {
            mimeType: E.mimeType,
            dataLength: E.data.length
          });
          const I = `

${S}`;
          n(I);
        }
        console.log("[GeminiChatProvider] Stream completed");
      } else {
        console.log("[GeminiChatProvider] Using non-streaming mode");
        const m = await this.client.models.generateContent(i), g = m.text;
        let T = null;
        const y = (h = (p = (f = m.candidates) == null ? void 0 : f[0]) == null ? void 0 : p.content) == null ? void 0 : h.parts;
        if (y)
          for (const E of y)
            E.inlineData && E.inlineData.mimeType && (T = {
              mimeType: E.inlineData.mimeType,
              data: E.inlineData.data || ""
            }, console.log("[GeminiChatProvider] Detected inline data in non-streaming response", {
              mimeType: T.mimeType,
              dataLength: T.data.length
            }));
        if (console.log("[GeminiChatProvider] Response received", {
          textLength: (g == null ? void 0 : g.length) || 0,
          hasText: !!g,
          hasInlineData: !!T
        }), g && n && n(g), T && n) {
          const E = `![](data:${T.mimeType};base64,${T.data})`;
          console.log("[GeminiChatProvider] Appending inline data as markdown", {
            mimeType: T.mimeType,
            dataLength: T.data.length
          });
          const S = `

${E}`;
          n(S);
        }
      }
    } catch (m) {
      console.error("[GeminiChatProvider] Error in Gemini API call:", m);
      const g = Se.mapError(m);
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
    var f, p, h, m, g, T, y, E, S;
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
    const o = e.model || this.defaultModel, i = this.convertToolsToGeminiFormat(this.tools), r = Se.toGeminiRequest(e, o, i), a = e.streaming !== !1;
    let u = r.contents, d = 0;
    console.log("[GeminiChatProvider] Starting tool orchestration loop", {
      initialMessagesCount: u.length,
      toolsCount: i.length,
      shouldStream: a,
      threadId: e.thread_id,
      branchId: e.branch_id
    });
    let c = e.branch_id || "";
    for (; d < Z.MAX_TOOL_ITERATIONS; ) {
      d++, c = Z.setBranchIteration(c, d), e.branch_id = c, console.log("[GeminiChatProvider] Tool loop iteration", {
        iteration: d,
        this_branch_id: c,
        messagesCount: u.length
      });
      const I = Se.toGeminiRequest(e, o, i);
      try {
        if (a) {
          console.log("[GeminiChatProvider] Making streaming request with tools:"), console.log("  Iteration:", d), console.log("  Tools count:", i.length), console.log("  Messages count:", u.length);
          let _ = null, C = !1;
          try {
            console.log("Request being sent:", JSON.stringify(I, null, 2));
            const A = await this.client.models.generateContentStream(I);
            let N = 0;
            console.log("[GeminiChatProvider] Started streaming, consuming chunks", { iteration: d });
            try {
              for await (const x of A) {
                if (N++, (h = (p = (f = x.candidates) == null ? void 0 : f[0]) == null ? void 0 : p.content) != null && h.parts)
                  for (const U of x.candidates[0].content.parts)
                    console.log("Part type:", Object.keys(U)[0]), U.functionCall ? console.log("FUNCTION CALL:", U.functionCall) : U.text && console.log("TEXT:", U.text);
                if (x && x.candidates && x.candidates.length > 0) {
                  const U = x.text;
                  U && n && (n(U), console.log("[GeminiChatProvider] Streamed text chunk", {
                    iteration: d,
                    chunkCount: N,
                    textLength: U.length
                  })), _ = x;
                }
              }
            } catch (x) {
              const U = x instanceof Error ? x.message : String(x);
              if (U.includes("Incomplete JSON") || U.includes("invalid chunk"))
                console.warn("[GeminiChatProvider] JSON streaming error, falling back to non-streaming", {
                  iteration: d,
                  errorMessage: U
                }), C = !0;
              else
                throw x;
            }
          } catch (A) {
            console.warn("[GeminiChatProvider] Stream error, will retry non-streaming", { iteration: d, error: A }), C = !0;
          }
          if (C) {
            console.log("[GeminiChatProvider] Retrying with non-streaming mode", { iteration: d });
            const A = await this.client.models.generateContent(I);
            _ = A;
            const N = this.toolHandler.extractTextContent(A);
            N && n && n(N);
          }
          const R = this.toolHandler.extractToolUses(_);
          if (console.log("[GeminiChatProvider] Extracted tool uses", {
            iteration: d,
            toolUsesCount: R.length,
            usedFallback: C
          }), R.length === 0) {
            console.log("[GeminiChatProvider] No tool calls, ending loop", { iteration: d });
            return;
          }
          u = this.appendMessage(u, {
            role: "model",
            parts: ((T = (g = (m = _.candidates) == null ? void 0 : m[0]) == null ? void 0 : g.content) == null ? void 0 : T.parts) || []
          }), console.log("[GeminiChatProvider] Executing tools", {
            iteration: d,
            toolUsesCount: R.length
          });
          const P = await this.executeTools(R);
          console.log("[GeminiChatProvider] Formatting tool results for Gemini", {
            iteration: d,
            toolUsesCount: R.length,
            resultsCount: P.length
          });
          const D = this.toolHandler.formatToolResults(R, P);
          console.log("[GeminiChatProvider] Tool results formatted", {
            iteration: d,
            formattedResultsCount: D.length
          }), u = this.appendMessage(u, {
            role: "user",
            parts: D
          }), console.log("[GeminiChatProvider] Tool results added to messages, continuing loop", {
            iteration: d,
            newMessagesCount: u.length
          });
        } else {
          console.log("[GeminiChatProvider] Making non-streaming request with tools", {
            iteration: d,
            messagesCount: u.length
          });
          const _ = await this.client.models.generateContent(I);
          console.log("[GeminiChatProvider] Non-streaming response received", {
            iteration: d
          });
          const C = this.toolHandler.extractTextContent(_);
          C && n && (n(C), console.log("[GeminiChatProvider] Sent text content", {
            iteration: d,
            textLength: C.length
          }));
          const R = this.toolHandler.extractToolUses(_);
          if (console.log("[GeminiChatProvider] Extracted tool uses", {
            iteration: d,
            toolUsesCount: R.length
          }), R.length === 0) {
            console.log("[GeminiChatProvider] No tool calls in response, ending loop", {
              iteration: d
            });
            return;
          }
          u = this.appendMessage(u, {
            role: "model",
            parts: ((S = (E = (y = _.candidates) == null ? void 0 : y[0]) == null ? void 0 : E.content) == null ? void 0 : S.parts) || []
          }), console.log("[GeminiChatProvider] Executing tools", {
            iteration: d,
            toolUsesCount: R.length
          });
          const P = await this.executeTools(R);
          console.log("[GeminiChatProvider] Formatting tool results for Gemini", {
            iteration: d,
            toolUsesCount: R.length,
            resultsCount: P.length
          });
          const D = this.toolHandler.formatToolResults(R, P);
          console.log("[GeminiChatProvider] Tool results formatted", {
            iteration: d,
            formattedResultsCount: D.length
          }), u = this.appendMessage(u, {
            role: "user",
            parts: D
          }), console.log("[GeminiChatProvider] Tool results added to messages, continuing loop", {
            iteration: d,
            newMessagesCount: u.length
          });
        }
      } catch (_) {
        throw console.error("[GeminiChatProvider] Error in tool loop iteration", {
          iteration: d,
          error: _
        }), _;
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
  /**
   * Convert ToolDefinition to Gemini's tool format
   */
  convertToolsToGeminiFormat(e) {
    return e.map((n) => {
      const o = this.convertSchemaTypes(n.input_schema);
      return {
        name: n.name,
        description: n.description,
        parametersJsonSchema: o
      };
    });
  }
  /**
   * Recursively convert type strings to Type enum values
   */
  convertSchemaTypes(e) {
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
  mapStringToSchemaType(e) {
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
}
var Ae = /* @__PURE__ */ ((t) => (t.OLLAMA = "ollama", t.OPENAI = "openai", t.CLAUDE = "claude", t.PERPLEXITY = "perplexity", t.GEMINI = "gemini", t))(Ae || {});
class Ec {
  /**
   * Creates an appropriate chat provider based on the provider type
   */
  static createProvider(e, n, o, i) {
    switch (e) {
      case "ollama":
        if (!n.apiKey)
          throw new Error("API key is required for Ollama provider");
        return new Qo(n.url, n.apiKey, n.model, o || [], i);
      case "openai":
        if (!n.apiKey)
          throw new Error("API key is required for OpenAI provider");
        return new ni(n.url, n.apiKey, n.model, o || [], i);
      case "claude":
        if (!n.apiKey)
          throw new Error("API key is required for Claude provider");
        return new ii(n.url, n.apiKey, n.model, o || [], i);
      case "gemini":
        if (!n.apiKey)
          throw new Error("API key is required for Gemini provider");
        return new _c(n.url, n.apiKey, n.model, o || [], i);
      case "perplexity":
        throw new Error("PerplexityChatProvider not implemented yet");
      default:
        throw new Error(`Unsupported provider type: ${e}`);
    }
  }
}
class Sc {
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
class vc {
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
class Ac {
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
function Rc(t) {
  switch (t.toLowerCase()) {
    case Ae.OPENAI:
      return new Sc();
    case Ae.CLAUDE:
      return new Ic();
    case Ae.OLLAMA:
      return new vc();
    default:
      return new Ac();
  }
}
class Pc {
  constructor(e, n, o, i, r) {
    w(this, "accumulatedResponse", "");
    w(this, "requestStartTime");
    w(this, "firstTokenTime");
    w(this, "tokenCounter");
    w(this, "originalCallback");
    w(this, "totalTokens", 0);
    w(this, "tokensReceived", 0);
    w(this, "isFirstToken", !0);
    this.provider = e, this.model = n, this.prompt = o, this.onComplete = i, this.requestStartTime = Date.now(), this.originalCallback = r, this.tokenCounter = Rc(e);
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
    return new Pc(
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
let ot = ne;
class kc {
  /**
   * Create a ChatService with the specified provider and configuration
   */
  constructor(e, n, o = !0, i, r) {
    w(this, "provider");
    w(this, "providerType");
    w(this, "config");
    w(this, "auditService");
    w(this, "tools");
    w(this, "onToolUse");
    this.providerType = e, this.config = n, this.tools = i, this.onToolUse = r, this.provider = this.initializeProvider(), this.auditService = ot.getInstance({
      enabled: o,
      logToConsole: !0,
      logToServer: !1
    });
  }
  /**
   * Initialize the appropriate provider based on provider type
   */
  initializeProvider() {
    return Ec.createProvider(this.providerType, this.config, this.tools, this.onToolUse);
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
class wc {
  static toOllamaRequest(e) {
    return {
      model: e.model,
      messages: e.messages.map((n) => ({ role: n.role, content: n.content }))
    };
  }
}
class Uc {
  constructor(e, n) {
    w(this, "url");
    w(this, "model");
    w(this, "ollama");
    this.url = e, this.model = n, this.ollama = new Zn({ host: e }), console.log("in constructor creating ollama client...");
  }
  async chat(e, n) {
    wc.toOllamaRequest(e);
    const o = await this.ollama.chat({ model: e.model, messages: e.messages, stream: !0 });
    for await (const i of o) {
      const r = i.message.content;
      n && n(r);
    }
  }
}
export {
  ot as AuditService,
  Uc as ChatApiService,
  Ec as ChatProviderFactory,
  Z as ChatProviderUtils,
  kc as ChatService,
  ii as ClaudeChatProvider,
  oi as ClaudeToolHandler,
  _c as GeminiChatProvider,
  Cc as GeminiToolHandler,
  Qo as OllamaChatProvider,
  Xo as OllamaToolHandler,
  ni as OpenAIChatProvider,
  Zo as OpenAIToolHandler,
  Ae as ProviderType,
  Pc as TokenAccumulator
};
