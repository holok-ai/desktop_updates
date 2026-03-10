/**
 * Svelte action that traps keyboard focus within a dialog element.
 *
 * Handles three concerns:
 * 1. **Initial focus** — moves focus to the first focusable element inside
 *    the node (unless focus is already inside, e.g. from a `use:focus` directive).
 * 2. **Tab cycling** — pressing Tab on the last element wraps to the first;
 *    Shift+Tab on the first wraps to the last.
 * 3. **Focus restoration** — on destroy, returns focus to the element that was
 *    focused before the trap was activated.
 *
 * Usage:
 *   <div class="dialog" use:focusTrap>
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function focusTrap(node: HTMLElement): { destroy: () => void } {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  function getFocusableElements(): HTMLElement[] {
    return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null,
    );
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') {
      return;
    }

    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      return;
    }

    const [first] = focusable;
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Set initial focus — defer so that use:focus directives on children run first
  requestAnimationFrame(() => {
    // If focus is already inside (e.g. from use:focus on an input), leave it
    if (node.contains(document.activeElement) && document.activeElement !== node) {
      return;
    }

    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  });

  node.addEventListener('keydown', handleKeydown);

  return {
    destroy(): void {
      node.removeEventListener('keydown', handleKeydown);
      previouslyFocused?.focus();
    },
  };
}
