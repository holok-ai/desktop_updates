import { safeStorage, app, shell } from 'electron';
import log from 'electron-log';
import { getSettingsService } from '../ipc-handlers/settings-handler';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Authentication Service
 * Handles OAuth 2.0 with PKCE authentication flow including:
 * - OAuth flow initiation with PKCE
 * - Token storage using Electron's safeStorage (encrypted)
 * - User session management
 * - Token refresh
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
 * OAuth Configuration Constants
 */
const CLIENT_ID = 'holokai-desktop-app';
const REDIRECT_URI = 'holokai://home';
const PKCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Storage keys for secure storage
 */
const STORAGE_KEY_TOKENS = 'holokai.auth.tokens';
const STORAGE_KEY_USER = 'holokai.auth.user';

/**
 * PKCE State Storage Interface
 */
interface PKCEState {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  timestamp: number;
}

export class AuthService {
  private currentAuthState: AuthState = {
    user: null,
    tokens: null,
    isAuthenticated: false
  };

  // In-memory PKCE storage with timeout
  private pkceStorage: Map<string, PKCEState> = new Map();

  constructor() {
    // Load stored auth data on initialization
    this.loadStoredAuth();
    log.info('[AuthService] Initialized');

    // Clean up expired PKCE states every minute
    setInterval(() => this.cleanupExpiredPKCE(), 60000);
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
   * Start OAuth Flow
   * Generates PKCE parameters, stores them in memory, and opens browser to authorization URL.
   * Returns the authorization URL that was opened.
   */
  public async startOAuthFlow(): Promise<{ authUrl: string; mockData?: any }> {
    log.info('[AuthService] Starting OAuth flow');

    // Generate PKCE parameters
    const state = this.generateState();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store PKCE state in memory with timeout
    const pkceState: PKCEState = {
      codeVerifier,
      codeChallenge,
      state,
      timestamp: Date.now()
    };
    this.pkceStorage.set(state, pkceState);

    // Schedule cleanup after timeout
    setTimeout(() => {
      if (this.pkceStorage.has(state)) {
        log.warn('[AuthService] PKCE state expired:', state);
        this.pkceStorage.delete(state);
      }
    }, PKCE_TIMEOUT_MS);

    // Construct authorization URL
    const mokuWebUrl = this.getMokuWebUrl();
    const authUrl = `${mokuWebUrl}/api/oauth/authorize?` +
      `client_id=${encodeURIComponent(CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `code_challenge=${encodeURIComponent(codeChallenge)}&` +
      `code_challenge_method=S256&` +
      `state=${encodeURIComponent(state)}&` +
      `response_type=code&` +
      `scope=read%20write`;

    log.info('[AuthService] Opening browser to:', authUrl);

    // Open system browser
    try {
      await shell.openExternal(authUrl);
      log.info('[AuthService] Browser opened successfully, waiting for callback...');
    } catch (error) {
      log.error('[AuthService] Failed to open browser:', error);
      this.pkceStorage.delete(state);
      throw new Error('Unable to open browser. Please check your default browser settings.');
    }

    return { authUrl };
  }

  /**
   * Process OAuth Callback
   * Validates state, retrieves PKCE parameters, and exchanges code for tokens.
   * Called by the deep link handler when OAuth callback is received.
   */
  public async processOAuthCallback(code: string, state: string): Promise<AuthState> {
    log.info('[AuthService] Processing OAuth callback');

    // Validate state and retrieve PKCE parameters
    const pkceState = this.pkceStorage.get(state);

    if (!pkceState) {
      log.error('[AuthService] State not found or expired');
      throw new Error('State not found or expired. Please try logging in again.');
    }

    // Verify state matches (CSRF protection)
    if (pkceState.state !== state) {
      log.error('[AuthService] State mismatch - possible CSRF attack');
      this.pkceStorage.delete(state);
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Delete state after verification (one-time use)
    this.pkceStorage.delete(state);

    // Exchange code for tokens
    return this.exchangeCodeForTokens(code, pkceState.codeVerifier);
  }

  /**
   * Exchange Authorization Code for Tokens
   * Makes API call to Moku server to exchange authorization code for access and refresh tokens.
   * Currently mocked - will need HTTP client implementation for production.
   */
  public async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<AuthState> {
    log.info('[AuthService] Exchanging authorization code for tokens');

    // TODO: Replace with real API call
    // const mokuApiUrl = this.getMokuApiUrl();
    // const response = await fetch(`${mokuApiUrl}/api/oauth/token`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     grant_type: 'authorization_code',
    //     code,
    //     client_id: CLIENT_ID,
    //     code_verifier: codeVerifier,
    //     redirect_uri: REDIRECT_URI
    //   })
    // });

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
   * Mock Login
   * Simulates complete OAuth flow in one step for testing without browser.
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
   * Refresh Access Token
   * Uses refresh token to obtain new access token from Moku API.
   * Currently mocked - will need HTTP client implementation for production.
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
   * Clean up expired PKCE states from memory
   */
  private cleanupExpiredPKCE(): void {
    const now = Date.now();
    const expiredStates: string[] = [];

    this.pkceStorage.forEach((pkceState, state) => {
      if (now - pkceState.timestamp > PKCE_TIMEOUT_MS) {
        expiredStates.push(state);
      }
    });

    expiredStates.forEach(state => {
      log.debug('[AuthService] Cleaning up expired PKCE state:', state);
      this.pkceStorage.delete(state);
    });

    if (expiredStates.length > 0) {
      log.info(`[AuthService] Cleaned up ${expiredStates.length} expired PKCE states`);
    }
  }

  /**
   * Clear all stored authentication data
   */
  private clearStoredAuth(): void {
    this.removeFromStorage(STORAGE_KEY_TOKENS);
    this.removeFromStorage(STORAGE_KEY_USER);
  }

  /**
   * Generate State Parameter
   * Creates random state value for CSRF protection (32 bytes as hex).
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate PKCE Code Verifier
   * Creates cryptographically random verifier (32+ bytes, base64url encoded).
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE Code Challenge
   * Creates SHA-256 hash of verifier, base64url encoded.
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return hash.toString('base64url');
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
