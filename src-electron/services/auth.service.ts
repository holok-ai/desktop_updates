import { safeStorage, app, shell } from 'electron';
import log from 'electron-log';
import { getSettingsService } from '../ipc-handlers/settings-handler.js';
import { mokuService } from './mokuapi/moku.service.js';
import { refreshAccessToken, isTokenValid } from '../utils/token-refresh.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Authentication Service
 * Handles Exchange Code Flow authentication including:
 * - OAuth flow initiation via Moku web
 * - Exchange code handling
 * - Token storage using Electron's safeStorage (encrypted)
 * - User session management
 * - Token refresh
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  organizationId?: string;
}
export interface AuthTokens {
  accessToken: string;
  apiKey?: string; // Optional, cached for token refresh
  expiresAt: number; // Unix timestamp
}

export interface AuthState {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isTestMode?: boolean; // Flag to indicate test tokens are being used
}

/**
 * OAuth Configuration Constants
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const REDIRECT_URI = 'holokai://home';
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Storage keys for secure storage
 */
const STORAGE_KEY_TOKENS = 'holokai.auth.tokens';
const STORAGE_KEY_USER = 'holokai.auth.user';

export class AuthService {
  private currentAuthState: AuthState = {
    user: null,
    tokens: null,
    isAuthenticated: false,
  };

  // Track if we're waiting for a callback
  private waitingForCallback: boolean = false;
  private callbackTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    // Load stored auth data on initialization
    this.loadStoredAuth();

    // For Playwright E2E tests - load tokens from environment variable
    this.loadTestTokens();

