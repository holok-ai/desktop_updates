import { ipcMain, BrowserWindow } from 'electron';
import { AuthService, AuthState, UserProfile } from '../services/auth.service.js';
import { createScopedLogger } from '../utils/logger.js';

/**
 * Authentication IPC Handlers
 * Handles all authentication-related IPC communication between renderer and main process.
 * Security: Tokens never exposed to renderer process, all sensitive operations in main process.
 */

const authLog = createScopedLogger('auth');

let authService: AuthService;

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

    authLog.info('Valid OAuth callback received, exchanging code for tokens');
    authLog.info('Calling authService.processOAuthCallback...');

    // Process the callback through auth service
    authService
      .processOAuthCallback(code)
      .then((authState) => {
        authLog.info('OAuth flow completed successfully');
        authLog.info('State - isAuthenticated:', authState.isAuthenticated);
        authLog.info('State - user:', authState.user?.email);
        authLog.info('Sending auth:callback-success to renderer...');

        // Notify renderer of successful authentication
        if (mainWindow) {
          mainWindow.webContents.send('auth:callback-success', {
            user: authState.user,
            isAuthenticated: authState.isAuthenticated,
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
export function registerAuthHandlers(): void {
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
      authLog.error('Error starting OAuth flow', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  });

  /**
   * Exchange authorization code for tokens (manual exchange for testing)
   */
  ipcMain.handle('auth:exchangeCode', async (_event, code: string): Promise<AuthState> => {
    authLog.info('exchangeCode called');

    try {
      const authState = await authService.exchangeCodeForTokens(code);

      // Return only non-sensitive data to renderer
      return {
        user: authState.user,
        tokens: null, // Never send tokens to renderer
        isAuthenticated: authState.isAuthenticated,
      };
    } catch (error) {
      authLog.error('Error exchanging auth code', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  });

  /**
   * Mock login - Simulates complete authentication flow for testing
   */
  ipcMain.handle('auth:mockLogin', async (_event): Promise<AuthState> => {
    authLog.info('mockLogin called');

    try {
      const authState = await authService.mockLogin();

      // Return only non-sensitive data to renderer
      return {
        user: authState.user,
        tokens: null, // Never send tokens to renderer
        isAuthenticated: authState.isAuthenticated,
      };
    } catch (error) {
      authLog.error('Error with mock login', { error: error instanceof Error ? error.message : 'Unknown error' });
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
    });
  });

  /**
   * Get current user profile
   */
  ipcMain.handle('auth:getUser', (): Promise<UserProfile | null> => {
    authLog.info('GetUser called');
    return Promise.resolve(authService.getUser());
  });

  /**
   * Check if user is authenticated
   */
  ipcMain.handle('auth:isAuthenticated', (): Promise<boolean> => {
    authLog.info('IsAuthenticated called');
    return Promise.resolve(authService.isAuthenticated());
  });

  /**
   * Logout user - Clears all stored authentication data
   */
  ipcMain.handle('auth:logout', (): Promise<void> => {
    authLog.info('Logout called');

    try {
      authService.logout();
      return Promise.resolve();
    } catch (error) {
      authLog.error('Error during logout', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  });

  /**
   * Refresh access token - Uses refresh token to get new access token
   */
  ipcMain.handle('auth:refreshToken', async (): Promise<void> => {
    authLog.info('refreshToken called');

    try {
      await authService.refreshAccessToken();
    } catch (error) {
      authLog.error('Error refreshing token', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  });

  authLog.info('Handlers registered');
}

/**
 * Unregister authentication handlers - Called when app is closing
 */
export function unregisterAuthHandlers(): void {
  ipcMain.removeHandler('auth:startOAuthFlow');
  ipcMain.removeHandler('auth:exchangeCode');
  ipcMain.removeHandler('auth:mockLogin');
  ipcMain.removeHandler('auth:getAuthState');
  ipcMain.removeHandler('auth:getUser');
  ipcMain.removeHandler('auth:isAuthenticated');
  ipcMain.removeHandler('auth:logout');
  ipcMain.removeHandler('auth:refreshToken');

  authLog.info('Handlers unregistered');
}
