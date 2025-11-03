import { describe, it, expect } from 'vitest';

import {
  makeChatMessage,
  isChatMessage,
} from '../../../src-electron/services/chat/interfaces/ChatMessage';

describe('ChatMessage interface runtime helpers', () => {
  it('makeChatMessage returns object with role and content', () => {
    const m = makeChatMessage('user', 'hello');
    expect(m.role).toBe('user');
    expect(m.content).toBe('hello');
  });

  it('isChatMessage recognizes valid messages and rejects invalid', () => {
    const good = { role: 'assistant', content: 'ok' };
    const bad1 = { role: 'assistant' };
    const bad2 = null;
    expect(isChatMessage(good)).toBe(true);
    expect(isChatMessage(bad1)).toBe(false);
    expect(isChatMessage(bad2)).toBe(false);
  });
});
