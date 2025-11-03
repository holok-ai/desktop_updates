import type { ChatMessage, ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import type { MessageParam } from '@anthropic-ai/sdk/resources';

/**
 * Converter for Claude-specific request/response formats
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ClaudeConverter {
    private constructor() {}

    /**
     * Map internal message role to Claude's expected format
     */
    private static mapRole(role: string): 'user' | 'assistant' {
        // Claude API only accepts 'user' and 'assistant' roles in messages
        // System prompts should be passed via the 'system' parameter in MessageCreateParams
        switch (role.toLowerCase()) {
            case 'assistant':
                return 'assistant';
            case 'user':
            case 'system':
            default:
                // Default to user for system and unknown roles
                return 'user';
        }
    }

    /**
     * Convert internal ChatMessage to Claude's MessageParam format
     */
    private static mapMessage(message: ChatMessage): MessageParam {
        return {
            role: this.mapRole(message.role),
            content: message.content
        };
    }

    /**
     * Convert internal ChatRequest to Claude-specific format
     */
    static toClaudeRequest(request: ChatRequest): {
        model: string;
        messages: MessageParam[];
        stream: boolean;
    } {
        return {
            model: request.model,
            messages: request.messages.map(m => this.mapMessage(m)),
            stream: request.streaming !== false
        };
    }

    /**
     * Convert internal ChatRequestWithOptions to Claude-specific format
     */
    static toClaudeRequestWithOptions(request: ChatRequestWithOptions): Record<string, unknown> {
        const options = request.options || {};

        const claudeRequest: Record<string, unknown> = {
            model: request.model,
            messages: request.messages.map(m => this.mapMessage(m)),
            stream: request.streaming !== false
        };

        // Add optional parameters only if defined
        if (options.temperature !== undefined) {
            claudeRequest.temperature = options.temperature;
        }
        if (options.maxTokens !== undefined) {
            claudeRequest.max_tokens = options.maxTokens;
        }
        if (options.topP !== undefined) {
            claudeRequest.top_p = options.topP;
        }
        if (options.stop !== undefined) {
            claudeRequest.stop_sequences = options.stop;
        }

        return claudeRequest;
    }
}