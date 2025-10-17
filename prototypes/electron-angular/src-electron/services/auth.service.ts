import { safeStorage, app } from 'electron';
import log from 'electron-log';
import { getSettingsService } from '../ipc-handlers/settings-handler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Authentication Service
 * 
 * Handles authentication operations including:
 * - SSO flow initiation (Step 1: redirect to Moku web)
 * - Token storage using Electron's safeStorage (encrypted)
 * - User session management
 * 
 * According to Option 1 from options-comparison-sso.md:
 * Step 1: Desktop app constructs URL to Moku web SSO
 * Step 2: Opens system browser for authentication
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'microsoft' | 'google' | 'oauth2';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

export interface AuthState {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}

/**
 * Custom protocol for OAuth redirect
 */
const CUSTOM_PROTOCOL = 'holokai://callback';

/**
 * Storage keys for secure storage
 */
const STORAGE_KEY_TOKENS = 'holokai.auth.tokens';
const STORAGE_KEY_USER = 'holokai.auth.user';

export class AuthService {
  private currentAuthState: AuthState = {
    user: null,
    tokens: null,
    isAuthenticated: false
  };

  constructor() {
    // Load stored auth data on initialization
    this.loadStoredAuth();
    log.info('[AuthService] Initialized');
  }

  /**
   * Get Moku Web URL from settings
   */
  private getMokuWebUrl(): string {
    const settingsService = getSettingsService();
    return settingsService.getMokuWebUrl();
  }

  /**
   * Get Moku API URL from settings
   */
  private getMokuApiUrl(): string {
    const settingsService = getSettingsService();
    return settingsService.getMokuApiUrl();
  }

  /**
   * Load authentication data from secure storage
   * Called on app startup to restore user session
   */
  private loadStoredAuth(): void {
    try {
      // Check if safeStorage is available
      if (!safeStorage.isEncryptionAvailable()) {
        log.warn('[AuthService] Encryption not available on this system');
        return;
      }

      // Load tokens from secure storage
      const encryptedTokens = this.getFromStorage(STORAGE_KEY_TOKENS);
      if (encryptedTokens) {
        const decryptedTokens = safeStorage.decryptString(encryptedTokens);
        const tokens: AuthTokens = JSON.parse(decryptedTokens);

        // Check if tokens are still valid
        if (tokens.expiresAt > Date.now()) {
          this.currentAuthState.tokens = tokens;
          log.info('[AuthService] Valid tokens loaded from storage');
        } else {
          log.info('[AuthService] Stored tokens expired, clearing');
          this.clearStoredAuth();
          return;
        }
      }

      // Load user profile
      const encryptedUser = this.getFromStorage(STORAGE_KEY_USER);
      if (encryptedUser) {
        const decryptedUser = safeStorage.decryptString(encryptedUser);
        this.currentAuthState.user = JSON.parse(decryptedUser);
        this.currentAuthState.isAuthenticated = true;
        log.info('[AuthService] User profile loaded:', this.currentAuthState.user?.email);
      }
    } catch (error) {
      log.error('[AuthService] Error loading stored auth:', error);
      this.clearStoredAuth();
    }
  }

