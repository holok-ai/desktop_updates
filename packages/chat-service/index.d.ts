import { ChatAuditData as ChatAuditData_2 } from '.';
import { ChatCompletion } from 'openai/resources/chat/completions';
import { ChatResponse } from 'ollama/browser';
import { default as default_2 } from '@anthropic-ai/sdk';
import { default as default_3 } from 'openai';
import { GoogleGenAI } from '@google/genai';
import { Ollama } from 'ollama/browser';

/**
 * Configuration for the audit service
 */
export declare interface AuditConfig {
    enabled: boolean;
    logToConsole?: boolean;
    logToServer?: boolean;
    serverEndpoint?: string;
    includePromptText?: boolean;
    includeResponseText?: boolean;
}

/**
 * Service for auditing chat interactions across all providers
 */
export declare class AuditService {
    private static instance;
    private config;
    private auditLogs;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(config?: AuditConfig): AuditService;
    /**
     * Create an accumulator for tracking a chat request
     */
    createAccumulator(provider: string, model: string, messages: ChatMessage[], onTokenReceived?: (token: string) => void): TokenAccumulator;
    /**
     * Create a wrapped token callback that accumulates tokens
     */
    createWrappedCallback(request: ChatRequest, provider: string, onTokenReceived?: (token: string) => void): {
        callback: (token: string) => void;
        complete: (error?: any) => void;
    };
    /**
     * Log the chat audit data
     */
    logChatAudit(auditData: ChatAuditData): void;
    /**
     * Get all accumulated audit logs
     */
    getAuditLogs(): ChatAuditData[];
    /**
     * Apply privacy filters to the audit data
     */
    private applyPrivacyFilters;
    /**
     * Send audit data to a server endpoint
     */
    private sendToServer;
}

export declare interface ChatApiRequest {
    messages: ChatMessage_2[];
    streaming?: boolean;
    model: string;
}

export declare class ChatApiService {
    private url;
    private model;
    private ollama;
    constructor(url: string, model: string);
    chat(request: ChatApiRequest, onTokenReceived?: (token: string) => void): Promise<void>;
}

/**
 * Core audit data interface for chat interactions
 */
export declare interface ChatAuditData {
    requestId: string;
    provider: string;
    model: string;
    requestTimestamp: number;
    firstTokenTimestamp?: number;
    completionTimestamp: number;
    totalDuration: number;
    timeToFirstToken?: number;
    promptTokenCount?: number;
    completionTokenCount?: number;
    totalTokenCount?: number;
    tokensPerSecond?: number;
    promptText: string;
    completeResponse: string;
    success: boolean;
    error?: string;
    metadata?: Record<string, any>;
}

/**
 * Represents a single message in a chat conversation
 */
export declare interface ChatMessage {
    role: string;
    content: string;
}

declare interface ChatMessage_2 {
    role: string;
    content: string;
}

/**
 * Factory for creating chat provider instances
 */
export declare class ChatProviderFactory {
    /**
     * Creates an appropriate chat provider based on the provider type
     */
    static createProvider(providerType: ProviderType, config: ProviderConfig, tools?: ToolDefinition[], onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>): IChatProvider;
}

/**
 * Utility functions shared across all chat providers
 */
export declare class ChatProviderUtils {
    /**
     * Maximum number of tool calling iterations to prevent infinite loops
     */
    static readonly MAX_TOOL_ITERATIONS = 10;
    /**
     * Sets the iteration value in a branch ID string
     * Format: row.lane.chat (3 parts) or row.lane.chat.iteration (4 parts)
     *
     * @param branchId - Current branch ID string (e.g., "1.0.1" or "1.0.1.5")
     * @param iteration - Iteration number (0-9) to set
     * @returns New branch ID with iteration set
     */
    static setBranchIteration(branchId: string, iteration: number): string;
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
    static handleToolLoop<TResponse>(handler: ProviderToolHandler<TResponse>, model: string, initialMessages: unknown[], tools: unknown[], originalRequest: ChatRequest, onToolUse: (toolUse: ToolUse) => Promise<ToolResult>, onTokenReceived?: (token: string) => void, shouldStream?: boolean): Promise<void>;
}