    log.info('[AuthService] Initialized with Exchange Code Flow');
  }

  /**
   * Get Moku Web URL from settings
   */
  private getMokuWebUrl(): string {
    const settingsService = getSettingsService();
    return settingsService.getMokuWebUrl();
  }

  /**
   * Load authentication data from secure storage
   * Called on app startup to restore user session
   */
  private loadStoredAuth(): void {
    try {
      const encryptionAvailable = safeStorage.isEncryptionAvailable();
      if (!encryptionAvailable) {
        log.warn('[AuthService] Encryption not available on this system, will use plain text storage');
      }

      // Load tokens from secure storage
      const storedTokens = this.getFromStorage(STORAGE_KEY_TOKENS);
      if (storedTokens) {
        let tokensJson: string;
        if (encryptionAvailable) {
          try {
            tokensJson = safeStorage.decryptString(storedTokens);
          } catch (error) {
            // If decryption fails, try parsing as plain text (for migration)
            log.warn('[AuthService] Decryption failed, trying plain text');
            tokensJson = storedTokens.toString('utf-8');
          }
        } else {
          tokensJson = storedTokens.toString('utf-8');
        }

        const tokens = JSON.parse(tokensJson) as AuthTokens;

        // Check if access token is still valid
        if (tokens.expiresAt > Date.now()) {
          this.currentAuthState.tokens = tokens;
          log.info('[AuthService] Valid access token loaded from storage');
        } else {
          log.info('[AuthService] Stored access token expired');
          // Try to refresh if we have an apiKey
          if (tokens.apiKey) {
            log.info('[AuthService] Will attempt token refresh on next request');
            this.currentAuthState.tokens = tokens;
          } else {
            this.clearStoredAuth();
            return;
          }
        }
      }

      // Load user profile
      const storedUser = this.getFromStorage(STORAGE_KEY_USER);
      if (storedUser) {
        let userJson: string;
        if (encryptionAvailable) {
          try {
            userJson = safeStorage.decryptString(storedUser);
          } catch (error) {
            // If decryption fails, try parsing as plain text (for migration)
            log.warn('[AuthService] Decryption failed, trying plain text');
            userJson = storedUser.toString('utf-8');
          }
        } else {
          userJson = storedUser.toString('utf-8');
        }

        this.currentAuthState.user = JSON.parse(userJson) as UserProfile;
        this.currentAuthState.isAuthenticated = true;
        log.info('[AuthService] User profile loaded:', this.currentAuthState.user?.email);
      }
    } catch (error) {
      log.error('[AuthService] Error loading stored auth:', error);
      this.clearStoredAuth();
    }
  }

  /**
   * Load authentication tokens from environment variable or command-line args (for Playwright E2E tests)
   * This bypasses encryption and allows tests to inject valid auth tokens
   *
   * **Cross-Platform Support:**
   * - Checks command-line args first (--playwright-test-tokens) for Windows compatibility
   * - Falls back to PLAYWRIGHT_TEST_TOKENS env var for backward compatibility
   */
  private loadTestTokens(): void {
    // Try command-line args first (more reliable on Windows)
    let testTokensJson = process.argv
      .find((arg) => arg.startsWith('--playwright-test-tokens='))
      ?.split('=')[1];

    // Fallback to environment variable
    if (!testTokensJson) {
      testTokensJson = process.env.PLAYWRIGHT_TEST_TOKENS;
    }

    if (!testTokensJson) {
      return; // Not in test mode
    }

    try {
      log.info('[AuthService] Loading test tokens from command-line args or env var');
      const testData = JSON.parse(testTokensJson) as {
        accessToken?: string;
        apiKey?: string;
        expiresAt?: number;
        user?: {
          id: string;
          email: string;
          name?: string;
          picture?: string;
          organizationId?: string;
        };
      };

      // Set tokens
      if (testData.accessToken) {
        this.currentAuthState.tokens = {
          accessToken: testData.accessToken,
          apiKey: testData.apiKey ?? '',
          expiresAt: testData.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000, // Default to 24h from now
        };
      }

      // Set user profile
      if (testData.user) {
        this.currentAuthState.user = {
          id: testData.user.id,
          email: testData.user.email,
          name: testData.user.name ?? 'Test User',
          picture: testData.user.picture,
          organizationId: testData.user.organizationId,
        };
      }

      // Mark as authenticated and in test mode
      this.currentAuthState.isAuthenticated = true;
      this.currentAuthState.isTestMode = true; // Flag for UI/test awareness

      log.info(
        '[AuthService] Test tokens loaded successfully (TEST MODE) for user:',
        testData.user?.email,
      );
    } catch (error) {
      log.error('[AuthService] Failed to parse test tokens:', error);
    }
  }

  /**
   * Start OAuth Flow
   * Opens browser to Moku web desktop login page.
   * Returns the authorization URL that was opened.
   */
  public async startOAuthFlow(): Promise<{ authUrl: string }> {
    log.info('[AuthService] Starting Exchange Code Flow');

    if (this.waitingForCallback) {
      log.warn('[AuthService] Already waiting for callback, cancelling previous attempt');
      this.cancelCallback();
    }

    // Construct desktop login URL
    const mokuWebUrl = this.getMokuWebUrl();
    const authUrl = `${mokuWebUrl}/login?source=desktop`;

    log.info('[AuthService] Opening browser to:', authUrl);

    // Open system browser
    try {
      await shell.openExternal(authUrl);
      log.info('[AuthService] Browser opened successfully, waiting for callback...');

      // Set waiting flag and timeout
      this.waitingForCallback = true;
      this.callbackTimeout = setTimeout(() => {
        if (this.waitingForCallback) {
          log.warn('[AuthService] Callback timeout - user may have closed browser');
          this.waitingForCallback = false;
        }
      }, CALLBACK_TIMEOUT_MS);
    } catch (error) {
      log.error('[AuthService] Failed to open browser:', error);
      throw new Error('Unable to open browser. Please check your default browser settings.');
    }

    return { authUrl };
  }

  /**
   * Cancel waiting for callback
   */
  private cancelCallback(): void {
    this.waitingForCallback = false;
    if (this.callbackTimeout) {
      clearTimeout(this.callbackTimeout);
      this.callbackTimeout = undefined;
    }
  }

  /**
   * Process OAuth Callback
   * Validates exchange code and completes authentication flow.
   * Called by the deep link handler when OAuth callback is received.
   */
  public async processOAuthCallback(code: string): Promise<AuthState> {
    log.info('[AuthService] Processing OAuth callback with exchange code');

    if (!this.waitingForCallback) {
      log.warn('[AuthService] Received callback but not expecting one');
    }

    // Clear callback timeout
    this.cancelCallback();

    // Exchange code for tokens
    return this.exchangeCodeForTokens(code);
  }

  /**
   * Exchange Code for Tokens
   * Step 1: Exchange code for apiKey
   * Step 2: Exchange apiKey for accessToken
   */
  public async exchangeCodeForTokens(code: string): Promise<AuthState> {
    log.info('[AuthService] Exchanging code for tokens');

    try {
      // Step 1: Exchange code for apiKey via MokuService
      log.info('[AuthService] Step 1: Exchanging code for apiKey');
      const apiKey = await mokuService.exchangeCodeForApiKey(code);
      log.info('[AuthService] Successfully received apiKey');

      // Step 2: Exchange apiKey for accessToken via MokuService
      const { accessToken, expires_in } = await mokuService.exchangeApiKeyForAccessToken(apiKey);

      // Create tokens object
      const tokens: AuthTokens = {
        accessToken,
        apiKey, // Cache for future token refresh
        expiresAt: Date.now() + expires_in * 1000 - 60 * 1000, // 1-minute safety buffer
      };

      // Extract user info from access token (JWT)
      const user = this.extractUserFromToken(accessToken);

      // Store authentication data
      this.storeAuthData(tokens, user);

      log.info('[AuthService] Authentication successful:', user.email);

      return this.currentAuthState;
    } catch (error) {
      log.error('[AuthService] Token exchange failed:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Extract user information from JWT token
   */
  private extractUserFromToken(token: string): UserProfile {
    try {
      // JWT has 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode payload (middle part)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as Record<
        string,
        unknown
      >;

      // Extract user information with type assertions
      const subject = payload.subject as string | undefined;
      const sub = payload.sub as string | undefined;
      const userId = payload.userId as string | undefined;
      const email = payload.email as string | undefined;
      const name = payload.name as string | undefined;
      const username = payload.username as string | undefined;
      const displayName = payload.displayName as string | undefined;
      const picture = payload.picture as string | undefined;
      const organizationId = payload.organizationId as string | undefined;

      // userId might be the email in this API
      const userEmail = email ?? userId;

      // Try multiple possible name fields
      let extractedName = name ?? displayName ?? username;

      // If no name found, use email username part
      if (!extractedName && userEmail) {
        extractedName = userEmail
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      // Final fallback
      extractedName = extractedName ?? 'User';

      if (!organizationId) {
        log.warn('[AuthService] ⚠️  WARNING: organizationId not found in JWT token!');
      }

      return {
        id: sub ?? subject ?? userId ?? 'unknown',
        email: userEmail ?? 'user@example.com',
        name: extractedName,
        picture,
        organizationId,
      };
    } catch (error) {
      log.error('[AuthService] Error extracting user from token:', error);
      // Return minimal user profile if extraction fails
      return {
        id: 'unknown',
        email: 'user@example.com',
        name: 'User',
      };
    }
  }

  /**
   * Refresh Access Token
   * Uses cached apiKey to obtain new access token from Moku API.
   */
  public async refreshAccessToken(): Promise<AuthTokens> {
    // Check if token is still valid
    if (this.isTokenValid()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.currentAuthState.tokens!;
    }

    // Check if we have an apiKey to refresh with
    if (!this.currentAuthState.tokens?.apiKey) {
      log.error('[AuthService] No apiKey available for token refresh');
      throw new Error('Re-authentication required');
    }

    try {
      const apiKey = this.currentAuthState.tokens.apiKey;

      // Use shared token refresh utility
      const { accessToken, expiresAt } = await refreshAccessToken({
        apiKey,
        currentExpiresAt: this.currentAuthState.tokens.expiresAt,
      });

      // Extract user info from the new access token to ensure it's up to date
      const updatedUser = this.extractUserFromToken(accessToken);

      // Update tokens
      const newTokens: AuthTokens = {
        accessToken,
        apiKey, // Keep the same apiKey
        expiresAt,
      };

      // Store updated tokens with updated user profile
      this.storeAuthData(newTokens, updatedUser);

      return newTokens;
    } catch (error) {
      log.error('[AuthService] Token refresh error:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Check if access token is valid
   */
  private isTokenValid(): boolean {
    return (
      this.currentAuthState.tokens !== null && isTokenValid(this.currentAuthState.tokens.expiresAt)
    );
  }

  /**
   * Get current access token, refreshing if needed
   */
  public async getAccessToken(): Promise<string> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    // Check if token needs refresh
    if (!this.isTokenValid()) {
      log.info('[AuthService] Access token expired, refreshing...');
      await this.refreshAccessToken();
    }
    const token = this.currentAuthState.tokens?.accessToken || '';
    const maskedToken = token
      ? `${token.slice(0, 5)}... (${token.length} characters)`
      : '(no token)';
    log.info('[AuthService] Access token:', maskedToken);
    return token;
  }

  /**
   * Store authentication data in secure storage
   */
  private storeAuthData(tokens: AuthTokens, user: UserProfile): void {
    try {
      const encryptionAvailable = safeStorage.isEncryptionAvailable();
      
      if (!encryptionAvailable) {
        log.warn('[AuthService] Encryption not available, storing in plain text (INSECURE)');
      }

      // Store tokens
      const tokensJson = JSON.stringify(tokens);
      let tokensBuffer: Buffer;
      if (encryptionAvailable) {
        tokensBuffer = safeStorage.encryptString(tokensJson);
      } else {
        tokensBuffer = Buffer.from(tokensJson, 'utf-8');
      }
      this.saveToStorage(STORAGE_KEY_TOKENS, tokensBuffer);

      // Store user profile
      const userJson = JSON.stringify(user);
      let userBuffer: Buffer;
      if (encryptionAvailable) {
        userBuffer = safeStorage.encryptString(userJson);
      } else {
        userBuffer = Buffer.from(userJson, 'utf-8');
      }
      this.saveToStorage(STORAGE_KEY_USER, userBuffer);

      // Update in-memory state
      this.currentAuthState = {
        user,
        tokens,
        isAuthenticated: true,
      };
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
    return this.currentAuthState.isAuthenticated && this.currentAuthState.tokens !== null;
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
  public logout(): void {
    log.info('[AuthService] Logging out user:', this.currentAuthState.user?.email);

    // TODO: In production, revoke tokens on server:
    // POST https://moku.holokai.com/api/auth/revoke
    // Body: { apiKey: "..." }

    this.cleanup();
    log.info('[AuthService] Logout complete');
  }

  /**
   * Clean up authentication state
   */
  private cleanup(): void {
    this.clearStoredAuth();
    this.currentAuthState = {
      user: null,
      tokens: null,
      isAuthenticated: false,
    };
  }

  /**
   * Mock Login
   * Simulates complete OAuth flow in one step for testing without browser.
   */
  public async mockLogin(): Promise<AuthState> {
    log.info('[AuthService] Mock login started');

    // Simulate network delay
    await this.delay(1000);

    // Generate mock tokens and user
    const tokens: AuthTokens = {
      accessToken: 'mock_access_token_' + Date.now(),
      apiKey: 'mock_api_key_' + Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
    };

    const user: UserProfile = {
      id: 'mock_user_' + Date.now(),
      email: 'user@example.com',
      name: 'Mock User',
      picture: 'https://via.placeholder.com/150',
    };

    // Store authentication data
    this.storeAuthData(tokens, user);

    log.info('[AuthService] Mock login successful:', user.email);

    return this.currentAuthState;
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
   * Delay helper for simulating async operations
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(storagePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const data = fs.readFileSync(storagePath, 'utf-8');
        storage = JSON.parse(data) as Record<string, string>;
      }

      // Store as base64 string
      // eslint-disable-next-line security/detect-object-injection
      storage[key] = value.toString('base64');

      // Write back to file
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(storagePath, JSON.stringify(storage), 'utf-8');
    } catch (error) {
      log.error('[AuthService] Error saving to storage:', error);
    }
  }

  private getFromStorage(key: string): Buffer | undefined {
    try {
      const storagePath = this.getStoragePath();

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(storagePath)) {
        return undefined;
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const data = fs.readFileSync(storagePath, 'utf-8');
      const storage = JSON.parse(data) as Record<string, string>;

      // eslint-disable-next-line security/detect-object-injection
      const value = storage[key];
      if (value) {
        // eslint-disable-next-line security/detect-object-injection
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

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(storagePath)) {
        return;
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const data = fs.readFileSync(storagePath, 'utf-8');
      const storage = JSON.parse(data) as Record<string, string>;

      const hasKey = key in storage;
      if (hasKey) {
        // Create new object without the key instead of dynamic delete
        const { [key]: _removed, ...rest } = storage;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.writeFileSync(storagePath, JSON.stringify(rest), 'utf-8');
      }
    } catch (error) {
      log.error('[AuthService] Error removing from storage:', error);
    }
  }
}
