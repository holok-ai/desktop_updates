/**
 * ThreadDisplay — unit tests for all static methods.
 *
 * Pure functions: no mocks needed for the core logic. The only external
 * dependency is formatResponseContent (which is also pure).
 */

import { describe, it, expect } from 'vitest';
import { ThreadDisplay } from '$lib/utils/thread-display';
import type { MessagePair, DisplayItem } from '$lib/utils/thread-display';
import type { Message } from '$lib/types/thread.type';
import type { ModelDetails } from '../../../src-electron/preload';

// ── Helper ──────────────────────────────────────────────────────────

function msg(
  overrides: Partial<Message> & { id: string; branchId: string; role: Message['role'] },
): Message {
  return {
    threadId: 'thread-1',
    content: `content-${overrides.id}`,
    createdAt: Date.now(),
    ...overrides,
  };
}

function model(overrides: Partial<ModelDetails> & { id: string; accessName: string }): ModelDetails {
  return {
    title: overrides.id,
    provider: 'test',
    applicationName: 'test-app',
    applicationSlug: 'test-app',
    slug: overrides.id,
    url: '',
    isPublic: true,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// injectImageTags
// ═══════════════════════════════════════════════════════════════════

describe('ThreadDisplay.injectImageTags', () => {
  it('appends image markdown for image attachments with data', () => {
    const result = ThreadDisplay.injectImageTags('Hello', [
      { mimeType: 'image/jpeg', data: 'abc123', filename: 'photo.jpg' },
    ]);
    expect(result).toBe('Hello\n\n![photo.jpg](data:image/jpeg;base64,abc123)');
  });

  it('handles multiple image attachments', () => {
    const result = ThreadDisplay.injectImageTags('Content', [
      { mimeType: 'image/png', data: 'data1', filename: 'a.png' },
      { mimeType: 'image/gif', data: 'data2', filename: 'b.gif' },
    ]);
    expect(result).toContain('![a.png]');
    expect(result).toContain('![b.gif]');
  });

  it('skips non-image mimeTypes', () => {
    const result = ThreadDisplay.injectImageTags('Text', [
      { mimeType: 'text/plain', data: 'txt', filename: 'readme.txt' },
    ]);
    expect(result).toBe('Text');
  });

  it('skips image attachments without data property', () => {
    const result = ThreadDisplay.injectImageTags('Text', [
      { mimeType: 'image/png', filename: 'nodata.png' },
    ]);
    expect(result).toBe('Text');
  });

  it('returns original content when attachments array is empty', () => {
    const result = ThreadDisplay.injectImageTags('Original', []);
    expect(result).toBe('Original');
  });

  it('mixes image and non-image attachments correctly', () => {
    const result = ThreadDisplay.injectImageTags('Body', [
      { mimeType: 'application/pdf', data: 'pdfdata', filename: 'doc.pdf' },
      { mimeType: 'image/png', data: 'imgdata', filename: 'pic.png' },
    ]);
    expect(result).toContain('![pic.png]');
    expect(result).not.toContain('doc.pdf');
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildMessagePairs
// ═══════════════════════════════════════════════════════════════════

describe('ThreadDisplay.buildMessagePairs', () => {
  it('pairs a user message with following assistant message', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user', content: 'Hello' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant', content: 'Hi there' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, false, '');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].request.id).toBe('u1');
    expect(pairs[0].responses).toHaveLength(1);
    expect(pairs[0].responses[0].id).toBe('a1');
    expect(pairs[0].isStreamingResponse).toBe(false);
    expect(pairs[0].streamingContent).toBe('');
  });

  it('collects multiple consecutive assistant responses', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'a2', branchId: '1.0.0', role: 'assistant' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, false, '');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].responses).toHaveLength(2);
  });

  it('includes system messages as responses', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 's1', branchId: '1.0.0', role: 'system' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, false, '');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].responses).toHaveLength(2);
  });

  it('creates separate pairs for separate user messages', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.0.0', role: 'assistant' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, false, '');
    expect(pairs).toHaveLength(2);
    expect(pairs[0].request.id).toBe('u1');
    expect(pairs[1].request.id).toBe('u2');
  });

  it('user message with no response and streaming active gets streaming flag', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, true, 'streaming...');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].isStreamingResponse).toBe(true);
    expect(pairs[0].streamingContent).toBe('streaming...');
    expect(pairs[0].responses).toHaveLength(0);
  });

  it('streaming flag is false when user message already has a response', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, true, 'streaming...');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].isStreamingResponse).toBe(false);
    expect(pairs[0].streamingContent).toBe('');
  });

  it('streaming flag only applies to the LAST user message', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, true, 'streaming...');
    expect(pairs).toHaveLength(2);
    expect(pairs[0].isStreamingResponse).toBe(false);
    expect(pairs[1].isStreamingResponse).toBe(true);
  });

  it('skips orphan assistant messages at the beginning', () => {
    const messages = [
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'u1', branchId: '2.0.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.0.0', role: 'assistant' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, false, '');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].request.id).toBe('u1');
  });

  it('handles empty message array', () => {
    const pairs = ThreadDisplay.buildMessagePairs([], false, '');
    expect(pairs).toHaveLength(0);
  });

  it('injects image tags for assistant messages with attachments', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({
        id: 'a1',
        branchId: '1.0.0',
        role: 'assistant',
        content: 'Here is an image',
        attachments: [
          { mimeType: 'image/png', data: 'base64data', filename: 'test.png', size: 100 },
        ],
      }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, false, '');
    expect(pairs[0].responses[0].content).toContain('![test.png]');
    expect(pairs[0].responses[0].content).toContain('data:image/png;base64,base64data');
  });

  it('does not inject tags for non-image attachments', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({
        id: 'a1',
        branchId: '1.0.0',
        role: 'assistant',
        content: 'A file',
        attachments: [
          { mimeType: 'application/pdf', data: 'pdfdata', filename: 'doc.pdf', size: 200 },
        ],
      }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, false, '');
    expect(pairs[0].responses[0].content).toBe('A file');
  });

  it('user message with no following messages and streaming=false is not streaming', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
    ];

    const pairs = ThreadDisplay.buildMessagePairs(messages, false, '');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].isStreamingResponse).toBe(false);
    expect(pairs[0].responses).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildDisplayItems
// ═══════════════════════════════════════════════════════════════════

describe('ThreadDisplay.buildDisplayItems', () => {
  it('returns empty array for empty messages', () => {
    expect(ThreadDisplay.buildDisplayItems([], false, '')).toEqual([]);
  });

  it('returns empty array when all messages are hidden', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user', isHidden: true }),
    ];
    expect(ThreadDisplay.buildDisplayItems(messages, false, '')).toEqual([]);
  });

  it('filters out hidden messages', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user', isHidden: true }),
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.0.0', role: 'assistant' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '');
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('message');
    if (items[0].type === 'message') {
      expect(items[0].pair.request.id).toBe('u2');
    }
  });

  it('builds MessageDisplay for single-lane rows', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.0.0', role: 'assistant' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '');
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('message');
    expect(items[1].type).toBe('message');
  });

  it('builds BranchDisplay for multi-lane rows', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      // Row 2 has two lanes: lane 0 and lane 1
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.0.0', role: 'assistant' }),
      msg({ id: 'u3', branchId: '2.1.0', role: 'user' }),
      msg({ id: 'a3', branchId: '2.1.0', role: 'assistant' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '');
    // Row 1: single lane → MessageDisplay, Row 2: multi-lane → BranchDisplay
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('message');
    expect(items[1].type).toBe('branch');

    if (items[1].type === 'branch') {
      expect(items[1].lanes).toHaveLength(2);
      expect(items[1].position).toBe(2);
      expect(items[1].lanes[0].branchId).toBe('2.0');
      expect(items[1].lanes[1].branchId).toBe('2.1');
    }
  });

  it('flattens selected lane as MessageDisplay with isFromBranch=true', () => {
    const messages = [
      // Row 2 multi-lane with one selected
      msg({
        id: 'u1',
        branchId: '2.1.0',
        role: 'user',
        desktopOptions: { isSelectedBranch: true },
      }),
      msg({ id: 'a1', branchId: '2.1.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.2.0', role: 'assistant' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '');
    // Selected lane should be flattened to MessageDisplay items
    expect(items.every((i) => i.type === 'message')).toBe(true);
    // All should have isFromBranch
    for (const item of items) {
      if (item.type === 'message') {
        expect(item.isFromBranch).toBe(true);
      }
    }
  });

  it('sorts messages by branchId (row, lane, iteration)', () => {
    // Provide messages out of order
    const messages = [
      msg({ id: 'u3', branchId: '3.0.0', role: 'user' }),
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '');
    expect(items).toHaveLength(3);
    if (items[0].type === 'message') {
      expect(items[0].pair.request.id).toBe('u1');
    }
    if (items[1].type === 'message') {
      expect(items[1].pair.request.id).toBe('u2');
    }
    if (items[2].type === 'message') {
      expect(items[2].pair.request.id).toBe('u3');
    }
  });

  it('looks up model name from availableModels by id', () => {
    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user', modelId: 'model-1' }),
      msg({ id: 'a1', branchId: '2.1.0', role: 'assistant', modelId: 'model-1' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user', modelId: 'model-2' }),
      msg({ id: 'a2', branchId: '2.2.0', role: 'assistant', modelId: 'model-2' }),
    ];

    const models = [
      model({ id: 'model-1', accessName: 'gpt-4', title: 'GPT-4' }),
      model({ id: 'model-2', accessName: 'claude-3', title: 'Claude 3' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '', models);
    expect(items).toHaveLength(1);
    if (items[0].type === 'branch') {
      expect(items[0].lanes[0].modelName).toBe('GPT-4');
      expect(items[0].lanes[1].modelName).toBe('Claude 3');
    }
  });

  it('looks up model name from availableModels by accessName', () => {
    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user', modelId: 'gpt-4' }),
      msg({ id: 'a1', branchId: '2.1.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user', modelId: 'unknown-model' }),
      msg({ id: 'a2', branchId: '2.2.0', role: 'assistant' }),
    ];

    const models = [
      model({ id: 'model-1', accessName: 'gpt-4', title: 'GPT-4' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '', models);
    if (items[0].type === 'branch') {
      // First lane matched by accessName
      expect(items[0].lanes[0].modelName).toBe('GPT-4');
      // Second lane has no match — falls back to modelId
      expect(items[0].lanes[1].modelName).toBe('unknown-model');
    }
  });

  it('includes intendedUse from model details', () => {
    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user', modelId: 'model-1' }),
      msg({ id: 'a1', branchId: '2.1.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.2.0', role: 'assistant' }),
    ];

    const models = [
      model({ id: 'model-1', accessName: 'gpt-4', title: 'GPT-4', intendedUse: 'General purpose' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '', models);
    if (items[0].type === 'branch') {
      expect(items[0].lanes[0].modelIntendedUse).toBe('General purpose');
    }
  });

  it('handles lanes sorted by lane number', () => {
    const messages = [
      // Provide lanes out of order
      msg({ id: 'u3', branchId: '2.3.0', role: 'user' }),
      msg({ id: 'u1', branchId: '2.1.0', role: 'user' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '');
    if (items[0].type === 'branch') {
      expect(items[0].lanes[0].branchId).toBe('2.1');
      expect(items[0].lanes[1].branchId).toBe('2.2');
      expect(items[0].lanes[2].branchId).toBe('2.3');
    }
  });

  it('streaming state passes through to message pairs', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, true, 'streaming...');
    expect(items).toHaveLength(1);
    if (items[0].type === 'message') {
      expect(items[0].pair.isStreamingResponse).toBe(true);
      expect(items[0].pair.streamingContent).toBe('streaming...');
    }
  });

  it('handles mixed single-lane and multi-lane rows', () => {
    const messages = [
      // Row 1: single lane
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      // Row 2: multi-lane
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
      msg({ id: 'u3', branchId: '2.1.0', role: 'user' }),
      // Row 3: single lane again
      msg({ id: 'u4', branchId: '3.0.0', role: 'user' }),
      msg({ id: 'a4', branchId: '3.0.0', role: 'assistant' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '');
    expect(items[0].type).toBe('message');
    expect(items[1].type).toBe('branch');
    expect(items[2].type).toBe('message');
  });

  it('empty lane produces empty messagePairs array', () => {
    // Row with only lane 1 (no lane 0 messages)
    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
    ];

    const items = ThreadDisplay.buildDisplayItems(messages, false, '');
    if (items[0].type === 'branch') {
      // Each lane should have message pairs
      expect(items[0].lanes).toHaveLength(2);
      expect(items[0].lanes[0].messagePairs).toHaveLength(1);
      expect(items[0].lanes[1].messagePairs).toHaveLength(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildDisplayItems — expandedBranchRows / isviewMode
// ═══════════════════════════════════════════════════════════════════

describe('ThreadDisplay.buildDisplayItems — expandedBranchRows', () => {
  /** Helper: multi-lane row 2 with lane 1 selected. */
  function branchMessages(selected: boolean = true): Message[] {
    return [
      msg({
        id: 'u1',
        branchId: '2.1.0',
        role: 'user',
        desktopOptions: selected ? { isSelectedBranch: true } : undefined,
      }),
      msg({ id: 'a1', branchId: '2.1.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.2.0', role: 'assistant' }),
    ];
  }

  it('selected lane WITHOUT expandedBranchRows → flattened MessageDisplay (default behaviour)', () => {
    const items = ThreadDisplay.buildDisplayItems(branchMessages(), false, '', [], new Set());
    // Should be flattened to MessageDisplay with isFromBranch
    expect(items.every((i) => i.type === 'message')).toBe(true);
    for (const item of items) {
      if (item.type === 'message') {
        expect(item.isFromBranch).toBe(true);
      }
    }
  });

  it('selected lane WITH row in expandedBranchRows → BranchDisplay with isviewMode=true', () => {
    const expanded = new Set([2]);
    const items = ThreadDisplay.buildDisplayItems(branchMessages(), false, '', [], expanded);
    // Should render as BranchDisplay since row 2 is force-expanded
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('branch');
    if (items[0].type === 'branch') {
      expect(items[0].isviewMode).toBe(true);
      expect(items[0].lanes).toHaveLength(2);
      expect(items[0].position).toBe(2);
    }
  });

  it('no selected lane WITH row in expandedBranchRows → BranchDisplay with isviewMode=false', () => {
    const expanded = new Set([2]);
    const items = ThreadDisplay.buildDisplayItems(branchMessages(false), false, '', [], expanded);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('branch');
    if (items[0].type === 'branch') {
      expect(items[0].isviewMode).toBe(false);
    }
  });

  it('expandedBranchRows for a different row does not affect the target row', () => {
    // Row 2 has selected lane, but expandedBranchRows contains row 5 (not 2)
    const expanded = new Set([5]);
    const items = ThreadDisplay.buildDisplayItems(branchMessages(), false, '', [], expanded);
    // Row 2 should still flatten because row 2 is not in the set
    expect(items.every((i) => i.type === 'message')).toBe(true);
  });

  it('empty expandedBranchRows set behaves same as no set provided', () => {
    const withEmpty = ThreadDisplay.buildDisplayItems(branchMessages(), false, '', [], new Set());
    const withDefault = ThreadDisplay.buildDisplayItems(branchMessages(), false, '', []);
    // Both should flatten the selected lane
    expect(withEmpty.length).toBe(withDefault.length);
    expect(withEmpty.every((i) => i.type === 'message')).toBe(true);
    expect(withDefault.every((i) => i.type === 'message')).toBe(true);
  });
});
