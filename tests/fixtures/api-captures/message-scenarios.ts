/**
 * Typed scenario builders for MessageDTO test data.
 *
 * These produce MessageDTO[] arrays representing specific API scenarios.
 * Use for edge cases that are hard to capture from live data, or as
 * quick inline alternatives to JSON fixture files.
 *
 * Every builder returns data shaped exactly like getMessages().data.content.
 */
import type { MessageDTO, LLMStatus } from 'src-electron/services/mokuapi/thread.types';

// ── Base factory ────────────────────────────────────────────────────

let _seq = 0;

export function fakeMessageDTO(overrides: Partial<MessageDTO> = {}): MessageDTO {
  _seq++;
  return {
    id: `msg-${_seq}`,
    threadId: 'thread-1',
    branchId: '1.0.0',
    model: 'gpt-4',
    provider: 'openai',
    role: 'user',
    content: 'Hello',
    rawData: null,
    status: null,
    options: null,
    createdUserId: 'user-1',
    createdAt: `2025-06-01T00:00:${String(_seq).padStart(2, '0')}Z`,
    updatedAt: `2025-06-01T00:00:${String(_seq).padStart(2, '0')}Z`,
    ...overrides,
  };
}

/** Reset the auto-incrementing sequence (call in beforeEach). */
export function resetSequence(): void {
  _seq = 0;
}

// ── Successful turns ────────────────────────────────────────────────

/** A complete user → assistant turn with success status. */
export function successfulTurn(overrides?: {
  userContent?: string;
  assistantContent?: string;
  provider?: string;
  model?: string;
  rawData?: unknown;
  branchId?: string;
}): MessageDTO[] {
  const branch = overrides?.branchId ?? '1.0.0';
  return [
    fakeMessageDTO({
      role: 'user',
      content: overrides?.userContent ?? 'Hello, how are you?',
      branchId: branch,
      provider: overrides?.provider ?? 'openai',
      model: overrides?.model ?? 'gpt-4',
    }),
    fakeMessageDTO({
      role: 'assistant',
      content: overrides?.assistantContent ?? 'I am doing well, thank you for asking!',
      branchId: branch,
      provider: overrides?.provider ?? 'openai',
      model: overrides?.model ?? 'gpt-4',
      status: 'success' as LLMStatus,
      rawData: overrides?.rawData ?? null,
    }),
  ];
}

/** Multi-turn conversation: 3 user→assistant pairs. */
export function multiTurnConversation(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'What is TypeScript?' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'TypeScript is a typed superset of JavaScript.',
      status: 'success',
    }),
    fakeMessageDTO({ role: 'user', content: 'How does it compare to Flow?' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'Both add types, but TypeScript has broader adoption.',
      status: 'success',
    }),
    fakeMessageDTO({ role: 'user', content: 'Thanks!' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'You are welcome!',
      status: 'success',
    }),
  ];
}

// ── Guard scenarios ─────────────────────────────────────────────────

/** Guard passed — content is JSON with { response: { passed: true } }. Should NOT be hidden. */
export function guardPassedTurn(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Benign request' }),
    fakeMessageDTO({
      role: 'assistant',
      content: JSON.stringify({ response: { passed: true } }),
      status: 'success',
    }),
  ];
}

/** Guard blocked — { response: { passed: false, reason } }. Should hide BOTH messages. */
export function guardBlockedTurn(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Blocked request' }),
    fakeMessageDTO({
      role: 'assistant',
      content: JSON.stringify({
        response: { passed: false, reason: 'Content policy violation' },
      }),
      status: 'success',
    }),
  ];
}

/** Guard response where the inner response is a JSON string (double-encoded). */
export function guardDoubleEncodedTurn(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Double encoded guard' }),
    fakeMessageDTO({
      role: 'assistant',
      content: JSON.stringify({
        response: JSON.stringify({ passed: false, reason: 'policy' }),
      }),
      status: 'success',
    }),
  ];
}

// ── Error scenarios ─────────────────────────────────────────────────

/**
 * Error payload in the response content.
 * Shape: { type: "error", status: 400, requestId, seq, error }.
 */
export function errorPayloadResponse(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Trigger an error' }),
    fakeMessageDTO({
      role: 'assistant',
      content: JSON.stringify({
        type: 'error',
        status: 400,
        requestId: 'req-abc-123',
        seq: 1,
        error: 'Invalid model specified',
      }),
      status: 'error',
    }),
  ];
}

/** Message with LLMStatus = 'timeout'. */
export function timeoutResponse(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Slow request' }),
    fakeMessageDTO({
      role: 'assistant',
      content: '',
      status: 'timeout' as LLMStatus,
      rawData: null,
    }),
  ];
}

