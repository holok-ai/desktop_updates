import { ipcMain, BrowserWindow } from 'electron';
import { AuthService, AuthState, UserProfile } from '../services/auth.service.js';
import log from 'electron-log';

/**
 * Authentication IPC Handlers
 * Handles all authentication-related IPC communication between renderer and main process.
 * Security: Tokens never exposed to renderer process, all sensitive operations in main process.
 */

let authService: AuthService;

/**
 * OAuth Callback Handler
 * Processes OAuth callback URLs received via deep links (holokai://home?code=...).
 * Validates the callback, extracts parameters, and exchanges authorization code for tokens.
 */
export function handleOAuthCallback(url: string, mainWindow: BrowserWindow | null): void {
  log.info('[Auth] ========================================');
  log.info('[Auth] Processing OAuth callback:', url);
  log.info('[Auth] Main window exists:', !!mainWindow);

  try {
    // Parse the URL
    const urlObj = new URL(url);
    log.info('[Auth] Parsed URL protocol:', urlObj.protocol);
    log.info('[Auth] Parsed URL pathname:', urlObj.pathname);
    log.info('[Auth] Parsed URL search params:', urlObj.search);

    const params = urlObj.searchParams;

    // Check for error response
    const error = params.get('error');
    if (error) {
      const errorDescription = params.get('error_description') || 'Unknown error';
      log.error('[Auth] OAuth error:', error, errorDescription);

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
//    const state = params.get('state');

    log.info('[Auth] Extracted code:', code ? `${code.substring(0, 10)}...` : 'null');

    if (!code) {
      log.error('[Auth] Missing required parameters in callback');
      log.error('[Auth] Code present:', !!code);
      if (mainWindow) {
        mainWindow.webContents.send('auth:callback-error', {
          error: 'invalid_callback',
          description: 'Missing code or state parameter',
        });
      }
      return;
    }

    log.info('[Auth] Valid OAuth callback received, exchanging code for tokens');
    log.info('[Auth] Calling authService.processOAuthCallback...');

    // Process the callback through auth service
    authService
      .processOAuthCallback(code)
      .then((authState) => {
        log.info('[Auth] OAuth flow completed successfully');
        log.info('[Auth] Auth state - isAuthenticated:', authState.isAuthenticated);
        log.info('[Auth] Auth state - user:', authState.user?.email);
        log.info('[Auth] Sending auth:callback-success to renderer...');

        // Notify renderer of successful authentication
        if (mainWindow) {
          mainWindow.webContents.send('auth:callback-success', {
            user: authState.user,
            isAuthenticated: authState.isAuthenticated,
          });
          log.info('[Auth] auth:callback-success sent to renderer');
        } else {
          log.warn('[Auth] Cannot send to renderer - mainWindow is null');
        }
      })
      .catch((error: unknown) => {
        log.error('[Auth] Error processing OAuth callback:', error);
        log.error('[Auth] Error type:', error instanceof Error ? 'Error' : typeof error);
        log.error('[Auth] Error message:', error instanceof Error ? error.message : String(error));

        if (mainWindow) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to exchange authorization code';
          mainWindow.webContents.send('auth:callback-error', {
            error: 'exchange_failed',
            description: errorMessage,
          });
          log.info('[Auth] auth:callback-error sent to renderer');
        }
      });
  } catch (error) {
    log.error('[Auth] Error parsing OAuth callback URL:', error);
    log.error('[Auth] Error details:', error instanceof Error ? error.stack : String(error));

    if (mainWindow) {
      mainWindow.webContents.send('auth:callback-error', {
        error: 'invalid_url',
        description: 'Failed to parse callback URL',
      });
      log.info('[Auth] auth:callback-error sent to renderer (parse error)');
    }
  }
  log.info('[Auth] ========================================');
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
    log.info('[IPC] auth:startOAuthFlow called');

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
      log.error('[IPC] Error starting OAuth flow:', error);
      throw error;
    }
  });

  /**
   * Exchange authorization code for tokens (manual exchange for testing)
   */
  ipcMain.handle('auth:exchangeCode', async (_event, code: string): Promise<AuthState> => {
    log.info('[IPC] auth:exchangeCode called');

    try {
      const authState = await authService.exchangeCodeForTokens(code);

      // Return only non-sensitive data to renderer
      return {
        user: authState.user,
        tokens: null, // Never send tokens to renderer
        isAuthenticated: authState.isAuthenticated,
      };
    } catch (error) {
      log.error('[IPC] Error exchanging auth code:', error);
      throw error;
    }
  });

  /**
   * Mock login - Simulates complete authentication flow for testing
   */
  ipcMain.handle('auth:mockLogin', async (_event): Promise<AuthState> => {
    log.info('[IPC] auth:mockLogin called');

    try {
      const authState = await authService.mockLogin();

      // Return only non-sensitive data to renderer
      return {
        user: authState.user,
        tokens: null, // Never send tokens to renderer
        isAuthenticated: authState.isAuthenticated,
      };
    } catch (error) {
      log.error('[IPC] Error with mock login:', error);
      throw error;
    }
  });

  /**
   * Get current authentication state
   */
  ipcMain.handle('auth:getAuthState', (): Promise<AuthState> => {
    log.info('[IPC] auth:getAuthState called');

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
    log.info('[IPC] auth:getUser called');
    return Promise.resolve(authService.getUser());
  });

  /**
   * Check if user is authenticated
   */
  ipcMain.handle('auth:isAuthenticated', (): Promise<boolean> => {
    log.info('[IPC] auth:isAuthenticated called');
    return Promise.resolve(authService.isAuthenticated());
  });

  /**
   * Logout user - Clears all stored authentication data
   */
  ipcMain.handle('auth:logout', (): Promise<void> => {
    log.info('[IPC] auth:logout called');

    try {
      authService.logout();
      return Promise.resolve();
    } catch (error) {
      log.error('[IPC] Error during logout:', error);
      throw error;
    }
  });

  /**
   * Refresh access token - Uses refresh token to get new access token
   */
  ipcMain.handle('auth:refreshToken', async (): Promise<void> => {
    log.info('[IPC] auth:refreshToken called');

    try {
      await authService.refreshAccessToken();
    } catch (error) {
      log.error('[IPC] Error refreshing token:', error);
      throw error;
    }
  });

  log.info('[IPC] Auth handlers registered');
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

  log.info('[IPC] Auth handlers unregistered');
}
