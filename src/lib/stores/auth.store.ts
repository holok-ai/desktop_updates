import { writable, derived } from 'svelte/store';
import type { UserProfile, AuthState } from '../../../src-electron/preload';

interface AuthStore {
  subscribe: (run: (value: AuthState) => void) => () => void;
  setUser: (user: UserProfile | null) => void;
  setAuthState: (authState: AuthState) => void;
  logout: () => void;
}

function createAuthStore(): AuthStore {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
  });

  return {
    subscribe,
    setUser: (user: UserProfile | null): void => {
      update((state) => ({
        ...state,
        user,
        isAuthenticated: user !== null,
      }));
    },
    setAuthState: (authState: AuthState): void => {
      set(authState);
    },
    logout: (): void => {
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
      });
    },
  };
}

export const authStore = createAuthStore();
export const isAuthenticated = derived(authStore, ($auth) => $auth.isAuthenticated);
export const currentUser = derived(authStore, ($auth) => $auth.user);
