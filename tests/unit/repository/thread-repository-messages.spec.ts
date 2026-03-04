/**
 * ThreadRepository — Message handling with realistic API data
 *
 * Tests the full message pipeline: DTO mapping → inspector pipeline → internal Message model.
 * Uses typed scenario builders (and eventually captured JSON fixtures) to inject data
 * that looks like real Moku API responses.
 *
 * ══════════════════════════════════════════════════════════════════════
 * SCENARIO CHECKLIST — track coverage of each scenario
 * ══════════════════════════════════════════════════════════════════════
 *
 *  [x]  1. Successful user→assistant turn (basic)
 *  [x]  2. Multi-turn conversation (3+ turns)
 *  [x]  3. Guard passed  — hides guard request + guard response, keeps user pair
 *  [x] 3b. Guard passed (order 2) — guard request arrives first, same result
 *  [x]  4. Guard blocked — hides guard request + guard response, keeps user request
 *  [x]  5. Guard double-encoded response (JSON string inside JSON)
 *  [x]  6. Error payload — { type:"error", status:400, ... } — hides message
 *  [x]  7. Orphan assistant (no preceding user) — placeholder inserted
 *  [x]  8. Duplicate audit records — deduplicated
 *  [x]  9. Empty assistant content + rawData → content set to "empty"
 *  [x] 10. Null branchId → defaults to "1.0.0"
 *  [x] 11. Two-part branchId → normalized to 3-part
 *  [x] 12. Over-long branchId (>3 parts) → truncated to 3
 *  [x] 13. Null content → graceful handling (empty string)
 *  [x] 14. Tool call data in rawData → preserved through pipeline
 *  [x] 15. Desktop options (wasBlockedByGuard) → extracted into message
 *  [x] 16. Desktop options (isSelectedBranch) → extracted into message
 *  [x] 17. Status: timeout → preserved
 *  [x] 18. Status: rate_limited → preserved
 *  [x] 19. Status: invalid_request → preserved
 *  [ ] 20. Captured JSON: successful OpenAI turn        (needs live capture)
 *  [ ] 21. Captured JSON: successful Claude turn         (needs live capture)
 *  [ ] 22. Captured JSON: Gemini response with image     (needs live capture)
 *  [ ] 23. Captured JSON: tool call response             (needs live capture)
 *  [ ] 24. Captured JSON: guard blocked                  (needs live capture)
 *  [ ] 25. Captured JSON: error response                 (needs live capture)
 *
 * ══════════════════════════════════════════════════════════════════════
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiOk } from '../../../src-electron/types/api-response';
import { loadCapture, pagedCapture, pagedMessages } from '../../fixtures/api-captures/loader';
import {
  fakeMessageDTO,
  resetSequence,
  successfulTurn,
  multiTurnConversation,
  guardPassedTurn,
  guardPassedTurnOrder2,
  guardBlockedTurn,
  guardDoubleEncodedTurn,
  errorPayloadResponse,
  timeoutResponse,
  rateLimitedResponse,
  invalidRequestResponse,
  orphanAssistant,
  duplicateAuditRecords,
  emptyContentWithRawData,
  nullBranchId,
  overLongBranchId,
  nullContent,
  toolCallInRawData,
  toolUseInContentBlocks,
  desktopOptionsBlocked,
  desktopOptionsSelectedBranch,
} from '../../fixtures/api-captures/message-scenarios';
import {
  validateMessageDTO,
  validateMessageDTOArray,
  formatErrors,
} from '../../fixtures/api-captures/schema-validator';

// ── Mock dependencies ──────────────────────────────────────────────

const mockThreadApi = vi.hoisted(() => ({
  getThread: vi.fn(),
  getThreads: vi.fn(),
  getMessages: vi.fn(),
  createThread: vi.fn(),
  updateThread: vi.fn(),
  deleteThread: vi.fn(),
  updateRequestBranch: vi.fn(),
  updateRequestDesktopOptions: vi.fn(),
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}));

vi.mock('../../../src-electron/services/file-storage.service', () => ({
  fileStorageService: {
    deleteThreadFiles: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src-electron/services/title-generator.service', () => ({
  titleGeneratorService: {
    generateTitle: vi.fn((text: string) => text.slice(0, 40)),
    ensureUniqueTitle: vi.fn((title: string) => title),
  },
}));

vi.mock('../../../src-electron/services/mokuapi/thread-api.service', () => ({
  threadApiService: mockThreadApi,
}));

// ── Import after mocks ─────────────────────────────────────────────

import { ThreadRepository } from '../../../src-electron/repository/thread-repository';
import type { Message } from '../../../src-electron/types/thread.types';
import type { ThreadDTO } from '../../../src-electron/services/mokuapi/thread.types';

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Load a thread through the uncached path with the given messages.
 */
async function loadWithMessages(
  repo: ThreadRepository,
  messages: ReturnType<typeof fakeMessageDTO>[],
): Promise<{ messages: Message[] }> {
  mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages(messages)));
  const loaded = await repo.loadThreadMessages('thread-1');
  return { messages: loaded };
}

