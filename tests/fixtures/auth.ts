import type { AuthState, UserProfile, AuthTokens } from 'src-electron/preload';

export const testUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-' + Date.now(),
  email: 'user@example.com',
  name: 'Test User',
  ...overrides,
});

export const testTokens = (overrides: Partial<AuthTokens> = {}): AuthTokens => ({
  accessToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    btoa(
      JSON.stringify({
        sub: 'user-id',
        email: 'user@example.com',
        name: 'Test User',
      }),
    ) +
    '.signature',
  apiKey: 'api_' + Math.random().toString(36).slice(2),
  expiresAt: Date.now() + 60 * 60 * 1000,
  ...overrides,
});

export const authenticatedState = (overrides: Partial<AuthState> = {}): AuthState => ({
  user: testUser(),
  tokens: testTokens(),
  isAuthenticated: true,
  ...overrides,
});

export const unauthenticatedState = (): AuthState => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
});
