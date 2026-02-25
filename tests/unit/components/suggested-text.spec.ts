/**
 * SuggestedText Component Tests
 *
 * Tests the SuggestedText component's behavior using a mock class
 * (same approach as ModelChooser tests — avoids Svelte compiler in vitest).
 *
 * Tests cover:
 * - Rendering suggestion text
 * - Keep button calls onKeep and clears timer
 * - Discard button calls onDiscard and clears timer
 * - Auto-accept timer fires onKeep after specified delay
 * - Timer is cleared on manual action
 * - Countdown display
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MockSuggestedText from './SuggestedText.mock';

function mount(props: Partial<ConstructorParameters<typeof MockSuggestedText>[0]['props']> = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);

  const fullProps = {
    suggestion: 'AI Generated Title',
    onKeep: vi.fn(),
    onDiscard: vi.fn(),
    ...props,
  };

  const comp = new MockSuggestedText({ target, props: fullProps });
  return { comp, target, props: fullProps };
}

describe('SuggestedText component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('displays the suggestion text', () => {
      const { target, comp } = mount({ suggestion: 'My Suggested Title' });

      const label = target.querySelector('.suggestion-label');
      expect(label).toBeTruthy();
      expect(label!.textContent).toBe('My Suggested Title');

      comp.$destroy();
    });

    it('renders keep and discard buttons', () => {
      const { target, comp } = mount();

      const keepBtn = target.querySelector('.suggestion-btn.keep');
      const discardBtn = target.querySelector('.suggestion-btn.discard');
      expect(keepBtn).toBeTruthy();
      expect(discardBtn).toBeTruthy();
      expect(keepBtn!.getAttribute('aria-label')).toBe('Keep suggestion');
      expect(discardBtn!.getAttribute('aria-label')).toBe('Discard suggestion');

      comp.$destroy();
    });

    it('does not show countdown when autoAcceptMs is 0', () => {
      const { target, comp } = mount({ autoAcceptMs: 0 });

      const countdown = target.querySelector('.auto-accept-countdown');
      expect(countdown).toBeNull();

      comp.$destroy();
    });

    it('shows countdown when autoAcceptMs is set', () => {
      const { target, comp } = mount({ autoAcceptMs: 15000 });

      const countdown = target.querySelector('.auto-accept-countdown');
      expect(countdown).toBeTruthy();
      expect(countdown!.textContent).toBe('15s');

      comp.$destroy();
    });
  });

  describe('keep action', () => {
    it('calls onKeep when keep button is clicked', () => {
      const { target, props, comp } = mount();

      const keepBtn = target.querySelector('.suggestion-btn.keep') as HTMLButtonElement;
      keepBtn.click();

      expect(props.onKeep).toHaveBeenCalledOnce();
      expect(props.onDiscard).not.toHaveBeenCalled();

      comp.$destroy();
    });

    it('clears the auto-accept timer on keep', () => {
      const { target, props, comp } = mount({ autoAcceptMs: 10000 });

      const keepBtn = target.querySelector('.suggestion-btn.keep') as HTMLButtonElement;
      keepBtn.click();

      expect(props.onKeep).toHaveBeenCalledOnce();

      // Advance time past the auto-accept — should NOT call onKeep again
      vi.advanceTimersByTime(15000);
      expect(props.onKeep).toHaveBeenCalledOnce();

      comp.$destroy();
    });
  });

  describe('discard action', () => {
    it('calls onDiscard when discard button is clicked', () => {
      const { target, props, comp } = mount();

      const discardBtn = target.querySelector('.suggestion-btn.discard') as HTMLButtonElement;
      discardBtn.click();

      expect(props.onDiscard).toHaveBeenCalledOnce();
      expect(props.onKeep).not.toHaveBeenCalled();

      comp.$destroy();
    });

    it('clears the auto-accept timer on discard', () => {
      const { target, props, comp } = mount({ autoAcceptMs: 10000 });

      const discardBtn = target.querySelector('.suggestion-btn.discard') as HTMLButtonElement;
      discardBtn.click();

      expect(props.onDiscard).toHaveBeenCalledOnce();

      // Advance time past the auto-accept — should NOT call onKeep
      vi.advanceTimersByTime(15000);
      expect(props.onKeep).not.toHaveBeenCalled();

      comp.$destroy();
    });
  });

  describe('auto-accept timer', () => {
    it('calls onKeep after autoAcceptMs elapses', () => {
      const { props, comp } = mount({ autoAcceptMs: 5000 });

      expect(props.onKeep).not.toHaveBeenCalled();

      // Advance to just before expiry
      vi.advanceTimersByTime(4000);
      expect(props.onKeep).not.toHaveBeenCalled();

      // Advance to expiry
      vi.advanceTimersByTime(1000);
      expect(props.onKeep).toHaveBeenCalledOnce();

      comp.$destroy();
    });

    it('updates countdown display as time passes', () => {
      const { target, comp } = mount({ autoAcceptMs: 3000 });

      const countdown = () => target.querySelector('.auto-accept-countdown');

      expect(countdown()!.textContent).toBe('3s');

      vi.advanceTimersByTime(1000);
      expect(countdown()!.textContent).toBe('2s');

      vi.advanceTimersByTime(1000);
      expect(countdown()!.textContent).toBe('1s');

      comp.$destroy();
    });

    it('does not start timer when autoAcceptMs is undefined', () => {
      const { props, comp } = mount();

      vi.advanceTimersByTime(30000);
      expect(props.onKeep).not.toHaveBeenCalled();

      comp.$destroy();
    });

    it('calls onKeep exactly once when timer expires', () => {
      const { props, comp } = mount({ autoAcceptMs: 2000 });

      vi.advanceTimersByTime(5000);
      expect(props.onKeep).toHaveBeenCalledOnce();

      comp.$destroy();
    });
  });

  describe('cleanup', () => {
    it('removes the DOM element on $destroy', () => {
      const { target, comp } = mount();

      expect(target.querySelector('.suggested-text')).toBeTruthy();

      comp.$destroy();

      expect(target.querySelector('.suggested-text')).toBeNull();
    });

    it('clears the timer on $destroy', () => {
      const { props, comp } = mount({ autoAcceptMs: 5000 });

      comp.$destroy();

      vi.advanceTimersByTime(10000);
      expect(props.onKeep).not.toHaveBeenCalled();
    });
  });
});