  /**
   * Step 1 & 2: Initiate SSO flow by opening Moku web in system browser
   * 
   * This is a MOCK implementation for demonstration.
   * In production, this would:
   * 1. Open system browser to: https://moku.holokai.com/auth/desktop?redirect_uri=holokai://callback
   * 2. User authenticates with their provider (Microsoft, Google, OAuth2.0)
   * 3. Moku web redirects to holokai://callback?code=XXXX&state=YYYY
   * 4. Desktop app's protocol handler captures the code
   * 5. Desktop exchanges code for tokens via POST to /api/auth/token
   */
  public async startOAuthFlow(): Promise<{ authUrl: string; mockData: any }> {
    log.info('[AuthService] Starting OAuth flow');

    // Generate state parameter for CSRF protection
    const state = this.generateState();

    // Generate PKCE code challenge (recommended for native apps)
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Construct the Moku web SSO URL
    const mokuWebUrl = this.getMokuWebUrl();
    const authUrl = `${mokuWebUrl}/auth/desktop?` +
      `redirect_uri=${encodeURIComponent(CUSTOM_PROTOCOL)}&` +
      `state=${state}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`;

    log.info('[AuthService] OAuth URL constructed:', authUrl);

    // In production, this would open the system browser:
    // shell.openExternal(authUrl);
    
    // For this MOCK, we'll simulate a successful authentication
    // Return mock data that represents what would happen after Steps 1-5
    const mockAuthCode = this.generateMockAuthCode();
    const mockTokens = this.generateMockTokens();
    const mockUser = this.generateMockUser();

    log.info('[AuthService] MOCK: Simulating successful authentication');
    log.info('[AuthService] MOCK: In production, user would see:', authUrl);
    log.info('[AuthService] MOCK: After auth, callback would be:', `${CUSTOM_PROTOCOL}?code=${mockAuthCode}&state=${state}`);

    return {
      authUrl,
      mockData: {
        authCode: mockAuthCode,
        state,
        codeVerifier,
        explanation: 'In production, the browser would open to authUrl, and the callback would return to the app via custom protocol'
      }
    };
  }

  /**
   * Step 5 (Mock): Exchange authorization code for tokens
   * 
   * In production, this would be:
   * POST https://moku.holokai.com/api/auth/token
   * Body: { code: "XXXX", grant_type: "authorization_code" }
   * Response: { access_token, refresh_token, expires_in, user }
   */
  public async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<AuthState> {
    log.info('[AuthService] Exchanging auth code for tokens (MOCK)');

    // MOCK: Simulate API call delay
    await this.delay(500);

    // MOCK: Generate tokens and user profile
    const tokens = this.generateMockTokens();
    const user = this.generateMockUser();

    // Store tokens securely
    await this.storeAuthData(tokens, user);

    log.info('[AuthService] Authentication successful:', user.email);

    return this.currentAuthState;
  }

  /**
   * Complete authentication with mock data (for testing without full OAuth flow)
   * This simulates the complete OAuth flow in one step
   */
  public async mockLogin(provider: 'microsoft' | 'google' | 'oauth2' = 'microsoft'): Promise<AuthState> {
    log.info('[AuthService] Mock login started for provider:', provider);

    // Simulate network delay
    await this.delay(1000);

    // Generate mock tokens and user
    const tokens = this.generateMockTokens();
    const user = this.generateMockUser(provider);

    // Store authentication data
    await this.storeAuthData(tokens, user);

    log.info('[AuthService] Mock login successful:', user.email);

    return this.currentAuthState;
  }

