/**
 * Mock for SuggestedText.svelte component
 *
 * Mirrors the component's DOM structure and behavior for unit testing
 * in jsdom without requiring the Svelte compiler plugin.
 */
export interface SuggestedTextProps {
  suggestion: string;
  onKeep: () => void;
  onDiscard: () => void;
  autoAcceptMs?: number;
}

export default class MockSuggestedText {
  target: HTMLElement;
  props: SuggestedTextProps;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private timeRemaining = 0;
  private container: HTMLElement;
  private countdownEl: HTMLElement | null = null;

  constructor(opts: { target: HTMLElement; props: SuggestedTextProps }) {
    this.target = opts.target;
    this.props = opts.props;

    this.container = document.createElement('div');
    this.container.className = 'suggested-text';
    this.render();
    this.target.appendChild(this.container);

    // Wire auto-accept timer
    if (this.props.autoAcceptMs && this.props.autoAcceptMs > 0) {
      this.timeRemaining = Math.ceil(this.props.autoAcceptMs / 1000);
      this.updateCountdown();
      this.timerId = setInterval(() => {
        this.timeRemaining -= 1;
        this.updateCountdown();
        if (this.timeRemaining <= 0) {
          this.clearTimer();
          this.props.onKeep();
        }
      }, 1000);
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <span class="suggestion-label">${this.props.suggestion}</span>
      <div class="suggestion-actions">
        <button class="suggestion-btn keep" aria-label="Keep suggestion"></button>
        <button class="suggestion-btn discard" aria-label="Discard suggestion"></button>
      </div>
    `;

    const keepBtn = this.container.querySelector('.suggestion-btn.keep') as HTMLButtonElement;
    const discardBtn = this.container.querySelector('.suggestion-btn.discard') as HTMLButtonElement;

    keepBtn.addEventListener('click', () => {
      this.clearTimer();
      this.props.onKeep();
    });

    discardBtn.addEventListener('click', () => {
      this.clearTimer();
      this.props.onDiscard();
    });
  }

  private updateCountdown(): void {
    if (this.timeRemaining > 0) {
      if (!this.countdownEl) {
        this.countdownEl = document.createElement('span');
        this.countdownEl.className = 'auto-accept-countdown';
        const actions = this.container.querySelector('.suggestion-actions');
        actions?.appendChild(this.countdownEl);
      }
      this.countdownEl.textContent = `${this.timeRemaining}s`;
    } else if (this.countdownEl) {
      this.countdownEl.remove();
      this.countdownEl = null;
    }
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  getTimeRemaining(): number {
    return this.timeRemaining;
  }

  $destroy(): void {
    this.clearTimer();
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
