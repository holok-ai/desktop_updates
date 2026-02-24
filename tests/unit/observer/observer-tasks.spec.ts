import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { renameTitleTask } from '$lib/observer/tasks/rename-title';
import { compressContextTask } from '$lib/observer/tasks/compress-context';
import { suggestPromptTask } from '$lib/observer/tasks/suggest-prompt';
import { observerStore, getSuggestion } from '$lib/observer/observer.store';
import { ObserverTaskType } from '../../../src-shared/types/observer.types';
import type { ObserverThread } from '$lib/observer/observer-task.interface';
import type { Message } from '$lib/types/thread.type';

// Helper to create a minimal thread
function makeThread(overrides: Partial<ObserverThread> = {}): ObserverThread {
  return {
    id: 'thread-1',
    title: '',
    messages: [],
    ...overrides,
  };
}

// Helper to create a minimal message
function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    branchId: '1.0.0',
    role: 'user',
    content: 'Hello',
    createdAt: Date.now(),
    guardExecution: 'none',
    guardMessageId: null,
    guardError: '',
    ...overrides,
  };
}

describe('Observer Tasks', () => {
  beforeEach(() => {
    observerStore.reset();
  });

  describe('renameTitleTask', () => {
    it('should have correct taskType', () => {
      expect(renameTitleTask.taskType).toBe(ObserverTaskType.RenameTitle);
    });

    it('should have autoTitleEnabled as settingKey', () => {
      expect(renameTitleTask.settingKey).toBe('autoTitleEnabled');
    });

    describe('shouldRun', () => {
      it('should return true when thread has no title and has assistant message', () => {
        const thread = makeThread({ title: '' });
        const messages = [
          makeMessage({ role: 'user', content: 'Hi' }),
          makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hello!' }),
        ];
        expect(renameTitleTask.shouldRun(thread, messages)).toBe(true);
      });

      it('should return false when thread already has a title', () => {
        const thread = makeThread({ title: 'My Chat' });
        const messages = [
          makeMessage({ role: 'user', content: 'Hi' }),
          makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hello!' }),
        ];
        expect(renameTitleTask.shouldRun(thread, messages)).toBe(false);
      });

      it('should return false when no assistant messages exist', () => {
        const thread = makeThread({ title: '' });
        const messages = [makeMessage({ role: 'user', content: 'Hi' })];
        expect(renameTitleTask.shouldRun(thread, messages)).toBe(false);
      });
    });

    describe('buildRequest', () => {
      it('should build a request with first 4 messages', () => {
        const thread = makeThread();
        const messages = [
          makeMessage({ role: 'user', content: 'Hi' }),
          makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hello!' }),
          makeMessage({ id: 'msg-3', role: 'user', content: 'How are you?' }),
          makeMessage({ id: 'msg-4', role: 'assistant', content: 'Good!' }),
          makeMessage({ id: 'msg-5', role: 'user', content: 'Extra message' }),
        ];

        const request = renameTitleTask.buildRequest(thread, messages);

        expect(request.taskType).toBe(ObserverTaskType.RenameTitle);
        expect(request.threadId).toBe('thread-1');
        expect(request.messages).toHaveLength(4); // Only first 4
        expect(request.maxTokens).toBe(60);
        expect(request.temperature).toBe(0.7);
        expect(request.system).toContain('title');
      });
    });

    describe('onResult', () => {
      it('should store the title suggestion in the observer store', () => {
        const thread = makeThread();
        renameTitleTask.onResult(thread, '  My New Title  ');
        expect(get(getSuggestion)('thread-1', ObserverTaskType.RenameTitle)).toBe('My New Title');
      });

      it('should strip quotes from the title', () => {
        const thread = makeThread();
        renameTitleTask.onResult(thread, '"Quoted Title"');
        expect(get(getSuggestion)('thread-1', ObserverTaskType.RenameTitle)).toBe('Quoted Title');
      });
    });
  });

  describe('compressContextTask', () => {
    it('should have correct taskType', () => {
      expect(compressContextTask.taskType).toBe(ObserverTaskType.CompressContext);
    });

    describe('shouldRun', () => {
      it('should return false when thread has no maxModelTokens', () => {
        const thread = makeThread();
        const messages = Array.from({ length: 15 }, (_, i) =>
          makeMessage({ id: `msg-${i}`, role: i % 2 === 0 ? 'user' : 'assistant' }),
        );
        expect(compressContextTask.shouldRun(thread, messages)).toBe(false);
      });

      it('should return false when messages have no token counts', () => {
        const thread = makeThread();
        // Add maxModelTokens to the thread (future property)
        (thread as any).maxModelTokens = 4096;
        const messages = [makeMessage()];
        expect(compressContextTask.shouldRun(thread, messages)).toBe(false);
      });

      it('should return true when total tokens exceed 75% threshold', () => {
        const thread = makeThread();
        (thread as any).maxModelTokens = 4096;
        const messages = [
          { ...makeMessage({ id: 'msg-1' }), tokens: 2000 },
          { ...makeMessage({ id: 'msg-2' }), tokens: 1100 },
        ] as any[];
        // Total: 3100, threshold: 4096 * 0.75 = 3072
        expect(compressContextTask.shouldRun(thread, messages)).toBe(true);
      });

      it('should return false when total tokens below 75% threshold', () => {
        const thread = makeThread();
        (thread as any).maxModelTokens = 4096;
        const messages = [
          { ...makeMessage({ id: 'msg-1' }), tokens: 1000 },
          { ...makeMessage({ id: 'msg-2' }), tokens: 1000 },
        ] as any[];
        // Total: 2000, threshold: 3072
        expect(compressContextTask.shouldRun(thread, messages)).toBe(false);
      });
    });

    describe('buildRequest', () => {
      it('should build a request with JSON response format', () => {
        const thread = makeThread();
        const messages = [makeMessage()];

        const request = compressContextTask.buildRequest(thread, messages);

        expect(request.taskType).toBe(ObserverTaskType.CompressContext);
        expect(request.maxTokens).toBe(500);
        expect(request.temperature).toBe(0.3);
        expect(request.responseFormat).toEqual({ type: 'json_object' });
      });
    });

    describe('onResult', () => {
      it('should store parsed context summary', () => {
        const thread = makeThread();
        const jsonResponse = JSON.stringify({
          summary: 'A conversation about coding',
          keyTopics: ['TypeScript', 'testing'],
        });

        compressContextTask.onResult(thread, jsonResponse);

        let state: any;
        const unsub = observerStore.subscribe((s) => {
          state = s;
        });
        expect(state.contextSummaries.get('thread-1')).toEqual({
          summary: 'A conversation about coding',
          keyTopics: ['TypeScript', 'testing'],
        });
        unsub();
      });

      it('should silently ignore invalid JSON', () => {
        const thread = makeThread();
        // Should not throw
        compressContextTask.onResult(thread, 'not valid json');
      });
    });
  });

  describe('suggestPromptTask', () => {
    it('should have correct taskType', () => {
      expect(suggestPromptTask.taskType).toBe(ObserverTaskType.SuggestPrompt);
    });

    describe('shouldRun', () => {
      it('should return true with 2+ exchanges and long last user message', () => {
        const thread = makeThread();
        const longContent = 'x'.repeat(250);
        const messages = [
          makeMessage({ id: 'msg-1', role: 'user', content: 'Hi' }),
          makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hello!' }),
          makeMessage({ id: 'msg-3', role: 'user', content: 'More' }),
          makeMessage({ id: 'msg-4', role: 'assistant', content: 'Response' }),
          makeMessage({ id: 'msg-5', role: 'user', content: longContent }),
        ];
        expect(suggestPromptTask.shouldRun(thread, messages)).toBe(true);
      });

      it('should return false with fewer than 2 exchanges', () => {
        const thread = makeThread();
        const longContent = 'x'.repeat(250);
        const messages = [
          makeMessage({ id: 'msg-1', role: 'user', content: longContent }),
          makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hello!' }),
        ];
        expect(suggestPromptTask.shouldRun(thread, messages)).toBe(false);
      });

      it('should return false with short last user message', () => {
        const thread = makeThread();
        const messages = [
          makeMessage({ id: 'msg-1', role: 'user', content: 'Hi' }),
          makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hello!' }),
          makeMessage({ id: 'msg-3', role: 'user', content: 'More' }),
          makeMessage({ id: 'msg-4', role: 'assistant', content: 'Response' }),
          makeMessage({ id: 'msg-5', role: 'user', content: 'Short' }),
        ];
        expect(suggestPromptTask.shouldRun(thread, messages)).toBe(false);
      });
    });

    describe('buildRequest', () => {
      it('should build a request with last 4 messages + rephrase prompt', () => {
        const thread = makeThread();
        const messages = [
          makeMessage({ id: 'msg-1', role: 'user', content: 'First' }),
          makeMessage({ id: 'msg-2', role: 'assistant', content: 'Second' }),
          makeMessage({ id: 'msg-3', role: 'user', content: 'Third' }),
          makeMessage({ id: 'msg-4', role: 'assistant', content: 'Fourth' }),
          makeMessage({ id: 'msg-5', role: 'user', content: 'Fifth question' }),
        ];

        const request = suggestPromptTask.buildRequest(thread, messages);

        expect(request.taskType).toBe(ObserverTaskType.SuggestPrompt);
        expect(request.maxTokens).toBe(300);
        expect(request.temperature).toBe(0.5);
        // Should include last 4 messages + the rephrase instruction
        expect(request.messages.length).toBe(5); // 4 slice + 1 rephrase
        expect(request.messages[request.messages.length - 1].content).toContain('Fifth question');
      });
    });

    describe('onResult', () => {
      it('should store the suggestion in the observer store', () => {
        const thread = makeThread();
        suggestPromptTask.onResult(thread, '  Better phrased question  ');
        expect(get(getSuggestion)('thread-1', ObserverTaskType.SuggestPrompt)).toBe(
          'Better phrased question',
        );
      });
    });
  });
});
