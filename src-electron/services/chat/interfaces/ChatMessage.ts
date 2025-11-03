/**
 * Represents a single message in a chat conversation
 */
export interface ChatMessage {
    role: string;
    content: string;
}

/**
 * Common chat request interface for all providers
 */
export interface ChatRequest {
    messages: ChatMessage[];
    streaming?: boolean;
    model: string;
}

/**
 * Provider-specific options for chat requests
 */
export interface ProviderOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    [key: string]: unknown; // For provider-specific options
}

/**
 * Extended chat request with provider options
 */
export interface ChatRequestWithOptions extends ChatRequest {
    options?: ProviderOptions;
}

/**
 * Chat API request interface (used by ChatApiService)
 */
export interface ChatApiRequest {
    messages: ChatMessage[];
    streaming?: boolean;
    model: string;
}