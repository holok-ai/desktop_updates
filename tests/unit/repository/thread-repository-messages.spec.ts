/**
 * ThreadRepository — Message handling scenarios 1–19 (builder-based)
 *
 * See also:
 *   - thread-repository-messages-captured.spec.ts  (scenarios 20–25)
 *   - thread-repository-messages-generated.spec.ts (generated fixture coverage)
 *   - thread-repository-messages-providers.spec.ts (provider fixture coverage)
 *   - thread-repository-messages-invariants.spec.ts (property-based invariants)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadWithMessages,
  validateMessageDTOArray,
  formatErrors,
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
  ThreadRepository,
} from './thread-messages-test-helpers';

// ── Mocks (must be at module scope, hoisted) ───────────────────────

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
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));
vi.mock('../../../src-electron/services/file-storage.service', () => ({
  fileStorageService: { deleteThreadFiles: vi.fn().mockResolvedValue(undefined) },
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

describe('ThreadRepository — message handling scenarios', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSequence();
    repo = new ThreadRepository();
  });

  // ── Schema validation ────────────────────────────────────────────

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

  // ── 1–2. Successful turns ────────────────────────────────────────

  describe('successful turns', () => {
    it('scenario 1: maps a basic user→assistant turn', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, successfulTurn());
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
      const result = await loadWithMessages(repo, mockThreadApi, multiTurnConversation());
      expect(result.messages).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(result.messages[i].role).toBe(i % 2 === 0 ? 'user' : 'assistant');
      }
      expect(result.messages[0].content).toBe('What is TypeScript?');
      expect(result.messages[5].content).toBe('You are welcome!');
    });
  });

  // ── 3–5. Guard inspector ─────────────────────────────────────────

  describe('guard inspector', () => {
    it('scenario 3: guard passed — hides guard, keeps user pair', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, guardPassedTurn());
      expect(result.messages).toHaveLength(4);
      const visible = result.messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(2);
      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Benign request');
      expect(visible[1].role).toBe('assistant');
      expect(visible[1].content).toBe('Sure, that sounds benign!');
      expect(visible[0].guardExecution).toBe('pass');
      expect(visible[0].guardMessageId).toEqual(expect.any(String));
      const hidden = result.messages.filter((m) => m.isHidden);
      expect(hidden).toHaveLength(2);
      expect(
        hidden.some((m) => m.role === 'user' && m.content.includes('Check the following')),
      ).toBe(true);
      expect(hidden.some((m) => m.role === 'assistant' && m.content.includes('passed'))).toBe(true);
    });

    it('scenario 3b: guard passed order 2', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, guardPassedTurnOrder2());
      expect(result.messages).toHaveLength(4);
      const visible = result.messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(2);
      expect(visible[0].guardExecution).toBe('pass');
      expect(visible[0].guardMessageId).toEqual(expect.any(String));
    });

    it('scenario 4: guard blocked', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, guardBlockedTurn());
      expect(result.messages).toHaveLength(3);
      const visible = result.messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(1);
      expect(visible[0].role).toBe('user');
      expect(visible[0].content).toBe('Blocked request');
      expect(visible[0].guardExecution).toBe('fail');
      expect(result.messages.filter((m) => m.isHidden)).toHaveLength(2);
    });

    it('scenario 5: guard double-encoded', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, guardDoubleEncodedTurn());
      expect(result.messages).toHaveLength(3);
      const visible = result.messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(1);
      expect(visible[0].content).toBe('Double encoded guard');
      expect(visible[0].guardExecution).toBe('fail');
    });
  });

  // ── 6. Error payload ─────────────────────────────────────────────

  describe('error payload', () => {
    it('scenario 6: error payload — message is hidden', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, errorPayloadResponse());
      const errorMsg = result.messages.find((m) => m.role === 'assistant');
      expect(errorMsg).toBeDefined();
      expect(errorMsg!.isHidden).toBe(true);
    });
  });

  // ── 7. Orphan assistant ──────────────────────────────────────────

  describe('placeholder inspector', () => {
    it('scenario 7: orphan assistant gets synthetic user placeholder', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, orphanAssistant());
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

  // ── 8. Duplicate audit records ───────────────────────────────────

  describe('duplication inspector', () => {
    it('scenario 8: duplicates are deduplicated', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, duplicateAuditRecords());
      const assistantMsgs = result.messages.filter((m) => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].content).toBe('Done running.');
    });
  });

  // ── 9. Empty content + rawData ───────────────────────────────────

  describe('empty content with rawData', () => {
    it('scenario 9: content set to "empty"', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, emptyContentWithRawData());
      const assistant = result.messages.find((m) => m.role === 'assistant');
      expect(assistant!.content).toBe('empty');
      expect(assistant!.rawData).toBeDefined();
    });
  });

  // ── 10–12. BranchId normalization ────────────────────────────────

  describe('branchId normalization', () => {
    it('scenario 10: null branchId defaults to 1.0.0', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, nullBranchId());
      for (const msg of result.messages) expect(msg.branchId).toBe('1.0.0');
    });

    it('scenario 11: two-part branchId normalized to 3-part', async () => {
      const msgs = [
        fakeMessageDTO({ role: 'user', content: 'Hi', branchId: '2.1' }),
        fakeMessageDTO({ role: 'assistant', content: 'Hey', branchId: '2.1', status: 'success' }),
      ];
      const result = await loadWithMessages(repo, mockThreadApi, msgs);
      for (const msg of result.messages) expect(msg.branchId).toBe('2.1.0');
    });

    it('scenario 12: over-long branchId truncated to 3 parts', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, overLongBranchId());
      for (const msg of result.messages) expect(msg.branchId).toBe('1.2.3');
    });
  });

  // ── 13. Malformed content ────────────────────────────────────────

  describe('malformed content', () => {
    it('scenario 13: null content → empty string', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, nullContent());
      expect(result.messages.find((m) => m.role === 'assistant')!.content).toBe('');
    });
  });

  // ── 14. Tool call data ───────────────────────────────────────────

  describe('tool call in rawData', () => {
    it('scenario 14: rawData with tool calls preserved', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, toolCallInRawData());
      const assistant = result.messages.find((m) => m.role === 'assistant')!;
      expect(assistant.toolUses).toHaveLength(1);
      expect(assistant.toolUses![0].name).toBe('read_file');
      const raw = assistant.rawData as Record<string, unknown>;
      expect(raw).toHaveProperty('tool_calls');
      expect(raw).toHaveProperty('tool_results');
    });
  });

  describe('tool use in content blocks', () => {
    it('captures tool uses from content array blocks', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, toolUseInContentBlocks());
      const assistant = result.messages.find((m) => m.role === 'assistant')!;
      expect(assistant.content).toContain("I'll check how many files are in that folder");
      expect(assistant.toolUses).toHaveLength(1);
      expect(assistant.toolUses![0].name).toBe('read_folder');
    });
  });

  // ── 15–16. Desktop options ───────────────────────────────────────

  describe('desktop options', () => {
    it('scenario 15: wasBlockedByGuard extracted', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, desktopOptionsBlocked());
      const assistant = result.messages.find((m) => m.role === 'assistant')!;
      expect(assistant.desktopOptions!.wasBlockedByGuard).toBe(true);
      expect(assistant.desktopOptions!.guardBlockReason).toBe('Content policy');
    });

    it('scenario 16: isSelectedBranch extracted', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, desktopOptionsSelectedBranch());
      expect(
        result.messages.find((m) => m.role === 'assistant')!.desktopOptions!.isSelectedBranch,
      ).toBe(true);
    });
  });

  // ── 17–19. LLM status preservation ──────────────────────────────

  describe('LLM status preservation', () => {
    it('scenario 17: timeout', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, timeoutResponse());
      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('scenario 18: rate_limited', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, rateLimitedResponse());
      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('scenario 19: invalid_request', async () => {
      const result = await loadWithMessages(repo, mockThreadApi, invalidRequestResponse());
      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });
  });
});
