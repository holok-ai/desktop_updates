import type {
  BackgroundPromptRequest,
  BackgroundPromptResult,
} from '../../../src-shared/types/background-prompt.types';
import { backgroundPromptStore } from '../stores/backgroundPrompt.store';
import { BaseElectronService } from './base-electron.service';

/**
 * Background Prompt Service (Renderer)
 *
 * Extends BaseElectronService to wire IPC event listeners for background prompt results.
 * Delegates state management to backgroundPrompt.store.ts.
 */
export class BackgroundPromptService extends BaseElectronService {
  private constructor() {
    super();
  }

  public static getInstance(): BackgroundPromptService {
    return this.getSingletonInstance();
  }

  protected initializeEventListeners(): void {
    if (window.electronAPI?.bgprompt === undefined) {
      console.warn('[BackgroundPromptService] Electron API not available');
      return;
    }

    const unsubResult = window.electronAPI.bgprompt.onResult((result: BackgroundPromptResult) => {
      backgroundPromptStore.handleResult(result);
    });
    this.registerCleanup(unsubResult);
  }

  /** Submit a background prompt task */
  public async submit(request: BackgroundPromptRequest): Promise<void> {
    return backgroundPromptStore.submit(request);
  }

  /** Cancel a specific task */
  public async cancel(taskId: string): Promise<void> {
    return backgroundPromptStore.cancel(taskId);
  }

  /** Dismiss a pending result (user chose to discard) */
  public dismiss(taskId: string): void {
    backgroundPromptStore.dismiss(taskId);
  }

  /** Accept a pending result (user chose to keep) */
  public accept(taskId: string): void {
    backgroundPromptStore.accept(taskId);
  }
}

export const backgroundPromptService = BackgroundPromptService.getInstance();