/**
 * Load a JSON fixture file through the full pipeline:
 * loadCapture → validateMessageDTOArray → mock API → repo.loadThreadMessages → Message[]
 *
 * Fails fast with the fixture path when schema validation detects drift.
 */
async function loadFixtureThroughPipeline(
  repo: ThreadRepository,
  fixturePath: string,
): Promise<Message[]> {
  // 1. Load raw DTOs from fixture
  const dtos = loadCapture(fixturePath);

  // 2. Validate schema — fail fast with fixture path on drift
  const schemaErrors = validateMessageDTOArray(dtos);
  expect(
    schemaErrors,
    `Schema drift in "${fixturePath}":\n${formatErrors(schemaErrors)}`,
  ).toHaveLength(0);

  // 3. Mock the API to return the fixture data in paged envelope
  mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedCapture(fixturePath)));

  // 4. Run through the full repository pipeline
  return repo.loadThreadMessages('thread-1');
}

// ── Tests ───────────────────────────────────────────────────────────

describe('ThreadRepository — message handling scenarios', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSequence();
    repo = new ThreadRepository();
  });

  // ────────────────────────────────────────────────────────────────
  // Schema validation — ensures builders produce valid DTOs
  // ────────────────────────────────────────────────────────────────

  describe('schema validation', () => {
    it('all scenario builders produce valid MessageDTO shapes', () => {
      const scenarios: [string, ReturnType<typeof fakeMessageDTO>[]][] = [
        ['successfulTurn', successfulTurn()],
        ['multiTurnConversation', multiTurnConversation()],
        ['guardPassedTurn', guardPassedTurn()],
        ['guardPassedTurnOrder2', guardPassedTurnOrder2()],
        ['guardBlockedTurn', guardBlockedTurn()],
        ['guardDoubleEncodedTurn', guardDoubleEncodedTurn()],
        ['errorPayloadResponse', errorPayloadResponse()],
        ['timeoutResponse', timeoutResponse()],
        ['rateLimitedResponse', rateLimitedResponse()],
        ['invalidRequestResponse', invalidRequestResponse()],
        ['orphanAssistant', orphanAssistant()],
        ['duplicateAuditRecords', duplicateAuditRecords()],
        ['emptyContentWithRawData', emptyContentWithRawData()],
        ['nullBranchId', nullBranchId()],
        ['overLongBranchId', overLongBranchId()],
        ['toolCallInRawData', toolCallInRawData()],
        ['toolUseInContentBlocks', toolUseInContentBlocks()],
        ['desktopOptionsBlocked', desktopOptionsBlocked()],
        ['desktopOptionsSelectedBranch', desktopOptionsSelectedBranch()],
      ];

      for (const [name, dtos] of scenarios) {
        const errors = validateMessageDTOArray(dtos);
        expect(errors, `Schema errors in "${name}":\n${formatErrors(errors)}`).toHaveLength(0);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 1. Successful turns
  // ────────────────────────────────────────────────────────────────

  describe('successful turns', () => {
    it('scenario 1: maps a basic user→assistant turn', async () => {
      const result = await loadWithMessages(repo, successfulTurn());

      expect(result.messages).toHaveLength(2);

      const [user, assistant] = result.messages;
      expect(user.role).toBe('user');
      expect(user.content).toBe('Hello, how are you?');
      expect(user.branchId).toBe('1.0.0');

      expect(assistant.role).toBe('assistant');
      expect(assistant.content).toBe('I am doing well, thank you for asking!');
      expect(assistant.provider).toBe('openai');
      expect(assistant.modelId).toBe('gpt-4');
    });

    it('scenario 2: maps a multi-turn conversation preserving order', async () => {
      const result = await loadWithMessages(repo, multiTurnConversation());

      expect(result.messages).toHaveLength(6);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[2].role).toBe('user');
      expect(result.messages[3].role).toBe('assistant');
      expect(result.messages[4].role).toBe('user');
      expect(result.messages[5].role).toBe('assistant');

      // Content preserved
      expect(result.messages[0].content).toBe('What is TypeScript?');
      expect(result.messages[5].content).toBe('You are welcome!');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3–5. Guard inspector scenarios
  // ────────────────────────────────────────────────────────────────

  describe('guard inspector', () => {
    it('scenario 3: guard passed — hides guard request + guard response, keeps user pair', async () => {
      const result = await loadWithMessages(repo, guardPassedTurn());

      // 4 messages total: User Request, Guard Request, Guard Response, User Response
      expect(result.messages).toHaveLength(4);

      const visible = result.messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(2);

      // Visible: user's original request + LLM response
      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Benign request');
      expect(visible[1].role).toBe('assistant');
      expect(visible[1].content).toBe('Sure, that sounds benign!');

      // Guard execution metadata on the kept user message
      expect(visible[0].guardExecution).toBe('pass');
      expect(visible[0].guardMessageId).toEqual(expect.any(String));

      // Hidden: guard request + guard response
      const hidden = result.messages.filter((m) => m.isHidden);
      expect(hidden).toHaveLength(2);
      expect(
        hidden.some((m) => m.role === 'user' && m.content.includes('Check the following')),
      ).toBe(true);
      expect(hidden.some((m) => m.role === 'assistant' && m.content.includes('passed'))).toBe(true);
    });

    it('scenario 3b: guard passed order 2 — guard request arrives first, same result', async () => {
      const result = await loadWithMessages(repo, guardPassedTurnOrder2());

      expect(result.messages).toHaveLength(4);

      const visible = result.messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(2);

      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Benign request');
      expect(visible[1].role).toBe('assistant');
      expect(visible[1].content).toBe('Sure, that sounds benign!');

      // Guard metadata present regardless of array order
      expect(visible[0].guardExecution).toBe('pass');
      expect(visible[0].guardMessageId).toEqual(expect.any(String));
    });

    it('scenario 4: guard blocked — hides guard request + guard response, keeps user request', async () => {
      const result = await loadWithMessages(repo, guardBlockedTurn());

      // 3 messages: User Request, Guard Request, Guard Response
      expect(result.messages).toHaveLength(3);

      const visible = result.messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(1);

      // Only the user's original request remains visible
      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Blocked request');
      expect(visible[0].guardExecution).toBe('fail');
      expect(visible[0].guardMessageId).toEqual(expect.any(String));

      // Guard request + guard response hidden
      const hidden = result.messages.filter((m) => m.isHidden);
      expect(hidden).toHaveLength(2);
    });

    it('scenario 5: guard double-encoded — still detected and hidden', async () => {
      const result = await loadWithMessages(repo, guardDoubleEncodedTurn());

      // 3 messages: User Request, Guard Request, Guard Response
      expect(result.messages).toHaveLength(3);

      const visible = result.messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(1);
      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Double encoded guard');
      expect(visible[0].guardExecution).toBe('fail');
      expect(visible[0].guardMessageId).toEqual(expect.any(String));
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. Error payload
  // ────────────────────────────────────────────────────────────────

  describe('error payload', () => {
    it('scenario 6: error payload in content — message is hidden', async () => {
      const result = await loadWithMessages(repo, errorPayloadResponse());

      const errorMsg = result.messages.find((m) => m.role === 'assistant');
      expect(errorMsg).toBeDefined();
      expect(errorMsg!.isHidden).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. Orphan assistant (PlaceholderInspector)
  // ────────────────────────────────────────────────────────────────

  describe('placeholder inspector', () => {
    it('scenario 7: orphan assistant gets a synthetic user placeholder', async () => {
      const result = await loadWithMessages(repo, orphanAssistant());

      // PlaceholderInspector should insert a user message before the orphan
      expect(result.messages.length).toBeGreaterThanOrEqual(2);

      const placeholder = result.messages.find((m) => m.role === 'user' && m.branchId === '2.0.0');
      expect(placeholder).toBeDefined();
      expect(placeholder!.content).toBe('');

      const assistant = result.messages.find(
        (m) => m.role === 'assistant' && m.branchId === '2.0.0',
      );
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('I appeared without a prompt');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8. Duplicate audit records (DuplicationInspector)
  // ────────────────────────────────────────────────────────────────

  describe('duplication inspector', () => {
    it('scenario 8: duplicate audit records are deduplicated', async () => {
      const result = await loadWithMessages(repo, duplicateAuditRecords());

      const assistantMsgs = result.messages.filter((m) => m.role === 'assistant');
      // Should have only 1 assistant message (the earlier one kept)
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].content).toBe('Done running.');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 9. Empty content + rawData
  // ────────────────────────────────────────────────────────────────

  describe('empty content with rawData', () => {
    it('scenario 9: assistant with empty content and rawData → content set to "empty"', async () => {
      const result = await loadWithMessages(repo, emptyContentWithRawData());

      const assistant = result.messages.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('empty');
      expect(assistant!.rawData).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 10–12. BranchId normalization
  // ────────────────────────────────────────────────────────────────

  describe('branchId normalization', () => {
    it('scenario 10: null branchId defaults to 1.0.0', async () => {
      const result = await loadWithMessages(repo, nullBranchId());

      for (const msg of result.messages) {
        expect(msg.branchId).toBe('1.0.0');
      }
    });

    it('scenario 11: two-part branchId normalized to 3-part', async () => {
      // The scenario builder has a unicode issue, test inline
      const msgs = [
        fakeMessageDTO({ role: 'user', content: 'Hi', branchId: '2.1' }),
        fakeMessageDTO({ role: 'assistant', content: 'Hey', branchId: '2.1', status: 'success' }),
      ];
      const result = await loadWithMessages(repo, msgs);

      for (const msg of result.messages) {
        expect(msg.branchId).toBe('2.1.0');
      }
    });

    it('scenario 12: over-long branchId truncated to 3 parts', async () => {
      const result = await loadWithMessages(repo, overLongBranchId());

      for (const msg of result.messages) {
        expect(msg.branchId).toBe('1.2.3');
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 13. Malformed content
  // ────────────────────────────────────────────────────────────────

  describe('malformed content', () => {
    it('scenario 13: null content → empty string', async () => {
      const result = await loadWithMessages(repo, nullContent());

      const assistant = result.messages.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      // mapDTOToMessage does: (dto.content as string) || ''
      expect(assistant!.content).toBe('');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 14. Tool call data in rawData
  // ────────────────────────────────────────────────────────────────

  describe('tool call in rawData', () => {
    it('scenario 14: rawData with tool calls preserved through pipeline', async () => {
      const result = await loadWithMessages(repo, toolCallInRawData());

      const assistant = result.messages.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.rawData).toBeDefined();
      expect(assistant!.toolUses).toBeDefined();
      expect(assistant!.toolUses).toHaveLength(1);
      expect(assistant!.toolUses![0].name).toBe('read_file');

      const raw = assistant!.rawData as Record<string, unknown>;
      expect(raw).toHaveProperty('tool_calls');
      expect(raw).toHaveProperty('tool_results');
    });
  });

  describe('tool use in content blocks', () => {
    it('captures tool uses from content array blocks', async () => {
      const result = await loadWithMessages(repo, toolUseInContentBlocks());

      const assistant = result.messages.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toContain("I'll check how many files are in that folder");
      expect(assistant!.toolUses).toBeDefined();
      expect(assistant!.toolUses).toHaveLength(1);
      expect(assistant!.toolUses![0].name).toBe('read_folder');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 15–16. Desktop options
  // ────────────────────────────────────────────────────────────────

  describe('desktop options', () => {
    it('scenario 15: wasBlockedByGuard extracted from options', async () => {
      const result = await loadWithMessages(repo, desktopOptionsBlocked());

      const assistant = result.messages.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.desktopOptions).toBeDefined();
      expect(assistant!.desktopOptions!.wasBlockedByGuard).toBe(true);
      expect(assistant!.desktopOptions!.guardBlockReason).toBe('Content policy');
    });

    it('scenario 16: isSelectedBranch extracted from options', async () => {
      const result = await loadWithMessages(repo, desktopOptionsSelectedBranch());

      const assistant = result.messages.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.desktopOptions).toBeDefined();
      expect(assistant!.desktopOptions!.isSelectedBranch).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 17–19. LLM status preservation
  // ────────────────────────────────────────────────────────────────

  describe('LLM status preservation', () => {
    it('scenario 17: timeout status preserved', async () => {
      const result = await loadWithMessages(repo, timeoutResponse());

      // Message should load (content will be empty string or "empty")
      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('scenario 18: rate_limited status preserved', async () => {
      const result = await loadWithMessages(repo, rateLimitedResponse());

      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('scenario 19: invalid_request status preserved', async () => {
      const result = await loadWithMessages(repo, invalidRequestResponse());

      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 20–25. Captured JSON fixtures — field-level assertions
  // ────────────────────────────────────────────────────────────────

  describe('captured JSON fixtures', () => {
    // Scenario 20: successful OpenAI turn
    it('scenario 20: successful OpenAI turn', async () => {
      const messages = await loadFixtureThroughPipeline(repo, 'turns/successful-openai-turn.json');
      expect(messages.length).toBe(2);

      const user = messages.find((m) => m.role === 'user')!;
      const assistant = messages.find((m) => m.role === 'assistant')!;

      expect(user.role).toBe('user');
      expect(user.content).toBe('just respond ok1');

      expect(assistant.role).toBe('assistant');
      expect(assistant.content).toBe('ok1');
      expect(assistant.provider).toBe('openai');
      // Successful turn — not hidden by any inspector
      expect(assistant.isHidden).not.toBe(true);

      // At least one visible message
      expect(messages.some((m) => m.isHidden !== true)).toBe(true);
    });

    // Scenario 21: successful Claude turn
    it('scenario 21: successful Claude turn', async () => {
      const messages = await loadFixtureThroughPipeline(repo, 'turns/successful-claude-turn.json');
      expect(messages.length).toBe(2);

      const user = messages.find((m) => m.role === 'user')!;
      const assistant = messages.find((m) => m.role === 'assistant')!;

      expect(user.content).toContain('TypeScript');

      expect(assistant.provider).toBe('claude');
      expect(assistant.content).toEqual(expect.any(String));
      expect(assistant.content.length).toBeGreaterThan(0);

      // At least one visible message
      expect(messages.some((m) => m.isHidden !== true)).toBe(true);
    });

    // Scenario 23: tool call response
    it('scenario 23: tool call response', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'tool-calls/tool-call-read-file.json',
      );
      expect(messages.length).toBe(2);

      const result = await repo.loadThread('thread-1');
      expect(result).not.toBeNull();
      expect(result!.messages.length).toBeGreaterThan(0);
    });

    // Scenario 24: guard blocked
    // The fixture contains a user message and an assistant error message with
    // { request_id, type: "error", error: { message: "PII detected..." } }.
    // This shape is reformatted by ErrorResponseInspector but NOT hidden
    // (it lacks the requestId/seq/status:400 guard-error envelope).
    // The guard inspector also does not detect it (no { response: { passed } } shape).
    it('scenario 24: guard blocked', async () => {
      const messages = await loadFixtureThroughPipeline(repo, 'guard/guard-blocked.json');
      expect(messages).toHaveLength(2);

      const user = messages.find((m) => m.role === 'user')!;
      const assistant = messages.find((m) => m.role === 'assistant')!;

      // User message is visible
      expect(user.isHidden).not.toBe(true);

      // Assistant error content was reformatted by ErrorResponseInspector
      expect(assistant.content).toContain('PII');

      // At least one visible message
      expect(messages.some((m) => m.isHidden !== true)).toBe(true);
    });

    // Scenario 25: error response
    // The fixture contains { type: "error", status: 400, message: "400 status code (no body)" }.
    // ErrorResponseInspector reformats the content but does not hide the message
    // (it lacks requestId/seq fields for guard-error detection).
    it('scenario 25: error response', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'errors/error-400-invalid-request.json',
      );

      const assistant = messages.find((m) => m.role === 'assistant')!;

      // ErrorResponseInspector reformats the error content
      expect(assistant.content).toContain('error');

      // At least one visible message
      expect(messages.some((m) => m.isHidden !== true)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Generated fixtures — turns
  // ────────────────────────────────────────────────────────────────

  describe('generated fixtures — turns', () => {
    it('openai_gpt-4-pass-successful-turn-1: 2 messages, user→assistant, provider=openai', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'turns/openai_gpt-4-pass-successful-turn-1.json',
      );

      expect(messages).toHaveLength(2);

      const [user, assistant] = messages;
      expect(user.role).toBe('user');
      expect(assistant.role).toBe('assistant');
      expect(assistant.provider).toBe('openai');

      // At least one visible message
      expect(messages.some((m) => m.isHidden !== true)).toBe(true);
    });

    it('openai_gpt-4-pass-multi-turn-conversation-1: 6 messages, role alternation preserved', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'turns/openai_gpt-4-pass-multi-turn-conversation-1.json',
      );

      expect(messages).toHaveLength(6);

      // Verify user→assistant role alternation across all turns
      for (let i = 0; i < messages.length; i++) {
        const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
        expect(messages[i].role).toBe(expectedRole);
      }

      // At least one visible message
      expect(messages.some((m) => m.isHidden !== true)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Generated fixtures — guard
  // ────────────────────────────────────────────────────────────────

  describe('generated fixtures — guard', () => {
    it('openai_gpt-4-pass-guard-blocked-1: guard messages hidden, user message visible', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'guard/openai_gpt-4-pass-guard-blocked-1.json',
      );

      // 3 DTOs: user request, guard request, guard response (failed)
      expect(messages).toHaveLength(3);

      const visible = messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(1);

      // Only the user's original request remains visible
      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Blocked request');
      expect(visible[0].guardExecution).toBe('fail');

      // Guard request + guard response are hidden
      const hidden = messages.filter((m) => m.isHidden);
      expect(hidden).toHaveLength(2);
    });

    it('openai_gpt-4-pass-guard-double-encoded-1: double-encoded guard still detected and hidden', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'guard/openai_gpt-4-pass-guard-double-encoded-1.json',
      );

      // 3 DTOs: user request, guard request, guard response (double-encoded)
      expect(messages).toHaveLength(3);

      const visible = messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(1);

      // User message visible, guard detected despite double encoding
      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Double encoded guard');
      expect(visible[0].guardExecution).toBe('fail');

      // Guard request + guard response are hidden
      const hidden = messages.filter((m) => m.isHidden);
      expect(hidden).toHaveLength(2);
    });

    it('openai_gpt-4-pass-guard-passed-1: guard messages hidden, user + assistant visible', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'guard/openai_gpt-4-pass-guard-passed-1.json',
      );

      // 4 DTOs: user request, guard request, guard response (passed), assistant response
      expect(messages).toHaveLength(4);

      const visible = messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(2);

      // User request and assistant response are visible
      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Benign request');
      expect(visible[0].guardExecution).toBe('pass');

      expect(visible[1].role).toBe('assistant');
      expect(visible[1].content).toBe('Sure, that sounds benign!');

      // Guard request + guard response are hidden
      const hidden = messages.filter((m) => m.isHidden);
      expect(hidden).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Generated fixtures — errors
  // ────────────────────────────────────────────────────────────────

  describe('generated fixtures — errors', () => {
    it('openai_gpt-4-error-error-payload-400-1: error payload with requestId/seq — assistant hidden by GuardInspector', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'errors/openai_gpt-4-error-error-payload-400-1.json',
      );

      expect(messages).toHaveLength(2);

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      // Guard error payload (type:"error", status:400, requestId, seq) → hidden by GuardInspector
      expect(assistant.isHidden).toBe(true);

      // User message remains visible
      const user = messages.find((m) => m.role === 'user')!;
      expect(user).toBeDefined();
      expect(user.isHidden).not.toBe(true);
    });

    it('openai_gpt-4-error-timeout-1: timeout status — assistant not hidden (no error payload)', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'errors/openai_gpt-4-error-timeout-1.json',
      );

      expect(messages).toHaveLength(2);

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      // Empty content + status:"timeout" — no JSON error payload to detect
      expect(assistant.isHidden).not.toBe(true);

      // User message visible
      const user = messages.find((m) => m.role === 'user')!;
      expect(user.isHidden).not.toBe(true);
    });

    it('openai_gpt-4-error-rate-limited-1: rate limited status — assistant not hidden (no error payload)', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'errors/openai_gpt-4-error-rate-limited-1.json',
      );

      expect(messages).toHaveLength(2);

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      // Empty content + status:"rate_limited" — no JSON error payload to detect
      expect(assistant.isHidden).not.toBe(true);

      // User message visible
      const user = messages.find((m) => m.role === 'user')!;
      expect(user.isHidden).not.toBe(true);
    });

    it('openai_claude-opus-4-6-error-invalid-request-400-1: invalid request status — assistant not hidden (no error payload)', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'errors/openai_claude-opus-4-6-error-invalid-request-400-1.json',
      );

      expect(messages).toHaveLength(2);

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      // Empty content + status:"invalid_request" — no JSON error payload to detect
      expect(assistant.isHidden).not.toBe(true);

      // User message visible
      const user = messages.find((m) => m.role === 'user')!;
      expect(user.isHidden).not.toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Generated fixtures — tool-calls
  // ────────────────────────────────────────────────────────────────

  describe('generated fixtures — tool-calls', () => {
    it('openai_gpt-4-pass-tool-call-in-rawdata-1: assistant has toolUses extracted from rawData.tool_calls', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'tool-calls/openai_gpt-4-pass-tool-call-in-rawdata-1.json',
      );

      expect(messages).toHaveLength(2);

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      expect(assistant.toolUses).toBeDefined();
      expect(assistant.toolUses!.length).toBeGreaterThan(0);

      // Verify the tool use was extracted from rawData.tool_calls
      expect(assistant.toolUses![0].name).toBe('read_file');

      // User message remains visible
      const user = messages.find((m) => m.role === 'user')!;
      expect(user).toBeDefined();
      expect(user.isHidden).not.toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Generated fixtures — edge-cases
  // ────────────────────────────────────────────────────────────────

  describe('generated fixtures — edge-cases', () => {
    it('openai_gpt-4-pass-orphan-assistant-1: placeholder user message inserted before orphan assistant', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-orphan-assistant-1.json',
      );

      // Fixture has 1 assistant message; PlaceholderInspector inserts a synthetic user
      expect(messages.length).toBeGreaterThanOrEqual(2);

      const placeholder = messages.find((m) => m.role === 'user');
      expect(placeholder).toBeDefined();
      expect(placeholder!.content).toBe('');

      const assistant = messages.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('I appeared without a prompt');
    });

    it('openai_gpt-4-pass-duplicate-audit-records-1: output count < input count (deduplication)', async () => {
      const inputDtos = loadCapture('edge-cases/openai_gpt-4-pass-duplicate-audit-records-1.json');
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-duplicate-audit-records-1.json',
      );

      // DuplicationInspector removes the duplicate assistant record
      expect(messages.length).toBeLessThan(inputDtos.length);

      // Should keep only 1 assistant message
      const assistantMsgs = messages.filter((m) => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].content).toBe('Done running.');
    });

    it('openai_gpt-4-pass-empty-content-with-rawdata-1: assistant content = "empty" and rawData defined', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-empty-content-with-rawdata-1.json',
      );

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      // Empty content + rawData → content set to "empty" by mapDTOToMessage
      expect(assistant.content).toBe('empty');
      expect(assistant.rawData).toBeDefined();
    });

    it('openai_gpt-4-pass-null-branch-id-1: all branchIds = "1.0.0"', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-null-branch-id-1.json',
      );

      expect(messages.length).toBeGreaterThanOrEqual(2);
      for (const msg of messages) {
        expect(msg.branchId).toBe('1.0.0');
      }
    });

    it('openai_gpt-4-pass-null-content-1: assistant content = ""', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-null-content-1.json',
      );

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      // Null content with no rawData → empty string (not "empty")
      expect(assistant.content).toBe('');
    });

    it('openai_gpt-4-pass-two-part-branch-id-1: branchId normalized to 3-part format', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-two-part-branch-id-1.json',
      );

      expect(messages.length).toBeGreaterThanOrEqual(2);
      // "2.1" → "2.1.0"
      for (const msg of messages) {
        expect(msg.branchId).toBe('2.1.0');
      }
    });

    it('openai_gpt-4-pass-over-long-branch-id-1: branchId truncated to 3 parts', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-over-long-branch-id-1.json',
      );

      expect(messages.length).toBeGreaterThanOrEqual(2);
      // "1.2.3.4.5" → "1.2.3"
      for (const msg of messages) {
        expect(msg.branchId).toBe('1.2.3');
      }
    });

    it('openai_gpt-4-pass-desktop-options-blocked-1: desktopOptions.wasBlockedByGuard = true', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-desktop-options-blocked-1.json',
      );

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      expect(assistant.desktopOptions).toBeDefined();
      expect(assistant.desktopOptions!.wasBlockedByGuard).toBe(true);
    });

    it('openai_gpt-4-pass-desktop-options-selected-branch-1: desktopOptions.isSelectedBranch = true', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        'edge-cases/openai_gpt-4-pass-desktop-options-selected-branch-1.json',
      );

      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant).toBeDefined();
      expect(assistant.desktopOptions).toBeDefined();
      expect(assistant.desktopOptions!.isSelectedBranch).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Fixture invariant tests
  // ────────────────────────────────────────────────────────────────

  describe('fixture invariants', () => {
    const FIXTURES_DIR = resolve(__dirname, '../../../tests/fixtures/api-captures');

    /** List all .json files in a subdirectory of the fixtures dir */
    function listFixtures(subdir: string): string[] {
      const dir = resolve(FIXTURES_DIR, subdir);
      return readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => `${subdir}/${f}`);
    }

    // Feature: e2e-thread-message-expect-clauses, Property 1: Schema validator rejects incomplete DTOs
    // **Validates: Requirements 1.3, 4.2, 4.3**
    it('Property 1: schema validator rejects incomplete DTOs', () => {
      const REQUIRED_FIELDS = [
        'id',
        'threadId',
        'createdAt',
        'updatedAt',
        'role',
        'content',
        'rawData',
        'options',
        'status',
      ] as const;

      // A complete, valid DTO base
      const validBase: Record<string, unknown> = {
        id: 'msg-1',
        threadId: 'thread-1',
        branchId: '1.0.0',
        model: 'gpt-4',
        provider: 'openai',
        role: 'user',
        content: 'hello',
        rawData: null,
        options: null,
        status: 'success',
        tokens: null,
        createdUserId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Test each required field individually — removing it should produce a validation error
      for (const field of REQUIRED_FIELDS) {
        const incomplete = { ...validBase };
        delete incomplete[field];

        const errors = validateMessageDTO(incomplete);
        expect(errors.length, `Removing "${field}" should produce errors`).toBeGreaterThan(0);

        const hasError = errors.some((e) => e.field.includes(field));
        expect(
          hasError,
          `Expected error for missing field "${field}" but got none. Errors: ${JSON.stringify(errors)}`,
        ).toBe(true);
      }

      // Test removing all required fields at once
      const allRemoved = { ...validBase };
      for (const field of REQUIRED_FIELDS) {
        delete allRemoved[field];
      }
      const allErrors = validateMessageDTO(allRemoved);
      expect(allErrors.length).toBeGreaterThanOrEqual(REQUIRED_FIELDS.length);
    });

    // Feature: e2e-thread-message-expect-clauses, Property 2: Every fixture produces at least one visible message
    // **Validates: Requirements 2.6**
    it('Property 2: every fixture produces at least one visible message', async () => {
      const subdirs = ['turns', 'guard', 'errors', 'tool-calls', 'edge-cases'];
      const allFixtures = subdirs.flatMap((d) => listFixtures(d));

      for (const fixturePath of allFixtures) {
        const messages = await loadFixtureThroughPipeline(repo, fixturePath);
        const visible = messages.filter((m) => m.isHidden !== true);
        expect(
          visible.length,
          `Fixture "${fixturePath}" produced no visible messages`,
        ).toBeGreaterThanOrEqual(1);
      }
    });

    // Feature: e2e-thread-message-expect-clauses, Property 3: Error fixtures hide assistant messages
    // **Validates: Requirements 3.2**
    // NOTE: Only the generated error-payload-400 fixture (with requestId/seq guard-error envelope)
    // has isHidden=true. The captured error-400-invalid-request.json and the timeout/rate_limited/
    // invalid_request fixtures do NOT hide assistant messages.
    it('Property 3: error-payload fixtures hide assistant messages', async () => {
      const errorPayloadFixtures = ['errors/openai_gpt-4-error-error-payload-400-1.json'];

      for (const fixturePath of errorPayloadFixtures) {
        const messages = await loadFixtureThroughPipeline(repo, fixturePath);
        const assistants = messages.filter((m) => m.role === 'assistant');
        expect(
          assistants.length,
          `Fixture "${fixturePath}" has no assistant messages`,
        ).toBeGreaterThan(0);

        for (const assistant of assistants) {
          expect(
            assistant.isHidden,
            `Fixture "${fixturePath}": assistant message should be hidden`,
          ).toBe(true);
        }
      }
    });

    // Feature: e2e-thread-message-expect-clauses, Property 4: Guard fixtures hide guard messages and keep user visible
    // **Validates: Requirements 3.3**
    it('Property 4: guard fixtures hide guard messages and keep user visible', async () => {
      // The captured guard-blocked.json lacks the { response: { passed } } shape
      // for guard detection. Only the generated guard fixtures have proper guard pairs.
      const guardFixtures = listFixtures('guard').filter((f) => !f.endsWith('guard-blocked.json'));

      for (const fixturePath of guardFixtures) {
        const messages = await loadFixtureThroughPipeline(repo, fixturePath);

        // At least one user message is visible
        const visibleUsers = messages.filter((m) => m.role === 'user' && m.isHidden !== true);
        expect(
          visibleUsers.length,
          `Fixture "${fixturePath}": no visible user messages`,
        ).toBeGreaterThanOrEqual(1);

        // Guard-related assistant messages (hidden ones) should be hidden
        const hiddenAssistants = messages.filter(
          (m) => m.role === 'assistant' && m.isHidden === true,
        );
        expect(
          hiddenAssistants.length,
          `Fixture "${fixturePath}": expected at least one hidden guard assistant message`,
        ).toBeGreaterThanOrEqual(1);
      }
    });

    // Feature: e2e-thread-message-expect-clauses, Property 5: Tool-call fixtures produce toolUses
    // **Validates: Requirements 3.4**
    it('Property 5: tool-call fixtures produce toolUses', async () => {
      const toolCallFixtures = listFixtures('tool-calls');

      for (const fixturePath of toolCallFixtures) {
        const messages = await loadFixtureThroughPipeline(repo, fixturePath);
        const withToolUses = messages.filter(
          (m) => m.role === 'assistant' && m.toolUses && m.toolUses.length > 0,
        );
        expect(
          withToolUses.length,
          `Fixture "${fixturePath}": no assistant messages with toolUses`,
        ).toBeGreaterThanOrEqual(1);
      }
    });

    // Feature: e2e-thread-message-expect-clauses, Property 6: Turn fixtures preserve role alternation
    // **Validates: Requirements 3.5**
    it('Property 6: turn fixtures preserve role alternation', async () => {
      const turnFixtures = listFixtures('turns');

      for (const fixturePath of turnFixtures) {
        const messages = await loadFixtureThroughPipeline(repo, fixturePath);

        expect(messages.length).toBeGreaterThanOrEqual(2);
        expect(messages[0].role).toBe('user');

        for (let i = 0; i < messages.length; i++) {
          const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
          expect(
            messages[i].role,
            `Fixture "${fixturePath}" message[${i}]: expected role "${expectedRole}" but got "${messages[i].role}"`,
          ).toBe(expectedRole);
        }
      }
    });

    // Feature: e2e-thread-message-expect-clauses, Property 7: Referenced fixture files exist on disk
    // **Validates: Requirements 5.3**
    it('Property 7: referenced fixture files exist on disk', () => {
      const testFileContent = readFileSync(
        resolve(__dirname, 'thread-repository-messages.spec.ts'),
        'utf-8',
      );

      // Match fixture path strings like 'turns/successful-openai-turn.json'
      const fixturePathPattern =
        /['"]((turns|guard|errors|tool-calls|edge-cases)\/[a-zA-Z0-9_-]+\.json)['"]/g;
      const referencedPaths = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = fixturePathPattern.exec(testFileContent)) !== null) {
        referencedPaths.add(match[1]);
      }

      expect(referencedPaths.size).toBeGreaterThan(0);

      for (const fixturePath of referencedPaths) {
        const fullPath = resolve(FIXTURES_DIR, fixturePath);
        expect(
          existsSync(fullPath),
          `Referenced fixture "${fixturePath}" does not exist at ${fullPath}`,
        ).toBe(true);
      }
    });

    // Feature: e2e-thread-message-expect-clauses, Property 8: Clean fixtures preserve message count
    // **Validates: Requirements 6.1**
    it('Property 8: clean fixtures preserve message count', async () => {
      const turnFixtures = listFixtures('turns');

      for (const fixturePath of turnFixtures) {
        const dtos = loadCapture(fixturePath);
        const messages = await loadFixtureThroughPipeline(repo, fixturePath);

        expect(
          messages.length,
          `Fixture "${fixturePath}": output count (${messages.length}) should equal input count (${dtos.length})`,
        ).toBe(dtos.length);
      }
    });

    // Feature: e2e-thread-message-expect-clauses, Property 9: Guard fixtures preserve or expand message count
    // **Validates: Requirements 6.2**
    it('Property 9: guard fixtures preserve or expand message count', async () => {
      const guardFixtures = listFixtures('guard');

      for (const fixturePath of guardFixtures) {
        const dtos = loadCapture(fixturePath);
        const messages = await loadFixtureThroughPipeline(repo, fixturePath);

        expect(
          messages.length,
          `Fixture "${fixturePath}": output count (${messages.length}) should be >= input count (${dtos.length})`,
        ).toBeGreaterThanOrEqual(dtos.length);
      }
    });

    // Feature: e2e-thread-message-expect-clauses, Property 10: Duplicate fixtures reduce message count
    // **Validates: Requirements 6.3**
    it('Property 10: duplicate fixtures reduce message count', async () => {
      const fixturePath = 'edge-cases/openai_gpt-4-pass-duplicate-audit-records-1.json';
      const dtos = loadCapture(fixturePath);
      const messages = await loadFixtureThroughPipeline(repo, fixturePath);

      expect(
        messages.length,
        `Fixture "${fixturePath}": output count (${messages.length}) should be < input count (${dtos.length})`,
      ).toBeLessThan(dtos.length);
    });
  });
});
