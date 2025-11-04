import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import ModelChooser from './ModelChooser.mock';

function mount(props = {}) {
  // mount into document body
  const target = document.createElement('div');
  document.body.appendChild(target);
  const comp: any = new ModelChooser({ target, props });
  return { comp, target };
}

describe('ModelChooser accessibility and behavior', () => {
  const mockModels = [
    {
      provider: 'openai',
      id: 'gpt-4o',
      name: 'GPT-4o',
      available: true,
      default: true,
      createdAt: Date.now(),
    },
    {
      provider: 'openai',
      id: 'gpt-4o-mini',
      name: 'GPT-4o-mini',
      available: true,
      createdAt: Date.now(),
    },
  ];

  beforeEach(() => {
    // Provide a minimal electronAPI for the component to call
    (globalThis as any).window = globalThis.window ?? globalThis;
    (globalThis as any).electronAPI = {
      models: {
        listAvailable: vi.fn(() => Promise.resolve(mockModels)),
      },
    };
  });

  afterEach(() => {
    // cleanup DOM
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders select with options and default selection', async () => {
    const { comp, target } = mount();
    // wait for async onMount to fetch models
    await Promise.resolve();
    await Promise.resolve();

    const select = target.querySelector('select#model-select') as HTMLSelectElement | null;
    expect(select).toBeTruthy();
    const options = select?.querySelectorAll('option') ?? [];
    // one placeholder + two models = 3 options
    expect(options.length).toBe(3);

    // default selection should be the model marked default
    expect(select.value).toBe('openai::gpt-4o');

    comp.$destroy();
  });

  it('emits confirm event with selected model when Use clicked', async () => {
    const { comp, target } = mount();
    // wait for fetch
    await Promise.resolve();
    await Promise.resolve();

    const called: unknown[] = [];
    comp.$on('confirm', (e: CustomEvent) => called.push(e.detail));

    const btn = target.querySelector('button.confirm') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();

    // ensure handler called with model object
    expect(called.length).toBe(1);
    // detail should have provider and id
    expect((called[0] as any).id).toBe('gpt-4o');

    comp.$destroy();
  });
});