/**
 * Common chat request interface for all providers
 */
export declare interface ChatRequest {
    messages: ChatMessage[];
    streaming?: boolean;
    model: string;
    system?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: any;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
}

/**
 * Main service class that provides a unified interface for chat functionality
 * across different providers
 */
export declare class ChatService {
    private provider;
    private providerType;
    private config;
    private auditService;
    private tools?;
    private onToolUse?;
    /**
     * Create a ChatService with the specified provider and configuration
     */
    constructor(providerType: string, config: ProviderConfig, enableAudit?: boolean, tools?: ToolDefinition[], onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>);
    /**
     * Initialize the appropriate provider based on provider type
     */
    private initializeProvider;
    /**
     * Send a chat request and handle streaming response
     */
    chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;
    /**
     * Get the audit logs for this chat service
     */
    getAuditLogs(): ChatAuditData_2[];
}

export declare class ClaudeChatProvider implements IChatProvider {
    private client;
    private defaultModel;
    private tools;
    private onToolUse?;
    private toolHandler?;
    constructor(apiEndpoint: string, apiKey: string, defaultModel: string, tools?: ToolDefinition[], onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>);
    /**
     * Send a chat request to Claude
     * Automatically handles tools if configured in constructor
     */
    chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;
    /**
     * Send a chat request with tools enabled
     * Private method called by chat() when tools are configured
     */
    private chatWithTools;
    /**
     * Convert ToolDefinition to Claude's tool format
     */
    private convertToolsToClaudeFormat;
}

declare interface ClaudeResponse {
    content: ContentBlock[];
    stop_reason?: string;
    model?: string;
    id?: string;
}

/**
 * Claude-specific implementation of the tool handler strategy
 */
export declare class ClaudeToolHandler implements ProviderToolHandler<ClaudeResponse> {
    private client;
    private onTokenReceived?;
    constructor(client: default_2);
    /**
     * Set the token callback for streaming responses
     * This is called before each tool loop iteration to update the callback
     */
    setTokenCallback(callback?: (token: string) => void): void;
    makeRequest(model: string, messages: unknown[], tools: unknown[], threadContext: Record<string, unknown>, shouldStream: boolean): Promise<ClaudeResponse>;
    extractToolUses(response: ClaudeResponse): ToolUse[];
    extractTextContent(response: ClaudeResponse): string | null;
    formatToolResults(toolUses: ToolUse[], results: ToolResult[]): unknown[];
    appendMessages(messages: unknown[], response: ClaudeResponse, toolResults: unknown[]): unknown[];
    /**
     * Make a streaming request to Claude API
     * Streams text tokens in real-time while collecting the final message for tool extraction
     */
    private makeStreamingRequest;
    /**
     * Make a non-streaming request to Claude API
     */
    private makeNonStreamingRequest;
    /**
     * Extract tool_use blocks from response content
     */
    private extractToolUseBlocks;
}

declare type ContentBlock = ToolUseBlock | TextBlock | {
    type: string;
};

export declare class GeminiChatProvider implements IChatProvider {
    private client;
    private defaultModel;
    private apiEndpoint;
    private tools;
    private onToolUse?;
    private toolHandler?;
    constructor(apiEndpoint: string, apiKey: string, defaultModel: string, tools?: ToolDefinition[], onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>);
    /**
     * Send a chat request to Gemini
     * Automatically handles tools if configured in constructor
     */
    chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;
    /**
     * Send a chat request with tools enabled
     * Private method called by chat() when tools are configured
     */
    private chatWithTools;
    /**
     * Convert ToolDefinition to Gemini's tool format
     */
    private convertToolsToGeminiFormat;
}

/**
 * Tool handler for Google Gemini's function calling API
 * Implements the ProviderToolHandler interface for Gemini-specific behavior
 */
