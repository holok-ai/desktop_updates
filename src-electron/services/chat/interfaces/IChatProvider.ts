// src/lib/services/interfaces/IChatProvider.ts
import type { ChatRequest, ChatRequestWithOptions } from './ChatMessage.js';

/**
 * Core interface for all chat providers
 */
export interface IChatProvider {
    /**
     * Sends a chat request to the provider and handles streaming response
     * @param request The chat request containing messages and model
     * @param onTokenReceived Callback function to handle streamed tokens
     */
    chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;
    
    /**
     * Sends a chat request with additional provider-specific options
     * @param request The extended chat request with provider options
     * @param onTokenReceived Callback function to handle streamed tokens
     */
    chatWithOptions(request: ChatRequestWithOptions, onTokenReceived?: (token: string) => void): Promise<void>;
}