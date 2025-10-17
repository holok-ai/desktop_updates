import { ipcMain } from 'electron';
import { AuthService, AuthState, UserProfile } from '../services/auth.service';
import log from 'electron-log';

/**
 * Authentication IPC Handlers
 * 
 * Handles all authentication-related IPC communication between
 * renderer and main process.
 * 
 * Implements the SSO flow from options-comparison-sso.md Option 1:
 * - Step 1-2: Start OAuth flow (redirect to Moku web)
 * - Step 3-4: Handled by Moku web and system browser
 * - Step 5: Exchange auth code for tokens
 * 
 * Security:
 * - Tokens never exposed to renderer process
 * - All sensitive operations in main process
 * - Uses Electron's safeStorage for encryption
 */

let authService: AuthService;

/**
 * Register all authentication IPC handlers
 */
export function registerAuthHandlers() {
  // Initialize auth service
  authService = new AuthService();

  /**
   * Start OAuth flow (Steps 1-2)
   * Opens system browser to Moku web SSO page
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
   * Exchange authorization code for tokens (Step 5)
   * Called after OAuth callback with authorization code
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
   * Mock login (for testing without full OAuth flow)
   * This simulates the complete authentication flow
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
   * Logout user
   * Clears all stored authentication data
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
   * Refresh access token
   * Uses refresh token to get new access token
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
 * Clean up handlers (called when app is closing)
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
