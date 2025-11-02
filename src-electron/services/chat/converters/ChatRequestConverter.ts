import type { ChatApiRequest } from "../interfaces/ChatMessage.js";
import type { ChatRequest } from "ollama";


// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ChatRequestConverter {
    private constructor() {}

    static toOllamaRequest(apiReq: ChatApiRequest): ChatRequest {
      return {
        model: apiReq.model,
        messages: apiReq.messages.map(m => ({ role: m.role, content: m.content }))
      };
    }
  }