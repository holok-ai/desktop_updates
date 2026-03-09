/**
 * Store for artifact editing state per thread.
 *
 * Manages document mode activation, version comparison, diff state,
 * change resolutions, and display preferences. All backend operations
 * are delegated to artifactFrontendService.
 */

import { writable, get } from 'svelte/store';
import { artifactFrontendService } from '$lib/services/artifact-frontend.service';
import type {
  Artifact,
  ArtifactVersion,
  DiffResult,
  DisplayStyle,
} from '../../../src-shared/types/artifact.types';

interface ComparisonScope {
  baseVersionId: number;
  targetVersionId: number;
}

interface ArtifactState {
  /** Active artifacts keyed by threadId */
  artifacts: Map<string, Artifact>;
  /** Current diff result for display, keyed by threadId */
  diffs: Map<string, DiffResult>;
  /** Display style per thread */
  displayStyles: Map<string, DisplayStyle>;
  /** Comparison scope per thread */
  comparisonScope: Map<string, ComparisonScope>;
  /** Loading flags per thread */
  loading: Map<string, boolean>;
  /** Error messages per thread */
  errors: Map<string, string>;
}

function createInitialState(): ArtifactState {
  return {
    artifacts: new Map(),
    diffs: new Map(),
    displayStyles: new Map(),
    comparisonScope: new Map(),
    loading: new Map(),
    errors: new Map(),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createArtifactStore() {
  const { subscribe, update } = writable<ArtifactState>(createInitialState());

  function getState(): ArtifactState {
    return get({ subscribe });
  }

  /** Compute diff between two versions and store the result */
  async function computeDiffInternal(
    threadId: string,
    baseVersionId: number,
    targetVersionId: number,
  ): Promise<void> {
    const result = await artifactFrontendService.computeDiff(
      threadId,
      baseVersionId,
      targetVersionId,
    );
    if (result.success && result.diff !== undefined) {
      const { diff } = result;
      update((s) => {
        s.diffs.set(threadId, diff);
        s.comparisonScope.set(threadId, { baseVersionId, targetVersionId });
        return { ...s };
      });
    }
  }

  /** Refresh the artifact after a backend change (new version, discard, etc.) */
  async function refreshArtifactInternal(threadId: string): Promise<void> {
    const result = await artifactFrontendService.get(threadId);
    if (result.success && result.artifact !== null && result.artifact !== undefined) {
      const { artifact } = result;
      update((s) => {
        s.artifacts.set(threadId, artifact);
        s.loading.set(threadId, false);

        // Reset scope to latest step but clear diff — rendered markdown is the
        // default view. Diffs are computed on demand via version navigation.
        s.diffs.delete(threadId);
        if (artifact.versions.length >= 2) {
          const scope: ComparisonScope = {
            baseVersionId: artifact.versions.length - 1,
            targetVersionId: artifact.versions.length,
          };
          s.comparisonScope.set(threadId, scope);
        } else {
          s.comparisonScope.delete(threadId);
        }
        return { ...s };
      });
    }
  }

  return {
    subscribe,

    /** Check if document mode is active for a thread */
    isActive(threadId: string): boolean {
      return getState().artifacts.has(threadId);
    },

    /** Get the artifact for a thread (synchronous, from store) */
    getArtifact(threadId: string): Artifact | null {
      return getState().artifacts.get(threadId) ?? null;
    },

    /** Get the current diff for a thread */
    getDiff(threadId: string): DiffResult | null {
      return getState().diffs.get(threadId) ?? null;
    },

    /** Get comparison scope for a thread */
    getScope(threadId: string): ComparisonScope | null {
      return getState().comparisonScope.get(threadId) ?? null;
    },

    /** Get display style for a thread */
    getDisplayStyle(threadId: string): DisplayStyle {
      return getState().displayStyles.get(threadId) ?? 'inline-markup';
    },

    /** Check if loading for a thread */
    isLoading(threadId: string): boolean {
      return getState().loading.get(threadId) ?? false;
    },

    /** Get error for a thread */
    getError(threadId: string): string | null {
      return getState().errors.get(threadId) ?? null;
    },

    /** Find a version by ID, falling back to versionDescription match */
    getVersion(
      threadId: string,
      versionId?: number,
      versionDescription?: string,
    ): ArtifactVersion | null {
      const artifact = getState().artifacts.get(threadId);
      if (artifact === undefined) {
        return null;
      }

      if (versionId !== undefined && versionId > 0) {
        const byId = artifact.versions.find((v) => v.id === versionId);
        if (byId !== undefined) {
          return byId;
        }
      }

      if (versionDescription !== undefined && versionDescription !== '') {
        const byDesc = artifact.versions.find((v) => v.changeSummary === versionDescription);
        if (byDesc !== undefined) {
          return byDesc;
        }
      }

      return null;
    },

    /** Activate document mode on an attachment */
    async activate(params: {
      threadId: string;
      fileId: string;
      filename: string;
      mimeType: string;
    }): Promise<boolean> {
      update((s) => {
        s.loading.set(params.threadId, true);
        s.errors.delete(params.threadId);
        return { ...s };
      });

      const result = await artifactFrontendService.activate(params);

      if (result.success && result.artifact !== undefined) {
        const { artifact } = result;
        update((s) => {
          s.artifacts.set(params.threadId, artifact);
          s.displayStyles.set(params.threadId, 'inline-markup');
          s.loading.set(params.threadId, false);

          // Set initial comparison scope (no diff — rendered markdown by default)
          if (artifact.versions.length >= 2) {
            const scope: ComparisonScope = {
              baseVersionId: artifact.versions.length - 1,
              targetVersionId: artifact.versions.length,
            };
            s.comparisonScope.set(params.threadId, scope);
          }
          return { ...s };
        });

        return true;
      }

      update((s) => {
        s.loading.set(params.threadId, false);
        s.errors.set(params.threadId, result.error ?? 'Failed to activate document mode');
        return { ...s };
      });
      return false;
    },

    /** Activate document mode from a pre-created artifact (for Composer mode). */
    activateFromArtifact(threadId: string, artifact: Artifact): void {
      update((s) => {
        s.artifacts.set(threadId, artifact);
        s.displayStyles.set(threadId, 'inline-markup');
        s.loading.set(threadId, false);
        s.errors.delete(threadId);
        return { ...s };
      });
    },

    /** Load existing artifact for a thread (on mount / thread switch) */
    async loadForThread(threadId: string): Promise<void> {
      const result = await artifactFrontendService.get(threadId);
      if (result.success && result.artifact !== null && result.artifact !== undefined) {
        const { artifact } = result;
        update((s) => {
          s.artifacts.set(threadId, artifact);
          if (!s.displayStyles.has(threadId)) {
            s.displayStyles.set(threadId, 'inline-markup');
          }

          // Set comparison scope to last step (no diff — rendered markdown by default)
          if (artifact.versions.length >= 2) {
            const scope: ComparisonScope = {
              baseVersionId: artifact.versions.length - 1,
              targetVersionId: artifact.versions.length,
            };
            s.comparisonScope.set(threadId, scope);
          }
          return { ...s };
        });
      }
    },

    /** Compute diff between two versions and store the result */
    computeDiff: computeDiffInternal,

    /** Navigate version comparison (prev/next step) */
    async navigateVersion(threadId: string, direction: 'prev' | 'next'): Promise<void> {
      const state = getState();
      const artifact = state.artifacts.get(threadId);
      const scope = state.comparisonScope.get(threadId);
      if (artifact === undefined || scope === undefined) {
        return;
      }

      const totalVersions = artifact.versions.length;
      let newBase: number;
      let newTarget: number;

      if (direction === 'prev') {
        if (scope.baseVersionId <= 1) {
          return; // Already at the beginning
        }
        newBase = scope.baseVersionId - 1;
        newTarget = scope.targetVersionId - 1;
      } else {
        if (scope.targetVersionId >= totalVersions) {
          return; // Already at the end
        }
        newBase = scope.baseVersionId + 1;
        newTarget = scope.targetVersionId + 1;
      }

      await computeDiffInternal(threadId, newBase, newTarget);
    },

    /** Set the display style for a thread */
    setDisplayStyle(threadId: string, style: DisplayStyle): void {
      update((s) => {
        s.displayStyles.set(threadId, style);
        return { ...s };
      });
    },

    /** Mark a single change as accepted or rejected */
    resolveChange(
      threadId: string,
      changeIndex: number,
      resolution: 'accepted' | 'rejected',
    ): void {
      update((s) => {
        const diff = s.diffs.get(threadId);
        if (diff === undefined || changeIndex < 0 || changeIndex >= diff.changes.length) {
          return s;
        }

        const updatedChanges = diff.changes.map((c, i) =>
          i === changeIndex ? { ...c, resolved: resolution } : c,
        );
        s.diffs.set(threadId, { ...diff, changes: updatedChanges });
        return { ...s };
      });
    },

    /** Mark all changes as accepted or rejected */
    resolveAllChanges(threadId: string, resolution: 'accepted' | 'rejected'): void {
      update((s) => {
        const diff = s.diffs.get(threadId);
        if (diff === undefined) {
          return s;
        }

        const updatedChanges = diff.changes.map((c) => ({ ...c, resolved: resolution }));
        s.diffs.set(threadId, { ...diff, changes: updatedChanges });
        return { ...s };
      });
    },

    /** Check if any changes are resolved (for showing Apply button) */
    hasResolvedChanges(threadId: string): boolean {
      const diff = getState().diffs.get(threadId);
      if (diff === undefined) {
        return false;
      }
      return diff.changes.some((c) => c.resolved !== undefined);
    },

    /** Apply accepted/rejected resolutions — creates a new version */
    async applyResolutions(threadId: string): Promise<boolean> {
      const state = getState();
      const diff = state.diffs.get(threadId);
      const scope = state.comparisonScope.get(threadId);
      if (diff === undefined || scope === undefined) {
        return false;
      }

      // Determine source action based on what was done
      const hasAccepted = diff.changes.some((c) => c.resolved === 'accepted');
      const sourceAction = hasAccepted ? ('accept_change' as const) : ('reject_change' as const);

      update((s) => {
        s.loading.set(threadId, true);
        return { ...s };
      });

      const result = await artifactFrontendService.applyAcceptReject(
        threadId,
        scope.baseVersionId,
        scope.targetVersionId,
        diff.changes,
        sourceAction,
      );

      if (result.success) {
        await refreshArtifactInternal(threadId);
        return true;
      }

      update((s) => {
        s.loading.set(threadId, false);
        s.errors.set(threadId, result.error ?? 'Failed to apply resolutions');
        return { ...s };
      });
      return false;
    },

    /** Navigate the ComposerPane to show a specific version (by clicking a version card). */
    showVersion(threadId: string, versionId: number): void {
      update((s) => {
        s.diffs.delete(threadId);
        s.comparisonScope.set(threadId, {
          baseVersionId: Math.max(1, versionId - 1),
          targetVersionId: versionId,
        });
        return { ...s };
      });
    },

    /** Refresh the artifact after a backend change */
    refreshArtifact: refreshArtifactInternal,

    /** Deactivate document mode for a thread */
    deactivate(threadId: string): void {
      update((s) => {
        s.artifacts.delete(threadId);
        s.diffs.delete(threadId);
        s.displayStyles.delete(threadId);
        s.comparisonScope.delete(threadId);
        s.loading.delete(threadId);
        s.errors.delete(threadId);
        return { ...s };
      });
    },

    /** Discard the most recent version */
    async discardLatest(threadId: string): Promise<boolean> {
      const result = await artifactFrontendService.discardVersion(threadId);
      if (result.success) {
        await refreshArtifactInternal(threadId);
        return true;
      }
      return false;
    },
  };
}

export const artifactStore = createArtifactStore();
