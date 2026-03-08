/* eslint-disable security/detect-object-injection */
/**
 * ArtifactService
 *
 * Orchestration layer for document editing / artifact versioning.
 * Coordinates the repository, conversion service, and diff service.
 * This is the single entry point called by the IPC handler.
 */

import log from '../utils/logger.js';
import { artifactRepository } from '../repository/artifact-repository.js';
import { documentConversionService } from './document-conversion.service.js';
import { diffService } from './diff.service.js';
import type {
  Artifact,
  ArtifactVersion,
  AiDiffResponse,
  DiffResult,
  DiffChange,
  VersionSourceAction,
  ArtifactAttributionSource,
} from '../../src-shared/types/artifact.types.js';

export class ArtifactService {
  /**
   * Activate document mode on an attachment.
   * Converts the file to Markdown (if needed) and creates the artifact with version 1.
   */
  async activateDocumentMode(
    threadId: string,
    filename: string,
    mimeType: string,
    fileBuffer: Buffer,
    maxSizeBytes: number = 2 * 1024 * 1024,
  ): Promise<Artifact> {
    // Validate file size
    if (!this.validateDocumentSize(fileBuffer.length, maxSizeBytes)) {
      const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      throw new Error(`Document exceeds maximum editable size of ${maxMB} MB`);
    }

    // Validate convertible type
    if (!documentConversionService.isConvertibleType(mimeType)) {
      throw new Error(`Unsupported document type: ${mimeType}`);
    }

    // Convert to canonical Markdown
    const markdownContent = await documentConversionService.convertToMarkdown(fileBuffer, mimeType);

    // Create the artifact with version 1
    const artifact = await artifactRepository.createArtifact(
      threadId,
      filename,
      mimeType,
      markdownContent,
      'Initial document',
    );

    log.info('[ArtifactService] Document mode activated', {
      threadId,
      artifactId: artifact.id,
      filename,
      mimeType,
      contentLength: markdownContent.length,
    });

    return artifact;
  }

