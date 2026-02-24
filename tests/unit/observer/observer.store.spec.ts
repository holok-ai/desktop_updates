import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  observerStore,
  isTaskRunning,
  getSuggestion,
  hasAnySuggestion,
} from '$lib/observer/observer.store';
import { ObserverTaskType } from '../../../src-shared/types/observer.types';

describe('observer.store', () => {
  beforeEach(() => {
    observerStore.reset();
  });

  describe('setRunning / isTaskRunning', () => {
    it('should mark a task as running', () => {
      observerStore.setRunning('thread-1', ObserverTaskType.RenameTitle, true);
      expect(get(isTaskRunning)('thread-1', ObserverTaskType.RenameTitle)).toBe(true);
    });

    it('should mark a task as not running', () => {
      observerStore.setRunning('thread-1', ObserverTaskType.RenameTitle, true);
      observerStore.setRunning('thread-1', ObserverTaskType.RenameTitle, false);
      expect(get(isTaskRunning)('thread-1', ObserverTaskType.RenameTitle)).toBe(false);
    });

    it('should track multiple tasks per thread independently', () => {
      observerStore.setRunning('thread-1', ObserverTaskType.RenameTitle, true);
      observerStore.setRunning('thread-1', ObserverTaskType.CompressContext, true);

      expect(get(isTaskRunning)('thread-1', ObserverTaskType.RenameTitle)).toBe(true);
      expect(get(isTaskRunning)('thread-1', ObserverTaskType.CompressContext)).toBe(true);
      expect(get(isTaskRunning)('thread-1', ObserverTaskType.SuggestPrompt)).toBe(false);
    });

    it('should return false for unknown threads', () => {
      expect(get(isTaskRunning)('unknown', ObserverTaskType.RenameTitle)).toBe(false);
    });
  });

  describe('setSuggestion / getSuggestion', () => {
    it('should store and retrieve a suggestion', () => {
      observerStore.setSuggestion('thread-1', ObserverTaskType.RenameTitle, 'My Title');
      expect(get(getSuggestion)('thread-1', ObserverTaskType.RenameTitle)).toBe('My Title');
    });

    it('should return undefined for missing suggestions', () => {
      expect(get(getSuggestion)('thread-1', ObserverTaskType.RenameTitle)).toBeUndefined();
    });

    it('should overwrite existing suggestions', () => {
      observerStore.setSuggestion('thread-1', ObserverTaskType.RenameTitle, 'First');
      observerStore.setSuggestion('thread-1', ObserverTaskType.RenameTitle, 'Second');
      expect(get(getSuggestion)('thread-1', ObserverTaskType.RenameTitle)).toBe('Second');
    });
  });

  describe('dismissSuggestion', () => {
    it('should remove a suggestion', () => {
      observerStore.setSuggestion('thread-1', ObserverTaskType.RenameTitle, 'My Title');
      observerStore.dismissSuggestion('thread-1', ObserverTaskType.RenameTitle);
      expect(get(getSuggestion)('thread-1', ObserverTaskType.RenameTitle)).toBeUndefined();
    });
  });

  describe('acceptSuggestion', () => {
    it('should remove a suggestion on accept', () => {
      observerStore.setSuggestion('thread-1', ObserverTaskType.RenameTitle, 'My Title');
      observerStore.acceptSuggestion('thread-1', ObserverTaskType.RenameTitle);
      expect(get(getSuggestion)('thread-1', ObserverTaskType.RenameTitle)).toBeUndefined();
    });
  });

  describe('hasAnySuggestion', () => {
    it('should return false when no suggestions exist', () => {
      expect(get(hasAnySuggestion)('thread-1')).toBe(false);
    });

    it('should return true when a suggestion exists', () => {
      observerStore.setSuggestion('thread-1', ObserverTaskType.RenameTitle, 'Title');
      expect(get(hasAnySuggestion)('thread-1')).toBe(true);
    });

    it('should return false for a different thread', () => {
      observerStore.setSuggestion('thread-1', ObserverTaskType.RenameTitle, 'Title');
      expect(get(hasAnySuggestion)('thread-2')).toBe(false);
    });
  });

  describe('setContextSummary', () => {
    it('should store a context summary', () => {
      const summary = { summary: 'Test summary', keyTopics: ['topic1'] };
      observerStore.setContextSummary('thread-1', summary);
      // Verify via direct store subscription
      let state: any;
      const unsub = observerStore.subscribe((s) => {
        state = s;
      });
      expect(state.contextSummaries.get('thread-1')).toEqual(summary);
      unsub();
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      observerStore.setRunning('thread-1', ObserverTaskType.RenameTitle, true);
      observerStore.setSuggestion('thread-1', ObserverTaskType.RenameTitle, 'Title');
      observerStore.setContextSummary('thread-1', { summary: 'test' });

      observerStore.reset();

      expect(get(isTaskRunning)('thread-1', ObserverTaskType.RenameTitle)).toBe(false);
      expect(get(getSuggestion)('thread-1', ObserverTaskType.RenameTitle)).toBeUndefined();
      expect(get(hasAnySuggestion)('thread-1')).toBe(false);
    });
  });
});
