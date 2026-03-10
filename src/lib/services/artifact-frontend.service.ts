/**
 * Frontend service for artifact editing operations.
 * Thin wrapper around window.electronAPI.artifact IPC calls.
 */
import { BaseElectronService } from './base-electron.service';
import type {
  Artifact,
  ArtifactVersion,
  DiffChange,
  DiffResult,
} from '../../../src-shared/types/artifact.types';

export class ArtifactFrontendService extends BaseElectronService {
  private constructor() {
    super();
  }

  public static getInstance(): ArtifactFrontendService {
    return this.getSingletonInstance();
  }

  protected initializeEventListeners(): void {
    // No IPC event listeners needed — all operations are request/response
  }

  async activate(params: {
    threadId: string;
    fileId: string;
    filename: string;
    mimeType: string;
    maxSizeBytes?: number;
  }): Promise<{ success: boolean; artifact?: Artifact; error?: string }> {
    return window.electronAPI.artifact.activate(params);
  }

  /** Initialize a blank artifact for Composer mode (no file buffer needed). */
  async initialize(
    threadId: string,
    filename: string,
    content: string,
    changeSummary?: string,
  ): Promise<{ success: boolean; artifact?: Artifact; error?: string }> {
    return window.electronAPI.artifact.initialize({ threadId, filename, content, changeSummary });
  }

  async get(
    threadId: string,
  ): Promise<{ success: boolean; artifact?: Artifact | null; error?: string }> {
    return window.electronAPI.artifact.get({ threadId });
  }

  async computeDiff(
    threadId: string,
    baseVersionId: number,
    targetVersionId: number,
  ): Promise<{ success: boolean; diff?: DiffResult; error?: string }> {
    return window.electronAPI.artifact.computeDiff({ threadId, baseVersionId, targetVersionId });
  }

  async getPromptAugmentation(
    threadId: string,
  ): Promise<{ success: boolean; augmentation?: string; error?: string }> {
    return window.electronAPI.artifact.getPromptAugmentation({ threadId });
  }

  async parseAiResponse(responseContent: string): Promise<{
    success: boolean;
    parsed?: { diff: string; summary: string } | null;
    error?: string;
  }> {
    return window.electronAPI.artifact.parseAiResponse({ responseContent });
  }

  async addAiVersion(
    threadId: string,
    diff: string,
    summary: string,
  ): Promise<{ success: boolean; version?: ArtifactVersion; error?: string }> {
    return window.electronAPI.artifact.addAiVersion({ threadId, diff, summary });
  }

  async applyAcceptReject(
    threadId: string,
    baseVersionId: number,
    targetVersionId: number,
    resolvedChanges: DiffChange[],
    sourceAction: 'accept_change' | 'reject_change',
  ): Promise<{ success: boolean; version?: ArtifactVersion; error?: string }> {
    return window.electronAPI.artifact.applyAcceptReject({
      threadId,
      baseVersionId,
      targetVersionId,
      resolvedChanges,
      sourceAction,
    });
  }

  async exportDocument(
    threadId: string,
    withMarkup: boolean,
    baseVersionId?: number,
    targetVersionId?: number,
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    return window.electronAPI.artifact.export({
      threadId,
      withMarkup,
      baseVersionId,
      targetVersionId,
    });
  }

  async addUserVersion(
    threadId: string,
    content: string,
    sourceAction: string,
    attribution?: string,
    changeSummary?: string,
    title?: string,
  ): Promise<{ success: boolean; version?: ArtifactVersion | null; error?: string }> {
    return window.electronAPI.artifact.addUserVersion({
      threadId,
      content,
      sourceAction,
      attribution,
      changeSummary,
      title,
    });
  }

  async discardVersion(
    threadId: string,
  ): Promise<{ success: boolean; artifact?: Artifact; error?: string }> {
    return window.electronAPI.artifact.discardVersion({ threadId });
  }
}

export const artifactFrontendService = ArtifactFrontendService.getInstance();
