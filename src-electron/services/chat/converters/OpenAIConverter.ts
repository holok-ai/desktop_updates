import type { ChatMessage, ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

/**
 * Converter for OpenAI-specific request/response formats
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class OpenAIConverter {
    private constructor() {}

    /**
     * Map internal message format to OpenAI's ChatCompletionMessageParam
     */
    private static mapMessage(message: ChatMessage): ChatCompletionMessageParam {
        // Map to appropriate role - only system, user, and assistant are supported in basic messages
        const role = message.role.toLowerCase();

        if (role === 'assistant') {
            return { role: 'assistant', content: message.content };
        } else if (role === 'system') {
            return { role: 'system', content: message.content };
        } else {
            // Default to user for all other roles
            return { role: 'user', content: message.content };
        }
    }

    /**
     * Convert internal ChatRequest to OpenAI-specific format
     */
    static toOpenAIRequest(request: ChatRequest): {
        model: string;
        messages: ChatCompletionMessageParam[];
        stream: boolean;
    } {
        return {
            model: request.model,
            messages: request.messages.map(m => this.mapMessage(m)),
            stream: request.streaming !== false
        };
    }

    /**
     * Convert internal ChatRequestWithOptions to OpenAI-specific format
     */
    static toOpenAIRequestWithOptions(request: ChatRequestWithOptions): Record<string, unknown> {
        const options = request.options || {};

        const openaiRequest: Record<string, unknown> = {
            model: request.model,
            messages: request.messages.map(m => this.mapMessage(m)),
            stream: request.streaming !== false
        };

        // Add optional parameters only if defined
        if (options.temperature !== undefined) {
            openaiRequest.temperature = options.temperature;
        }
        if (options.maxTokens !== undefined) {
            openaiRequest.max_tokens = options.maxTokens;
        }
        if (options.topP !== undefined) {
            openaiRequest.top_p = options.topP;
        }
        if (options.frequencyPenalty !== undefined) {
            openaiRequest.frequency_penalty = options.frequencyPenalty;
        }
        if (options.presencePenalty !== undefined) {
            openaiRequest.presence_penalty = options.presencePenalty;
        }
        if (options.stop !== undefined) {
            openaiRequest.stop = options.stop;
        }

        return openaiRequest;
    }
}