  /**
   * Store authentication data in secure storage
   */
  private async storeAuthData(tokens: AuthTokens, user: UserProfile): Promise<void> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        log.warn('[AuthService] Encryption not available, storing in plain text (INSECURE)');
        // In production, should fail here or use alternative secure storage
      }

      // Encrypt and store tokens
      const tokensJson = JSON.stringify(tokens);
      const encryptedTokens = safeStorage.encryptString(tokensJson);
      this.saveToStorage(STORAGE_KEY_TOKENS, encryptedTokens);

      // Encrypt and store user profile
      const userJson = JSON.stringify(user);
      const encryptedUser = safeStorage.encryptString(userJson);
      this.saveToStorage(STORAGE_KEY_USER, encryptedUser);

      // Update in-memory state
      this.currentAuthState = {
        user,
        tokens,
        isAuthenticated: true
      };

      log.info('[AuthService] Auth data stored securely');
    } catch (error) {
      log.error('[AuthService] Error storing auth data:', error);
      throw error;
    }
  }

  /**
   * Get current authentication state
   */
  public getAuthState(): AuthState {
    return { ...this.currentAuthState };
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return this.currentAuthState.isAuthenticated && 
           this.currentAuthState.tokens !== null &&
           this.currentAuthState.tokens.expiresAt > Date.now();
  }

  /**
   * Get current user profile
   */
  public getUser(): UserProfile | null {
    return this.currentAuthState.user;
  }

  /**
   * Logout user
   */
  public async logout(): Promise<void> {
    log.info('[AuthService] Logging out user:', this.currentAuthState.user?.email);

    // In production, would also revoke tokens on server:
    // POST https://moku.holokai.com/api/auth/revoke
    // Body: { refresh_token: "..." }

    this.clearStoredAuth();
    this.currentAuthState = {
      user: null,
      tokens: null,
      isAuthenticated: false
    };

    log.info('[AuthService] Logout complete');
  }

  /**
   * Refresh access token
   * In production, would call: POST https://moku.holokai.com/api/auth/refresh
   */
  public async refreshToken(): Promise<AuthTokens> {
    log.info('[AuthService] Refreshing access token (MOCK)');

    if (!this.currentAuthState.tokens) {
      throw new Error('No refresh token available');
    }

    // MOCK: Simulate API call
    await this.delay(300);

    // Generate new tokens
    const newTokens = this.generateMockTokens();
    
    // Update stored tokens
    if (this.currentAuthState.user) {
      await this.storeAuthData(newTokens, this.currentAuthState.user);
    }

    log.info('[AuthService] Token refresh successful');
    return newTokens;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Clear all stored authentication data
   */
  private clearStoredAuth(): void {
    this.removeFromStorage(STORAGE_KEY_TOKENS);
    this.removeFromStorage(STORAGE_KEY_USER);
  }

  /**
   * Generate state parameter for CSRF protection
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64url');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Buffer.from(hash).toString('base64url');
  }

  /**
   * Generate mock authorization code
   */
  private generateMockAuthCode(): string {
    return 'mock_auth_code_' + Date.now();
  }

  /**
   * Generate mock tokens
   */
  private generateMockTokens(): AuthTokens {
    return {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour from now
    };
  }

  /**
   * Generate mock user profile
   */
  private generateMockUser(provider: 'microsoft' | 'google' | 'oauth2' = 'microsoft'): UserProfile {
    const providerEmails = {
      microsoft: 'user@company.com',
      google: 'user@gmail.com',
      oauth2: 'user@example.com'
    };

    return {
      id: 'mock_user_' + Date.now(),
      email: providerEmails[provider],
      name: 'Mock User',
      picture: 'https://via.placeholder.com/150',
      provider
    };
  }

  /**
   * Delay helper for simulating async operations
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get storage file path
   */
  private getStoragePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'auth-storage.json');
  }

  /**
   * Simple storage helpers using file system for persistence
   */
  private saveToStorage(key: string, value: Buffer): void {
    try {
      const storagePath = this.getStoragePath();
      let storage: Record<string, string> = {};
      
      // Read existing storage if it exists
      if (fs.existsSync(storagePath)) {
        const data = fs.readFileSync(storagePath, 'utf-8');
        storage = JSON.parse(data);
      }
      
      // Store as base64 string
      storage[key] = value.toString('base64');
      
      // Write back to file
      fs.writeFileSync(storagePath, JSON.stringify(storage), 'utf-8');
    } catch (error) {
      log.error('[AuthService] Error saving to storage:', error);
    }
  }

  private getFromStorage(key: string): Buffer | undefined {
    try {
      const storagePath = this.getStoragePath();
      
      if (!fs.existsSync(storagePath)) {
        return undefined;
      }
      
      const data = fs.readFileSync(storagePath, 'utf-8');
      const storage: Record<string, string> = JSON.parse(data);
      
      if (storage[key]) {
        return Buffer.from(storage[key], 'base64');
      }
      
      return undefined;
    } catch (error) {
      log.error('[AuthService] Error reading from storage:', error);
      return undefined;
    }
  }

  private removeFromStorage(key: string): void {
    try {
      const storagePath = this.getStoragePath();
      
      if (!fs.existsSync(storagePath)) {
        return;
      }
      
      const data = fs.readFileSync(storagePath, 'utf-8');
      const storage: Record<string, string> = JSON.parse(data);
      
      delete storage[key];
      
      fs.writeFileSync(storagePath, JSON.stringify(storage), 'utf-8');
    } catch (error) {
      log.error('[AuthService] Error removing from storage:', error);
    }
  }
}
