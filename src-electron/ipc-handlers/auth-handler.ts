import { ipcMain, BrowserWindow } from 'electron';
import { AuthService, AuthState } from '../services/auth.service.js';
import { createScopedLogger } from '../utils/logger.js';
import { interfaceStatusRegistry } from '../services/reliability/interface-status-registry.js';

/**
 * Authentication IPC Handlers
 * Handles all authentication-related IPC communication between renderer and main process.
 * Security: Tokens never exposed to renderer process, all sensitive operations in main process.
 */

const authLog = createScopedLogger('auth');

let authService: AuthService;
let onAuthSuccessCallback: (() => Promise<void>) | null = null;

// Track processed OAuth codes to prevent duplicate processing
const processedCodes = new Set<string>();

/**
 * OAuth Callback Handler
 * Processes OAuth callback URLs received via deep links (holokai://home?code=...).
 * Validates the callback, extracts parameters, and exchanges authorization code for tokens.
 */
export function handleOAuthCallback(url: string, mainWindow: BrowserWindow | null): void {
  authLog.info('========================================');
  authLog.info('Processing OAuth callback:', url);
  authLog.info('Main window exists:', !!mainWindow);

  try {
    // Parse the URL
    const urlObj = new URL(url);
    authLog.info('Parsed URL protocol:', urlObj.protocol);
    authLog.info('Parsed URL pathname:', urlObj.pathname);
    authLog.info('Parsed URL search params:', urlObj.search);

    const params = urlObj.searchParams;

    // Check for error response
    const error = params.get('error');
    if (error) {
      const errorDescription = params.get('error_description') || 'Unknown error';
      authLog.error('OAuth error', { error, description: errorDescription });

      // Notify renderer of error
      if (mainWindow) {
        mainWindow.webContents.send('auth:callback-error', {
          error,
          description: errorDescription,
        });
      }
      return;
    }

    // Extract authorization code and state
    const code = params.get('code');
    // const state = params.get('state');

    authLog.info('Extracted code:', code ? `${code.substring(0, 10)}...` : 'null');

    if (!code) {
      authLog.error('Missing required parameters in callback');
      authLog.error('Code present:', !!code);
      if (mainWindow) {
        mainWindow.webContents.send('auth:callback-error', {
          error: 'invalid_callback',
          description: 'Missing code or state parameter',
        });
      }
      return;
    }

    // Check if this code has already been processed (prevents duplicate processing on Windows)
    if (processedCodes.has(code)) {
      authLog.warn('[AUTH] Code already processed, ignoring duplicate callback');
      authLog.warn(
        '[AUTH] This typically happens on Windows where multiple protocol handlers fire',
      );
      return;
    }

    // Mark this code as processed
    processedCodes.add(code);
    authLog.info('[AUTH] Code marked as processed');

    // Clean up old codes after 5 minutes to prevent memory leak
    setTimeout(
      () => {
        processedCodes.delete(code);
        authLog.info('[AUTH] Cleaned up processed code from tracking set');
      },
      5 * 60 * 1000,
    );

    authLog.info('Valid OAuth callback received, exchanging code for tokens');
    authLog.info('Calling authService.processOAuthCallback...');

    // Process the callback through auth service
    authService
      .processOAuthCallback(code)
      .then(async (authState) => {
        authLog.info('OAuth flow completed successfully');
        authLog.info('State - isAuthenticated:', authState.isAuthenticated);
        authLog.info('State - user:', authState.user?.email);
        authLog.info('Sending auth:callback-success to renderer...');

        // Execute post-authentication callback before notifying renderer
        // so that caches (e.g. model repository) are warm when the renderer navigates
        if (onAuthSuccessCallback) {
          authLog.info('Executing post-authentication callback...');
          try {
            await onAuthSuccessCallback();
            authLog.info('Post-authentication callback completed successfully');
          } catch (error) {
            authLog.error('Post-authentication callback failed:', error);
            // Don't throw - auth succeeded even if post-auth actions failed
          }
        }

        // Notify renderer of successful authentication
        if (mainWindow) {
          mainWindow.webContents.send('auth:callback-success', {
            user: authState.user,
            isAuthenticated: authState.isAuthenticated,
            isTestMode: authState.isTestMode,
          });
          authLog.info('auth:callback-success sent to renderer');
        } else {
          authLog.warn('Cannot send to renderer - mainWindow is null');
        }
      })
      .catch((error: unknown) => {
        authLog.error('Error processing OAuth callback:', error);
        authLog.error('Error type:', error instanceof Error ? 'Error' : typeof error);
        authLog.error('Error message:', error instanceof Error ? error.message : String(error));

        if (mainWindow) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to exchange authorization code';
          mainWindow.webContents.send('auth:callback-error', {
            error: 'exchange_failed',
            description: errorMessage,
          });
          authLog.info('auth:callback-error sent to renderer');
        }
      });
  } catch (error) {
    authLog.error('Error parsing OAuth callback URL:', error);
    authLog.error('Error details:', error instanceof Error ? error.stack : String(error));

    if (mainWindow) {
      mainWindow.webContents.send('auth:callback-error', {
        error: 'invalid_url',
        description: 'Failed to parse callback URL',
      });
      authLog.info('auth:callback-error sent to renderer (parse error)');
    }
  }
  authLog.info('========================================');
}

/**
 * Register all authentication IPC handlers
 */
export function registerAuthHandlers(): AuthService {
  // Initialize auth service
  authService = new AuthService();

  /**
   * Start OAuth flow - Opens system browser to Moku web SSO page
   */
  ipcMain.handle('auth:startOAuthFlow', async (): Promise<{ authUrl: string }> => {
    authLog.info('auth:startOAuthFlow called');

    try {
      const result = await authService.startOAuthFlow();

      // In production, would return just the URL
      // For mock, return additional data for demonstration
      const response: { authUrl: string } = {
        authUrl: result.authUrl,
      };
      // @ts-expect-error - mock data for demonstration
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      response._mockData = result.mockData;
      return response;
    } catch (error) {
      authLog.error('Error starting OAuth flow', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  });

  /**
   * Get current authentication state
   */
  ipcMain.handle('auth:getAuthState', (): Promise<AuthState> => {
    authLog.info('getAuthState called');

    const authState = authService.getAuthState();

    // Return only non-sensitive data to renderer
    return Promise.resolve({
      user: authState.user,
      tokens: null, // Never send tokens to renderer
      isAuthenticated: authState.isAuthenticated,
      isTestMode: authState.isTestMode, // Include test mode flag
    });
  });

  /**
   * Logout user - Clears all stored authentication data
   */
  ipcMain.handle('auth:logout', (): Promise<void> => {
    authLog.info('Logout called');

    try {
      authService.logout();
      // Reset all interface reliability monitors on logout
      interfaceStatusRegistry.resetAll();
      return Promise.resolve();
    } catch (error) {
      authLog.error('Error during logout', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  });

  authLog.info('Handlers registered');
  return authService;
}

/**
 * Unregister authentication handlers - Called when app is closing
 */
export function unregisterAuthHandlers(): void {
  ipcMain.removeHandler('auth:startOAuthFlow');
  ipcMain.removeHandler('auth:getAuthState');
  ipcMain.removeHandler('auth:logout');

  authLog.info('Handlers unregistered');
}

/**
 * Expose singleton AuthService for other handlers/services (read-only usage)
 */
export function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

/**
 * Register callback to be executed after successful authentication
 * Used by main process to coordinate post-login actions
 */
export function registerAuthSuccessCallback(callback: () => Promise<void>): void {
  onAuthSuccessCallback = callback;
  authLog.info('Auth success callback registered');
}
