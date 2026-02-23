/**
 * ThreadCrudService — unit tests for CRUD domain
 *
 * Tests cover:
 *   - create: agent resolution, model selection, metadata building
 *   - isAgentAvailable: agent lookup logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiResponse } from '../../../src-electron/preload';

// ── Helpers ───────────────────────────────────────────────────────

function apiOk<T>(data: T): ApiResponse<T> {
  return { success: true, data, errorCode: 0, errorText: '' };
}
function apiFail<T>(errorCode: number, errorText: string): ApiResponse<T> {
  return { success: false, data: null, errorCode, errorText } as ApiResponse<T>;
}

// ── Mock electronAPI ──────────────────────────────────────────────

const mockThreadApi = {
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  softDelete: vi.fn(),
  renameThread: vi.fn(),
  getMessages: vi.fn(),
  moveToProject: vi.fn(),
  appendMessage: vi.fn(),
  updateMessage: vi.fn(),
  updateMessageBranch: vi.fn(),
  updateMessageDesktopOptions: vi.fn(),
  deleteBranch: vi.fn(),
  onThreadCreated: vi.fn(() => vi.fn()),
  onThreadUpdated: vi.fn(() => vi.fn()),
  onThreadDeleted: vi.fn(() => vi.fn()),
};

const mockModelsApi = {
  getAgent: vi.fn(),
  getModelsForApplication: vi.fn(),
  listAllApplications: vi.fn(),
  listAll: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: {
    thread: mockThreadApi,
    chat: {
      createServiceForThread: vi.fn(),
      chat: vi.fn(),
      onToken: vi.fn(() => vi.fn()),
      onToolUse: vi.fn(() => vi.fn()),
      onToolStatus: vi.fn(() => vi.fn()),
      getAuditLogs: vi.fn(),
    },
    models: mockModelsApi,
    auth: {},
    settings: {},
    system: {},
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    onMenuCommand: vi.fn(),
  },
  writable: true,
  configurable: true,
});

vi.mock('$lib/stores/thread.store', () => ({
  threads: {
    setThreads: vi.fn(),
    addThread: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

let ThreadCrudService: typeof import('$lib/services/thread-crud.service').ThreadCrudService;
let crudService: InstanceType<typeof ThreadCrudService>;

beforeEach(async () => {
  vi.clearAllMocks();

  const baseModule = await import('$lib/services/base-electron.service');
  const BaseClass = baseModule.BaseElectronService as unknown as {
    instances: Map<string, unknown>;
  };
  if (BaseClass.instances) {
    BaseClass.instances.clear();
  }

  const mod = await import('$lib/services/thread-crud.service');
  ThreadCrudService = mod.ThreadCrudService;
  crudService = ThreadCrudService.getInstance();
});

// ═══════════════════════════════════════════════════════════════════
// create
// ═══════════════════════════════════════════════════════════════════

describe('create', () => {
  it('returns failure when agent is not found', async () => {
    mockModelsApi.getAgent.mockResolvedValue(apiFail(-1, 'not found'));

    const result = await crudService.create('Title', null, 'agent-missing');
    expect(result.success).toBe(false);
    expect(result.errorText).toContain('Agent not found');
  });

  it('builds metadata with agent info and creates thread', async () => {
    const agent = {
      id: 'agent-1',
      provider: 'openai',
      slug: 'my-agent',
      models: [{ id: 'm1', title: 'GPT-4', accessName: 'gpt-4', provider: 'openai' }],
    };
    mockModelsApi.getAgent.mockResolvedValue(apiOk(agent));
    mockThreadApi.create.mockResolvedValue(apiOk({ id: 'new-thread', title: 'Title' }));

    const result = await crudService.create('Title', 'proj-1', 'agent-1');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Title',
        projectId: 'proj-1',
        agentId: 'agent-1',
        applicationSlug: 'my-agent',
        metadata: expect.objectContaining({
          agentId: 'agent-1',
          initialProvider: 'openai',
          applicationSlug: 'my-agent',
          modelTitle: 'GPT-4',
          initalModel: 'gpt-4',
          modelProvider: 'openai',
        }),
      }),
    );
    expect(result.success).toBe(true);
  });

  it('selects specific model when initialModel matches', async () => {
    const agent = {
      id: 'agent-1',
      provider: 'openai',
      slug: 'slug',
      models: [
        { id: 'm1', title: 'GPT-3.5', accessName: 'gpt-3.5', provider: 'openai' },
        { id: 'm2', title: 'GPT-4', accessName: 'gpt-4', provider: 'openai' },
      ],
    };
    mockModelsApi.getAgent.mockResolvedValue(apiOk(agent));
    mockModelsApi.getModelsForApplication.mockResolvedValue(apiOk(agent.models));
    mockThreadApi.create.mockResolvedValue(apiOk({ id: 't1', title: 'T' }));

    await crudService.create('T', null, 'agent-1', 'gpt-4');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          modelTitle: 'GPT-4',
          initalModel: 'gpt-4',
        }),
      }),
    );
  });

  it('falls back to first agent model when initialModel not specified', async () => {
    const agent = {
      id: 'agent-1',
      provider: 'openai',
      slug: 'slug',
      models: [{ id: 'm1', title: 'Default Model', accessName: 'default', provider: 'openai' }],
    };
    mockModelsApi.getAgent.mockResolvedValue(apiOk(agent));
    mockThreadApi.create.mockResolvedValue(apiOk({ id: 't1', title: 'T' }));

    await crudService.create('T', null, 'agent-1');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          modelTitle: 'Default Model',
          initalModel: 'default',
        }),
      }),
    );
  });

  it('creates thread without model metadata when no models available', async () => {
    const agent = {
      id: 'agent-1',
      provider: 'openai',
      slug: 'slug',
      models: [],
    };
    mockModelsApi.getAgent.mockResolvedValue(apiOk(agent));
    mockThreadApi.create.mockResolvedValue(apiOk({ id: 't1', title: 'T' }));

    await crudService.create('T', null, 'agent-1');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          modelTitle: expect.anything(),
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// isAgentAvailable
// ═══════════════════════════════════════════════════════════════════

describe('isAgentAvailable', () => {
  it('returns false for null agentId', async () => {
    expect(await crudService.isAgentAvailable(null)).toBe(false);
  });

  it('returns false for undefined agentId', async () => {
    expect(await crudService.isAgentAvailable(undefined)).toBe(false);
  });

  it('returns false for empty string agentId', async () => {
    expect(await crudService.isAgentAvailable('')).toBe(false);
  });

  it('returns false when API call fails', async () => {
    mockModelsApi.listAllApplications.mockResolvedValue(apiFail(-1, 'error'));
    expect(await crudService.isAgentAvailable('agent-1')).toBe(false);
  });

  it('returns false when agent not in list', async () => {
    mockModelsApi.listAllApplications.mockResolvedValue(
      apiOk([{ id: 'other-agent', title: 'Other' }]),
    );
    expect(await crudService.isAgentAvailable('agent-1')).toBe(false);
  });

  it('returns true when agent is in list', async () => {
    mockModelsApi.listAllApplications.mockResolvedValue(
      apiOk([
        { id: 'agent-1', title: 'My Agent' },
        { id: 'agent-2', title: 'Other' },
      ]),
    );
    expect(await crudService.isAgentAvailable('agent-1')).toBe(true);
  });
});
