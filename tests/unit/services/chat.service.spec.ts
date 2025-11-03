import { describe, it, expect, beforeEach } from 'vitest';
import { ChatService } from '../../../src-electron/services/chat/ChatService';
import type { ChatRequest } from '../../../src-electron/services/chat/interfaces/ChatMessage';

describe('ChatService (unit)', () => {
  let service: ChatService;

  beforeEach(() => {
    // Initialize ChatService with local Ollama llama3 model
    service = new ChatService(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'ollama',
        model: 'llama3:latest'
      },
      false // Disable audit for testing
    );
  });

  it('should create ChatService instance', () => {
    expect(service).toBeDefined();
  });

  it('should send a basic chat request and receive streaming response', async () => {
    const request: ChatRequest = {
      messages: [
        { role: 'user', content: 'Say "hello" and nothing else.' }
      ],
      streaming: true,
      model: 'llama3:latest'
    };

    let receivedTokens = '';
    const onTokenReceived = (token: string): void => {
      receivedTokens += token;
    };

    await service.chat(request, onTokenReceived);

    expect(receivedTokens.length).toBeGreaterThan(0);
    expect(receivedTokens.toLowerCase()).toContain('hello');
  }, 30000);

  it('should send a chat request with options', async () => {
    const request = {
      messages: [
        { role: 'user', content: 'Reply with just the number 5.' }
      ],
      streaming: true,
      model: 'llama3:latest',
      options: {
        temperature: 0.1,
        maxTokens: 10
      }
    };

    let receivedTokens = '';
    const onTokenReceived = (token: string): void => {
      receivedTokens += token;
    };

    await service.chatWithOptions(request, onTokenReceived);

    expect(receivedTokens.length).toBeGreaterThan(0);
  }, 30000);

  it('should get audit logs when audit is enabled', () => {
    const serviceWithAudit = new ChatService(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'ollama',
        model: 'llama3:latest'
      },
      true // Enable audit
    );

    const logs = serviceWithAudit.getAuditLogs();
    expect(logs).toBeDefined();
  });
});
