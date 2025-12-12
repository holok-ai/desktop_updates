import type { ChatApiRequest } from '../interfaces/ChatMessage.js';
import type { ChatRequest } from 'ollama';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ChatRequestConverter {
  private constructor() {}

  private static extractThreadId(request: ChatApiRequest): string | undefined {
    const threadId = (request as { thread_id?: string }).thread_id;
    if (typeof threadId === 'string' && threadId.length > 0) {
      return threadId;
    }

    return undefined;
  }

  static toOllamaRequest(apiReq: ChatApiRequest): ChatRequest {
    const threadId = this.extractThreadId(apiReq);
    return {
      model: apiReq.model,
      messages: apiReq.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(threadId ? { thread_id: threadId } : {}),
    };
  }
}
