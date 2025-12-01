import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  navigationGuard,
  setUnsavedChanges,
  clearUnsavedChanges,
  confirmNavigation,
  registerDiscardCallback,
} from '../../../src/lib/stores/navigation-guard.store';

describe('navigation-guard.store', () => {
  beforeEach(() => {
    // Clear state before each test
    clearUnsavedChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setUnsavedChanges', () => {
    it('sets dirty state when isDirty is true', () => {
      setUnsavedChanges('add-thread', true);
      const state = get(navigationGuard);
      expect(state.isDirty).toBe(true);
      expect(state.context).toBe('add-thread');
    });

    it('clears dirty state when isDirty is false and context matches', () => {
      setUnsavedChanges('add-thread', true);
      setUnsavedChanges('add-thread', false);
      const state = get(navigationGuard);
      expect(state.isDirty).toBe(false);
      expect(state.context).toBeNull();
    });
  });

  describe('clearUnsavedChanges', () => {
    it('clears all dirty state when no context provided', () => {
      setUnsavedChanges('add-thread', true);
      clearUnsavedChanges();
      const state = get(navigationGuard);
      expect(state.isDirty).toBe(false);
    });

    it('clears dirty state for matching context', () => {
      setUnsavedChanges('add-thread', true);
      clearUnsavedChanges('add-thread');
      const state = get(navigationGuard);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('confirmNavigation', () => {
    it('returns true when not dirty', () => {
      const result = confirmNavigation();
      expect(result).toBe(true);
    });

    it('returns false (stay on page) when user clicks OK', () => {
      setUnsavedChanges('add-thread', true);
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );

      const result = confirmNavigation();
      expect(result).toBe(false); // User wants to stay
    });

    it('returns true (navigate away) when user clicks Cancel', () => {
      setUnsavedChanges('add-thread', true);
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );

      const result = confirmNavigation();
      expect(result).toBe(true); // User wants to discard and navigate

      // Guard state should be cleared
      const state = get(navigationGuard);
      expect(state.isDirty).toBe(false);
    });

    it('calls registered discard callback when user clicks Cancel', () => {
      const cleanupFn = vi.fn();
      const unregister = registerDiscardCallback('add-thread', cleanupFn);

      setUnsavedChanges('add-thread', true);
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );

      confirmNavigation();

      expect(cleanupFn).toHaveBeenCalledOnce();
      unregister();
    });

    it('does not call discard callback when user clicks OK', () => {
      const cleanupFn = vi.fn();
      const unregister = registerDiscardCallback('add-thread', cleanupFn);

      setUnsavedChanges('add-thread', true);
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );

      confirmNavigation();

      expect(cleanupFn).not.toHaveBeenCalled();
      unregister();
    });
  });

  describe('registerDiscardCallback', () => {
    it('registers a callback that can be unregistered', () => {
      const cleanupFn = vi.fn();
      const unregister = registerDiscardCallback('add-thread', cleanupFn);

      setUnsavedChanges('add-thread', true);
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );

      // Unregister before navigating
      unregister();
      confirmNavigation();

      // Callback should not be called after unregistering
      expect(cleanupFn).not.toHaveBeenCalled();
    });

    it('handles multiple registrations with only latest callback', () => {
      const cleanupFn1 = vi.fn();
      const cleanupFn2 = vi.fn();

      registerDiscardCallback('add-thread', cleanupFn1);
      registerDiscardCallback('add-thread', cleanupFn2);

      setUnsavedChanges('add-thread', true);
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );

      confirmNavigation();

      // Only the latest callback should be called
      expect(cleanupFn1).not.toHaveBeenCalled();
      expect(cleanupFn2).toHaveBeenCalledOnce();
    });
  });
});
