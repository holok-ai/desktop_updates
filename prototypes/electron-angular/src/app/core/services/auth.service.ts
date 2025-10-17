import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ElectronService } from './electron.service';
import { AuthState, UserProfile } from '../../../../src-electron/preload';

/**
 * Authentication Service (Renderer Process)
 * 
 * This service provides authentication functionality to Angular components.
 * It communicates with the main process AuthService via IPC for all
 * authentication operations.
 * 
 * Implements SSO flow from options-comparison-sso.md Option 1:
 * Step 1-2: Initiate OAuth by redirecting to Moku web
 * Step 3-4: User authenticates on Moku web (handled by browser)
 * Step 5: Exchange code for tokens (handled by main process)
 * 
 * Key Features:
 * - Type-safe IPC communication
 * - Reactive state management with RxJS
 * - Secure: tokens never exposed to renderer
 * - Mock login for development/testing
 * 
 * Architecture Pattern:
 * Component -> AuthService -> ElectronService -> Context Bridge -> IPC -> Main Process AuthService
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // State management using BehaviorSubject for reactive updates
  private authStateSubject = new BehaviorSubject<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false
  });
  public authState$ = this.authStateSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  constructor(private electronService: ElectronService) {
    // Load initial auth state from main process
    this.loadAuthState();
  }

  /**
   * Load authentication state from main process
   * Called on service initialization
   */
  private async loadAuthState(): Promise<void> {
    if (!this.electronService.isElectron) {
      console.warn('[AuthService] Not in Electron, skipping auth state load');
      return;
    }

    try {
      const authState = await this.electronService.api.auth.getAuthState();
      this.authStateSubject.next(authState);
      
      if (authState.isAuthenticated && authState.user) {
        console.log('[AuthService] User already authenticated:', authState.user.email);
      }
    } catch (error) {
      console.error('[AuthService] Error loading auth state:', error);
    }
  }

  /**
   * Step 1-2: Start OAuth flow
   * Opens system browser to Moku web SSO page
   * 
   * In production, this would:
   * 1. Open browser to: https://moku.holokai.com/auth/desktop?redirect_uri=holokai://callback
   * 2. User selects provider (Microsoft, Google, OAuth2.0) and authenticates
   * 3. Moku web redirects to: holokai://callback?code=XXXX&state=YYYY
   * 4. Custom protocol handler captures the code
   * 5. Desktop calls exchangeCode() to complete authentication
   * 
   * For this mock, it returns the URL that would be opened
   */
  public async startOAuthFlow(): Promise<{ authUrl: string }> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      const result = await this.electronService.api.auth.startOAuthFlow();
      
      console.log('[AuthService] OAuth flow started');
      console.log('[AuthService] In production, browser would open to:', result.authUrl);
      
      // In production, the browser opens automatically via shell.openExternal()
      // and the app waits for the custom protocol callback
      
      return result;
    } catch (error) {
      console.error('[AuthService] Error starting OAuth flow:', error);
      this.errorSubject.next('Failed to start authentication');
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Step 5: Exchange authorization code for tokens
   * Called after OAuth callback with authorization code
   * 
   * In production, this is called by the custom protocol handler
   * after catching the redirect from Moku web
   */
  public async exchangeCode(code: string, codeVerifier: string): Promise<void> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      const authState = await this.electronService.api.auth.exchangeCode(code, codeVerifier);
      this.authStateSubject.next(authState);

      console.log('[AuthService] Authentication successful:', authState.user?.email);
    } catch (error) {
      console.error('[AuthService] Error exchanging code:', error);
      this.errorSubject.next('Authentication failed');
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Mock login for testing without full OAuth flow
   * Simulates the complete authentication process
   * 
   * In production, this method would NOT exist.
   * It's only for development/testing purposes.
   */
  public async mockLogin(provider: 'microsoft' | 'google' | 'oauth2' = 'microsoft'): Promise<void> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      console.log('[AuthService] Mock login started for provider:', provider);

      const authState = await this.electronService.api.auth.mockLogin(provider);
      this.authStateSubject.next(authState);

      console.log('[AuthService] Mock login successful:', authState.user?.email);
    } catch (error) {
      console.error('[AuthService] Mock login error:', error);
      this.errorSubject.next('Mock login failed');
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Logout user
   * Clears authentication state and stored tokens
   */
  public async logout(): Promise<void> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      await this.electronService.api.auth.logout();

      // Update local state
      this.authStateSubject.next({
        user: null,
        tokens: null,
        isAuthenticated: false
      });

      console.log('[AuthService] Logout successful');
    } catch (error) {
      console.error('[AuthService] Logout error:', error);
      this.errorSubject.next('Logout failed');
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Refresh access token
   * Uses stored refresh token to get new access token
   */
  public async refreshToken(): Promise<void> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    try {
      await this.electronService.api.auth.refreshToken();
      
      // Reload auth state after refresh
      await this.loadAuthState();
      
      console.log('[AuthService] Token refresh successful');
    } catch (error) {
      console.error('[AuthService] Token refresh error:', error);
      
      // If refresh fails, logout user
      await this.logout();
      
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    if (!this.electronService.isElectron) {
      return false;
    }

    try {
      return await this.electronService.api.auth.isAuthenticated();
    } catch (error) {
      console.error('[AuthService] Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Get current user profile
   */
  public async getUser(): Promise<UserProfile | null> {
    if (!this.electronService.isElectron) {
      return null;
    }

    try {
      return await this.electronService.api.auth.getUser();
    } catch (error) {
      console.error('[AuthService] Error getting user:', error);
      return null;
    }
  }

  /**
   * Get current auth state (synchronous from local cache)
   */
  public getCurrentAuthState(): AuthState {
    return this.authStateSubject.value;
  }

  /**
   * Observable of current user
   */
  public get currentUser$(): Observable<UserProfile | null> {
    return new BehaviorSubject(this.authStateSubject.value.user).asObservable();
  }

  /**
   * Observable of authentication status
   */
  public get isAuthenticated$(): Observable<boolean> {
    return new BehaviorSubject(this.authStateSubject.value.isAuthenticated).asObservable();
  }
}
