import { writable, derived } from 'svelte/store';
import type { UserProfile, AuthState } from '../../../src-electron/preload';

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false
  });

  return {
    subscribe,
    setUser: (user: UserProfile | null) => {
      update(state => ({
        ...state,
        user,
        isAuthenticated: user !== null
      }));
    },
    setAuthState: (authState: AuthState) => {
      set(authState);
    },
    logout: () => {
      set({
        user: null,
        tokens: null,
        isAuthenticated: false
      });
    }
  };
}

export const authStore = createAuthStore();
export const isAuthenticated = derived(authStore, $auth => $auth.isAuthenticated);
export const currentUser = derived(authStore, $auth => $auth.user);