  /**
   * Add an AI-attributed version from a parsed structured diff response.
   * Applies the diff to the current version's content to produce the new version.
   */
  async addAiVersion(
    threadId: string,
    diffText: string,
    changeSummary: string,
  ): Promise<ArtifactVersion> {
    const artifact = await artifactRepository.getArtifact(threadId);
    if (!artifact) {
      throw new Error(`[ArtifactService] No artifact found for thread: ${threadId}`);
    }

    const currentVersion = artifact.versions[artifact.versions.length - 1];

    // Apply the diff to current content
    let newContent: string;
    try {
      newContent = diffService.applyUnifiedDiff(currentVersion.content, diffText);
    } catch (error) {
      log.error('[ArtifactService] Failed to apply AI diff, storing diff as-is', {
        threadId,
        error,
      });
      throw new Error(
        `Failed to apply AI diff: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const version = await artifactRepository.addVersion(
      threadId,
      newContent,
      'ai',
      'attachment_edit',
      changeSummary,
      diffText,
    );

    log.info('[ArtifactService] AI version added', {
      threadId,
      versionId: version.id,
      changeSummary,
    });

    return version;
  }

  /**
   * Add a user-attributed version (from direct editing, auto-save, export, or prompt submit).
   */
  async addUserVersion(
    threadId: string,
    content: string,
    sourceAction: VersionSourceAction,
  ): Promise<ArtifactVersion> {
    const artifact = await artifactRepository.getArtifact(threadId);
    if (!artifact) {
      throw new Error(`[ArtifactService] No artifact found for thread: ${threadId}`);
    }

    const currentVersion = artifact.versions[artifact.versions.length - 1];

    // Compute diff from current to new content
    const diff = diffService.computeUnifiedDiff(currentVersion.content, content);

    const version = await artifactRepository.addVersion(
      threadId,
      content,
      'user',
      sourceAction,
      'User edit',
      diff,
    );

    log.info('[ArtifactService] User version added', {
      threadId,
      versionId: version.id,
      sourceAction,
    });

    return version;
  }

  /**
   * Compute a diff between any two versions of an artifact.
   */
  /* eslint-disable-next-line @typescript-eslint/require-await */
  async computeDiff(
    threadId: string,
    baseVersionId: number,
    targetVersionId: number,
  ): Promise<DiffResult> {
    const baseVersion = artifactRepository.getVersion(threadId, baseVersionId);
    const targetVersion = artifactRepository.getVersion(threadId, targetVersionId);

    if (!baseVersion) {
      throw new Error(`[ArtifactService] Base version ${baseVersionId} not found`);
    }
    if (!targetVersion) {
      throw new Error(`[ArtifactService] Target version ${targetVersionId} not found`);
    }

    const attribution: ArtifactAttributionSource = targetVersion.attribution;

    return diffService.computeDiffResult(
      baseVersion.content,
      targetVersion.content,
      baseVersionId,
      targetVersionId,
      attribution,
    );
  }

  /**
   * Discard the most recent version. Returns the updated artifact.
   */
  async discardLatestVersion(threadId: string): Promise<Artifact> {
    return artifactRepository.discardLatestVersion(threadId);
  }

  /**
   * Apply accept/reject resolutions to produce a new version.
   */
  async applyAcceptReject(
    threadId: string,
    baseVersionId: number,
    targetVersionId: number,
    resolvedChanges: DiffChange[],
    sourceAction: 'accept_change' | 'reject_change',
  ): Promise<ArtifactVersion> {
    const baseVersion = artifactRepository.getVersion(threadId, baseVersionId);
    const targetVersion = artifactRepository.getVersion(threadId, targetVersionId);

    if (!baseVersion || !targetVersion) {
      throw new Error('[ArtifactService] Base or target version not found');
    }

    const newContent = diffService.applyAcceptReject(
      baseVersion.content,
      targetVersion.content,
      resolvedChanges,
    );

    const accepted = resolvedChanges.filter((c) => c.resolved === 'accepted').length;
    const rejected = resolvedChanges.filter((c) => c.resolved === 'rejected').length;
    const summary = `${accepted} change(s) accepted, ${rejected} change(s) rejected`;

    const diff = diffService.computeUnifiedDiff(
      artifactRepository.getVersion(threadId, targetVersionId)?.content ?? '',
      newContent,
    );

    return artifactRepository.addVersion(threadId, newContent, 'user', sourceAction, summary, diff);
  }

  /**
   * Get the current artifact for a thread.
   */
  async getArtifact(threadId: string): Promise<Artifact | null> {
    return artifactRepository.getArtifact(threadId);
  }

  /**
   * Validate document size against a configured maximum.
   */
  validateDocumentSize(sizeBytes: number, maxSizeBytes: number): boolean {
    return sizeBytes <= maxSizeBytes;
  }

  /**
   * Build prompt augmentation text for document mode.
   * This is appended to every user prompt when document mode is active.
   */
  getPromptAugmentation(currentContent: string): string {
    return [
      'You are editing a document. The current document content is provided below.',
      'When making changes, respond with ONLY a JSON object inside a fenced code block containing:',
      '1. "diff": A GitHub unified diff (with @@ hunks, + and - lines) of your changes against the current document.',
      '2. "summary": A concise human-readable description of what you changed and why.',
      '',
      'Current document:',
      '```markdown',
      currentContent,
      '```',
      '',
      'Respond in this exact format:',
      '```json',
      '{"diff": "--- a/document\\n+++ b/document\\n@@ ... @@\\n ...","summary": "..."}',
      '```',
    ].join('\n');
  }

  /**
   * Parse an AI response to extract the structured diff output.
   * Returns null if the response doesn't contain valid structured output.
   */
  parseAiDiffResponse(responseContent: string): AiDiffResponse | null {
    try {
      // Look for a fenced JSON code block
      const jsonBlockRegex = /```json\s*\n([\s\S]*?)```/;
      const match = responseContent.match(jsonBlockRegex);

      if (!match || !match[1]) {
        // Try bare JSON object
        const bareJsonRegex = /\{[\s\S]*"diff"[\s\S]*"summary"[\s\S]*\}/;
        const bareMatch = responseContent.match(bareJsonRegex);
        if (!bareMatch) {
          log.warn('[ArtifactService] No structured diff found in AI response');
          return null;
        }

        const parsed = JSON.parse(bareMatch[0]) as Record<string, unknown>;
        if (typeof parsed.diff === 'string' && typeof parsed.summary === 'string') {
          return { diff: parsed.diff, summary: parsed.summary };
        }
        return null;
      }

      const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;

      if (typeof parsed.diff !== 'string' || typeof parsed.summary !== 'string') {
        log.warn('[ArtifactService] AI response JSON missing diff or summary fields');
        return null;
      }

      return {
        diff: parsed.diff,
        summary: parsed.summary,
      };
    } catch (error) {
      log.error('[ArtifactService] Failed to parse AI diff response', { error });
      return null;
    }
  }

  /**
   * Get export content for a specific version (with or without diff markup).
   */
  getExportContent(
    threadId: string,
    withMarkup: boolean,
    baseVersionId?: number,
    targetVersionId?: number,
  ): string {
    const latestId = this.getLatestVersionId(threadId);
    const version = artifactRepository.getVersion(threadId, targetVersionId ?? latestId);

    if (!version) {
      throw new Error('[ArtifactService] Version not found for export');
    }

    if (!withMarkup) {
      return version.content;
    }

    // With markup: generate annotated content showing changes
    if (baseVersionId !== undefined && targetVersionId !== undefined) {
      const baseVersion = artifactRepository.getVersion(threadId, baseVersionId);
      if (baseVersion) {
        const diff = diffService.computeUnifiedDiff(baseVersion.content, version.content);
        return `<!-- Changes from version ${baseVersionId} to ${targetVersionId} -->\n\n${diff}\n\n---\n\n${version.content}`;
      }
    }

    return version.content;
  }

  /**
   * Get full change history export content (all versions with summaries).
   */
  getFullChangeHistoryExport(threadId: string): string {
    const artifactData = artifactRepository.getArtifactFromCache(threadId);
    if (!artifactData) {
      throw new Error('[ArtifactService] No artifact found for export');
    }

    const sections: string[] = [];
    sections.push(`# Change History: ${artifactData.filename}\n`);

    for (let i = 0; i < artifactData.versions.length; i++) {
      const version = artifactData.versions[i];
      sections.push(`## Version ${version.id}`);
      sections.push(`**Attribution:** ${version.attribution}`);
      sections.push(`**Date:** ${new Date(version.createdAt).toISOString()}`);
      sections.push(`**Summary:** ${version.changeSummary}`);
      sections.push('');

      if (version.diffFromPrevious && i > 0) {
        sections.push('### Changes');
        sections.push('```diff');
        sections.push(version.diffFromPrevious);
        sections.push('```');
        sections.push('');
      }

      sections.push('### Content');
      sections.push('```markdown');
      sections.push(version.content);
      sections.push('```');
      sections.push('\n---\n');
    }

    return sections.join('\n');
  }

  // ── Private helpers ──

  private getLatestVersionId(threadId: string): number {
    const artifactData = artifactRepository.getArtifactFromCache(threadId);
    if (!artifactData || artifactData.versions.length === 0) {
      throw new Error('[ArtifactService] No versions found');
    }
    return artifactData.versions[artifactData.versions.length - 1].id;
  }
}

export const artifactService = new ArtifactService();
