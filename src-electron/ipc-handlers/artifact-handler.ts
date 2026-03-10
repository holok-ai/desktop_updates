/**
 * Artifact IPC Handler
 *
 * Registers IPC handlers for all artifact / document editing operations.
 * Follows the pattern of file-handler.ts.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import log from '../utils/logger.js';
import { artifactService } from '../services/artifact.service.js';
import { artifactRepository } from '../repository/artifact-repository.js';
import { fileStorageService } from '../services/file-storage.service.js';
import type {
  Artifact,
  ArtifactVersion,
  DiffResult,
  DiffChange,
} from '../../src-shared/types/artifact.types.js';

/**
 * Register all artifact-related IPC handlers
 */
export function registerArtifactHandlers(): void {
  ipcMain.handle('artifact:activate', handleActivate);
  ipcMain.handle('artifact:initialize', handleInitialize);
  ipcMain.handle('artifact:get', handleGet);
  ipcMain.handle('artifact:addUserVersion', handleAddUserVersion);
  ipcMain.handle('artifact:addAiVersion', handleAddAiVersion);
  ipcMain.handle('artifact:computeDiff', handleComputeDiff);
  ipcMain.handle('artifact:discardVersion', handleDiscardVersion);
  ipcMain.handle('artifact:applyAcceptReject', handleApplyAcceptReject);
  ipcMain.handle('artifact:getPromptAugmentation', handleGetPromptAugmentation);
  ipcMain.handle('artifact:parseAiResponse', handleParseAiResponse);
  ipcMain.handle('artifact:export', handleExport);
  ipcMain.handle('artifact:exportFullHistory', handleExportFullHistory);

  log.info('[ArtifactHandler] Artifact IPC handlers registered');
}

/**
 * Activate document mode on an attachment.
 */
async function handleActivate(
  _event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    fileId: string;
    filename: string;
    mimeType: string;
    maxSizeBytes?: number;
  },
): Promise<{ success: boolean; artifact?: Artifact; error?: string }> {
  try {
    const { threadId, fileId, filename, mimeType, maxSizeBytes } = payload;

    log.info('[ArtifactHandler] Activate request', { threadId, fileId, filename, mimeType });

    if (!threadId || !fileId || !filename || !mimeType) {
      return { success: false, error: 'Missing required fields' };
    }

    // Retrieve file buffer from file storage
    const fileBuffer = await fileStorageService.getFile(threadId, fileId);
    if (!fileBuffer) {
      return { success: false, error: 'File not found in storage' };
    }

    const artifact = await artifactService.activateDocumentMode(
      threadId,
      filename,
      mimeType,
      fileBuffer,
      maxSizeBytes,
    );

    return { success: true, artifact };
  } catch (error) {
    log.error('[ArtifactHandler] Activate error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during activation',
    };
  }
}

/**
 * Initialize a blank artifact for Composer mode (no file buffer needed).
 */
async function handleInitialize(
  _event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    filename: string;
    content: string;
    changeSummary?: string;
  },
): Promise<{ success: boolean; artifact?: Artifact; error?: string }> {
  try {
    const { threadId, filename, content, changeSummary } = payload;

    log.info('[ArtifactHandler] Initialize request', { threadId, filename });

    if (!threadId || !filename) {
      return { success: false, error: 'Missing required fields (threadId, filename)' };
    }

    const artifact = await artifactRepository.createArtifact(
      threadId,
      filename,
      'text/markdown',
      content || '',
      changeSummary || 'Initial document',
    );

    return { success: true, artifact };
  } catch (error) {
    log.error('[ArtifactHandler] Initialize error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during initialization',
    };
  }
}

/**
 * Get the artifact for a thread.
 */
