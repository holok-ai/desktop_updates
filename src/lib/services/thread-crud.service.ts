/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type {
  Thread,
  CreateThreadRequest,
  ModelDetails,
  ApiResponse,
} from '../../../src-electron/preload.js';
import { threads } from '../stores/thread.store.js';
import { BaseElectronService } from './base-electron.service';
import type { ThreadMetadata } from '../../../src-electron/types/thread.types.js';

/**
 * Domain service for thread CRUD operations.
 *
 * Owns:
 * - Thread lifecycle (create, update, rename, delete, softDelete)
 * - Thread listing (getAll, listPersonal, listForProject)
 * - Thread retrieval (getThread)
 * - Thread move (moveToProject)
 * - Agent availability check (isAgentAvailable)
 * - IPC listeners: onThreadCreated, onThreadUpdated, onThreadDeleted
 */
export class ThreadCrudService extends BaseElectronService {
  private constructor() {
    super();
  }

  public static getInstance(): ThreadCrudService {
    return this.getSingletonInstance();
  }

  protected initializeEventListeners(): void {
    // Listen for thread created events
    const unsubCreated = window.electronAPI.thread.onThreadCreated((thread: Thread) => {
      threads.addThread(thread);
    });
    this.registerCleanup(unsubCreated);

    // Listen for thread updated events
    const unsubUpdated = window.electronAPI.thread.onThreadUpdated((thread: Thread) => {
      threads.updateThread(thread);
    });
    this.registerCleanup(unsubUpdated);

    // Listen for thread deleted events
    const unsubDeleted = window.electronAPI.thread.onThreadDeleted((threadId: string) => {
      threads.deleteThread(threadId);
    });
    this.registerCleanup(unsubDeleted);
  }

  async getAll(options?: {
    projectId?: string | null;
    includeProjectOnly?: boolean;
    updateStore?: boolean;
  }): Promise<ApiResponse<Thread[]>> {
    const result = await window.electronAPI.thread.getAll(options);

    if (result.success && options?.updateStore !== false) {
      threads.setThreads(result.data);
    }

    return result;
  }

  /**
   * Get only personal threads (threads without a projectId)
   */
  async listPersonal(): Promise<ApiResponse<Thread[]>> {
    return this.getAll({ projectId: null, updateStore: true });
  }

  /**
   * Get threads for a specific project
   */
  async listForProject(projectId: string): Promise<ApiResponse<Thread[]>> {
    return this.getAll({ projectId, updateStore: true });
  }

  /**
   *
   * create - creates a new thread
   *
   **/
  async create(
    title: string,
    projectId: string | null,
    agentId: string,
    initialModel?: string,
  ): Promise<ApiResponse<Thread>> {
    let selectedModel: ModelDetails | undefined = undefined;
    const agentResult = await window.electronAPI.models.getAgent(agentId);

    if (!agentResult.success) {
      console.error('[ThreadCrudService.create] Agent not found:', agentId);
      return {
        success: false,
        data: null,
        errorCode: -1,
        errorText: `Agent not found: ${agentId}`,
      };
    }
    const agent = agentResult.data;

    // Build metadata object with agent and model information
    const metadata: ThreadMetadata = {
      agentId,
      initialProvider: agent.provider,
      applicationSlug: agent.slug,
    };

    // find the model the caller specified
    if (initialModel) {
      const modelsResult = await window.electronAPI.models.getModelsForApplication(agentId);
      if (modelsResult.success) {
        selectedModel = modelsResult.data.find(
          (m) => m.id === initialModel || m.accessName === initialModel,
        );
      }
    }

    // or use the first one
    if (!selectedModel && agent.models && agent.models?.length > 0) {
      selectedModel = agent.models?.[0];
    }

    if (selectedModel) {
      metadata.modelTitle = selectedModel.title;
      metadata.initalModel = selectedModel.accessName;
      metadata.modelProvider = selectedModel.provider;
    } else {
      console.warn(
        '[ThreadCrudService.create] No model selected - metadata will not include model info',
      );
    }

    const request: CreateThreadRequest = {
      title,
      projectId,
      agentId,
      applicationSlug: agent.slug,
      initalModel: initialModel ?? undefined,
      metadata,
    };
    console.warn('[ThreadCrudService.create] Final request payload:', request);

    return window.electronAPI.thread.create(request);
  }

  async update(id: string, updates: Partial<Thread>): Promise<ApiResponse<Thread>> {
    return window.electronAPI.thread.update(id, updates);
  }

  async rename(threadId: string, newTitle: string): Promise<ApiResponse<Thread>> {
    return window.electronAPI.thread.renameThread(threadId, newTitle);
  }

  async delete(id: string): Promise<ApiResponse<boolean>> {
    return window.electronAPI.thread.delete(id);
  }

  async softDelete(id: string): Promise<ApiResponse<boolean>> {
    return window.electronAPI.thread.softDelete(id);
  }

  async getThread(id: string): Promise<ApiResponse<Thread | null>> {
    const result = await window.electronAPI.thread.getById(id);
    if (result.success && result.data) {
      threads.addThread(result.data);
    }
    return result;
  }

  async moveToProject(
    threadId: string,
    targetProjectId: string | null,
    options?: { privacyMode?: string; contextHandling?: string },
  ): Promise<ApiResponse<Thread>> {
    return window.electronAPI.thread.moveToProject(threadId, targetProjectId, options);
  }

  /**
   * Check whether an agent is still in the available applications list.
   * Returns false if agentId is falsy, not found, or the API call fails.
   */
  async isAgentAvailable(agentId: string | null | undefined): Promise<boolean> {
    if (!agentId) {
      return false;
    }
    const result = await window.electronAPI.models.listAllApplications();
    if (!result.success) {
      return false;
    }
    return result.data.some((a) => a.id === agentId);
  }
}

export const threadCrudService = ThreadCrudService.getInstance();