/** Message with LLMStatus = 'rate_limited'. */
export function rateLimitedResponse(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Rate limited request' }),
    fakeMessageDTO({
      role: 'assistant',
      content: '',
      status: 'rate_limited' as LLMStatus,
      rawData: null,
    }),
  ];
}

/** Message with LLMStatus = 'invalid_request'. */
export function invalidRequestResponse(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Bad params' }),
    fakeMessageDTO({
      role: 'assistant',
      content: '',
      status: 'invalid_request' as LLMStatus,
      rawData: null,
    }),
  ];
}

// ── Edge cases ──────────────────────────────────────────────────────

/** Orphan assistant message with no preceding user on same branch. */
export function orphanAssistant(): MessageDTO[] {
  return [
    fakeMessageDTO({
      role: 'assistant',
      content: 'I appeared without a prompt',
      branchId: '2.0.0',
      status: 'success',
    }),
  ];
}

/** Duplicate audit records from tool-loop continuation. */
export function duplicateAuditRecords(): MessageDTO[] {
  const ts = '2025-06-01T00:01:00Z';
  return [
    fakeMessageDTO({ role: 'user', content: 'Run the command', branchId: '1.0.0' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'Done running.',
      branchId: '1.0.0',
      status: 'success',
      createdAt: ts,
      updatedAt: ts,
    }),
    // Duplicate with later timestamp — should be filtered out
    fakeMessageDTO({
      role: 'assistant',
      content: 'Done running.',
      branchId: '1.0.0',
      status: 'success',
      createdAt: '2025-06-01T00:02:00Z',
      updatedAt: '2025-06-01T00:02:00Z',
    }),
  ];
}

/** Assistant with empty content but non-empty rawData → content becomes "empty". */
export function emptyContentWithRawData(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Trigger tool use' }),
    fakeMessageDTO({
      role: 'assistant',
      content: '',
      rawData: { tool_use: { name: 'read_file', input: { path: '/tmp/test.txt' } } },
      status: 'success',
    }),
  ];
}

/** Assistant message with null branchId — should default to 1.0.0. */
export function nullBranchId(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Hello', branchId: null }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'Hi',
      branchId: null,
      status: 'success',
    }),
  ];
}

/** Messages with 2-part branchId — should normalize to 3-part. */
export function twoPartBranchId(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Hello', branchId: '2.1' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'Hi',
      branchId: '2.1',
      status: 'success',
    }),
  ];
}

/** Messages with >3-part branchId — should truncate to 3 parts. */
export function overLongBranchId(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Hello', branchId: '1.2.3.4.5' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'Hi',
      branchId: '1.2.3.4.5',
      status: 'success',
    }),
  ];
}

// ── Malformed data ──────────────────────────────────────────────────

/** Content is a nested JSON object instead of a string. */
export function contentAsObject(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Hello' }),
    fakeMessageDTO({
      role: 'assistant',
      content: { text: 'This is an object, not a string' } as unknown as string,
      status: 'success',
    }),
  ];
}

/** Content is null. */
export function nullContent(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Hello' }),
    fakeMessageDTO({
      role: 'assistant',
      content: null as unknown as string,
      status: 'success',
    }),
  ];
}

/** Role is null. */
export function nullRole(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: null as unknown as string, content: 'Hello' }),
  ];
}

// ── Tool call scenarios ─────────────────────────────────────────────

/** Assistant response with tool call data in rawData. */
export function toolCallInRawData(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Read the file /tmp/hello.txt' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'Here is the file content.',
      status: 'success',
      rawData: {
        tool_calls: [
          {
            id: 'call_abc123',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: '{"path":"/tmp/hello.txt"}',
            },
          },
        ],
        tool_results: [
          {
            tool_call_id: 'call_abc123',
            success: true,
            content: 'Hello, world!',
          },
        ],
      },
    }),
  ];
}

// ── Desktop options scenarios ───────────────────────────────────────

/** Message with desktopOptions including wasBlockedByGuard. */
export function desktopOptionsBlocked(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Blocked by guard via options' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'Blocked response',
      status: 'success',
      options: {
        desktop_options: {
          wasBlockedByGuard: true,
          guardBlockReason: 'Content policy',
          guardBlockedAt: '2025-06-01T00:00:10Z',
        },
      },
    }),
  ];
}

/** Message with desktopOptions isSelectedBranch. */
export function desktopOptionsSelectedBranch(): MessageDTO[] {
  return [
    fakeMessageDTO({ role: 'user', content: 'Branch selection test' }),
    fakeMessageDTO({
      role: 'assistant',
      content: 'Selected branch response',
      status: 'success',
      options: {
        desktop_options: {
          isSelectedBranch: true,
        },
      },
    }),
  ];
}
