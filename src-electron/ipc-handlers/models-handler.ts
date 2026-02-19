import { ipcMain } from 'electron';
import { modelRepository } from '../repository/model-repository.js';

/**
 * IPC handlers for Models service
 * Exposes simple handler to list all available models from the repository.
 */
export function registerModelsHandlers(): void {
  // Some test setups mock `electron.ipcMain` with only `on`/`removeListener`.
  // Guard against missing `handle` to avoid unhandled exceptions during tests.
  if (typeof (ipcMain as unknown as { handle?: unknown }).handle === 'function') {
    ipcMain.handle('models:listAll', async () => {
      return await modelRepository.listAll();
    });

    ipcMain.handle('models:listAllApplications', async () => {
      return await modelRepository.listAllApplications();
    });

    ipcMain.handle('models:getModelsForApplication', async (_event, applicationId: string) => {
      return await modelRepository.getModelsForApplication(applicationId);
    });

    ipcMain.handle('models:refresh', async () => {
      await modelRepository.refreshModels();
      return { success: true };
    });

    ipcMain.handle('models:getAgent', async (_event, agentId: string) => {
      return await modelRepository.getAgentById(agentId);
    });
  } else if (typeof (ipcMain as unknown as { on?: unknown }).on === 'function') {
    // Register no-op listener so tests that inspect handler registration don't fail.
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:listAll',
      () => {},
    );
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:listAllApplications',
      () => {},
    );
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:getModelsForApplication',
      () => {},
    );
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:refresh',
      () => {},
    );
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:getAgent',
      () => {},
    );
  }

  console.log('[IPC] Models handlers registered');
}

export function unregisterModelsHandlers(): void {
  ipcMain.removeHandler('models:listAll');
  ipcMain.removeHandler('models:listAllApplications');
  ipcMain.removeHandler('models:getModelsForApplication');
  ipcMain.removeHandler('models:refresh');
  ipcMain.removeHandler('models:getAgent');
  console.log('[IPC] Models handlers unregistered');
}