async function handleGet(
  _event: IpcMainInvokeEvent,
  payload: { threadId: string },
): Promise<{ success: boolean; artifact?: Artifact | null; error?: string }> {
  try {
    const { threadId } = payload;
    const artifact = await artifactService.getArtifact(threadId);
    return { success: true, artifact };
  } catch (error) {
    log.error('[ArtifactHandler] Get error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Add a version (user or AI attributed).
 */
async function handleAddUserVersion(
  _event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    content: string;
    sourceAction: string;
    attribution?: string;
    changeSummary?: string;
    title?: string;
  },
): Promise<{ success: boolean; version?: ArtifactVersion | null; error?: string }> {
  try {
    const { threadId, content, sourceAction, attribution, changeSummary, title } = payload;

    if (!threadId || content === undefined || !sourceAction) {
      return { success: false, error: 'Missing required fields' };
    }

    const version = await artifactService.addVersion(threadId, {
      content,
      sourceAction: sourceAction as ArtifactVersion['sourceAction'],
      attribution: (attribution as ArtifactVersion['attribution']) ?? 'user',
      changeSummary: changeSummary ?? 'User edit',
      title,
    });

    return { success: true, version };
  } catch (error) {
    log.error('[ArtifactHandler] AddUserVersion error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Add an AI-attributed version from structured diff output.
 */
async function handleAddAiVersion(
  _event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    diff: string;
    summary: string;
  },
): Promise<{ success: boolean; version?: ArtifactVersion | null; error?: string }> {
  try {
    const { threadId, diff, summary } = payload;

    if (!threadId || !diff || !summary) {
      return { success: false, error: 'Missing required fields' };
    }

    const version = await artifactService.addAiVersion(threadId, diff, summary);
    return { success: true, version };
  } catch (error) {
    log.error('[ArtifactHandler] AddAiVersion error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Compute diff between two versions.
 */
async function handleComputeDiff(
  _event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    baseVersionId: number;
    targetVersionId: number;
  },
): Promise<{ success: boolean; diff?: DiffResult; error?: string }> {
  try {
    const { threadId, baseVersionId, targetVersionId } = payload;

    if (!threadId || baseVersionId === undefined || targetVersionId === undefined) {
      return { success: false, error: 'Missing required fields' };
    }

    const diff = await artifactService.computeDiff(threadId, baseVersionId, targetVersionId);
    return { success: true, diff };
  } catch (error) {
    log.error('[ArtifactHandler] ComputeDiff error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Discard the most recent version.
 */
async function handleDiscardVersion(
  _event: IpcMainInvokeEvent,
  payload: { threadId: string },
): Promise<{ success: boolean; artifact?: Artifact; error?: string }> {
  try {
    const { threadId } = payload;

    if (!threadId) {
      return { success: false, error: 'Missing threadId' };
    }

    const artifact = await artifactService.discardLatestVersion(threadId);
    return { success: true, artifact };
  } catch (error) {
    log.error('[ArtifactHandler] DiscardVersion error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Apply accept/reject resolutions and create a new version.
 */
async function handleApplyAcceptReject(
  _event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    baseVersionId: number;
    targetVersionId: number;
    resolvedChanges: DiffChange[];
    sourceAction: 'accept_change' | 'reject_change';
  },
): Promise<{ success: boolean; version?: ArtifactVersion | null; error?: string }> {
  try {
    const { threadId, baseVersionId, targetVersionId, resolvedChanges, sourceAction } = payload;

    if (!threadId || !resolvedChanges || !sourceAction) {
      return { success: false, error: 'Missing required fields' };
    }

    const version = await artifactService.applyAcceptReject(
      threadId,
      baseVersionId,
      targetVersionId,
      resolvedChanges,
      sourceAction,
    );

    return { success: true, version };
  } catch (error) {
    log.error('[ArtifactHandler] ApplyAcceptReject error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get prompt augmentation text for document mode.
 */
async function handleGetPromptAugmentation(
  _event: IpcMainInvokeEvent,
  payload: { threadId: string },
): Promise<{ success: boolean; augmentation?: string; error?: string }> {
  try {
    const { threadId } = payload;

    const artifact = await artifactService.getArtifact(threadId);

    let augmentation: string;
    if (!artifact || artifact.versions.length === 0) {
      // No artifact yet — use creation-mode augmentation
      augmentation = artifactService.getCreationAugmentation();
    } else {
      // Existing artifact — use edit-mode augmentation
      const currentContent = artifact.versions[artifact.versions.length - 1].content;
      augmentation = artifactService.getPromptAugmentation(
        artifact.id,
        artifact.filename,
        artifact.originalMimeType,
        currentContent,
      );
    }

    return { success: true, augmentation };
  } catch (error) {
    log.error('[ArtifactHandler] GetPromptAugmentation error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse an AI response for structured diff output.
 */
function handleParseAiResponse(
  _event: IpcMainInvokeEvent,
  payload: { responseContent: string },
): {
  success: boolean;
  parsed?: { diff: string; summary: string } | null;
  error?: string;
} {
  try {
    const { responseContent } = payload;
    const parsed = artifactService.parseAiDiffResponse(responseContent);
    return { success: true, parsed };
  } catch (error) {
    log.error('[ArtifactHandler] ParseAiResponse error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export document content.
 */
function handleExport(
  _event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    withMarkup: boolean;
    baseVersionId?: number;
    targetVersionId?: number;
  },
): { success: boolean; content?: string; error?: string } {
  try {
    const { threadId, withMarkup, baseVersionId, targetVersionId } = payload;

    const content = artifactService.getExportContent(
      threadId,
      withMarkup,
      baseVersionId,
      targetVersionId,
    );

    return { success: true, content };
  } catch (error) {
    log.error('[ArtifactHandler] Export error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export full change history.
 */
function handleExportFullHistory(
  _event: IpcMainInvokeEvent,
  payload: { threadId: string },
): { success: boolean; content?: string; error?: string } {
  try {
    const { threadId } = payload;
    const content = artifactService.getFullChangeHistoryExport(threadId);
    return { success: true, content };
  } catch (error) {
    log.error('[ArtifactHandler] ExportFullHistory error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
