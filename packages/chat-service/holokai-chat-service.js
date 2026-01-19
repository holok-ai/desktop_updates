var E = Object.defineProperty;
var L = (d, e, t) => e in d ? E(d, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : d[e] = t;
var i = (d, e, t) => L(d, typeof e != "symbol" ? e + "" : e, t);
import { Ollama as N } from "ollama/browser";
import W from "openai";
import b from "@anthropic-ai/sdk";
class R {
  /**
   * Convert internal ChatRequest to Ollama-specific format
   */
  static toOllamaRequest(e) {
    const t = e.messages.filter((a) => a.role !== "system"), n = e.system ? [{ role: "system", content: e.system }, ...t.map((a) => ({ role: a.role, content: a.content }))] : t.map((a) => ({ role: a.role, content: a.content })), o = {
      model: e.model,
      messages: n,
      stream: e.streaming !== !1
    };
    return (e.temperature !== void 0 || e.maxTokens !== void 0 || e.topP !== void 0 || e.frequencyPenalty !== void 0 || e.presencePenalty !== void 0 || e.stop !== void 0) && (o.options = {}, e.temperature !== void 0 && (o.options.temperature = e.temperature), e.maxTokens !== void 0 && (o.options.num_predict = e.maxTokens), e.topP !== void 0 && (o.options.top_p = e.topP), e.frequencyPenalty !== void 0 && (o.options.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (o.options.presence_penalty = e.presencePenalty), e.stop !== void 0 && (o.options.stop = e.stop)), e.responseFormat && (o.format = e.responseFormat), o;
  }
}
const k = class k {
  constructor(e, t, n, o = [], s) {
    i(this, "ollama");
    i(this, "defaultModel");
    i(this, "tools");
    i(this, "onToolUse");
    this.ollama = new N({ host: e, headers: {
      "X-api-key": t
    } }), this.defaultModel = n, this.tools = o, this.onToolUse = s, console.log(`OllamaChatProvider initialized with endpoint ${e} and model ${n}${o.length > 0 ? ` and ${o.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Ollama
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    const n = e;
    if (console.log("[OllamaChatProvider] chat called", {
      hasThreadId: !!n.thread_id,
      thread_id: n.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    const o = e.model || this.defaultModel, s = { ...e, model: o }, a = R.toOllamaRequest(s), l = n.thread_id ? { thread_id: n.thread_id } : {};
    try {
      if (a.stream) {
        const c = await this.ollama.chat({
          ...l,
          ...a,
          stream: !0
        });
        for await (const m of c) {
          const g = m.message.content;
          t && t(g);
        }
      } else {
        const c = await this.ollama.chat({
          ...l,
          ...a,
          stream: !1
        });
        t && t(c.message.content);
      }
    } catch (c) {
      throw console.error("Error in Ollama API call:", c), c;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, t) {
    const n = e.model || this.defaultModel, o = { ...e, model: n }, s = R.toOllamaRequest(o), a = this.convertToolsToOllamaFormat(this.tools);
    try {
      await this.handleToolLoop(s, a, t, e);
    } catch (l) {
      throw console.error("[OllamaChatProvider] Tool-enabled chat failed:", l), l;
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
    return !e.tool_calls || !Array.isArray(e.tool_calls) ? [] : e.tool_calls.map((t, n) => ({
      id: `call_${Date.now()}_${n}`,
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
  /**
   * Handle the tool use loop
   */
  async handleToolLoop(e, t, n, o) {
    var m, g, u, h;
    let s = [...e.messages];
    const a = e.stream !== !1, l = o, c = l.thread_id ? { thread_id: l.thread_id } : {};
    console.log("[OllamaChatProvider] handleToolLoop starting", {
      shouldStream: a,
      toolsCount: t.length,
      messagesCount: s.length,
      hasThreadId: !!l.thread_id
    });
    for (let r = 0; r < k.MAX_TOOL_ITERATIONS; r++) {
      console.log("[OllamaChatProvider] Tool loop iteration", { iteration: r });
      const p = await this.ollama.chat({
        ...c,
        model: e.model,
        messages: s,
        tools: t,
        stream: !1
        // Use non-streaming for tool calls
      });
      console.log("[OllamaChatProvider] Got response", {
        hasMessage: !!p.message,
        hasToolCalls: !!((m = p.message) != null && m.tool_calls),
        messageKeys: p.message ? Object.keys(p.message) : [],
        messageContent: (g = p.message) == null ? void 0 : g.content,
        toolCalls: (u = p.message) == null ? void 0 : u.tool_calls,
        fullResponse: JSON.stringify(p, null, 2)
      }), (h = p.message) != null && h.content && n && n(p.message.content);
      const f = this.extractToolCalls(p.message);
      if (f.length === 0) {
        console.log("[OllamaChatProvider] No tool calls found, ending loop");
        return;
      }
      console.log("[OllamaChatProvider] Found tool calls", { count: f.length });
      const T = [];
      for (const y of f) {
        console.log("[OllamaChatProvider] Executing tool", { name: y.name });
        const _ = {
          id: y.id,
          name: y.name,
          input: this.parseToolArguments(y.arguments)
        }, O = await this.onToolUse(_);
        console.log("[OllamaChatProvider] Tool result", { success: O.success }), T.push({
          id: y.id,
          result: JSON.stringify(O)
        });
      }
      s.push({
        role: "assistant",
        content: p.message.content || "",
        tool_calls: p.message.tool_calls
      });
      for (const y of T)
        s.push({
          role: "tool",
          content: y.result
        });
    }
    throw new Error("Tool loop exceeded maximum iterations");
  }
};
i(k, "MAX_TOOL_ITERATIONS", 10);
let A = k;
class M {
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
    const t = e.messages.filter((s) => s.role !== "system"), n = e.system ? [{ role: "system", content: e.system }, ...t.map((s) => this.mapMessage(s))] : t.map((s) => this.mapMessage(s)), o = {
      model: e.model,
      messages: n,
      stream: e.streaming !== !1
    };
    return e.temperature !== void 0 && (o.temperature = e.temperature), e.maxTokens !== void 0 && (o.max_tokens = e.maxTokens), e.topP !== void 0 && (o.top_p = e.topP), e.frequencyPenalty !== void 0 && (o.frequency_penalty = e.frequencyPenalty), e.presencePenalty !== void 0 && (o.presence_penalty = e.presencePenalty), e.stop !== void 0 && (o.stop = e.stop), e.responseFormat !== void 0 && (o.response_format = e.responseFormat), o;
  }
}
const P = class P {
  constructor(e, t, n, o = [], s) {
    i(this, "client");
    i(this, "defaultModel");
    i(this, "tools");
    i(this, "onToolUse");
    this.client = new W({ apiKey: t, baseURL: e, dangerouslyAllowBrowser: !0 }), this.defaultModel = n || "gpt-3.5-turbo", this.tools = o, this.onToolUse = s, console.log(`OpenAIChatProvider initialized with model ${this.defaultModel}${o.length > 0 ? ` and ${o.length} tools` : ""}`);
  }
  /**
   * Send a chat request to OpenAI
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    var l, c, m, g;
    const n = e;
    if (console.log("[OpenAIChatProvider] chat called", {
      hasThreadId: !!n.thread_id,
      thread_id: n.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    const o = e.model || this.defaultModel, s = M.toOpenAIRequest({ ...e, model: o }), a = n.thread_id ? { thread_id: n.thread_id } : {};
    try {
      if (e.streaming !== !1) {
        const u = await this.client.chat.completions.create({
          model: s.model,
          messages: s.messages,
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
        for await (const h of u) {
          const r = ((c = (l = h.choices[0]) == null ? void 0 : l.delta) == null ? void 0 : c.content) || "";
          r && t && t(r);
        }
      } else {
        const h = ((g = (m = (await this.client.chat.completions.create({
          model: s.model,
          messages: s.messages,
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
        })).choices[0]) == null ? void 0 : m.message) == null ? void 0 : g.content) || "";
        h && t && t(h);
      }
    } catch (u) {
      throw console.error("Error in OpenAI API call:", u), u;
    }
  }
  /**
   * Send a chat request with tools enabled
   * Private method called by chat() when tools are configured
   */
  async chatWithTools(e, t) {
    const n = e.model || this.defaultModel, o = M.toOpenAIRequest({ ...e, model: n }), s = this.convertToolsToOpenAIFormat(this.tools);
    try {
      await this.handleToolLoop(o, s, t, e);
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
  /**
   * Extract tool call from response (new tools API format)
   */
  extractFunctionCall(e) {
    var n, o, s;
    const t = e.choices[0];
    if ((t == null ? void 0 : t.finish_reason) === "tool_calls" || (n = t == null ? void 0 : t.message) != null && n.tool_calls) {
      const a = (o = t == null ? void 0 : t.message) == null ? void 0 : o.tool_calls;
      if (a && a.length > 0) {
        const l = a[0];
        return {
          id: l.id,
          name: l.function.name,
          arguments: l.function.arguments
        };
      }
    }
    if ((t == null ? void 0 : t.finish_reason) === "function_call") {
      const a = (s = t == null ? void 0 : t.message) == null ? void 0 : s.function_call;
      if (a)
        return {
          id: `call_${Date.now()}`,
          // Generate ID for old format
          name: a.name,
          arguments: a.arguments
        };
    }
    return null;
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
      return console.warn("[OpenAIChatProvider] Failed to parse tool arguments", { error: t, raw: e }), {};
    }
  }
  /**
   * Handle the tool use loop for both streaming and non-streaming modes
   */
  async handleToolLoop(e, t, n, o) {
    var m, g, u, h, r;
    let s = e.messages;
    const a = !1, l = o, c = l.thread_id ? { thread_id: l.thread_id } : {};
    console.log("[OpenAIChatProvider] handleToolLoop starting", {
      shouldStream: a,
      toolsCount: t.length,
      messagesCount: s.length
    });
    for (let p = 0; p < P.MAX_TOOL_ITERATIONS; p++) {
      console.log("[OpenAIChatProvider] Tool loop iteration", { iteration: p, shouldStream: a });
      const f = await this.sendNonStreamingRequestWithTools(
        e.model,
        s,
        t,
        c,
        n
      );
      if (console.log("[OpenAIChatProvider] Got response", {
        hasResponse: !!f,
        finishReason: (m = f == null ? void 0 : f.choices[0]) == null ? void 0 : m.finish_reason,
        hasToolCalls: !!((u = (g = f == null ? void 0 : f.choices[0]) == null ? void 0 : g.message) != null && u.tool_calls),
        hasFunctionCall: !!((r = (h = f == null ? void 0 : f.choices[0]) == null ? void 0 : h.message) != null && r.function_call)
      }), !f) {
        console.log("[OpenAIChatProvider] No response, exiting loop");
        return;
      }
      const T = this.extractFunctionCall(f);
      if (!T) {
        console.log("[OpenAIChatProvider] No function call found, ending loop");
        return;
      }
      console.log("[OpenAIChatProvider] Function call detected", { name: T.name, id: T.id });
      const y = {
        id: T.id,
        name: T.name,
        input: this.parseToolArguments(T.arguments ?? "{}")
      };
      console.log("[OpenAIChatProvider] Executing tool", { toolUse: y });
      const _ = await this.onToolUse(y);
      console.log("[OpenAIChatProvider] Tool result", { success: _.success });
      const O = {
        role: "assistant",
        content: f.choices[0].message.content,
        tool_calls: f.choices[0].message.tool_calls
      }, U = {
        role: "tool",
        tool_call_id: T.id,
        content: JSON.stringify(_)
      };
      s = [...s, O, U];
    }
    throw new Error("Tool loop exceeded maximum iterations");
  }
  /**
   * Send streaming request with tools
   */
  async sendStreamingRequestWithTools(e, t, n, o, s) {
    var g;
    console.log("[OpenAIChatProvider] sendStreamingRequestWithTools called", {
      model: e,
      toolsCount: n.length,
      messagesCount: t.length
    });
    const a = await this.client.chat.completions.create({
      ...o,
      model: e,
      messages: t,
      tools: n,
      stream: !0
    });
    let l = null, c = !1, m = 0;
    for await (const u of a) {
      m++;
      const h = u.choices[0], r = h == null ? void 0 : h.delta;
      if ((m <= 3 || !r) && (console.log("[OpenAIChatProvider] Stream chunk details", {
        chunkNum: m,
        hasChoice: !!h,
        hasDelta: !!r,
        deltaKeys: r ? Object.keys(r) : [],
        hasContent: !!(r != null && r.content),
        hasFunctionCall: !!(r != null && r.function_call),
        finishReason: h == null ? void 0 : h.finish_reason,
        choiceIndex: h == null ? void 0 : h.index,
        chunkKeys: Object.keys(u),
        hasChoicesArray: !!u.choices,
        choicesLength: (g = u.choices) == null ? void 0 : g.length
      }), h || console.log("[OpenAIChatProvider] Raw chunk (no choice):", JSON.stringify(u))), r != null && r.content && s && (c = !0, s(r.content)), r != null && r.function_call) {
        console.log("[OpenAIChatProvider] Function call delta", {
          name: r.function_call.name,
          hasArguments: !!r.function_call.arguments
        });
        const p = l ?? { name: "", arguments: "" };
        typeof r.function_call.name == "string" && (p.name += r.function_call.name), typeof r.function_call.arguments == "string" && (p.arguments += r.function_call.arguments), l = p;
      }
    }
    return console.log("[OpenAIChatProvider] Stream complete after chunks", { chunkCount: m }), console.log("[OpenAIChatProvider] Stream complete", {
      hasFunctionCall: !!l,
      functionName: l == null ? void 0 : l.name,
      textContentReceived: c
    }), l ? {
      choices: [
        {
          finish_reason: "function_call",
          message: {
            role: "assistant",
            function_call: l,
            content: null
          },
          index: 0,
          logprobs: null
        }
      ],
      id: "",
      object: "chat.completion",
      created: Date.now(),
      model: e
    } : null;
  }
  /**
   * Send non-streaming request with tools
   */
  async sendNonStreamingRequestWithTools(e, t, n, o, s) {
    var m, g, u, h, r, p, f, T, y;
    console.log("[OpenAIChatProvider] sendNonStreamingRequestWithTools called", {
      model: e,
      toolsCount: n.length,
      messagesCount: t.length
    });
    const a = await this.client.chat.completions.create({
      ...o,
      model: e,
      messages: t,
      tools: n,
      stream: !1
    });
    console.log("[OpenAIChatProvider] Non-streaming response received", {
      finishReason: (m = a.choices[0]) == null ? void 0 : m.finish_reason,
      hasContent: !!((u = (g = a.choices[0]) == null ? void 0 : g.message) != null && u.content),
      hasToolCalls: !!((r = (h = a.choices[0]) == null ? void 0 : h.message) != null && r.tool_calls),
      hasFunctionCall: !!((f = (p = a.choices[0]) == null ? void 0 : p.message) != null && f.function_call)
    });
    const l = (y = (T = a.choices[0]) == null ? void 0 : T.message) == null ? void 0 : y.content;
    l && s && s(l);
    const c = this.extractFunctionCall(a);
    return console.log("[OpenAIChatProvider] Extracted function call", { hasFunctionCall: !!c }), c ? a : null;
  }
};
i(P, "MAX_TOOL_ITERATIONS", 10);
let x = P;
class F {
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
    const t = e.messages.filter((o) => o.role !== "system"), n = {
      model: e.model,
      messages: t.map((o) => this.mapMessage(o)),
      stream: e.streaming !== !1
    };
    if (e.system) {
      let o = e.system;
      if (e.responseFormat) {
        const s = `

You must respond with valid JSON that matches this exact schema:
\`\`\`json
${JSON.stringify(e.responseFormat, null, 2)}
\`\`\`

Respond only with the JSON, no other text.`;
        o += s;
      }
      n.system = o;
    }
    return e.temperature !== void 0 && (n.temperature = e.temperature), e.maxTokens !== void 0 && (n.max_tokens = e.maxTokens), e.topP !== void 0 && (n.top_p = e.topP), e.stop !== void 0 && (n.stop_sequences = e.stop), n;
  }
}
const w = class w {
  constructor(e, t, n, o = [], s) {
    i(this, "client");
    i(this, "defaultModel");
    i(this, "tools");
    i(this, "onToolUse");
    this.client = new b({
      apiKey: t,
      dangerouslyAllowBrowser: !0
    }), e && (this.client.baseURL = e), this.defaultModel = n || "claude-3-opus-20240229", this.tools = o, this.onToolUse = s, console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}${o.length > 0 ? ` and ${o.length} tools` : ""}`);
  }
  /**
   * Send a chat request to Claude
   * Automatically handles tools if configured in constructor
   */
  async chat(e, t) {
    const n = e;
    if (console.log("[ClaudeChatProvider] chat called", {
      hasThreadId: !!n.thread_id,
      thread_id: n.thread_id,
      hasTools: this.tools.length > 0
    }), this.tools.length > 0 && this.onToolUse) {
      await this.chatWithTools(e, t);
      return;
    }
    const o = e.model || this.defaultModel, s = F.toClaudeRequest({ ...e, model: o }), a = n.thread_id ? { thread_id: n.thread_id } : {};
    try {
      if (e.streaming !== !1) {
        const l = this.client.messages.stream({
          ...a,
          model: s.model,
          messages: s.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          stream: !0,
          system: s.system
        }).on("text", (m) => {
          t && t(m);
        });
        console.log("waiting for final message");
        const c = await l.finalMessage();
        console.log(c);
      } else {
        const l = await this.client.messages.create({
          ...a,
          model: s.model,
          messages: s.messages,
          temperature: e.temperature,
          max_tokens: e.maxTokens || 4096,
          top_p: e.topP,
          stop_sequences: e.stop,
          system: s.system
        });
        if (l.content && l.content.length > 0) {
          const c = l.content.filter((m) => m.type === "text").map((m) => m.text).join("");
          t && t(c);
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
  async chatWithTools(e, t) {
    const n = e.model || this.defaultModel, o = F.toClaudeRequest({ ...e, model: n }), s = this.convertToolsToClaudeFormat(this.tools);
    try {
      await this.handleToolLoop(o, s, t, e);
    } catch (a) {
      throw console.error("[ClaudeChatProvider] Tool-enabled chat failed:", a), a;
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
  /**
   * Extract tool_use blocks from response content
   */
  extractToolUses(e) {
    return e.filter((t) => t.type === "tool_use");
  }
  /**
   * Extract text blocks from response content
   */
  extractTextContent(e) {
    return e.filter((t) => t.type === "text").map((t) => t.text).join("");
  }
  /**
   * Format tool results for Claude API
   */
  formatToolResults(e, t) {
    return e.map((n, o) => {
      const s = t.at(o);
      return {
        type: "tool_result",
        tool_use_id: n.id,
        content: JSON.stringify({
          success: (s == null ? void 0 : s.success) ?? !1,
          data: (s == null ? void 0 : s.data) ?? null,
          error: (s == null ? void 0 : s.error) ?? null
        })
      };
    });
  }
  /**
   * Handle the tool use loop for both streaming and non-streaming modes
   */
  async handleToolLoop(e, t, n, o) {
    let s = e.messages;
    const a = o.streaming !== !1;
    for (let l = 0; l < w.MAX_TOOL_ITERATIONS; l++) {
      let c;
      if (a ? c = await this.sendStreamingRequestWithTools(
        e.model,
        s,
        t,
        n,
        o
      ) : c = await this.sendNonStreamingRequestWithTools(
        e.model,
        s,
        t,
        n,
        o
      ), !c || !c.content)
        return;
      const m = this.extractToolUses(c.content);
      if (m.length === 0)
        return;
      const g = [];
      for (const h of m) {
        const r = {
          id: h.id,
          name: h.name,
          input: h.input
        }, p = await this.onToolUse(r);
        g.push(p);
      }
      const u = this.formatToolResults(m, g);
      s = [
        ...s,
        {
          role: "assistant",
          content: c.content
        },
        {
          role: "user",
          content: u
        }
      ];
    }
    throw new Error("Tool loop exceeded maximum iterations");
  }
  /**
   * Send streaming request with tools
   */
  async sendStreamingRequestWithTools(e, t, n, o, s) {
    const a = s;
    return console.log("[ClaudeChatProvider] streamWithTools thread_id:", a.thread_id), await this.client.messages.stream({
      model: e,
      messages: t,
      tools: n,
      max_tokens: 4096,
      stream: !0,
      thread_id: a.thread_id
    }).on("text", (m) => {
      o && o(m);
    }).finalMessage();
  }
  /**
   * Send non-streaming request with tools
   */
  async sendNonStreamingRequestWithTools(e, t, n, o, s) {
    const a = s;
    console.log("[ClaudeChatProvider] nonStreamingWithTools thread_id:", a.thread_id);
    const c = await this.client.messages.create({
      model: e,
      messages: t,
      tools: n,
      max_tokens: 4096,
      stream: !1,
      thread_id: a.thread_id
    });
    if (o && c.content) {
      const m = this.extractTextContent(c.content);
      m && o(m);
    }
    return c;
  }
};
i(w, "MAX_TOOL_ITERATIONS", 10);
let I = w;
var v = /* @__PURE__ */ ((d) => (d.OLLAMA = "ollama", d.OPENAI = "openai", d.CLAUDE = "claude", d.PERPLEXITY = "perplexity", d))(v || {});
class D {
  /**
   * Creates an appropriate chat provider based on the provider type
   */
  static createProvider(e, t, n, o) {
    switch (e) {
      case "ollama":
        if (!t.apiKey)
          throw new Error("API key is required for Ollama provider");
        return new A(t.url, t.apiKey, t.model, n || [], o);
      case "openai":
        if (!t.apiKey)
          throw new Error("API key is required for OpenAI provider");
        return new x(t.url, t.apiKey, t.model, n || [], o);
      case "claude":
        if (!t.apiKey)
          throw new Error("API key is required for Claude provider");
        return new I(t.url, t.apiKey, t.model, n || [], o);
      case "perplexity":
        throw new Error("PerplexityChatProvider not implemented yet");
      default:
        throw new Error(`Unsupported provider type: ${e}`);
    }
  }
}
class $ {
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
class J {
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
class j {
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
function X(d) {
  switch (d.toLowerCase()) {
    case v.OPENAI:
      return new $();
    case v.CLAUDE:
      return new J();
    case v.OLLAMA:
      return new j();
    default:
      return new K();
  }
}
class z {
  constructor(e, t, n, o, s) {
    i(this, "accumulatedResponse", "");
    i(this, "requestStartTime");
    i(this, "firstTokenTime");
    i(this, "tokenCounter");
    i(this, "originalCallback");
    i(this, "totalTokens", 0);
    i(this, "tokensReceived", 0);
    i(this, "isFirstToken", !0);
    this.provider = e, this.model = t, this.prompt = n, this.onComplete = o, this.requestStartTime = Date.now(), this.originalCallback = s, this.tokenCounter = X(e);
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
    const t = Date.now(), n = ((a = this.tokenCounter) == null ? void 0 : a.countPromptTokens(this.prompt)) ?? 0, o = ((l = this.tokenCounter) == null ? void 0 : l.estimateResponseTokens(this.accumulatedResponse)) ?? 0, s = {
      requestId: crypto.randomUUID(),
      provider: this.provider,
      model: this.model,
      requestTimestamp: this.requestStartTime,
      firstTokenTimestamp: this.firstTokenTime,
      completionTimestamp: t,
      totalDuration: t - this.requestStartTime,
      timeToFirstToken: this.firstTokenTime ? this.firstTokenTime - this.requestStartTime : void 0,
      promptTokenCount: n,
      completionTokenCount: o,
      totalTokenCount: n + o,
      tokensPerSecond: this.calculateTokensPerSecond(t),
      promptText: JSON.stringify(this.prompt),
      completeResponse: this.accumulatedResponse,
      success: !e,
      error: e ? String(e) : void 0
    };
    return this.onComplete(s), s;
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
const C = class C {
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
    return C.instance || (C.instance = new C(e || { enabled: !0 })), C.instance;
  }
  /**
   * Create an accumulator for tracking a chat request
   */
  createAccumulator(e, t, n, o) {
    return new z(
      e,
      t,
      n,
      (s) => this.logChatAudit(s),
      o
    );
  }
  /**
   * Create a wrapped token callback that accumulates tokens
   */
  createWrappedCallback(e, t, n) {
    const o = this.createAccumulator(
      t,
      e.model,
      e.messages,
      n
    );
    return {
      callback: (s) => o.handleToken(s),
      complete: (s) => o.complete(s)
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
      const n = await fetch(t, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(e)
      });
      n.ok || console.error(`Failed to send audit data to server: ${n.status} ${n.statusText}`);
    } catch (n) {
      console.error("Error sending audit data to server:", n);
    }
  }
};
i(C, "instance");
let S = C;
class V {
  /**
   * Create a ChatService with the specified provider and configuration
   */
  constructor(e, t, n = !0, o, s) {
    i(this, "provider");
    i(this, "providerType");
    i(this, "config");
    i(this, "auditService");
    i(this, "tools");
    i(this, "onToolUse");
    this.providerType = e, this.config = t, this.tools = o, this.onToolUse = s, this.provider = this.initializeProvider(), this.auditService = S.getInstance({
      enabled: n,
      logToConsole: !0,
      logToServer: !1
    });
  }
  /**
   * Initialize the appropriate provider based on provider type
   */
  initializeProvider() {
    return D.createProvider(this.providerType, this.config, this.tools, this.onToolUse);
  }
  /**
   * Send a chat request and handle streaming response
   */
  async chat(e, t) {
    const { callback: n, complete: o } = this.auditService.createWrappedCallback(
      e,
      this.providerType,
      t
    );
    try {
      await this.provider.chat(e, n), o();
    } catch (s) {
      throw o(s), s;
    }
  }
  /**
   * Get the audit logs for this chat service
   */
  getAuditLogs() {
    return this.auditService.getAuditLogs();
  }
}
class B {
  static toOllamaRequest(e) {
    return {
      model: e.model,
      messages: e.messages.map((t) => ({ role: t.role, content: t.content }))
    };
  }
}
class Z {
  constructor(e, t) {
    i(this, "url");
    i(this, "model");
    i(this, "ollama");
    this.url = e, this.model = t, this.ollama = new N({ host: e }), console.log("in constructor creating ollama client...");
  }
  async chat(e, t) {
    B.toOllamaRequest(e);
    const n = await this.ollama.chat({ model: e.model, messages: e.messages, stream: !0 });
    for await (const o of n) {
      const s = o.message.content;
      t && t(s);
    }
  }
}
export {
  S as AuditService,
  Z as ChatApiService,
  D as ChatProviderFactory,
  V as ChatService,
  I as ClaudeChatProvider,
  A as OllamaChatProvider,
  x as OpenAIChatProvider,
  v as ProviderType,
  z as TokenAccumulator
};
