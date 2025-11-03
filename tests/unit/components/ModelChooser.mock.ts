export default class MockModelChooser {
  target: HTMLElement;
  props: Record<string, unknown> | undefined;
  _confirmCb: ((e: CustomEvent) => void) | null = null;
  selectEl: HTMLSelectElement | null = null;

  constructor(opts: { target: HTMLElement; props?: Record<string, unknown> }) {
    this.target = opts.target;
    this.props = opts.props;

    const container = document.createElement('div');
    container.innerHTML =
      '<select id="model-select"><option value="">-- Select a model --</option></select><button class="confirm">Use</button>';
    this.target.appendChild(container);

    this.selectEl = container.querySelector('select#model-select');
    const btn = container.querySelector('button.confirm') as HTMLButtonElement;

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const models = await (globalThis as any).electronAPI.models.listAvailable();
        if (this.selectEl && Array.isArray(models)) {
          let firstSelected: { provider: string; id: string } | null = null;
          for (const m of models) {
            const opt = document.createElement('option');
            opt.value = `${m.provider}::${m.id}`;
            opt.textContent = `${m.name} — ${m.provider}`;
            if ((m as any).default) {
              opt.selected = true;
              firstSelected = { provider: m.provider, id: m.id };
            }
            this.selectEl.appendChild(opt);
          }
          // ensure select value and current selection reflect default
          if (firstSelected) {
            this.selectEl.value = `${firstSelected.provider}::${firstSelected.id}`;
            // store on instance for click handler
            (this as any)._current = firstSelected;
          }
        }
      } catch {
        // ignore
      }
    })();

    // keep track of current selection
    (this as any)._current = (this as any)._current ?? null;
    this.selectEl?.addEventListener('change', () => {
      const v = this.selectEl?.value ?? '';
      if (v) {
        const [prov, id] = v.split('::');
        (this as any)._current = { provider: prov, id };
      } else (this as any)._current = null;
    });

    btn.addEventListener('click', () => {
      if (this._confirmCb) this._confirmCb({ detail: (this as any)._current } as CustomEvent);
    });
  }

  $on(eventName: string, cb: (e: CustomEvent) => void) {
    if (eventName === 'confirm') this._confirmCb = cb;
    return () => {
      if (eventName === 'confirm') this._confirmCb = null;
    };
  }

  $destroy() {
    if (this.target && this.target.firstChild) this.target.removeChild(this.target.firstChild);
  }
}
