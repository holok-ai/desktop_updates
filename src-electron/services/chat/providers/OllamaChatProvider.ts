import { Ollama } from 'ollama';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OllamaConverter } from '../converters/OllamaConverter.js';

export class OllamaChatProvider implements IChatProvider {
    private ollama: Ollama;
    private defaultModel: string;

    constructor(apiEndpoint: string, apiKey: string, defaultModel: string) {
        
        this.ollama = new Ollama({ host: apiEndpoint, headers: {
            'X-api-key': apiKey
        } });
        this.defaultModel = defaultModel;
        console.log(`OllamaChatProvider initialized with endpoint ${apiEndpoint} and model ${defaultModel} and key ${apiKey}`);
    }

    /**
     * Send a chat request to Ollama
     */
    public async chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void> {
        const modelToUse = request.model || this.defaultModel;
        const requestWithModel = { ...request, model: modelToUse };
        
        const ollamaRequest = OllamaConverter.toOllamaRequest(requestWithModel);
        // Handle streaming vs non-streaming
        if (ollamaRequest.stream) {
            const response = await this.ollama.chat({
                ...ollamaRequest,
                stream: true
            });

            // Handle streaming response
            for await (const part of response) {
                const token = part.message.content;
                if (onTokenReceived) {
                    onTokenReceived(token);
                }
            }
        } else {
            const response = await this.ollama.chat({
                ...ollamaRequest,
                stream: false
            });
            
            // Handle non-streaming response
            if (onTokenReceived) {
                onTokenReceived(response.message.content);
            }
        }
    }

    /**
     * Send a chat request with additional options to Ollama
     */
    public async chatWithOptions(
        request: ChatRequestWithOptions, 
        onTokenReceived?: (token: string) => void
    ): Promise<void> {
        const modelToUse = request.model || this.defaultModel;
        const requestWithModel = { ...request, model: modelToUse };
        
        const ollamaRequest = OllamaConverter.toOllamaRequestWithOptions(requestWithModel);
        
        // Handle streaming vs non-streaming
        if (ollamaRequest.stream) {
            const response = await this.ollama.chat({
                ...ollamaRequest,
                stream: true
            });
            
            // Handle streaming response
            for await (const part of response) {
                const token = part.message.content;
                if (onTokenReceived) {
                    onTokenReceived(token);
                }
            }
        } else {
            const response = await this.ollama.chat({
                ...ollamaRequest,
                stream: false
            });
            
            // Handle non-streaming response
            if (onTokenReceived) {
                onTokenReceived(response.message.content);
            }
        }
    }
}