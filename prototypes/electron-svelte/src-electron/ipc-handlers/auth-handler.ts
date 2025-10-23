import { ipcMain, BrowserWindow } from 'electron';
import { AuthService, AuthState, UserProfile } from '../services/auth.service';
import log from 'electron-log';

/**
 * Authentication IPC Handlers
 * Handles all authentication-related IPC communication between renderer and main process.
 * Security: Tokens never exposed to renderer process, all sensitive operations in main process.
 */

let authService: AuthService;

/**
 * OAuth Callback Handler
 * Processes OAuth callback URLs received via deep links (holokai://home?code=...&state=...).
 * Validates the callback, extracts parameters, and exchanges authorization code for tokens.
 */
export function handleOAuthCallback(url: string, mainWindow: BrowserWindow | null): void {
  log.info('[Auth] Processing OAuth callback:', url);

  try {
    // Parse the URL
    const urlObj = new URL(url);
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
          description: errorDescription
        });
      }
      return;
    }

    // Extract authorization code and state
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      log.error('[Auth] Missing required parameters in callback');
      if (mainWindow) {
        mainWindow.webContents.send('auth:callback-error', {
          error: 'invalid_callback',
          description: 'Missing code or state parameter'
        });
      }
      return;
    }

    log.info('[Auth] Valid OAuth callback received, exchanging code for tokens');

    // Process the callback through auth service
    authService.processOAuthCallback(code, state)
      .then(authState => {
        log.info('[Auth] OAuth flow completed successfully');

        // Notify renderer of successful authentication
        if (mainWindow) {
          mainWindow.webContents.send('auth:callback-success', {
            user: authState.user,
            isAuthenticated: authState.isAuthenticated
          });
        }
      })
      .catch(error => {
        log.error('[Auth] Error processing OAuth callback:', error);

        if (mainWindow) {
          mainWindow.webContents.send('auth:callback-error', {
            error: 'exchange_failed',
            description: error.message || 'Failed to exchange authorization code'
          });
        }
      });

  } catch (error) {
    log.error('[Auth] Error parsing OAuth callback URL:', error);

    if (mainWindow) {
      mainWindow.webContents.send('auth:callback-error', {
        error: 'invalid_url',
        description: 'Failed to parse callback URL'
      });
    }
  }
}

/**
 * Register all authentication IPC handlers
 */
export function registerAuthHandlers() {
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
      return {
        authUrl: result.authUrl,
        // @ts-ignore - mock data for demonstration
        _mockData: result.mockData
      };
    } catch (error) {
      log.error('[IPC] Error starting OAuth flow:', error);
      throw error;
    }
  });

  /**
   * Exchange authorization code for tokens (manual exchange for testing)
   */
  ipcMain.handle(
    'auth:exchangeCode',
    async (_event, code: string, codeVerifier: string): Promise<AuthState> => {
      log.info('[IPC] auth:exchangeCode called');
      
      try {
        const authState = await authService.exchangeCodeForTokens(code, codeVerifier);
        
        // Return only non-sensitive data to renderer
        return {
          user: authState.user,
          tokens: null, // Never send tokens to renderer
          isAuthenticated: authState.isAuthenticated
        };
      } catch (error) {
        log.error('[IPC] Error exchanging auth code:', error);
        throw error;
      }
    }
  );

  /**
   * Mock login - Simulates complete authentication flow for testing
   */
  ipcMain.handle(
    'auth:mockLogin',
    async (_event, provider: 'microsoft' | 'google' | 'oauth2' = 'microsoft'): Promise<AuthState> => {
      log.info('[IPC] auth:mockLogin called with provider:', provider);
      
      try {
        const authState = await authService.mockLogin(provider);
        
        // Return only non-sensitive data to renderer
        return {
          user: authState.user,
          tokens: null, // Never send tokens to renderer
          isAuthenticated: authState.isAuthenticated
        };
      } catch (error) {
        log.error('[IPC] Error with mock login:', error);
        throw error;
      }
    }
  );

  /**
   * Get current authentication state
   */
  ipcMain.handle('auth:getAuthState', async (): Promise<AuthState> => {
    log.info('[IPC] auth:getAuthState called');
    
    const authState = authService.getAuthState();
    
    // Return only non-sensitive data to renderer
    return {
      user: authState.user,
      tokens: null, // Never send tokens to renderer
      isAuthenticated: authState.isAuthenticated
    };
  });

  /**
   * Get current user profile
   */
  ipcMain.handle('auth:getUser', async (): Promise<UserProfile | null> => {
    log.info('[IPC] auth:getUser called');
    return authService.getUser();
  });

  /**
   * Check if user is authenticated
   */
  ipcMain.handle('auth:isAuthenticated', async (): Promise<boolean> => {
    log.info('[IPC] auth:isAuthenticated called');
    return authService.isAuthenticated();
  });

  /**
   * Logout user - Clears all stored authentication data
   */
  ipcMain.handle('auth:logout', async (): Promise<void> => {
    log.info('[IPC] auth:logout called');
    
    try {
      await authService.logout();
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
      await authService.refreshToken();
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
export function unregisterAuthHandlers() {
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
