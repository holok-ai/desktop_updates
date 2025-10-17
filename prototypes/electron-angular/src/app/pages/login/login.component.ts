import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService } from '../../core/services/auth.service';

/**
 * Login Component
 * 
 * Demonstrates the SSO authentication flow from options-comparison-sso.md Option 1:
 * 
 * User Journey:
 * 1. User sees this login screen with provider options
 * 2. User clicks "Sign in with [Provider]"
 * 3. System browser opens to Moku web SSO page
 * 4. User authenticates with selected provider
 * 5. Moku web redirects back to desktop app
 * 6. Desktop app exchanges code for tokens
 * 7. User is redirected to home page
 * 
 * For development, includes a "Mock Login" button to simulate
 * the complete flow without requiring Moku web.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    MessageModule,
    ProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loading$ = this.authService.loading$;
  error$ = this.authService.error$;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Check if already authenticated
    this.checkAuth();
  }

  /**
   * Check if user is already authenticated
   * If so, redirect to home
   */
  private async checkAuth(): Promise<void> {
    const isAuthenticated = await this.authService.isAuthenticated();
    if (isAuthenticated) {
      this.router.navigate(['/home']);
    }
  }

  /**
   * Start OAuth flow (Production method)
   * Opens system browser to Moku web SSO page
   * 
   * Steps 1-2 of SSO flow:
   * - Constructs URL to Moku web SSO endpoint
   * - Opens system browser
   * - User authenticates on Moku web
   * - Moku web redirects to custom protocol (holokai://callback)
   * - Custom protocol handler calls authService.exchangeCode()
   */
  async onStartOAuthFlow(): Promise<void> {
    try {
      const result = await this.authService.startOAuthFlow();
      
      console.log('='.repeat(80));
      console.log('MOCK AUTHENTICATION FLOW STARTED');
      console.log('='.repeat(80));
      console.log('In production, the system browser would open to:');
      console.log(result.authUrl);
      console.log('');
      console.log('User would:');
      console.log('1. See Moku web SSO page with provider options');
      console.log('2. Click their preferred provider (Microsoft, Google, etc.)');
      console.log('3. Complete authentication with that provider');
      console.log('4. Get redirected back to desktop app via: holokai://callback?code=XXX');
      console.log('5. Desktop app exchanges code for tokens');
      console.log('6. User is logged in!');
      console.log('='.repeat(80));
      console.log('');
      console.log('For now, use "Mock Login" button to simulate this flow.');
      console.log('');
    } catch (error) {
      console.error('OAuth flow error:', error);
    }
  }

  /**
   * Mock login (Development/Testing only)
   * Simulates the complete OAuth flow without requiring Moku web
   * 
   * In production, this button would NOT exist.
   */
  async onMockLogin(provider: 'microsoft' | 'google' | 'oauth2'): Promise<void> {
    try {
      await this.authService.mockLogin(provider);
      
      // Redirect to home after successful login
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Mock login error:', error);
    }
  }
}
