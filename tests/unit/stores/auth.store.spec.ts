import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { authStore, isAuthenticated, currentUser } from '$lib/stores/auth.store';
import type { AuthState, UserProfile } from 'src-electron/preload';

describe('auth.store', () => {
  beforeEach(() => {
    const initial: AuthState = { user: null, tokens: null, isAuthenticated: false };
    authStore.setAuthState(initial);
  });

  it('starts unauthenticated by default', () => {
    expect(get(isAuthenticated)).toBe(false);
    expect(get(currentUser)).toBeNull();
  });

  it('setUser sets user and updates isAuthenticated', () => {
    const user: UserProfile = { id: '1', email: 'a@b.com', name: 'A', provider: 'oauth2' };
    authStore.setUser(user);
    expect(get(isAuthenticated)).toBe(true);
    expect(get(currentUser)).toEqual(user);
  });

  it('logout clears user and sets isAuthenticated=false', () => {
    const user: UserProfile = { id: '1', email: 'a@b.com', name: 'A', provider: 'oauth2' };
    authStore.setUser(user);
    authStore.logout();
    expect(get(isAuthenticated)).toBe(false);
    expect(get(currentUser)).toBeNull();
  });

  it('setAuthState replaces the entire state', () => {
    const state: AuthState = { user: null, tokens: null, isAuthenticated: true };
    authStore.setAuthState(state);
    expect(get(isAuthenticated)).toBe(true);
    expect(get(currentUser)).toBeNull();
  });
});