export declare class GeminiToolHandler implements ProviderToolHandler<any> {
    private client;
    private apiEndpoint;
    private tokenCallback?;
    constructor(client: GoogleGenAI, apiEndpoint: string);
    /**
     * Set the token callback for streaming mode
     */
    setTokenCallback(callback?: (token: string) => void): void;
    /**
     * Make a request to Gemini with function calling enabled
     */
    makeRequest(model: string, messages: unknown[], tools: unknown[], threadContext: Record<string, unknown>, shouldStream: boolean): Promise<any>;
    /**
     * Make a streaming request to Gemini
     */
    private makeStreamingRequest;
    /**
     * Make a non-streaming request to Gemini
     */
    private makeNonStreamingRequest;
    /**
     * Extract tool uses (function calls) from Gemini's response
     */
    extractToolUses(response: any): ToolUse[];
    /**
     * Extract text content from Gemini's response
     */
    extractTextContent(response: any): string | null;
    /**
     * Format tool results for Gemini's expected format
     */
    formatToolResults(toolUses: ToolUse[], results: ToolResult[]): unknown[];
    /**
     * Append the assistant's response and tool results to the conversation
     */
    appendMessages(messages: unknown[], response: any, toolResults: unknown[]): unknown[];
}

/**
 * Core interface for all chat providers
 */
export declare interface IChatProvider {
    /**
     * Sends a chat request to the provider and handles streaming response
     * @param request The chat request containing messages, model, and all options
     * @param onTokenReceived Callback function to handle streamed tokens
     */
    chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;
}

export declare class OllamaChatProvider implements IChatProvider {
    private ollama;
    private defaultModel;
    private tools;
    private onToolUse?;
    private toolHandler?;
    constructor(apiEndpoint: string, apiKey: string, defaultModel: string, tools?: ToolDefinition[], onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>);
    /**
     * Send a chat request to Ollama
     * Automatically handles tools if configured in constructor
     */
    chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;
    /**
     * Send a chat request with tools enabled
     * Private method called by chat() when tools are configured
     */
    private chatWithTools;
    /**
     * Convert ToolDefinition to Ollama's tools format
     */
    private convertToolsToOllamaFormat;
    /**
     * Extract tool calls from Ollama response
     */
    private extractToolCalls;
    /**
     * Parse tool arguments from string or object
     * Ollama returns arguments as an object, while other providers return a JSON string
     */
    private parseToolArguments;
}

/**
 * Ollama-specific implementation of the tool handler strategy
 */
export declare class OllamaToolHandler implements ProviderToolHandler<ChatResponse> {
    private ollama;
    private onTokenReceived?;
    constructor(ollama: Ollama);
    /**
     * Set the token callback for streaming responses
     */
    setTokenCallback(callback?: (token: string) => void): void;
    makeRequest(model: string, messages: unknown[], tools: unknown[], threadContext: Record<string, unknown>, shouldStream: boolean): Promise<ChatResponse>;
    extractToolUses(response: ChatResponse): ToolUse[];
    extractTextContent(response: ChatResponse): string | null;
    formatToolResults(toolUses: ToolUse[], results: ToolResult[]): unknown[];
    appendMessages(messages: unknown[], response: ChatResponse, toolResults: unknown[]): unknown[];
    /**
     * Extract tool calls from Ollama message
     */
    private extractToolCalls;
    /**
     * Parse tool arguments from various formats
     */
    private parseToolArguments;
}

export declare class OpenAIChatProvider implements IChatProvider {
    private client;
    private defaultModel;
    private tools;
    private onToolUse?;
    private toolHandler?;
    constructor(baseURL: string, apiKey: string, defaultModel: string, tools?: ToolDefinition[], onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>);
    /**
     * Send a chat request to OpenAI
     * Automatically handles tools if configured in constructor
     */
    chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;
    /**
     * Send a chat request with tools enabled
     * Private method called by chat() when tools are configured
     */
    private chatWithTools;
    /**
     * Convert ToolDefinition to OpenAI's tools format (new API)
     */
    private convertToolsToOpenAIFormat;
}

/**
 * OpenAI-specific implementation of the tool handler strategy
 * Note: OpenAI tool handling currently uses non-streaming mode
 */
