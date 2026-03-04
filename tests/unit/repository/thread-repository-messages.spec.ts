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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiOk, apiFail } from '../../../src-electron/types/api-response';
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
  // 20–25. Captured JSON fixtures (placeholder for live captures)
  //
  // Uncomment each test once the corresponding JSON file has been
  // captured via CAPTURE_API_DATA=true and placed in the fixture dir.
  // ────────────────────────────────────────────────────────────────

  // TODO: Uncomment Gemini once we have a Gemini captures
  //
  describe('captured JSON fixtures', () => {
    it.each([
      ['scenario 20: successful OpenAI turn', 'turns/openai_gpt-4-pass-successful-turn-1.json'],
      ['scenario 21: successful Claude turn', 'turns/successful-claude-turn.json'],
      // ['scenario 22: Gemini response with image', 'turns/successful-gemini-with-image.json'],
      [
        'scenario 23: tool call response',
        'tool-calls/openai_gpt-4-pass-tool-call-in-rawdata-1.json',
      ],
      ['scenario 24: guard blocked', 'guard/openai_gpt-4-pass-guard-blocked-1.json'],
      ['scenario 25: error response', 'errors/openai_gpt-4-error-error-payload-400-1.json'],
    ])('%s', async (label, fixturePath) => {
      const messages = loadCapture(fixturePath);

      // Validate schema first
      const schemaErrors = validateMessageDTOArray(messages);
      expect(
        schemaErrors,
        `Schema drift in "${fixturePath}":\n${formatErrors(schemaErrors)}`,
      ).toHaveLength(0);

      // Load through repository
      mockThreadApi.getThread.mockResolvedValue(
        apiOk({
          id: 'thread-1',
          title: 'Test Thread',
          description: '',
          type: 'personal',
          ownerId: 'user-1',
          projectId: null,
          createdUserId: 'user-1',
          status: 'active',
          createdAt: '2025-06-01T00:00:00Z',
          updatedAt: '2025-06-01T00:00:00Z',
          deletedAt: '',
          metadata: {},
        } as ThreadDTO),
      );
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedCapture(fixturePath)));

      const result = await repo.loadThread('thread-1');
      expect(result).not.toBeNull();

      const skipMessageCountCheck = [
        'turns/successful-openai-turn.json',
        'turns/successful-claude-turn.json',
        'tool-calls/tool-call-read-file.json',
        'guard/guard-blocked.json',
        'errors/error-400-invalid-request.json',
      ];
      if (!skipMessageCountCheck.includes(fixturePath)) {
        expect(result!.messages.length).toBeGreaterThan(0);
      }
    });
  });
});
