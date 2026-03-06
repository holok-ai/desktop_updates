/**
 * Models IPC Handler Tests
 *
 * Tests at the IPC handler boundary.
 * Mocks: modelRepository (all methods already return ApiResponse<T>).
 * Verifies every handler passes through the ApiResponse shape correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiOk, apiFail } from '../../../src-electron/types/api-response';
import { expectApiSuccess, expectApiFail } from '../../helpers/api-response.helpers';

// ── Capture IPC handlers ──────────────────────────────────────────

let handlers: Record<string, Function> = {};

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock'), on: vi.fn(), whenReady: () => Promise.resolve() },
  ipcMain: {
    handle: (channel: string, fn: Function) => {
      handlers[channel] = fn;
    },
    removeHandler: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

// ── Mock modelRepository ───────────────────────────────────────────

const mockModelRepo = {
  listAllModels: vi.fn(),
  listAllApplications: vi.fn(),
  getModelsForApplication: vi.fn(),
  getAgentById: vi.fn(),
};

vi.mock('../../../src-electron/repository/model-repository', () => ({
  modelRepository: mockModelRepo,
}));

// ── Fake data ──────────────────────────────────────────────────────

const fakeModel = {
  id: 'model-1',
  title: 'GPT-4',
  accessName: 'gpt-4',
  provider: 'OpenAI',
  applicationName: 'ChatGPT',
  applicationSlug: 'chatgpt',
  slug: 'gpt-4',
  url: 'https://api.openai.com',
  isPublic: true,
};

const fakeApp = {
  id: 'app-1',
  title: 'ChatGPT',
  description: 'Chat powered by OpenAI',
  provider: 'OpenAI',
  slug: 'chatgpt',
  url: 'https://api.openai.com',
  models: [fakeModel],
};

// ── Setup / Teardown ───────────────────────────────────────────────

beforeEach(async () => {
  handlers = {};
  vi.clearAllMocks();

  const mod = await import('../../../src-electron/ipc-handlers/models-handler');
  mod.registerModelsHandlers();
});

afterEach(async () => {
  const mod = await import('../../../src-electron/ipc-handlers/models-handler');
  mod.unregisterModelsHandlers();
});

// ── Tests ──────────────────────────────────────────────────────────

describe('Models IPC Handlers — ApiResponse<T> contract', () => {
  describe('handler registration', () => {
    it('registers all expected channels', () => {
      expect(handlers['models:listAll']).toBeDefined();
      expect(handlers['models:listAllApplications']).toBeDefined();
      expect(handlers['models:getModelsForApplication']).toBeDefined();
      expect(handlers['models:getAgent']).toBeDefined();
    });
  });

  describe('models:listAll', () => {
    it('returns ApiResponse<ModelDetails[]> on success', async () => {
      mockModelRepo.listAllModels.mockResolvedValue(apiOk([fakeModel]));

      const result = await handlers['models:listAll']();

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].accessName).toBe('gpt-4');
    });

    it('returns apiFail when repository fails', async () => {
      mockModelRepo.listAllModels.mockResolvedValue(apiFail(401, 'Not authenticated'));

      const result = await handlers['models:listAll']();

      expectApiFail(result, 401);
    });
  });

  describe('models:listAllApplications', () => {
    it('returns ApiResponse<ApplicationSummary[]> on success', async () => {
      mockModelRepo.listAllApplications.mockResolvedValue(apiOk([fakeApp]));

      const result = await handlers['models:listAllApplications'](null, false);

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].provider).toBe('OpenAI');
    });

    it('passes reloadFromApi parameter', async () => {
      mockModelRepo.listAllApplications.mockResolvedValue(apiOk([]));

      await handlers['models:listAllApplications'](null, true);

      expect(mockModelRepo.listAllApplications).toHaveBeenCalledWith(true);
    });

    it('returns apiFail when API errors', async () => {
      mockModelRepo.listAllApplications.mockResolvedValue(apiFail(500, 'Server error'));

      const result = await handlers['models:listAllApplications'](null, false);

      expectApiFail(result, 500);
    });
  });

  describe('models:getModelsForApplication', () => {
    it('returns ApiResponse<ModelDetails[]> on success', async () => {
      mockModelRepo.getModelsForApplication.mockResolvedValue(apiOk([fakeModel]));

      const result = await handlers['models:getModelsForApplication'](null, 'app-1');

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
    });

    it('passes applicationId parameter', async () => {
      mockModelRepo.getModelsForApplication.mockResolvedValue(apiOk([]));

      await handlers['models:getModelsForApplication'](null, 'app-1');

      expect(mockModelRepo.getModelsForApplication).toHaveBeenCalledWith('app-1');
    });

    it('returns apiFail when application not found', async () => {
      mockModelRepo.getModelsForApplication.mockResolvedValue(
        apiFail(404, 'Application not found'),
      );

      const result = await handlers['models:getModelsForApplication'](null, 'nonexistent');

      expectApiFail(result, 404);
    });
  });

  describe('models:getAgent', () => {
    it('returns ApiResponse<ApplicationSummary> on success', async () => {
      mockModelRepo.getAgentById.mockResolvedValue(apiOk(fakeApp));

      const result = await handlers['models:getAgent'](null, 'agent-1');

      expectApiSuccess(result);
      expect(result.data.id).toBe('app-1');
    });

    it('returns apiFail when agent not found', async () => {
      mockModelRepo.getAgentById.mockResolvedValue(apiFail(404, 'Agent not found'));

      const result = await handlers['models:getAgent'](null, 'nonexistent');

      expectApiFail(result, 404);
    });
  });

  describe('unregisterModelsHandlers', () => {
    it('removes all registered handlers', async () => {
      const { ipcMain } = await import('electron');
      const mod = await import('../../../src-electron/ipc-handlers/models-handler');

      mod.unregisterModelsHandlers();

      expect(ipcMain.removeHandler).toHaveBeenCalledWith('models:listAll');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('models:listAllApplications');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('models:getModelsForApplication');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('models:getAgent');
    });
  });
});