export declare class OpenAIToolHandler implements ProviderToolHandler<ChatCompletion> {
    private client;
    private onTokenReceived?;
    constructor(client: default_3);
    /**
     * Set the token callback for streaming responses
     */
    setTokenCallback(callback?: (token: string) => void): void;
    makeRequest(model: string, messages: unknown[], tools: unknown[], threadContext: Record<string, unknown>, shouldStream: boolean): Promise<ChatCompletion>;
    extractToolUses(response: ChatCompletion): ToolUse[];
    extractTextContent(response: ChatCompletion): string | null;
    formatToolResults(toolUses: ToolUse[], results: ToolResult[]): unknown[];
    appendMessages(messages: unknown[], response: ChatCompletion, toolResults: unknown[]): unknown[];
    /**
     * Make a streaming request to OpenAI API
     */
    private makeStreamingRequest;
    /**
     * Make a non-streaming request to OpenAI API
     */
    private makeNonStreamingRequest;
    /**
     * Parse tool arguments from string
     */
    private parseToolArguments;
}

/**
 * Configuration for creating a chat provider
 */
export declare interface ProviderConfig {
    url: string;
    model: string;
    apiKey?: string;
}

/**
 * Strategy interface for handling tool calling loops across different providers
 * Each provider implements this interface to define provider-specific behavior
 */
export declare interface ProviderToolHandler<TResponse = unknown> {
    /**
     * Make an API request with tools to the provider
     * @param model - Model identifier
     * @param messages - Conversation messages
     * @param tools - Tool definitions in provider-specific format
     * @param threadContext - Thread context with thread_id if present
     * @param shouldStream - Whether to use streaming mode
     * @returns Provider-specific response
     */
    makeRequest(model: string, messages: unknown[], tools: unknown[], threadContext: Record<string, unknown>, shouldStream: boolean): Promise<TResponse>;
    /**
     * Extract tool uses/calls from the provider's response
     * @param response - Provider-specific response
     * @returns Array of tool uses to execute
     */
    extractToolUses(response: TResponse): ToolUse[];
    /**
     * Extract text content from the provider's response
     * @param response - Provider-specific response
     * @returns Text content or null if none
     */
    extractTextContent(response: TResponse): string | null;
    /**
     * Format tool results for appending to the conversation
     * @param toolUses - Original tool uses
     * @param results - Tool execution results
     * @returns Formatted results in provider-specific format
     */
    formatToolResults(toolUses: ToolUse[], results: ToolResult[]): unknown[];
    /**
     * Append the assistant's response and tool results to the conversation
     * @param messages - Current conversation messages
     * @param response - Provider's response
     * @param toolResults - Formatted tool results
     * @returns Updated messages array
     */
    appendMessages(messages: unknown[], response: TResponse, toolResults: unknown[]): unknown[];
}

/**
 * Provider types supported by the factory
 */
export declare enum ProviderType {
    OLLAMA = "ollama",
    OPENAI = "openai",
    CLAUDE = "claude",
    PERPLEXITY = "perplexity",
    GEMINI = "gemini"
}

declare type TextBlock = {
    type: 'text';
    text: string;
};

/**
 * Accumulates tokens from streaming responses and tracks performance metrics
 */
export declare class TokenAccumulator {
    private provider;
    private model;
    private prompt;
    private onComplete;
    private accumulatedResponse;
    private requestStartTime;
    private firstTokenTime?;
    private tokenCounter?;
    private originalCallback?;
    private totalTokens;
    private tokensReceived;
    private isFirstToken;
    constructor(provider: string, model: string, prompt: any[], onComplete: (auditData: ChatAuditData) => void, onTokenReceived?: (token: string) => void);
    /**
     * Handle each token as it arrives
     */
    handleToken(token: string): void;
    /**
     * Complete the accumulation and generate audit data
     */
    complete(error?: any): ChatAuditData;
    /**
     * Calculate tokens per second rate
     */
    private calculateTokensPerSecond;
}

/**
 * Provider-specific implementation for token counting
 */
export declare interface TokenCounter {
    countPromptTokens(messages: any[]): number;
    estimateResponseTokens(text: string): number;
}

/**
 * Tool definition for function calling
 */
export declare interface ToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}

/**
 * Tool execution result
 */
export declare interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Tool use from LLM
 */
export declare interface ToolUse {
    id: string;
    name: string;
    input: Record<string, any>;
}

declare type ToolUseBlock = {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
};

export { }
