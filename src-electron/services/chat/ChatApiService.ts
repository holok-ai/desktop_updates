import { Ollama } from 'ollama';
import type { ChatApiRequest } from './interfaces/ChatMessage.js';

export class ChatApiService {
  private url: string;
  private model: string;
  private ollama: Ollama;

  constructor(url: string, model: string) {
    this.url = url;
    this.model = model;
    this.ollama = new Ollama({ host: url });
    console.log('in constructor creating ollama client...');
  }

  public async chat(
    request: ChatApiRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const response = await this.ollama.chat({
      model: request.model,
      messages: request.messages,
      stream: true,
    });
    for await (const part of response) {
      const token = part.message.content;
      if (onTokenReceived) {
        onTokenReceived(token);
      }
    }
  }
}
