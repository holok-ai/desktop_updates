import { ChatAuditData as ChatAuditData_2 } from '.';

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
    private static readonly MAX_TOOL_ITERATIONS;
    private client;
    private defaultModel;
    private tools;
    private onToolUse?;
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
    /**
     * Extract tool_use blocks from response content
     */
    private extractToolUses;
    /**
     * Extract text blocks from response content
     */
    private extractTextContent;
    /**
     * Format tool results for Claude API
     */
    private formatToolResults;
    /**
     * Handle the tool use loop for both streaming and non-streaming modes
     */
    private handleToolLoop;
    /**
     * Send streaming request with tools
     */
    private sendStreamingRequestWithTools;
    /**
     * Send non-streaming request with tools
     */
    private sendNonStreamingRequestWithTools;
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
    private static readonly MAX_TOOL_ITERATIONS;
    private ollama;
    private defaultModel;
    private tools;
    private onToolUse?;
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
    /**
     * Handle the tool use loop
     */
    private handleToolLoop;
}

export declare class OpenAIChatProvider implements IChatProvider {
    private static readonly MAX_TOOL_ITERATIONS;
    private client;
    private defaultModel;
    private tools;
    private onToolUse?;
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
    /**
     * Extract tool call from response (new tools API format)
     */
    private extractFunctionCall;
    /**
     * Parse tool arguments from string
     */
    private parseToolArguments;
    /**
     * Handle the tool use loop for both streaming and non-streaming modes
     */
    private handleToolLoop;
    /**
     * Send streaming request with tools
     */
    private sendStreamingRequestWithTools;
    /**
     * Send non-streaming request with tools
     */
    private sendNonStreamingRequestWithTools;
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
 * Provider types supported by the factory
 */
export declare enum ProviderType {
    OLLAMA = "ollama",
    OPENAI = "openai",
    CLAUDE = "claude",
    PERPLEXITY = "perplexity"
}

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

export { }
