import { describe, it, expect } from 'vitest';

import {
  isIChatProvider,
  makeMockProvider,
} from '../../../src-electron/services/chat/interfaces/IChatProvider';

describe('IChatProvider runtime helpers', () => {
  it('isIChatProvider recognizes proper shape', () => {
    const p = makeMockProvider();
    expect(isIChatProvider(p)).toBe(true);
    expect(isIChatProvider(null)).toBe(false);
    expect(isIChatProvider({})).toBe(false);
  });

  it('makeMockProvider streams tokens via callbacks', async () => {
    const p = makeMockProvider(['a', 'b']);
    const received: string[] = [];
    await p.chat({ model: 'm', messages: [] }, (t) => received.push(t));
    expect(received).toEqual(['a', 'b']);

    const received2: string[] = [];
    await p.chatWithOptions({ model: 'm', messages: [], options: {} }, (t) => received2.push(t));
    expect(received2).toEqual(['a_opt', 'b_opt']);
  });
});
